const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setImmediate } = require('node:timers/promises');
const { createClient } = require('@supabase/supabase-js');
const loadSource = require('./load-source.cjs');

const USER_ID = '00000000-0000-0000-0000-000000000001';
let clientNumber = 0;
const user = { id: USER_ID, email: 'qa@example.test' };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function loadAuth(client) {
  return loadSource({ '@/services/supabase': { supabase: client }, '@/utils/uuid': { generateId: () => 'unused' } })('app/src/services/workoutService.ts').getAuthenticatedUserOrThrow;
}
async function setup(t) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: USER_ID, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.test-signature`;
  const gate = deferred();
  const started = deferred();
  let hold = false;
  let authCalls = 0;
  let restCalls = 0;
  const client = createClient('https://supabase.example.test', 'public-key', {
    auth: { storageKey: `test-auth-queue-${++clientNumber}`, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async input => {
      if (new URL(input).pathname === '/auth/v1/user') {
        if (hold) { authCalls++; started.resolve(); await gate.promise; }
        return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      restCalls++;
      return new Response(JSON.stringify([{ id: 'row' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const initialized = await client.auth.setSession({ access_token: token, refresh_token: 'test-refresh' });
  assert.equal(initialized.error, null);
  t.after(() => gate.resolve());
  hold = true;
  return { client, getUser: loadAuth(client), gate, started, get authCalls() { return authCalls; }, get restCalls() { return restCalls; } };
}

test('server user verification does not hold the session lock needed by database requests', async t => {
  const probe = await setup(t);
  const verification = probe.getUser();
  await probe.started.promise;
  const query = Promise.resolve(probe.client.from('profiles').select('id'));
  await setImmediate();
  try {
    assert.equal(probe.restCalls, 1, 'the database query is blocked behind an unrelated auth HTTP request');
  } finally {
    probe.gate.resolve();
    await Promise.all([verification, query]);
  }
});

test('concurrent checks share one pending verification but a later check validates again', async t => {
  const probe = await setup(t);
  const checks = [probe.getUser(), probe.getUser(), probe.getUser()];
  await probe.started.promise;
  await setImmediate();
  probe.gate.resolve();
  const users = await Promise.all(checks);
  assert.deepEqual(users.map(value => value.id), [USER_ID, USER_ID, USER_ID]);
  assert.equal(probe.authCalls, 1);
  await probe.getUser();
  assert.equal(probe.authCalls, 2, 'completed validations must not be cached');
});

test('remote rejection cannot fall back to the user stored locally', async () => {
  const getUser = loadAuth({ auth: {
    getSession: async () => ({ data: { session: { access_token: 'token-a', user } }, error: null }),
    getUser: async () => ({ data: { user: null }, error: { message: 'Invalid JWT' } }),
  } });
  await assert.rejects(getUser(), /Invalid JWT/);
});

test('signing out during verification prevents the old identity from being returned', async () => {
  const gate = deferred();
  let activeSession = { access_token: 'token-a', user };
  const getUser = loadAuth({ auth: {
    getSession: async () => ({ data: { session: activeSession }, error: null }),
    getUser: async () => { await gate.promise; return { data: { user }, error: null }; },
  } });
  const pending = getUser();
  await setImmediate();
  activeSession = null;
  gate.resolve();
  await assert.rejects(pending, /session|account/i);
});

test('a different account cannot share the previous token verification', async () => {
  const gate = deferred();
  const otherUser = { id: '00000000-0000-0000-0000-000000000002' };
  let activeSession = { access_token: 'token-a', user };
  const checkedTokens = [];
  const getUser = loadAuth({ auth: {
    getSession: async () => ({ data: { session: activeSession }, error: null }),
    getUser: async token => {
      checkedTokens.push(token);
      if (token === 'token-a') await gate.promise;
      return { data: { user: token === 'token-a' ? user : otherUser }, error: null };
    },
  } });
  const pending = getUser();
  await setImmediate();
  activeSession = { access_token: 'token-b', user: otherUser };
  assert.equal((await getUser()).id, otherUser.id);
  gate.resolve();
  await assert.rejects(pending, /Session changed/);
  assert.deepEqual(checkedTokens, ['token-a', 'token-b']);
});

test('a failed shared request is cleared so a later validation can retry', async () => {
  let calls = 0;
  const getUser = loadAuth({ auth: {
    getSession: async () => ({ data: { session: { access_token: 'token-a', user } }, error: null }),
    getUser: async () => ++calls === 1 ? { data: { user: null }, error: { message: 'Temporary auth failure' } } : { data: { user }, error: null },
  } });
  const failed = await Promise.allSettled([getUser(), getUser()]);
  assert.ok(failed.every(result => result.status === 'rejected'));
  assert.equal(calls, 1);
  assert.equal((await getUser()).id, user.id);
  assert.equal(calls, 2);
});

test('a token refresh for the same account does not discard a valid server verification', async () => {
  const gate = deferred();
  let activeSession = { access_token: 'token-a', user };
  const getUser = loadAuth({ auth: {
    getSession: async () => ({ data: { session: activeSession }, error: null }),
    getUser: async () => { await gate.promise; return { data: { user }, error: null }; },
  } });
  const pending = getUser();
  await setImmediate();
  activeSession = { access_token: 'refreshed-token-a', user };
  gate.resolve();
  assert.equal((await pending).id, USER_ID);
});

test('a missing or unreadable session does not send a user verification request', async () => {
  for (const error of [null, { message: 'Storage unavailable' }]) {
    let calls = 0;
    const getUser = loadAuth({ auth: {
      getSession: async () => ({ data: { session: null }, error }),
      getUser: async () => { calls++; return { data: { user }, error: null }; },
    } });
    await assert.rejects(getUser(), error ? /Storage unavailable/ : /session not found/i);
    assert.equal(calls, 0);
  }
});
