const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setImmediate } = require('node:timers/promises');
const loadSource = require('./load-source.cjs');

const session = id => ({ user: { id }, access_token: `fixture-${id}` });
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function setup(t, checkDeleted) {
  const initial = deferred();
  const snapshots = [];
  let receive;
  let invalidate;
  let invalidations = 0;
  const load = loadSource({
    'react-native': { Platform: { OS: 'web' } },
    '@/services/dataCache': {
      invalidateExerciseCatalogCache() {},
      invalidateWorkoutDataCache() { invalidations++; },
    },
    '@/services/supabase': {
      isDeletedAuthAccount: checkDeleted,
      subscribeDeletedAuthAccounts(listener) { invalidate = listener; return () => {}; },
      observeDeletedAuthAccount() {},
      supabase: { auth: {
        getSession: () => initial.promise,
        onAuthStateChange(listener) {
          receive = listener;
          return { data: { subscription: { unsubscribe() {} } } };
        },
      } },
    },
  });
  const store = load('app/src/services/authSessionStore.ts');
  t.after(store.subscribeAuthSession(next => snapshots.push(next)));
  return {
    send: (id, event = 'SIGNED_IN') => receive(event, id ? session(id) : null),
    invalidate: id => invalidate(id),
    last: () => snapshots.at(-1),
    invalidations: () => invalidations,
  };
}

test('a pending auth event cannot restore an account invalidated during its storage check', async t => {
  const oldRead = deferred();
  const store = setup(t, () => oldRead.promise);
  store.send('A', 'INITIAL_SESSION');
  store.invalidate('A');
  oldRead.resolve(false);
  await setImmediate();
  assert.equal(store.last().session, null);
  assert.equal(store.last().isPending, false);
});

test('a late event for the deleted account cannot replace a pending login to another account', async t => {
  const newRead = deferred();
  const store = setup(t, id => id === 'B' ? newRead.promise : Promise.resolve(false));
  store.send('A');
  await setImmediate();
  assert.equal(store.last().session.user.id, 'A');
  store.invalidate('A');
  store.send('B');
  store.send('A', 'TOKEN_REFRESHED');
  newRead.resolve(false);
  await setImmediate();
  assert.equal(store.last().session.user.id, 'B');
  assert.equal(store.invalidations(), 3);
});

test('a real sign-out supersedes pending events from before it', async t => {
  const oldRead = deferred();
  const store = setup(t, () => oldRead.promise);
  store.send('B');
  store.send(null, 'SIGNED_OUT');
  oldRead.resolve(false);
  await setImmediate();
  assert.equal(store.last().session, null);
  assert.equal(store.last().isPending, false);
});
