const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const loadSource = require('./load-source.cjs');

const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const exercise = '10000000-0000-0000-0000-000000000001';
const emptyExercise = '10000000-0000-0000-0000-000000000002';
const uuid = n => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const plain = value => JSON.parse(JSON.stringify(value));

async function setup(t) {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.user_id',true)::uuid $$;
    grant usage on schema auth to authenticated;
    create table profiles(id uuid primary key,username text);
    create table workouts(id uuid primary key,user_id uuid,name text,start_time timestamptz,end_time timestamptz);
    create table sets(id uuid primary key,workout_id uuid,exercise_id uuid,weight numeric,reps integer,set_number integer,rir integer,set_type text);
    create table workout_exercises(id uuid primary key,workout_id uuid,exercise_id uuid,rest_time integer);
    create table workout_comments(id uuid primary key,workout_id uuid,user_id uuid,content text,created_at timestamptz);
    insert into workouts values
      ('${uuid(1)}','${owner}','First','2026-10-01T00:00:00Z','2026-10-01T00:00:30Z'),
      ('${uuid(2)}','${owner}','Second','2026-10-01T23:00:00Z','2026-10-01T23:00:29Z'),
      ('${uuid(3)}','${owner}','Tie','2026-10-02T00:00:00Z','2026-10-02T00:01:30Z'),
      ('${uuid(4)}','${owner}','Draft','2026-10-03T00:00:00Z',null),
      ('${uuid(5)}','${other}','Other','2026-10-04T00:00:00Z','2026-10-04T01:00:00Z'),
      ('${uuid(6)}','${owner}','Negative duration','2026-10-05T00:01:00Z','2026-10-05T00:00:00Z');
    alter table workouts enable row level security;
    alter table sets enable row level security;
    create policy visible_workouts on workouts for select to authenticated using(true);
    create policy visible_sets on sets for select to authenticated using(id <> '${uuid(99999)}');
    grant select on workouts,sets to authenticated;
  `);
  const samples = [
    [1, 0.1, 3, 2, 'normal'], [1, 10.09, 11, null, 'drop'],
    [1, 10.06, 2, -1, 'normal'], [1, 50, 2, 0, 'normal'],
    [1, 50, 5, 1, 'normal'], [2, 350.05, 4, 3, ' WARMUP '],
    [2, -4, -2, -1, null], [2, null, null, null, 'failure'],
    [3, 82.5, 7, 0, 'warmup'], [3, 33.33, 13, 3, 'working'],
    [3, 33.33, 15, 0, 'normal'], [3, 99.99, 0, 3, 'normal'],
    [4, 5000, 30, 5, 'normal'], [5, 10000, 30, 5, 'normal'],
    [6, 2.55, 5, 2, 'normal'],
  ];
  for (const [i, [workout, weight, reps, rir, type]] of samples.entries()) {
    await db.query('insert into sets values($1,$2,$3,$4,$5,$6,$7,$8)', [uuid(i + 100), uuid(workout), exercise, weight, reps, i, rir, type]);
  }
  await db.exec(`
    insert into sets select ('30000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid, '${uuid(1)}', '${exercise}', 0.1, 3, i, 2, 'normal' from generate_series(1,1250) i;
    insert into sets values('${uuid(99999)}','${uuid(1)}','${exercise}',90000,100,1,10,'normal');
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261019120000_batched_read_models.sql', 'utf8'));
  await db.exec(`set role authenticated; set test.user_id='${owner}'; set timezone='Pacific/Honolulu';`);
  let currentUser = owner;
  const calls = [];
  const supabase = {
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      const result = await db.query('select public.exercise_stats_summary($1::uuid) value', [args.p_exercise_id]);
      return { data: result.rows[0].value, error: null };
    },
    from(table) {
      assert.equal(table, 'sets');
      const predicates = [];
      let after = '', limit = 1000;
      const query = {
        select() { return query; },
        eq(key, value) { predicates.push(row => (key === 'exercise_id' ? row.exercise_id : row.workouts.user_id) === value); return query; },
        not() { predicates.push(row => row.workouts.end_time !== null); return query; },
        gt(_key, cursor) { after = cursor; return query; },
        gte(_key, value) { predicates.push(row => row.workouts.start_time >= value); return query; },
        order() { return query; },
        range(start, end) { limit = end - start + 1; return query; },
        async then(resolve, reject) {
          try {
            calls.push({ table });
            const result = await db.query(`select s.id,s.exercise_id,s.weight::float8,s.reps,s.rir,s.set_type,
              json_build_object('id',w.id,'user_id',w.user_id,'start_time',to_char(w.start_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'end_time',case when w.end_time is null then null else to_char(w.end_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end) as workouts
              from sets s join workouts w on w.id=s.workout_id order by s.id`);
            return resolve({ data: result.rows.filter(row => row.id > after && predicates.every(predicate => predicate(row))).slice(0, limit), error: null });
          } catch (error) { return reject(error); }
        },
      };
      return query;
    },
  };
  const service = loadSource({
    '@/services/supabase': { supabase },
    '@/services/authUserService': { getSessionUserOrThrow: async () => ({ id: currentUser }) },
    '@/services/workoutService': { normalizeSetType: type => type?.trim().toLowerCase() === 'warmup' ? 'warmup' : 'normal' },
  })('app/src/services/statsService.ts');
  return { db, calls, service, async switchUser(id) { currentUser = id; await db.exec(`set test.user_id='${id}'`); } };
}

test('exercise statistics RPC preserves legacy arithmetic and only returns daily aggregates beyond 1000 sets', async t => {
  const { service, calls, db } = await setup(t);
  const records = await service.getExercisePersonalRecords(exercise);
  assert.equal(records.completedSetCount, 1263);
  for (const metric of ['volume', 'reps', 'duration', 'weight', 'e1rm']) {
    for (const locale of ['pt', 'en']) {
      const expected = await service.getExerciseProgress(exercise, metric, locale);
      calls.length = 0;
      const result = await service.getExerciseStats(exercise, metric, locale);
      assert.deepEqual(plain(result.progress), plain(expected));
      assert.deepEqual(plain(result.records), plain(records));
      assert.deepEqual(plain(calls), [{ rpc: 'exercise_stats_summary', args: { p_exercise_id: exercise } }]);
    }
  }
  const payload = (await db.query('select public.exercise_stats_summary($1::uuid) value', [exercise])).rows[0].value;
  assert.equal(payload.progress.length, 3);
  assert.ok(JSON.stringify(payload).length < 2000);
});

test('exercise summary cutoffs retain all-time records and authenticated access respects own user and set RLS', async t => {
  const { service, switchUser, db } = await setup(t);
  const full = await service.getExerciseStats(exercise, 'weight', 'pt');
  const filtered = await service.getExerciseStats(exercise, 'weight', 'pt', { sinceDate: '2026-10-02' });
  assert.deepEqual(filtered.progress, full.progress.filter(point => point.date >= '2026-10-02'));
  assert.deepEqual(filtered.records, full.records);
  assert.equal(full.records.heaviestWeight, 350.1);
  assert.equal(full.progress[0].maxWeight, 50);
  assert.equal(full.progress[0].maxWeightReps, 5);
  assert.equal(full.progress[0].durationMinutes, 1);
  assert.equal(full.progress[1].durationMinutes, 2);
  await switchUser(other);
  const foreign = await service.getExerciseStats(exercise);
  assert.equal(foreign.records.completedSetCount, 1);
  assert.equal(foreign.records.heaviestWeight, 10000);
  assert.equal(foreign.progress[0].date, '2026-10-04');
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select public.exercise_stats_summary($1::uuid)', [exercise]), /permission denied/);
});

test('empty exercise summaries preserve empty charts and zero records', async t => {
  const { service } = await setup(t);
  const result = await service.getExerciseStats(emptyExercise);
  assert.deepEqual(plain(result.progress), []);
  assert.deepEqual(plain(result.records), { heaviestWeight: 0, bestEstimated1RM: 0, bestDayVolume: 0, completedSetCount: 0 });
});

test('exercise summary failures reject without downloading raw sets or treating errors as empty data', async () => {
  let rawReads = 0;
  const service = loadSource({
    '@/services/supabase': { supabase: { rpc: async () => ({ data: null, error: { message: 'Offline summary' } }), from() { rawReads++; throw new Error('Unexpected raw-set read'); } } },
    '@/services/authUserService': { getSessionUserOrThrow: async () => ({ id: owner }) },
    '@/services/workoutService': { normalizeSetType: value => value },
  })('app/src/services/statsService.ts');
  await assert.rejects(service.getExerciseStats(exercise), /Offline summary/);
  await assert.rejects(service.getExerciseStats('   '), /Exercise id is required/);
  assert.equal(rawReads, 0);
});
