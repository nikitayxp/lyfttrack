const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const owner = '00000000-0000-0000-0000-000000000001';
const copier = '00000000-0000-0000-0000-000000000002';
const secondCopier = '00000000-0000-0000-0000-000000000003';
const source = '10000000-0000-0000-0000-000000000001';
const catalog = '10000000-0000-0000-0000-000000000002';
const own = '10000000-0000-0000-0000-000000000003';
const migrationDir = path.resolve(__dirname, '../../supabase/migrations');
const repairPath = path.join(migrationDir, '20261027090100_repair_copied_exercise_references.sql');
const relations = [
  ['workout_exercises', 'workout_id', 'workouts', 'owner_only'],
  ['sets', 'workout_id', 'workouts', 'owner_only'],
  ['routine_exercises', 'routine_id', 'routines', 'owner_only'],
  ['template_exercises', 'template_id', 'workout_templates', 'owner_templates'],
];

async function createDb(t) {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create table auth.users(id uuid primary key);
    create table exercises(
      id uuid primary key default gen_random_uuid(), name text not null,
      muscle_group text, equipment text, is_custom boolean not null default false,
      created_by uuid references auth.users(id) on delete cascade,
      name_pt text, image_url text, name_en text, muscle_en text, muscle_pt text,
      description text, aliases text[] not null default '{}', listed boolean not null default true,
      constraint exercises_custom_owner_chk check ((is_custom and created_by is not null) or (not is_custom and created_by is null))
    );
    create table workouts(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
    create table workout_exercises(id uuid primary key default gen_random_uuid(), workout_id uuid not null references workouts(id) on delete cascade, exercise_id uuid not null references exercises(id) on delete cascade, "order" int not null default 1, rest_time int, notes text);
    create table sets(id uuid primary key default gen_random_uuid(), workout_id uuid references workouts(id) on delete cascade, exercise_id uuid references exercises(id), workout_exercise_id uuid references workout_exercises(id) on delete cascade, weight numeric, reps int, set_number int);
    create table routines(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
    create table routine_exercises(id uuid primary key default gen_random_uuid(), routine_id uuid not null references routines(id) on delete cascade, exercise_id uuid not null references exercises(id) on delete cascade, "order" int not null default 1);
    create table workout_templates(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
    create table template_exercises(id uuid primary key default gen_random_uuid(), template_id uuid not null references workout_templates(id) on delete cascade, exercise_id uuid not null references exercises(id) on delete restrict, order_index int not null default 1, rest_seconds int not null default 90, unique(template_id, order_index));
    insert into auth.users values ('${owner}'), ('${copier}'), ('${secondCopier}');
    insert into exercises(id,name,is_custom,created_by,name_pt,name_en,muscle_group,equipment,muscle_en,muscle_pt,description,image_url,aliases,listed) values
      ('${source}','Curl',true,'${owner}','Remada','Curl','back','machine','Back','Costas','Seat 3','https://example.test/move.png',array['Row','Remada'],false),
      ('${catalog}','Bench',false,null,null,null,'chest','barbell',null,null,null,null,'{}',true),
      ('${own}','Curl',true,'${copier}',null,null,'biceps','dumbbell',null,null,null,null,'{}',true);
    insert into workouts(id,user_id) select id,id from auth.users;
    insert into routines(id,user_id) select id,id from auth.users;
    insert into workout_templates(id,user_id) select id,id from auth.users;
  `);
  for (const [table, parentId, parent, suffix] of relations) {
    await db.exec(`
      alter table ${table} enable row level security;
      grant select,insert,update on ${table} to authenticated;
      create policy ${table}_select on ${table} for select to authenticated using (true);
      create policy ${table}_insert_${suffix} on ${table} for insert to authenticated with check (true);
      create policy ${table}_update_${suffix} on ${table} for update to authenticated using (exists (select 1 from ${parent} p where p.id=${parentId} and p.user_id=auth.uid())) with check (true);
    `);
  }
  await db.exec('grant select on workouts,routines,workout_templates,exercises to authenticated');
  return db;
}

async function migrate(db) {
  await db.exec(fs.readFileSync(path.join(migrationDir, '20261027090000_own_exercise_references.sql'), 'utf8'));
  if (!process.env.TEST_BASELINE_EXERCISE_REPAIR) {
    await db.exec(fs.readFileSync(repairPath, 'utf8'));
  }
}

async function asUser(db, userId, work) {
  await db.exec(`set role authenticated; set test.user_id='${userId}'`);
  try { return await work(); } finally { await db.exec('reset role'); }
}

async function snapshot(db) {
  const result = {};
  for (const table of ['exercises', 'workouts', 'workout_exercises', 'sets', 'routines', 'routine_exercises', 'workout_templates', 'template_exercises']) {
    result[table] = (await db.query(`select * from ${table} order by id`)).rows;
  }
  return result;
}

async function seedHistoricalReferences(db) {
  for (const userId of [copier, secondCopier]) {
    await db.query('insert into workout_exercises(id,workout_id,exercise_id,notes,rest_time) values ($1,$1,$2,\'Keep notes\',120)', [userId, source]);
    await db.query('insert into sets(id,workout_id,exercise_id,workout_exercise_id,weight,reps,set_number) values ($1,$1,$2,$1,42.5,8,1)', [userId, source]);
    await db.query('insert into sets(workout_id,exercise_id,weight,reps,set_number) values ($1,$2,25,12,2)', [userId, source]);
    await db.query('insert into routine_exercises(id,routine_id,exercise_id) values ($1,$1,$2)', [userId, source]);
    await db.query('insert into template_exercises(id,template_id,exercise_id,rest_seconds) values ($1,$1,$2,120)', [userId, source]);
  }
}

test('historical references become independent per account without changing training data', async t => {
  const db = await createDb(t);
  await seedHistoricalReferences(db);
  const before = await snapshot(db);
  await migrate(db);
  const after = await snapshot(db);
  const { id: ignoredId, created_by: ignoredOwner, ...sourceContent } = before.exercises.find(row => row.id === source);
  for (const userId of [copier, secondCopier]) {
    const copies = after.exercises.filter(row => row.created_by === userId && row.equipment === 'machine');
    assert.equal(copies.length, 1);
    const { id: copyId, created_by: copyOwner, ...copyContent } = copies[0];
    assert.equal(copyOwner, userId);
    assert.deepEqual(copyContent, sourceContent);
    for (const [table, parentId] of relations) {
      for (const row of after[table].filter(row => row[parentId] === userId)) {
        assert.equal(row.exercise_id, copyId, table);
        const original = before[table].find(item => item.id === row.id);
        assert.deepEqual({ ...row, exercise_id: source }, original, table);
      }
    }
  }
  assert.deepEqual(after.exercises.find(row => row.id === own), before.exercises.find(row => row.id === own));
  assert.deepEqual(after.exercises.find(row => row.id === source), before.exercises.find(row => row.id === source));
  await migrate(db);
  assert.deepEqual(await snapshot(db), after, 'reapplication must not make more copies');
});

for (const deletion of ['exercise', 'account']) {
  test(`deleting the source ${deletion} preserves copied workouts, sets, routines and templates`, async t => {
    const db = await createDb(t);
    await seedHistoricalReferences(db);
    await migrate(db);
    const before = await snapshot(db);
    if (deletion === 'exercise') await db.query('delete from exercises where id=$1', [source]);
    else await db.query('delete from auth.users where id=$1', [owner]);
    const after = await snapshot(db);
    for (const [table] of relations) assert.deepEqual(after[table], before[table], table);
    for (const userId of [copier, secondCopier]) {
      assert.deepEqual(after.exercises.filter(row => row.created_by === userId), before.exercises.filter(row => row.created_by === userId));
    }
  });
}

test('sets cannot attach to a block from another workout on insert or update', async t => {
  const db = await createDb(t);
  await db.query('insert into workout_exercises(id,workout_id,exercise_id) values ($1,$1,$2),($3,$3,$4)', [owner, source, copier, own]);
  await migrate(db);
  await asUser(db, copier, async () => {
    for (const exerciseId of [null, own]) {
      await assert.rejects(db.query('insert into sets(workout_id,exercise_id,workout_exercise_id) values ($1,$2,$3)', [copier, exerciseId, owner]), /row-level security/);
    }
    const inserted = await db.query('insert into sets(workout_id,exercise_id,workout_exercise_id) values ($1,$2,$1) returning id', [copier, own]);
    await assert.rejects(db.query('update sets set workout_exercise_id=$1 where id=$2', [owner, inserted.rows[0].id]), /row-level security/);
    await assert.rejects(db.query('insert into sets(workout_id,exercise_id,workout_exercise_id) values ($1,$2,$1)', [copier, catalog]), /row-level security/);
    await assert.rejects(db.query('insert into sets(workout_id,exercise_id) values ($1,$2)', [copier, source]), /row-level security/);
    await db.query('insert into sets(workout_id,workout_exercise_id) values ($1,$1)', [copier]);
    await db.query('insert into sets(workout_id,exercise_id) values ($1,$2),($1,null)', [copier, own]);
  });
});

test('legacy cross-workout links are detached and their exercise content survives source deletion', async t => {
  const db = await createDb(t);
  await db.query('insert into workout_exercises(id,workout_id,exercise_id) values ($1,$1,$2)', [owner, source]);
  for (const exerciseId of [null, own]) {
    await db.query('insert into sets(workout_id,exercise_id,workout_exercise_id,weight,reps) values ($1,$2,$3,30,10)', [copier, exerciseId, owner]);
  }
  await migrate(db);
  const before = (await db.query('select s.*,e.created_by,e.equipment from sets s left join exercises e on e.id=s.exercise_id order by s.id')).rows;
  assert.equal(before.length, 2);
  assert.ok(before.every(row => row.workout_exercise_id === null && row.created_by === copier));
  assert.deepEqual(before.map(row => row.equipment).sort(), ['dumbbell', 'machine']);
  await db.query('delete from auth.users where id=$1', [owner]);
  const after = (await db.query('select s.*,e.created_by,e.equipment from sets s left join exercises e on e.id=s.exercise_id order by s.id')).rows;
  assert.deepEqual(after, before);
});

test('a linked legacy set without workout_id follows its existing block and retains its values', async t => {
  const db = await createDb(t);
  await db.query('insert into workout_exercises(id,workout_id,exercise_id) values ($1,$1,$2)', [copier, source]);
  await db.query('insert into sets(id,workout_exercise_id,weight,reps) values ($1,$1,55,6)', [copier]);
  await migrate(db);
  const row = (await db.query('select s.*,e.created_by from sets s join exercises e on e.id=s.exercise_id')).rows[0];
  assert.equal(row.workout_id, copier);
  assert.equal(row.workout_exercise_id, copier);
  assert.equal(row.created_by, copier);
  assert.equal(row.weight, '55');
  assert.equal(row.reps, 6);
  await db.query('delete from exercises where id=$1', [source]);
  assert.equal((await db.query('select count(*)::int n from sets')).rows[0].n, 1);
});

test('a database without foreign references is unchanged', async t => {
  const db = await createDb(t);
  await db.query('insert into workout_exercises(id,workout_id,exercise_id) values ($1,$1,$2)', [copier, own]);
  await db.query('insert into sets(workout_id,exercise_id,workout_exercise_id,weight,reps) values ($1,$2,$1,20,10)', [copier, own]);
  const before = await snapshot(db);
  await migrate(db);
  assert.deepEqual(await snapshot(db), before);
});

test('a failed repair rolls back link normalization and exercise copies together', async t => {
  const db = await createDb(t);
  await seedHistoricalReferences(db);
  await db.query('insert into sets(workout_exercise_id,weight,reps) values ($1,15,10)', [copier]);
  await db.exec(`alter table exercises add constraint reject_test_copy check (created_by <> '${copier}' or equipment <> 'machine')`);
  const before = await snapshot(db);
  await assert.rejects(migrate(db), /reject_test_copy/);
  await db.exec('rollback');
  assert.deepEqual(await snapshot(db), before);
});

test('a legacy set with an explicit different exercise can still be edited after repair', async t => {
  const db = await createDb(t);
  await db.query('insert into workout_exercises(id,workout_id,exercise_id) values ($1,$1,$2)', [copier, own]);
  await db.query('insert into sets(id,exercise_id,workout_exercise_id,weight,reps) values ($1,$2,$1,50,8)', [copier, catalog]);
  await migrate(db);
  const row = (await db.query('select * from sets')).rows[0];
  assert.equal(row.workout_id, copier);
  assert.equal(row.exercise_id, catalog);
  assert.equal(row.workout_exercise_id, null);
  await asUser(db, copier, () => db.query('update sets set weight=51 where id=$1', [copier]));
  assert.equal((await db.query('select weight from sets')).rows[0].weight, '51');
});

test('a custom-exercise set without any ownership path stops repair without guessing an owner', async t => {
  const db = await createDb(t);
  await seedHistoricalReferences(db);
  await db.query('insert into sets(exercise_id,weight,reps) values ($1,10,5)', [source]);
  const before = await snapshot(db);
  await assert.rejects(migrate(db), /unowned set/);
  await db.exec('rollback');
  assert.deepEqual(await snapshot(db), before);
});
