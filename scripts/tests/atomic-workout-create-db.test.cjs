const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const exercise = '30000000-0000-0000-0000-000000000001';
const privateExercise = '30000000-0000-0000-0000-000000000002';
const otherTemplate = '40000000-0000-0000-0000-000000000001';
const header = { session_started_at: '2026-10-18T10:00:00Z', name: 'Treino', notes: null, template_id: null, start_time: '2026-10-18T10:00:00Z', end_time: '2026-10-18T10:30:00Z' };
const exercises = [{ exercise_id: exercise, order: 1, rest_time: 90, notes: 'Controlled' }];
const set = { exercise_id: exercise, set_number: 1, weight: 30.25, reps: 8, rir: 2, set_type: 'normal', side: 'both' };

test('creation is transactional, owner-scoped and repeatable in PostgreSQL', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    create table exercises (id uuid primary key, created_by uuid);
    create table workout_templates (id uuid primary key, user_id uuid);
    create table workouts (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null, notes text, template_id uuid references workout_templates(id), start_time timestamptz, end_time timestamptz);
    create table workout_exercises (id uuid primary key default gen_random_uuid(), workout_id uuid references workouts(id), exercise_id uuid references exercises(id), "order" integer, rest_time integer, notes text);
    create table sets (id uuid primary key default gen_random_uuid(), workout_id uuid references workouts(id), workout_exercise_id uuid references workout_exercises(id), exercise_id uuid references exercises(id), set_number integer, weight numeric, reps integer, rir integer, set_type text, side text);
    insert into exercises values ('${exercise}', null), ('${privateExercise}', '${other}');
    insert into workout_templates values ('${otherTemplate}', '${other}');
    alter table exercises enable row level security; alter table workouts enable row level security; alter table workout_exercises enable row level security; alter table sets enable row level security;
    create policy exercise_read on exercises for select to authenticated using (created_by is null or created_by = auth.uid());
    create policy workout_read on workouts for select to authenticated using (true);
    create policy workout_insert on workouts for insert to authenticated with check (user_id = auth.uid());
    create policy workout_update on workouts for update to authenticated using (user_id = auth.uid());
    create policy relation_read on workout_exercises for select to authenticated using (true);
    create policy relation_insert on workout_exercises for insert to authenticated with check (exists(select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));
    create policy set_read on sets for select to authenticated using (true);
    create policy set_insert on sets for insert to authenticated with check (exists(select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));
    grant select on exercises, workout_templates to authenticated;
    grant select, insert, update on workouts to authenticated; grant select, insert on workout_exercises, sets to authenticated;
  `);
  await db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261018140000_atomic_workout_creation.sql'), 'utf8'));
  const save = async (workout = header, relations = exercises, sets = [set], expectedUser = owner) => (await db.query(
    'select public.create_workout_atomic($1::uuid, $2::jsonb, $3::jsonb, $4::jsonb) result',
    [expectedUser, JSON.stringify(workout), JSON.stringify(relations), JSON.stringify(sets)],
  )).rows[0].result;
  async function reset() {
    await db.exec(`reset role; delete from sets; delete from workout_exercises; delete from workouts; set role authenticated; set test.user_id = '${owner}';`);
  }
  async function counts(expected) {
    const result = await db.query('select (select count(*)::int from workouts) workouts, (select count(*)::int from workout_exercises) exercises, (select count(*)::int from sets) sets');
    assert.deepEqual(result.rows[0], expected);
  }
  await t.test('persists one complete workout and correct relations', async () => {
    await reset();
    const result = await save();
    assert.equal(result.inserted_set_count, 1);
    await counts({ workouts: 1, exercises: 1, sets: 1 });
    const rows = (await db.query('select w.user_id, s.weight::float, s.reps, we.notes from workouts w join sets s on s.workout_id = w.id join workout_exercises we on we.id = s.workout_exercise_id')).rows;
    assert.deepEqual(rows, [{ user_id: owner, weight: 30.25, reps: 8, notes: 'Controlled' }]);
  });
  await t.test('lost-response retry returns the same id and original finish time', async () => {
    await reset();
    const first = await save();
    const retry = await save({ ...header, start_time: '2026-10-18T10:05:00Z', end_time: '2026-10-18T10:35:00Z' });
    assert.equal(retry.workout_id, first.workout_id);
    assert.equal(retry.end_time, first.end_time);
    await counts({ workouts: 1, exercises: 1, sets: 1 });
  });
  await t.test('repeated queued requests create one workout', async () => {
    await reset();
    const results = await Promise.all([save(), save(), save()]);
    assert.equal(new Set(results.map(result => result.workout_id)).size, 1);
    await counts({ workouts: 1, exercises: 1, sets: 1 });
  });
  await t.test('a changed payload cannot silently overwrite an already saved session', async () => {
    await reset(); await save();
    await assert.rejects(save(header, exercises, [{ ...set, weight: 90 }]), /already saved/);
    assert.equal((await db.query('select weight::float from sets')).rows[0].weight, 30.25);
  });
  await t.test('late invalid sets roll back workout, exercises and earlier sets', async () => {
    await reset();
    await assert.rejects(save(header, exercises, [set, { ...set, set_number: 2, reps: -1 }]));
    await counts({ workouts: 0, exercises: 0, sets: 0 });
    await assert.rejects(save(header, exercises, [set, { ...set, set_number: 2, exercise_id: privateExercise }]));
    await counts({ workouts: 0, exercises: 0, sets: 0 });
  });
  await t.test('two accounts with the same start time have independent sessions', async () => {
    await reset(); const first = await save();
    await db.exec(`set test.user_id = '${other}'`);
    await assert.rejects(save(), /Account changed/);
    const second = await save(header, exercises, [set], other);
    assert.notEqual(second.workout_id, first.workout_id);
    await counts({ workouts: 2, exercises: 2, sets: 2 });
  });
  await t.test('private exercises, injected owners and invalid numeric types are rejected', async () => {
    await reset();
    await assert.rejects(save(header, [{ ...exercises[0], exercise_id: privateExercise }], [{ ...set, exercise_id: privateExercise }]));
    for (const patch of [{ weight: -1 }, { weight: 1001 }, { weight: '30' }, { reps: 1.5 }, { rir: 11 }, { side: 'invalid' }, { user_id: other }]) {
      await assert.rejects(save(header, exercises, [{ ...set, ...patch }]));
      await counts({ workouts: 0, exercises: 0, sets: 0 });
    }
    await assert.rejects(save({ ...header, user_id: other }));
    await counts({ workouts: 0, exercises: 0, sets: 0 });
  });
  await t.test('invalid duplicate or empty collections never leave partial rows', async () => {
    await reset();
    for (const [relations, sets] of [[exercises, []], [[], [set]], [exercises, [set, set]], [[exercises[0], exercises[0]], [set]], [exercises, {}]]) {
      await assert.rejects(save(header, relations, sets));
      await counts({ workouts: 0, exercises: 0, sets: 0 });
    }
  });
  await t.test('foreign templates are not linked and caller permissions are retained', async () => {
    await reset(); await save({ ...header, template_id: otherTemplate });
    assert.equal((await db.query('select template_id from workouts')).rows[0].template_id, null);
    await db.exec('reset role');
    const proc = (await db.query("select prosecdef, proconfig from pg_proc where oid = 'public.create_workout_atomic(uuid,jsonb,jsonb,jsonb)'::regprocedure")).rows[0];
    assert.equal(proc.prosecdef, false);
    assert.ok(proc.proconfig.some(value => value.startsWith('search_path=')));
  });
  await t.test('authentication is required and anonymous role cannot execute', async () => {
    await reset(); await db.exec("set test.user_id = ''");
    await assert.rejects(save(), /Authentication required/);
    await db.exec('reset role; set role anon');
    await assert.rejects(save(), /permission denied/);
  });
});
