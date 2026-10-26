const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setImmediate } = require('node:timers/promises');
const loadSource = require('./load-source.cjs');

function gate() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function memoryStorage() {
  const values = new Map([['lyfttrack.auth.oauth.pending', String(Date.now())]]);
  return { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
}
function loadService(auth, name) {
  return loadSource({ '@react-native-async-storage/async-storage': memoryStorage(), '@/services/supabase': { supabase: { auth } } })(`app/src/services/${name}.ts`);
}

test('RLS reads use the session identity without a remote user verification', async () => {
  let remote = 0;
  const user = { id: 'account-a' };
  const service = loadService({ getSession: async () => ({ data: { session: { user, access_token: 'a' } }, error: null }), getUser: () => { remote++; } }, 'authUserService');
  assert.equal(typeof service.getSessionUserOrThrow, 'function');
  assert.equal((await service.getSessionUserOrThrow()).id, 'account-a');
  assert.equal(remote, 0);
});

test('RLS identity rejects unavailable storage and missing sessions', async () => {
  for (const error of [null, { message: 'Storage failed' }]) {
    const service = loadService({ getSession: async () => ({ data: { session: null }, error }) }, 'authUserService');
    await assert.rejects(service.getSessionUserOrThrow(), error ? /Storage failed/ : /session not found/i);
  }
});

test('OAuth completion shares one pending exchange and remembers a completed callback', async () => {
  const pending = gate();
  const codes = [];
  const service = loadService({ exchangeCodeForSession: async code => { codes.push(code); await pending.promise; return { error: null }; }, getSession: async () => ({ data: { session: { user: { id: 'a' } } }, error: null }) }, 'oauthReturn');
  assert.equal(typeof service.completeGoogleOAuthReturn, 'function');
  const calls = [service.completeGoogleOAuthReturn('lyfttrack://callback?code=one'), service.completeGoogleOAuthReturn('lyfttrack://callback?code=one')];
  pending.resolve();
  await Promise.all(calls);
  await service.completeGoogleOAuthReturn('lyfttrack://callback?code=one');
  assert.deepEqual(codes, ['one']);
});

test('OAuth completion supports native implicit returns, provider errors and retries', async () => {
  const tokens = [];
  let attempt = 0;
  const service = loadService({
    setSession: async value => { tokens.push(value); return { error: null }; },
    exchangeCodeForSession: async () => ({ error: ++attempt === 1 ? { message: 'temporary' } : null }),
    getSession: async () => ({ data: { session: null }, error: null }),
  }, 'oauthReturn');
  assert.equal(typeof service.completeGoogleOAuthReturn, 'function');
  await service.completeGoogleOAuthReturn('lyfttrack://callback#access_token=a&refresh_token=r');
  assert.equal(tokens[0].access_token, 'a');
  await assert.rejects(service.completeGoogleOAuthReturn('lyfttrack://callback?error=denied'), /denied/);
  await service.beginGoogleOAuthReturn();
  await assert.rejects(service.completeGoogleOAuthReturn('lyfttrack://callback?code=retry'), /temporary/);
  await service.completeGoogleOAuthReturn('lyfttrack://callback?code=retry');
  await assert.rejects(service.completeGoogleOAuthReturn('lyfttrack://callback'), /oauth-missing-code/);
});

test('replaying a completed callback after sign-out cannot report a signed-in session', async () => {
  let session = { user: { id: 'a' } };
  const service = loadService({
    exchangeCodeForSession: async () => ({ error: null }),
    getSession: async () => ({ data: { session }, error: null }),
  }, 'oauthReturn');
  await service.completeGoogleOAuthReturn('lyfttrack://callback?code=old');
  session = null;
  await assert.rejects(service.completeGoogleOAuthReturn('lyfttrack://callback?code=old'), /oauth-missing-code/);
});

test('shared session store has one subscription, rejects stale bootstrap and manages native refresh', async () => {
  const initial = gate();
  let callback, stateCallback;
  let subscriptions = 0, unsubscribeCount = 0, removed = 0, starts = 0, stops = 0;
  let workoutInvalidations = 0, catalogInvalidations = 0;
  const load = loadSource({
    '@/services/dataCache': { invalidateWorkoutDataCache: () => workoutInvalidations++, invalidateExerciseCatalogCache: () => catalogInvalidations++ },
    '@/services/supabase': { supabase: { auth: {
      getSession: () => initial.promise,
      onAuthStateChange: cb => { subscriptions++; callback = cb; return { data: { subscription: { unsubscribe: () => unsubscribeCount++ } } }; },
      startAutoRefresh: () => starts++, stopAutoRefresh: () => stops++,
    } } },
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener: (_, cb) => { stateCallback = cb; return { remove: () => removed++ }; } } },
  });
  const service = load('app/src/services/authSessionStore.ts');
  assert.equal(typeof service.subscribeAuthSession, 'function');
  const values = [], other = [];
  const first = service.subscribeAuthSession(value => values.push(value));
  const second = service.subscribeAuthSession(value => other.push(value));
  assert.equal(subscriptions, 1);
  callback('SIGNED_IN', { user: { id: 'new' } });
  initial.resolve({ data: { session: null }, error: null });
  await setImmediate();
  assert.equal(values.at(-1).session.user.id, 'new');
  assert.equal(other.at(-1).session.user.id, 'new');
  assert.equal(workoutInvalidations, 1);
  assert.equal(catalogInvalidations, 1);
  callback('TOKEN_REFRESHED', { user: { id: 'new' } });
  assert.equal(workoutInvalidations, 1);
  callback('SIGNED_OUT', null);
  assert.equal(workoutInvalidations, 2);
  assert.equal(catalogInvalidations, 2);
  assert.equal(starts, 1);
  stateCallback('background');
  assert.equal(stops, 1);
  stateCallback('active');
  assert.equal(starts, 2);
  first(); assert.equal(unsubscribeCount, 0);
  second(); assert.equal(unsubscribeCount, 1); assert.equal(removed, 1); assert.equal(stops, 2);
});

test('profile reads coalesce by account and never wait for metadata writes', async () => {
  const response = gate();
  let accountChanged;
  let id = 'a', reads = 0, updates = 0;
  const rows = { a: { id: 'a', username: 'a' }, b: { id: 'b', username: 'b' } };
  const load = loadSource({
    'expo-image-picker': {},
    '@/services/authSessionStore': { onAuthAccountChange(listener) { accountChanged = listener; } },
    '@/services/authUserService': { getSessionUserOrThrow: async () => ({ id }), getAuthenticatedUserOrThrow: async () => ({ id }) },
    '@/services/workoutService': { getAuthenticatedUserOrThrow: async () => ({ id }) },
    '@/services/supabase': { supabase: { auth: { updateUser: async () => { updates++; await new Promise(() => {}); } }, from: () => {
      reads++;
      return { select() { return this; }, eq(_, value) { this.id = value; return this; }, async maybeSingle() { await response.promise; return { data: rows[this.id], error: null }; } };
    } } },
  });
  const service = load('app/src/services/profileService.ts');
  const both = [service.getProfile(), service.getProfile()];
  response.resolve();
  const profiles = await Promise.race([Promise.all(both), setImmediate().then(() => 'blocked')]);
  assert.notEqual(profiles, 'blocked', 'profile read awaits an auth metadata write');
  assert.equal(reads, 1);
  assert.equal(updates, 0);
  await service.getProfile(); assert.equal(reads, 1);
  id = 'b'; assert.equal((await service.getProfile()).id, 'b');
  assert.equal(reads, 2);
  service.invalidateProfileCache();
  await service.getProfile(); assert.equal(reads, 3);
  accountChanged();
  await service.getProfile(); assert.equal(reads, 4);
});

test('a profile response for the previous account is rejected and cannot poison the new cache', async () => {
  const pending = gate();
  let accountId = 'a';
  const load = loadSource({
    'expo-image-picker': {},
    '@/services/authSessionStore': { onAuthAccountChange() {} },
    '@/services/authUserService': { getSessionUserOrThrow: async () => ({ id: accountId }) },
    '@/services/supabase': { supabase: { from: () => ({ select() { return this; }, eq(_, id) { this.id = id; return this; }, async maybeSingle() {
      if (this.id === 'a') await pending.promise;
      return { data: { id: this.id }, error: null };
    } }) } },
  });
  const service = load('app/src/services/profileService.ts');
  const old = service.getProfile();
  await setImmediate();
  accountId = 'b';
  assert.equal((await service.getProfile()).id, 'b');
  pending.resolve();
  await assert.rejects(old, /Session changed/);
  assert.equal((await service.getProfile()).id, 'b');
});

test('native Google login consumes its browser return and concurrent starts share one browser', async () => {
  const browser = gate();
  const storage = memoryStorage();
  await storage.removeItem('lyfttrack.auth.oauth.pending');
  let browsers = 0, starts = 0;
  const codes = [];
  const service = loadSource({
    '@react-native-async-storage/async-storage': storage,
    'react-native': { Platform: { OS: 'ios' } },
    'expo-web-browser': { openAuthSessionAsync: async () => { assert.ok(await storage.getItem('lyfttrack.auth.oauth.pending')); browsers++; return browser.promise; } },
    '@/services/supabase': { getGoogleOAuthRedirectTo: () => 'lyfttrack://callback', supabase: { auth: {
      signInWithOAuth: async () => { starts++; return { data: { url: 'https://provider.test' }, error: null }; },
      exchangeCodeForSession: async code => { codes.push(code); return { error: null }; },
    } } },
  })('app/src/services/authService.ts');
  const calls = [service.startGoogleOAuth(), service.startGoogleOAuth()];
  browser.resolve({ type: 'success', url: 'lyfttrack://callback?code=browser-code' });
  await Promise.all(calls);
  assert.equal(browsers, 1);
  assert.equal(starts, 1);
  assert.deepEqual(codes, ['browser-code']);
});

test('native client uses PKCE and processLock while web retains its default browser lock', () => {
  for (const os of ['ios', 'web']) {
    let options;
    const processLock = () => {};
    loadSource({
      '@supabase/supabase-js': { processLock, createClient: (_url, _key, config) => { options = config; return {}; } },
      '@react-native-async-storage/async-storage': { getItem() {} },
      'expo-linking': {},
      'react-native': { Platform: { OS: os } },
    }, { process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://project.test', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test' } } })('app/src/services/supabase.ts');
    assert.equal(options.auth.flowType, os === 'web' ? undefined : 'pkce');
    assert.equal(options.auth.lock, os === 'web' ? undefined : processLock);
    assert.equal(options.auth.detectSessionInUrl, false);
  }
});

test('native cancelled Google sessions reject and can be retried', async () => {
  let calls = 0;
  const service = loadSource({
    '@react-native-async-storage/async-storage': memoryStorage(),
    'react-native': { Platform: { OS: 'ios' } },
    'expo-web-browser': { openAuthSessionAsync: async () => { calls++; return { type: 'cancel' }; } },
    '@/services/supabase': { getGoogleOAuthRedirectTo: () => 'lyfttrack://callback', supabase: { auth: {
      signInWithOAuth: async () => ({ data: { url: 'https://provider.test' }, error: null }),
    } } },
  })('app/src/services/authService.ts');
  await assert.rejects(service.startGoogleOAuth(), /oauth-cancelled/);
  await assert.rejects(service.startGoogleOAuth(), /oauth-cancelled/);
  assert.equal(calls, 2);
});
