const assert = require('node:assert/strict');
const { test } = require('node:test');
const load = require('./load-source.cjs')();
const { summarizeExercisePreview } = load('app/src/utils/workoutPreview.ts');

test('a heavy warm-up is excluded from the representative working set', () => {
  const group = { exercise_name: 'Squat', name_pt: 'Agachamento', sets: [
    { weight: 150, reps: 1, set_type: 'warmup' }, { weight: 100, reps: 5, set_type: 'normal' },
    { weight: 100, reps: 8, set_type: 'normal' }, { weight: 90, reps: 12, set_type: 'drop' },
  ] };
  const summary = summarizeExercisePreview(group, 'pt', true);
  assert.equal(summary.name, 'Agachamento');
  assert.equal(summary.setCount, 3);
  assert.equal(summary.weight, 100);
  assert.equal(summary.reps, 8);
  assert.equal(summarizeExercisePreview(group, 'en', false).setCount, 4);
});

test('bodyweight, zero reps, and warm-up-only exercises do not invent a best set', () => {
  const group = { exercise_name: 'Pull-up', sets: [{ weight: 0, reps: 12, set_type: 'normal' }, { weight: 40, reps: 0, set_type: 'normal' }] };
  assert.equal(summarizeExercisePreview(group, 'en', false).reps, 12);
  assert.equal(summarizeExercisePreview(group, 'en', false).weight, 0);
  const warmup = summarizeExercisePreview({ ...group, sets: [{ weight: 30, reps: 8, set_type: 'warmup' }] }, 'en', true);
  assert.equal(warmup.setCount, 0);
  assert.equal(warmup.reps, null);
});
