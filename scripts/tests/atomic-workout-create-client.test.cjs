const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

function setup(error = null, switchAccount = false) {
  let userId = 'owner';
  const calls = [];
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: userId, user: { id: userId } } }, error: null }),
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    from() { throw Error('Unexpected non-atomic write'); },
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (switchAccount) userId = 'different';
      return { error, data: error ? null : { workout_id: 'saved', inserted_set_count: 1, start_time: '2026-10-18T10:00:00Z', end_time: '2026-10-18T10:10:00Z' } };
    },
  };
  const dependencies = { '@/services/supabase': { supabase } };
  const helpers = createSourceLoader(dependencies)('app/src/services/workoutService.ts');
  const types = createSourceLoader()('app/src/services/workoutSession.types.ts');
  const { createWorkoutWithSets } = createSourceLoader({ ...dependencies, './workoutService': helpers, './workoutSession.types': types })('app/src/services/sessionRepository.ts');
  return { calls, createWorkoutWithSets };
}

const input = {
  sessionStartTime: '2026-10-18T09:59:00Z', name: '  Treino  ', startTime: '2026-10-18T10:00:00Z', endTime: '2026-10-18T10:10:00Z',
  setDrafts: [{ exerciseId: 'exercise', setNumber: 1, weight: 30.126, reps: 8, side: 'left' }],
};

test('creation sends one atomic request and retains the session identity across retries', async () => {
  const { calls, createWorkoutWithSets } = setup();
  const result = await createWorkoutWithSets(input);
  await createWorkoutWithSets({ ...input, startTime: '2026-10-18T10:02:00Z', endTime: '2026-10-18T10:12:00Z' });
  assert.equal(result.workoutId, 'saved');
  assert.equal(result.endTime, '2026-10-18T10:10:00Z');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, 'create_workout_atomic');
  assert.equal(calls[0].args.p_expected_user_id, 'owner');
  assert.equal(calls[0].args.p_workout.session_started_at, calls[1].args.p_workout.session_started_at);
  assert.equal(calls[0].args.p_sets[0].weight, 30.13);
  assert.equal(calls[0].args.p_exercises[0].exercise_id, 'exercise');
});

test('failed creation rejects without attempting a legacy write or cleanup', async () => {
  const { calls, createWorkoutWithSets } = setup({ message: 'Response lost' });
  await assert.rejects(createWorkoutWithSets(input), /Response lost/);
  assert.equal(calls.length, 1);
});

test('invalid rows cannot be silently dropped before saving the remaining workout', async () => {
  const { calls, createWorkoutWithSets } = setup();
  await assert.rejects(createWorkoutWithSets({ ...input, setDrafts: [...input.setDrafts, { exerciseId: '', setNumber: 1 }] }), error => error.code === 'no-valid-set-rows');
  assert.equal(calls.length, 0);
});


test('a response received after switching accounts cannot complete the new account session', async () => {
  const { calls, createWorkoutWithSets } = setup(null, true);
  await assert.rejects(createWorkoutWithSets(input), /Account changed/);
  assert.equal(calls.length, 1);
});
