const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const workout = '10000000-0000-0000-0000-000000000001';
const otherWorkout = '10000000-0000-0000-0000-000000000002';
const firstSet = '20000000-0000-0000-0000-000000000001';
const otherSet = '20000000-0000-0000-0000-000000000002';
const exercise = '30000000-0000-0000-0000-000000000001';
const migration = path.resolve(__dirname, '../../supabase/migrations/20261017110000_atomic_workout_edit.sql');

test('workout edits are atomic and retain ownership checks in PostgreSQL', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create table public.workouts (id uuid primary key, user_id uuid not null, name text not null, notes text);
    create table public.sets (id uuid primary key, workout_id uuid references workouts(id), weight numeric, reps integer, rir integer, side text not null default 'both');
    create table public.workout_exercises (workout_id uuid references workouts(id), exercise_id uuid, notes text);
    alter table workouts enable row level security;
    alter table sets enable row level security;
    alter table workout_exercises enable row level security;
    create policy workout_read on workouts for select to authenticated using (true);
    create policy workout_update on workouts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy set_read on sets for select to authenticated using (true);
    create policy set_update on sets for update to authenticated using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));
    create policy exercise_read on workout_exercises for select to authenticated using (true);
    create policy exercise_update on workout_exercises for update to authenticated using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));
    grant select, update on workouts, sets, workout_exercises to authenticated;
  `);
  await db.exec(fs.readFileSync(migration, 'utf8'));

  async function reset() {
    await db.exec(`reset role; delete from sets; delete from workout_exercises; delete from workouts;
      insert into workouts values ('${workout}', '${owner}', 'Original', 'Original notes'), ('${otherWorkout}', '${other}', 'Other', null);
      insert into sets (id, workout_id, weight, reps) values ('${firstSet}', '${workout}', 20, 8), ('${otherSet}', '${otherWorkout}', 60, 5);
      insert into workout_exercises values ('${workout}', '${exercise}', 'Original exercise notes');
      set role authenticated; set test.user_id = '${owner}';`);
  }
  const edit = (id = workout, header = {}, sets = [], notes = {}) => db.query(
    'select public.update_workout_atomic($1::uuid, $2::jsonb, $3::jsonb, $4::jsonb)',
    [id, JSON.stringify(header), JSON.stringify(sets), JSON.stringify(notes)]);
  async function original() {
    const result = await db.query('select w.name, w.notes, s.weight::int as weight from workouts w join sets s on s.workout_id = w.id where w.id = $1', [workout]);
    assert.deepEqual(result.rows, [{ name: 'Original', notes: 'Original notes', weight: 20 }]);
  }

  await t.test('updates header, sets and exercise notes together, including explicit null', async () => {
    await reset();
    await edit(workout, { name: 'Changed', notes: null }, [{ id: firstSet, weight: 30.25, reps: 9, rir: 2, side: 'left' }], { [exercise]: 'Changed notes' });
    assert.deepEqual((await db.query('select name, notes from workouts where id = $1', [workout])).rows, [{ name: 'Changed', notes: null }]);
    assert.deepEqual((await db.query('select weight::float, reps, rir, side from sets where id = $1', [firstSet])).rows, [{ weight: 30.25, reps: 9, rir: 2, side: 'left' }]);
    assert.equal((await db.query('select notes from workout_exercises')).rows[0].notes, 'Changed notes');
  });
  await t.test('rolls back earlier changes when a later set belongs to another workout', async () => {
    await reset();
    await assert.rejects(edit(workout, { name: 'Changed' }, [{ id: firstSet, weight: 30 }, { id: otherSet, weight: 80 }]));
    await original();
    assert.equal((await db.query('select weight::int as weight from sets where id = $1', [otherSet])).rows[0].weight, 60);
  });
  await t.test('rolls back header and sets when a later exercise note is invalid', async () => {
    await reset();
    await assert.rejects(edit(workout, { name: 'Changed' }, [{ id: firstSet, weight: 30 }], { [exercise]: 'x'.repeat(1001) }));
    await original();
  });
  await t.test('cannot modify another owner even when their workout is readable', async () => {
    await reset();
    assert.equal((await db.query('select id from workouts where id = $1', [otherWorkout])).rows.length, 1);
    await assert.rejects(edit(otherWorkout, { name: 'Changed' }, [{ id: otherSet, weight: 80 }]));
    assert.equal((await db.query('select name from workouts where id = $1', [otherWorkout])).rows[0].name, 'Other');
  });
  await t.test('rejects calls without a session and denies the anonymous role', async () => {
    await reset();
    await db.exec("set test.user_id = ''");
    await assert.rejects(edit());
    await db.exec('reset role; set role anon');
    await assert.rejects(edit(), /permission denied/);
  });
  await t.test('rejects invalid numeric values, malformed structures and unexpected fields', async () => {
    await reset();
    for (const patch of [{ weight: -1 }, { weight: 1001 }, { reps: 1.5 }, { rir: 11 }, { side: 'invalid' }, { weight: '30' }, { user_id: other }]) {
      await assert.rejects(edit(workout, { name: 'Changed' }, [{ id: firstSet, ...patch }]));
      await original();
    }
    await assert.rejects(edit(workout, { user_id: other }));
    await assert.rejects(edit(workout, {}, {}));
    await original();
  });
  await t.test('does not silently accept a missing set or a missing nonempty note target', async () => {
    await reset();
    await assert.rejects(edit(workout, { name: 'Changed' }, [{ id: exercise, weight: 30 }]));
    await assert.rejects(edit(workout, { name: 'Changed' }, [], { [otherSet]: 'Missing target' }));
    await original();
  });
  await t.test('empty notes for legacy workouts without an exercise relation are harmless', async () => {
    await reset();
    await edit(workout, {}, [], { [otherSet]: null });
    await original();
  });
  await t.test('uses caller permissions and a pinned search path', async () => {
    await db.exec('reset role');
    const { rows } = await db.query("select prosecdef, proconfig from pg_proc where oid = 'public.update_workout_atomic(uuid,jsonb,jsonb,jsonb)'::regprocedure");
    assert.equal(rows[0].prosecdef, false);
    assert.ok(rows[0].proconfig.some(value => value.startsWith('search_path=')));
  });
});
