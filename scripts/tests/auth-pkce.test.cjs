const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash, randomFillSync } = require('node:crypto');
const sdk = require('@supabase/supabase-js');
const createSourceLoader = require('./load-source.cjs');

let nextClient = 0;
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'test@example.test' };

function memoryStorage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}

function session(subject = user) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: subject.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.test`,
    refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: subject,
  };
}

async function setup(t, platform = 'web', nativeBridge) {
  const storage = memoryStorage();
  const requests = [];
  let client;
  const replacements = {
    '@react-native-async-storage/async-storage': storage,
    'react-native': { Platform: { OS: platform } },
    'expo-linking': { createURL: path => `lyfttrack://${path}` },
    '@/utils/authCrypto': {},
    '@supabase/supabase-js': { ...sdk, createClient: (url, key, options) => {
      client = sdk.createClient(url, key, {
        ...options,
        auth: { ...options.auth, autoRefreshToken: false, storageKey: `test-pkce-${++nextClient}` },
        global: { fetch: async (input, init) => {
          const url = new URL(input);
          const body = init?.body ? JSON.parse(init.body) : null;
          const authorization = new Headers(init?.headers).get('authorization');
          let requestUser = user;
          if (url.pathname.endsWith('/user') && authorization?.includes('.')) {
            const token = authorization.replace(/^Bearer /, '');
            requestUser = { ...user, id: JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub };
          }
          requests.push({ path: url.pathname, query: url.search, body, method: init?.method, authorization });
          return new Response(JSON.stringify(url.pathname.endsWith('/recover') ? {} : url.pathname.endsWith('/user') ? requestUser : session()), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } },
      });
      return client;
    } },
    ...(nativeBridge ? { 'expo-crypto': nativeBridge } : {}),
  };
  if (nativeBridge) {
    Object.defineProperty(replacements, '@/utils/authCrypto', { get: () => load('app/src/utils/authCrypto.native.ts') });
  }
  const load = createSourceLoader(replacements, {
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://supabase.example.test', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key' } },
    __DEV__: false,
    window: platform === 'web' ? { localStorage: storage, location: { origin: 'https://app.example.test' } } : undefined,
    ...(nativeBridge ? { globalThis } : {}),
  });
  const source = load('app/src/services/supabase.ts');
  await client.auth.getSession();
  t.after(() => client.auth.stopAutoRefresh());
  return { ...source, storage, requests };
}

for (const platform of ['web', 'ios', 'android']) {
  test(`${platform} Google authorization sends S256 and keeps the verifier in its own storage`, async t => {
    const app = await setup(t, platform);
    const { data, error } = await app.supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: app.getGoogleOAuthRedirectTo(), skipBrowserRedirect: true } });
    assert.equal(error, null);
    const url = new URL(data.url);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    const stored = [...app.storage.values.entries()].find(([key]) => key.endsWith('-code-verifier'));
    assert.ok(stored, 'the verifier must survive the external browser roundtrip');
    const verifier = JSON.parse(stored[1]);
    assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(verifier).digest('base64url'));
    assert.ok(!url.toString().includes(verifier));
    assert.equal(url.searchParams.has('access_token'), false);
    assert.equal(url.searchParams.has('refresh_token'), false);
  });
}

test('a recovery code can be verified and the password updated in an independent browser with PKCE', async t => {
  const requester = await setup(t);
  const receiver = await setup(t);
  const sent = await requester.supabase.auth.resetPasswordForEmail(user.email, { redirectTo: requester.getPasswordResetRedirectTo() });
  assert.equal(sent.error, null);
  const recovery = requester.requests.find(request => request.path.endsWith('/recover'));
  assert.equal(recovery.body.code_challenge_method, 's256');
  assert.ok(recovery.body.code_challenge);
  assert.equal([...receiver.storage.values.keys()].some(key => key.endsWith('-code-verifier')), false);
  const events = [];
  const { data: listener } = receiver.supabase.auth.onAuthStateChange(event => { events.push(event); });
  t.after(() => listener.subscription.unsubscribe());
  const verified = await receiver.supabase.auth.verifyOtp({ email: user.email, token: '123456', type: 'recovery' });
  assert.equal(verified.error, null);
  assert.equal(verified.data.user.id, user.id);
  assert.ok(events.includes('PASSWORD_RECOVERY'));
  const changed = await receiver.supabase.auth.updateUser({ password: 'replacement-test-password' });
  assert.equal(changed.error, null);
  assert.equal(receiver.requests.some(request => request.path.endsWith('/token')), false);
  assert.equal(receiver.requests.find(request => request.path.endsWith('/verify')).body.token, '123456');
  assert.equal(receiver.requests.find(request => request.path.endsWith('/user')).body.password, 'replacement-test-password');
});

test('native OAuth uses secure random bytes and SHA-256 when Web Crypto is absent', async t => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  t.after(() => Object.defineProperty(globalThis, 'crypto', originalCrypto));
  let randomCalls = 0;
  let digestCalls = 0;
  const app = await setup(t, 'android', {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomValues: array => { randomCalls++; return randomFillSync(array); },
    digest: async (algorithm, input) => {
      digestCalls++;
      assert.equal(algorithm, 'SHA-256');
      const bytes = createHash('sha256').update(new Uint8Array(input.buffer, input.byteOffset, input.byteLength)).digest();
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  });
  const { data, error } = await app.supabase.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } });
  assert.equal(error, null);
  assert.equal(new URL(data.url).searchParams.get('code_challenge_method'), 's256');
  assert.ok(randomCalls > 0);
  assert.ok(digestCalls > 0);
});

test('recovery password update uses the verified token and preserves a different active account', async t => {
  const app = await setup(t);
  await app.supabase.auth.setSession(session());
  const verifiedSession = (await app.supabase.auth.getSession()).data.session;
  const other = { ...user, id: '00000000-0000-0000-0000-000000000002' };
  await app.supabase.auth.setSession(session(other));
  await app.updateRecoveredPassword(verifiedSession, 'replacement-test-password');
  const request = app.requests.find(request => request.method === 'PUT');
  assert.equal(request.authorization, `Bearer ${verifiedSession.access_token}`);
  assert.equal(request.body.password, 'replacement-test-password');
  assert.equal((await app.supabase.auth.getSession()).data.session.user.id, other.id);
});
