const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

function deferred() { let resolve; let reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }

async function setup(t) {
  const requests = [];
  const load = createSourceLoader({
    '@/services/profileService': { getPublicProfileById: async id => ({ id, username: id, visibility: 'public' }) },
    '@/services/workoutService': {
      getUserWorkoutMonthBuckets: async () => [],
      getErrorMessage: error => error.message,
      getUserWorkouts: (id, page, size, filter) => {
        const pending = deferred(); requests.push({ id, page, size, filter, ...pending }); return pending.promise;
      },
    },
  });
  const { useAthleteHistory } = load('app/src/hooks/useAthleteHistory.ts');
  let state;
  function Screen(props) { state = useAthleteHistory(props.id, props.filter); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(Screen, { id: 'a', filter: {} })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { requests, get state() { return state; }, async update(id, filter = {}) { await act(async () => tree.update(React.createElement(Screen, { id, filter }))); }, async resolve(index, value) { await act(async () => requests[index].resolve(value)); } };
}

test('the athlete header loads before a slow workout history', async t => {
  const app = await setup(t);
  assert.equal(app.state.profile.username, 'a');
  assert.equal(app.state.isLoadingProfile, false);
  assert.equal(app.state.isLoadingHistory, true);
});

test('all pages can be loaded and duplicate page requests are suppressed', async t => {
  const app = await setup(t);
  await app.resolve(0, Array.from({ length: 20 }, (_, i) => ({ id: `w${i}` })));
  assert.equal(app.state.hasMore, true);
  let pending;
  await act(async () => { pending = app.state.loadMore(); void app.state.loadMore(); });
  assert.equal(app.requests.length, 2);
  assert.equal(app.requests[1].page, 1);
  await app.resolve(1, [{ id: 'w19' }, { id: 'w20' }]);
  await act(async () => pending);
  assert.equal(app.state.workouts.length, 21);
  assert.equal(app.state.hasMore, false);
});

test('a late old-filter page cannot replace the selected month', async t => {
  const app = await setup(t);
  await app.update('a', { periodKey: '2024-12', search: 'squat' });
  await app.resolve(1, [{ id: 'december' }]);
  await app.resolve(0, [{ id: 'old' }]);
  assert.deepEqual(Array.from(app.state.workouts, row => row.id), ['december']);
  assert.equal(app.requests[1].filter.periodKey, '2024-12');
});

test('switching athletes clears their history and ignores earlier responses', async t => {
  const app = await setup(t);
  await app.update('b');
  assert.equal(app.state.profile.username, 'b');
  assert.equal(app.state.workouts.length, 0);
  await app.resolve(1, [{ id: 'b-workout' }]);
  await app.resolve(0, [{ id: 'a-private-workout' }]);
  assert.deepEqual(Array.from(app.state.workouts, row => row.id), ['b-workout']);
});

test('a failed next page preserves previous sessions and retries that page', async t => {
  const app = await setup(t);
  await app.resolve(0, Array.from({ length: 20 }, (_, i) => ({ id: `w${i}` })));
  let next;
  await act(async () => { next = app.state.loadMore(); });
  await act(async () => app.requests[1].reject(new Error('Offline')));
  await next;
  assert.equal(app.state.workouts.length, 20);
  assert.equal(app.state.historyError, 'Offline');
  let retry;
  await act(async () => { retry = app.state.retryHistory(); });
  assert.equal(app.requests[2].page, 1);
  await app.resolve(2, [{ id: 'w20' }]);
  await retry;
  assert.equal(app.state.workouts.length, 21);
  assert.equal(app.state.historyError, null);
});
