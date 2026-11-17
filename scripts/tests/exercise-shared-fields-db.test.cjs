const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const owner = '00000000-0000-4000-8000-000000000001';
const viewer = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
const id = n => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
const sql = file => fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', file), 'utf8');

test('shared exercise readers retain training data while restricting private fields', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id',true),'')::uuid
    $$;
    grant usage on schema auth to authenticated, anon;
    create function public.can_view_user_content(target uuid) returns boolean language sql stable as $$
      select target=auth.uid() or target::text=current_setting('test.visible_user',true)
    $$;
    create table exercises (
      id uuid primary key, name text not null, muscle_group text, equipment text,
      is_custom boolean not null, created_by uuid, name_pt text, image_url text,
      name_en text, muscle_en text, muscle_pt text, description text,
      aliases text[] not null default '{}', listed boolean not null default true
    );
    create table workouts (id uuid primary key, user_id uuid not null, name text, notes text);
    create table workout_exercises (
      id uuid primary key, workout_id uuid references workouts(id),
      exercise_id uuid references exercises(id), "order" integer, rest_time integer, notes text
    );
    create table sets (id uuid primary key, workout_id uuid references workouts(id), weight integer);
    create table client_mutation_receipts (
      user_id uuid, mutation_id uuid, fingerprint text, result_id uuid, result_data jsonb,
      primary key (user_id, mutation_id)
    );
    alter table exercises enable row level security;
    alter table workouts enable row level security;
    alter table workout_exercises enable row level security;
    grant select,insert,update,delete on exercises,workouts,workout_exercises,sets to authenticated;
    grant all on exercises,workouts,workout_exercises,sets to service_role;
    create policy workouts_read on workouts for select to authenticated
      using (public.can_view_user_content(user_id));
    create policy blocks_read on workout_exercises for select to authenticated
      using (exists(select 1 from workouts w where w.id=workout_id and public.can_view_user_content(w.user_id)));
    create policy blocks_update on workout_exercises for update to authenticated
      using (exists(select 1 from workouts w where w.id=workout_id and w.user_id=auth.uid()));
    insert into exercises (id,name,is_custom,created_by,description,aliases,equipment,image_url,muscle_group) values
      ('${id(1)}','Built in',false,null,'Catalogue instructions',array['Public alias'],'barbell','https://example.test/catalog.png','chest'),
      ('${id(2)}','Shared custom',true,'${owner}','Private setup',array['Private alias'],'machine','https://example.test/custom.png','back'),
      ('${id(3)}','Unrelated custom',true,'${stranger}','Stranger setup',array['Stranger alias'],'cable',null,'arms');
    insert into workouts values
      ('${id(10)}','${owner}','Shared workout','Shared general note'),
      ('${id(11)}','${stranger}','Hidden workout',null);
    insert into workout_exercises values
      ('${id(20)}','${id(10)}','${id(2)}',1,90,'Private setup from an old session'),
      ('${id(21)}','${id(10)}','${id(1)}',2,60,'Public built-in session note'),
      ('${id(22)}','${id(11)}','${id(3)}',1,90,'Hidden session note');
    insert into sets values ('${id(30)}','${id(10)}',50);
    create function public.import_workout_snapshot(p_workout_id uuid) returns jsonb
      language sql stable security invoker set search_path='' as $$
      select jsonb_build_object('name',w.name,'notes',w.notes,
        'exercises',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.workout_exercises e where e.workout_id=w.id),'[]'::jsonb),
        'sets',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.sets s where s.workout_id=w.id),'[]'::jsonb))
      from public.workouts w where w.id=p_workout_id and w.user_id=(select auth.uid())
    $$;
    grant execute on function public.import_workout_snapshot(uuid) to authenticated;
  `);
  await db.exec(sql('20261019141000_restore_exercise_privacy.sql'));
  const rows = async query => (await db.query(query)).rows;
  const asUser = async user => db.exec(`reset role; set role authenticated; set test.user_id='${user}'; set test.visible_user='${owner}'`);
  const allBefore = await rows('select to_jsonb(e) as data from exercises e order by id');
  await asUser(owner);
  const ownSnapshot = await rows(`select import_workout_snapshot('${id(10)}') as data`);
  await asUser(viewer);
  assert.equal((await rows(`select description from exercises where id='${id(2)}'`))[0].description, 'Private setup', 'fixture reproduces the original full-row exposure');
  await db.exec('reset role');
  const preparation = fs.readFileSync(path.resolve(__dirname, '../../supabase/rollouts/exercise_read_views.sql'), 'utf8');
  assert.equal(preparation, sql('20261117121500_exercise_private_read_views.sql'), 'the pre-deployment script and recorded additive migration must stay identical');
  await db.exec(preparation);
  await db.exec(preparation);

  await t.test('additive views preserve the old client until the separate restriction', async () => {
    await asUser(owner);
    assert.deepEqual(await rows(`select import_workout_snapshot('${id(10)}') as data`), ownSnapshot);
    await asUser(viewer);
    const row = (await rows(`select * from exercises_read where id='${id(2)}'`))[0];
    assert.equal(row.name, 'Shared custom');
    assert.equal(row.image_url, 'https://example.test/custom.png');
    assert.equal(row.equipment, 'machine');
    assert.equal(row.description, null);
    assert.deepEqual(row.aliases, []);
    assert.equal((await rows(`select description from exercises where id='${id(2)}'`))[0].description, 'Private setup');
  });
  await db.exec('reset role');
  await db.exec(sql('20261117121500_exercise_private_read_views.sql'));
  await db.exec(sql('20261117121600_restrict_exercise_private_columns.sql'));

  await t.test('owners retain descriptions, aliases, historical notes and the repair snapshot', async () => {
    await asUser(owner);
    const row = (await rows(`select * from exercises_read where id='${id(2)}'`))[0];
    assert.equal(row.description, 'Private setup');
    assert.deepEqual(row.aliases, ['Private alias']);
    assert.equal((await rows(`select notes from workout_exercises_read where id='${id(20)}'`))[0].notes, 'Private setup from an old session');
    assert.deepEqual(await rows(`select import_workout_snapshot('${id(10)}') as data`), ownSnapshot);
    await db.exec(`update workout_exercises set notes='My edited note' where id='${id(20)}'`);
    assert.equal((await rows(`select notes from workout_exercises_read where id='${id(20)}'`))[0].notes, 'My edited note');
    await db.exec(`update workout_exercises set notes='Private setup from an old session' where id='${id(20)}'`);
  });
  await t.test('permitted viewers retain safe custom fields and built-in instructions', async () => {
    await asUser(viewer);
    const exercises = await rows('select * from exercises_read order by id');
    assert.deepEqual(exercises.map(e => e.id), [id(1), id(2)]);
    assert.equal(exercises[0].description, 'Catalogue instructions');
    assert.deepEqual(exercises[0].aliases, ['Public alias']);
    assert.equal(exercises[1].description, null);
    assert.deepEqual(exercises[1].aliases, []);
    assert.deepEqual(await rows('select id,notes from workout_exercises_read order by id'), [
      { id: id(20), notes: null }, { id: id(21), notes: 'Public built-in session note' },
    ]);
    assert.equal((await rows(`select import_workout_snapshot('${id(10)}') as data`))[0].data, null);
    assert.equal((await rows(`select name,notes from workouts where id='${id(10)}'`))[0].notes, 'Shared general note');
  });
  await t.test('old base-table projections and predicates cannot read sensitive fields', async () => {
    await asUser(viewer);
    for (const query of [
      'select description from exercises', 'select aliases from exercises',
      'select * from exercises', 'select row_to_json(e) from exercises e',
      "select id from exercises where description='Private setup'",
      'select notes from workout_exercises', 'select * from workout_exercises',
    ]) await assert.rejects(db.query(query), /permission denied/, query);
    assert.deepEqual((await rows('select id,name from exercises order by id')).map(e => e.id), [id(1), id(2)]);
    assert.equal((await rows('select id,exercise_id from workout_exercises')).length, 2);
    assert.equal((await rows("select id from exercises_read where description='Private setup'")).length, 0);
  });
  await t.test('unrelated and no-longer-visible custom exercises remain inaccessible', async () => {
    await asUser(viewer);
    assert.deepEqual(await rows(`select * from exercises_read where id='${id(3)}'`), []);
    await db.exec("set test.visible_user=''");
    assert.deepEqual((await rows('select id from exercises_read')).map(e => e.id), [id(1)]);
    assert.deepEqual(await rows('select * from workout_exercises_read'), []);
  });
  await t.test('anonymous access and private-schema calls are denied', async () => {
    await asUser(viewer);
    await assert.rejects(db.query(`select * from private.exercise_sensitive_details('${id(2)}')`), /permission denied/);
    await db.exec('reset role; set role anon');
    for (const relation of ['exercises_read','workout_exercises_read','exercises','workout_exercises']) {
      await assert.rejects(db.query(`select * from ${relation}`), /permission denied/);
    }
  });
  await t.test('migrations preserve exercise rows, original RLS, write grants and service access', async () => {
    await db.exec('reset role');
    assert.deepEqual(await rows('select to_jsonb(e) as data from exercises e order by id'), allBefore);
    assert.equal((await rows("select count(*)::int as n from pg_policies where schemaname='public' and tablename='exercises'"))[0].n, 4);
    const grants = (await rows(`select
      has_table_privilege('authenticated','exercises','INSERT') as can_insert,
      has_table_privilege('authenticated','exercises','UPDATE') as can_update,
      has_column_privilege('authenticated','exercises','aliases','SELECT') as aliases_read,
      has_column_privilege('authenticated','exercises','description','SELECT') as description_read,
      has_column_privilege('authenticated','workout_exercises','notes','SELECT') as notes_read,
      has_table_privilege('service_role','exercises','SELECT') as service_read`))[0];
    assert.deepEqual(grants, { can_insert: true, can_update: true, aliases_read: false, description_read: false, notes_read: false, service_read: true });
  });
});
