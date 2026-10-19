const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const loadSource = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('exercise detail shares its statistics load and pages only the visible history', async t => {
  let statsCalls = 0;
  const pages = [];
  let result;
  const load = loadSource({ '@/services/workoutService': { getErrorMessage: e => e.message }, '@/services/statsService': {
    getExerciseStats: async () => { statsCalls++; return { progress: [{ date: '2026-10-01', value: 10 }], records: { heaviestWeight: 10 } }; },
    getExerciseWorkoutHistory: async (_id, options) => { pages.push(options); return Array.from({ length: options.offset ? 1 : 20 }, (_, i) => ({ workoutId: `w${(options.offset ?? 0) + i}` })); },
  } });
  const { useExerciseDetailsData } = load('app/src/hooks/useExerciseDetailsData.ts');
  function Consumer({ id }) { result = useExerciseDetailsData(id); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(Consumer, { id: 'exercise' })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(statsCalls, 1);
  assert.equal(result.history.length, 20);
  assert.equal(result.hasMoreHistory, true);
  await act(async () => result.loadMoreHistory());
  assert.equal(result.history.length, 21);
  assert.equal(result.hasMoreHistory, false);
  assert.deepEqual(pages.map(p => p.offset), [0, 20]);
  assert.equal(statsCalls, 1);
});

test('late exercise results cannot replace a newer exercise or turn an error into empty success', async t => {
  let finish;
  let result;
  const load = loadSource({ '@/services/workoutService': { getErrorMessage: e => e.message }, '@/services/statsService': {
    getExerciseStats: id => id === 'old' ? new Promise(resolve => { finish = resolve; }) : Promise.reject(new Error('Offline')),
    getExerciseWorkoutHistory: async () => [],
  } });
  const { useExerciseDetailsData } = load('app/src/hooks/useExerciseDetailsData.ts');
  function Consumer({ id }) { result = useExerciseDetailsData(id); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(Consumer, { id: 'old' })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  await act(async () => tree.update(React.createElement(Consumer, { id: 'new' })));
  await act(async () => finish({ progress: [{ date: 'old' }], records: {} }));
  assert.equal(result.statsError, 'Offline');
  assert.equal(result.progress.length, 0);
});
