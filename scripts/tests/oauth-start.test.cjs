const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

function setup({ platform = 'ios', result = { type: 'success', url: 'lyfttrack://callback?code=native-code' }, secureContext = true, exchangeError = null } = {}) {
  const exchanges = [];
  const starts = [];
  const navigations = [];
  let activeSession = null;
  const load = createSourceLoader({
    '@react-native-async-storage/async-storage': {},
    'react-native': { Platform: { OS: platform } },
    'expo-web-browser': { openAuthSessionAsync: async () => result },
    '@/services/authUserService': {},
    '@/services/supabase': {
      getGoogleOAuthRedirectTo: () => platform === 'web' ? 'https://app.example.test/callback' : 'lyfttrack://callback',
      isNonLoopbackIpOrigin: () => false,
      supabase: { auth: {
        signInWithOAuth: async options => { starts.push(options); return { data: { url: 'https://supabase.example.test/auth/v1/authorize?provider=google' }, error: null }; },
        exchangeCodeForSession: async code => { exchanges.push(code); if (!exchangeError) activeSession = { user: { id: 'test-user' } }; return { data: { session: activeSession, user: activeSession?.user }, error: exchangeError }; },
        getSession: async () => ({ data: { session: activeSession }, error: null }),
      } },
    },
  }, { __DEV__: false, globalThis: { crypto: { subtle: { digest() {} } } }, window: platform === 'web' ? { isSecureContext: secureContext, location: { assign: url => navigations.push(url) } } : undefined });
  return { ...load('app/src/services/authService.ts'), exchanges, starts, navigations };
}

test('a successful native browser return completes its PKCE code without needing a route event', async () => {
  const app = setup();
  await app.startGoogleOAuth();
  assert.deepEqual(app.exchanges, ['native-code']);
});

test('native cancellation and provider errors cannot establish a session', async () => {
  for (const result of [{ type: 'cancel' }, { type: 'success', url: 'lyfttrack://callback?error=access_denied' }]) {
    const app = setup({ result });
    await assert.rejects(app.startGoogleOAuth());
    assert.equal(app.exchanges.length, 0);
  }
});

test('a failed native code exchange is reported to the sign-in screen', async () => {
  const app = setup({ exchangeError: { message: 'Invalid code' } });
  await assert.rejects(app.startGoogleOAuth(), /Invalid code/);
});

test('Google OAuth cannot start from an insecure browser context', async () => {
  const app = setup({ platform: 'web', secureContext: false });
  await assert.rejects(app.startGoogleOAuth(), /oauth-insecure-context/);
  assert.equal(app.starts.length, 0);
  assert.equal(app.navigations.length, 0);
});

test('a secure browser starts OAuth and navigates directly to its authorize URL', async () => {
  const app = setup({ platform: 'web' });
  await app.startGoogleOAuth();
  assert.equal(app.starts.length, 1);
  assert.deepEqual(app.navigations, ['https://supabase.example.test/auth/v1/authorize?provider=google']);
});
