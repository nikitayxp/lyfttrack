const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

function setup(rpcError = null) {
  const state = { name: 'Original', weight: 20 };
  const calls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError }; },
    from(table) {
      let payload;
      const filters = {};
      const query = {
        update(value) { payload = value; return query; },
        eq(key, value) { filters[key] = value; return query; },
        then(resolve, reject) {
          if (filters.id === 'missing') return Promise.resolve({ error: { message: 'write failed' } }).then(resolve, reject);
          if (table === 'workouts') state.name = payload.name;
          if (table === 'sets') state.weight = payload.weight;
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const dependencies = { '@/services/supabase': { supabase } };
  const helpers = createSourceLoader(dependencies)('app/src/services/workoutService.ts');
  const types = createSourceLoader()('app/src/services/workoutSession.types.ts');
  const { updateWorkoutSets } = createSourceLoader({ ...dependencies, './workoutService': helpers, './workoutSession.types': types })('app/src/services/sessionRepository.ts');
  return { state, calls, updateWorkoutSets };
}

test('a failed edit cannot leave an earlier name or set change committed', async () => {
  const { state, updateWorkoutSets } = setup({ message: 'write failed' });
  await assert.rejects(updateWorkoutSets({
    workoutId: 'workout', workoutName: 'Changed',
    setPatches: [{ setId: 'first', weight: 30 }, { setId: 'missing', weight: 40 }],
  }), /write failed/);
  assert.deepEqual(state, { name: 'Original', weight: 20 });
});

test('an edit sends one transaction with normalized fields and explicit note removal', async () => {
  const { calls, updateWorkoutSets } = setup();
  await updateWorkoutSets({
    workoutId: ' workout ', workoutName: '  Changed  ', workoutNotes: null,
    setPatches: [{ setId: ' first ', weight: 30.126, reps: 8, rir: null, side: 'left' }],
    notesByExerciseId: { exercise: '  Focus  ' },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'update_workout_atomic');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)), {
    p_workout_id: 'workout', p_workout_patch: { name: 'Changed', notes: null },
    p_set_patches: [{ id: 'first', weight: 30.13, reps: 8, rir: null, side: 'left' }],
    p_exercise_notes: { exercise: 'Focus' },
  });
});
