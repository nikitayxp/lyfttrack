const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const owner = '00000000-0000-0000-0000-000000000001';
const attacker = '00000000-0000-0000-0000-000000000002';
const catalog = '10000000-0000-0000-0000-000000000001';
const ownerCustom = '10000000-0000-0000-0000-000000000002';
const attackerCustom = '10000000-0000-0000-0000-000000000003';
const migration = path.resolve(__dirname, '../../supabase/migrations/20261027090000_own_exercise_references.sql');

async function createDb() {
  const db = await PGlite.create();
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    create table exercises(id uuid primary key, is_custom boolean not null, created_by uuid, name text);
    create table workouts(id uuid primary key default gen_random_uuid(), user_id uuid);
    create table workout_exercises(id uuid primary key default gen_random_uuid(), workout_id uuid references workouts(id), exercise_id uuid not null references exercises(id) on delete cascade);
    create table sets(id uuid primary key default gen_random_uuid(), workout_id uuid references workouts(id), exercise_id uuid references exercises(id));
    create table routines(id uuid primary key default gen_random_uuid(), user_id uuid);
    create table routine_exercises(id uuid primary key default gen_random_uuid(), routine_id uuid references routines(id), exercise_id uuid not null references exercises(id) on delete cascade);
    create table workout_templates(id uuid primary key default gen_random_uuid(), user_id uuid);
    create table template_exercises(id uuid primary key default gen_random_uuid(), template_id uuid references workout_templates(id), exercise_id uuid not null references exercises(id));
    alter table exercises enable row level security;
    alter table workouts enable row level security;
    alter table workout_exercises enable row level security;
    alter table sets enable row level security;
    alter table routines enable row level security;
    alter table routine_exercises enable row level security;
    alter table workout_templates enable row level security;
    alter table template_exercises enable row level security;
    grant select on exercises to authenticated;
    grant select, insert, update on workouts, workout_exercises, sets, routines, routine_exercises, workout_templates, template_exercises to authenticated;
    create policy exercises_select on exercises for select to authenticated using (true);
    create policy workouts_own on workouts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy routines_own on routines for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy templates_own on workout_templates for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy workout_exercises_select on workout_exercises for select to authenticated using (true);
    create policy sets_select on sets for select to authenticated using (true);
    create policy routine_exercises_select on routine_exercises for select to authenticated using (true);
    create policy template_exercises_select on template_exercises for select to authenticated using (true);
    create policy workout_exercises_insert_owner_only on workout_exercises for insert to authenticated with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
    create policy workout_exercises_update_owner_only on workout_exercises for update to authenticated using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = (select auth.uid()))) with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
    create policy sets_insert_owner_only on sets for insert to authenticated with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
    create policy sets_update_owner_only on sets for update to authenticated using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = (select auth.uid()))) with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
    create policy routine_exercises_insert_owner_only on routine_exercises for insert to authenticated with check (exists (select 1 from routines r where r.id = routine_id and r.user_id = (select auth.uid())));
    create policy routine_exercises_update_owner_only on routine_exercises for update to authenticated using (exists (select 1 from routines r where r.id = routine_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from routines r where r.id = routine_id and r.user_id = (select auth.uid())));
    create policy template_exercises_insert_owner_templates on template_exercises for insert to authenticated with check (exists (select 1 from workout_templates wt where wt.id = template_id and wt.user_id = (select auth.uid())));
    create policy template_exercises_update_owner_templates on template_exercises for update to authenticated using (exists (select 1 from workout_templates wt where wt.id = template_id and wt.user_id = (select auth.uid()))) with check (exists (select 1 from workout_templates wt where wt.id = template_id and wt.user_id = (select auth.uid())));
    insert into exercises values
      ('${catalog}', false, null, 'Bench Press'),
      ('${ownerCustom}', true, '${owner}', 'Owner secret move'),
      ('${attackerCustom}', true, '${attacker}', 'Attacker move');
    insert into workouts(id, user_id) values ('20000000-0000-0000-0000-000000000001', '${attacker}');
    insert into routines(id, user_id) values ('30000000-0000-0000-0000-000000000001', '${attacker}');
    insert into workout_templates(id, user_id) values ('40000000-0000-0000-0000-000000000001', '${attacker}');
  `);
  return db;
}

const workoutId = '20000000-0000-0000-0000-000000000001';
const routineId = '30000000-0000-0000-0000-000000000001';
const templateId = '40000000-0000-0000-0000-000000000001';

async function asAttacker(db, work) {
  await db.exec(`set role authenticated; set test.user_id = '${attacker}'`);
  try {
    return await work();
  } finally {
    await db.exec('reset role');
  }
}

test('before the migration another account can attach your private custom exercise', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await asAttacker(db, () =>
    db.query('insert into workout_exercises(workout_id, exercise_id) values ($1, $2)', [workoutId, ownerCustom])
  );
  await db.exec(`delete from exercises where id = '${ownerCustom}'`);
  assert.equal((await db.query('select count(*)::int as n from workout_exercises')).rows[0].n, 0);
});

test('only catalog exercises and your own custom exercises can be referenced', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await assert.doesNotReject(db.exec(fs.readFileSync(migration, 'utf8')), 'the migration must be safe to apply again');

  await asAttacker(db, async () => {
    const foreignInserts = [
      ['insert into workout_exercises(workout_id, exercise_id) values ($1, $2)', workoutId],
      ['insert into sets(workout_id, exercise_id) values ($1, $2)', workoutId],
      ['insert into routine_exercises(routine_id, exercise_id) values ($1, $2)', routineId],
      ['insert into template_exercises(template_id, exercise_id) values ($1, $2)', templateId],
    ];
    for (const [sql, parentId] of foreignInserts) {
      await assert.rejects(db.query(sql, [parentId, ownerCustom]), /row-level security/, sql);
      await db.query(sql, [parentId, catalog]);
      await db.query(sql, [parentId, attackerCustom]);
    }
    await db.query('insert into sets(workout_id, exercise_id) values ($1, null)', [workoutId]);

    await assert.rejects(
      db.query('update workout_exercises set exercise_id = $1 where exercise_id = $2', [ownerCustom, catalog]),
      /row-level security/
    );
    await assert.rejects(
      db.query('update sets set exercise_id = $1 where exercise_id = $2', [ownerCustom, catalog]),
      /row-level security/
    );
    await assert.rejects(
      db.query('update routine_exercises set exercise_id = $1 where exercise_id = $2', [ownerCustom, catalog]),
      /row-level security/
    );
    await assert.rejects(
      db.query('update template_exercises set exercise_id = $1 where exercise_id = $2', [ownerCustom, catalog]),
      /row-level security/
    );
  });

  const before = (await db.query('select count(*)::int as n from workout_exercises')).rows[0].n;
  await db.exec(`delete from exercises where id = '${ownerCustom}'`);
  assert.equal((await db.query('select count(*)::int as n from workout_exercises')).rows[0].n, before);

  await db.exec('set role anon');
  await assert.rejects(db.query('select public.can_reference_exercise($1)', [catalog]), /permission denied/);
});
