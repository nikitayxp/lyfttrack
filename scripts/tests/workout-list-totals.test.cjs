const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

function setup(cap=1000, rpc = async () => ({data: [], error: null}), { setRequests = [], setsPerWorkout = 60, exposesCount = true } = {}) {
  const workouts = Array.from({ length: 20 }, (_, i) => ({
    id: `w${i}`, user_id: 'owner', name: `Workout ${i}`,
    start_time: '2026-10-17T09:00:00Z', end_time: '2026-10-17T10:00:00Z',
  }));
  const sets = Array.from({ length: workouts.length * setsPerWorkout }, (_, i) => ({
    id: `s${String(i).padStart(5, '0')}`, workout_id: workouts[Math.floor(i / setsPerWorkout)].id,
    exercise_id: 'exercise', set_number: i % setsPerWorkout + 1, weight: 10, reps: 2,
    set_type: i % setsPerWorkout === 0 ? 'warmup' : 'normal',
    exercises: { id: 'exercise', name: 'Exercise' },
  }));
  const supabase = {
    rpc,
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'owner-token', user: { id: 'owner' } } }, error: null }),
      getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }),
    },
    from(table) {
      let rows = table === 'workouts' ? [...workouts] : table === 'sets' ? [...sets] : [];
      let from = 0, to = 999;
      let countMode;
      const query = {
        select(_projection, options) { countMode = options?.count; return query; },
        maybeSingle() { return Promise.resolve({data:rows[0] ?? null,error:null}); },
        eq(key, value) { rows = rows.filter(r => r[key] === value); return query; },
        in(key, values) { rows = rows.filter(r => values.includes(r[key])); return query; },
        gt(key, value) { rows = rows.filter(r => r[key] > value); return query; },
        not() { return query; }, or() { return query; },
        order(key, { ascending }) { rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)); return query; },
        range(a, b) { from = a; to = b; return query; },
        limit(n) { to = n - 1; return query; },
        then(resolve, reject) {
          const data = rows.slice(from, Math.min(to + 1, from + cap));
          const count = exposesCount && countMode === 'exact' ? rows.length : null;
          if (table === 'sets') setRequests.push([data.length, countMode]);
          return Promise.resolve({ data, count, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return createSourceLoader({ '@/services/supabase': { supabase } })('app/src/services/workoutService.ts');
}

for (const method of ['getFeedWorkouts', 'getUserWorkouts']) {
  test(`${method} keeps every workout total when the page contains more than 1000 sets`, async () => {
    const service = setup();
    const workouts = await (method === 'getFeedWorkouts' ? service[method]() : service[method]('owner'));
    assert.equal(workouts.length, 20);
    for (const workout of workouts) {
      assert.equal(workout.totalSets, 60);
      assert.equal(workout.workingSets, 59);
      assert.equal(workout.totalVolume, 1200);
      assert.equal(workout.exerciseGroups[0].sets.length, 60);
    }
  });
}

test('history skips the empty follow-up when the exact count fits in one response', async () => {
  const setRequests = [];
  const service = setup(1000, undefined, { setRequests, setsPerWorkout: 12 });
  const history = await service.getUserWorkouts('owner', 0, 20, undefined, { deferRecords: true });
  assert.equal(history.length, 20);
  assert.ok(history.every(workout => workout.totalSets === 12 && workout.totalVolume === 240));
  assert.deepEqual(setRequests, [[240, 'exact']]);
});

test('history continues when the response cap is below the exact count', async () => {
  const setRequests = [];
  const service = setup(137, undefined, { setRequests, setsPerWorkout: 12 });
  const history = await service.getUserWorkouts('owner');
  assert.equal(history.length, 20);
  assert.ok(history.every(workout => workout.totalSets === 12 && workout.exerciseGroups[0].sets.length === 12));
  assert.deepEqual(setRequests, [[137, 'exact'], [103, undefined], [0, undefined]]);
});

test('history keeps paginating when the server omits the exact count', async () => {
  const setRequests = [];
  const service = setup(1000, undefined, { setRequests, setsPerWorkout: 12, exposesCount: false });
  const history = await service.getUserWorkouts('owner');
  assert.equal(history.length, 20);
  assert.ok(history.every(workout => workout.totalSets === 12));
  assert.deepEqual(setRequests, [[240, 'exact'], [0, undefined]]);
});

test('details keep all sets beyond the project cap',async()=>{
 const service=setup(17);
 const details=await service.getWorkoutDetails('w0');
 assert.equal(details.totalSets,60);
});

test('deferred history returns complete cards before requesting records', async () => {
  let calls = 0;
  let finish;
  const service = setup(1000, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const history = service.getUserWorkouts('owner', 0, 20, undefined, { deferRecords: true });
  const result = await Promise.race([history, new Promise(resolve => setTimeout(() => resolve(null), 100))]);
  assert.ok(result, 'history must not wait for the records RPC');
  assert.equal(calls, 0);
  assert.equal(result[0].prCount, null);
  assert.equal(result[0].totalSets, 60);
  const records = service.getUserWorkoutRecordCounts(result);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  finish({ data: result.map(w => ({workout_id:w.id, exercise_id:'exercise', has_history:true, best_weight:1, best_e1rm:1})), error: null });
  assert.equal((await records).get(result[0].id), 1);
});
