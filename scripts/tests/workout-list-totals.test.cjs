const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

function setup(cap=1000) {
  const workouts = Array.from({ length: 20 }, (_, i) => ({
    id: `w${i}`, user_id: 'owner', name: `Workout ${i}`,
    start_time: '2026-10-17T09:00:00Z', end_time: '2026-10-17T10:00:00Z',
  }));
  const sets = Array.from({ length: 1200 }, (_, i) => ({
    id: `s${String(i).padStart(5, '0')}`, workout_id: workouts[Math.floor(i / 60)].id,
    exercise_id: 'exercise', set_number: i % 60 + 1, weight: 10, reps: 2,
    set_type: i % 60 === 0 ? 'warmup' : 'normal',
    exercises: { id: 'exercise', name: 'Exercise' },
  }));
  const supabase = {
    rpc: async () => ({data: [], error: null}),
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'owner-token', user: { id: 'owner' } } }, error: null }),
      getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }),
    },
    from(table) {
      let rows = table === 'workouts' ? [...workouts] : table === 'sets' ? [...sets] : [];
      let from = 0, to = 999;
      const query = {
        select() { return query; },
        maybeSingle() { return Promise.resolve({data:rows[0] ?? null,error:null}); },
        eq(key, value) { rows = rows.filter(r => r[key] === value); return query; },
        in(key, values) { rows = rows.filter(r => values.includes(r[key])); return query; },
        gt(key, value) { rows = rows.filter(r => r[key] > value); return query; },
        not() { return query; }, or() { return query; },
        order(key, { ascending }) { rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)); return query; },
        range(a, b) { from = a; to = b; return query; },
        limit(n) { to = n - 1; return query; },
        then(resolve, reject) { return Promise.resolve({ data: rows.slice(from, Math.min(to + 1,from+cap)), error: null }).then(resolve, reject); },
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

test('details keep all sets beyond the project cap',async()=>{
 const service=setup(17);
 const details=await service.getWorkoutDetails('w0');
 assert.equal(details.totalSets,60);
});
