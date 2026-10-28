const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

async function setup(t, { href = 'https://lyfttrack-app.vercel.app/callback?code=auth-code', exchange, session = null, routeParams = {} } = {}) {
  const exchanges = [];
  const sessions = [];
  const redirects = [];
  const cleanedUrls = [];
  const routeUpdates = [];
  let activeSession = session;
  const browserWindow = { location: { href, replace: url => redirects.push(url) }, history: { replaceState: (_state, _title, url) => { cleanedUrls.push(url); browserWindow.location.href = new URL(url, browserWindow.location.href).toString(); } } };
  let language = 'pt';
  let translate = key => `${language}:${key}`;
  const load = createSourceLoader({
    'react-native': { ActivityIndicator: 'Spinner', StyleSheet: { create: value => value }, Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-linking': { createURL: () => 'lyfttrack://callback?code=auth-code' },
    'expo-router': { router: { setParams: value => routeUpdates.push(value) }, useLocalSearchParams: () => ({ ...routeParams, code: Array.isArray(routeParams.code) ? [...routeParams.code] : routeParams.code }) },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/constants/Styles': { Radius: {}, Spacing: {} },
    '@/components/auth/AuthAmbientGlow': { AuthAmbientGlow: ({ children }) => children },
    '@/components/ui/AppButton': { AppButton: props => React.createElement('Button', props) },
    '@/services/supabase': { supabase: { auth: {
      exchangeCodeForSession: async code => { exchanges.push(code); const result = exchange ? await exchange() : { error: null }; if (!result.error) activeSession = { user: { id: 'test-user' } }; return { ...result, data: { session: activeSession, user: activeSession?.user } }; },
      setSession: async value => { sessions.push(value); return { error: null }; },
      getSession: async () => ({ data: { session: activeSession }, error: null }),
    } } },
  }, { window: browserWindow });
  const Screen = load('app/app/(auth)/callback.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { get tree() { return tree; }, exchanges, sessions, redirects, cleanedUrls, browserWindow, routeUpdates,
    async remount() { await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(Screen)); }); },
    async changeLanguage() { language = 'en'; translate = key => `${language}:${key}`; await act(async () => tree.update(React.createElement(Screen))); } };
}

test('the browser PKCE callback exchanges only its authorization code', async t => {
  const app = await setup(t);
  assert.deepEqual(app.exchanges, ['auth-code']);
  assert.equal(app.sessions.length, 0);
});

test('language hydration cannot repeat a pending one-time OAuth exchange', async t => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const app = await setup(t, { exchange: () => pending });
  await app.changeLanguage();
  assert.equal(app.exchanges.length, 1);
  await act(async () => finish({ error: { message: 'Invalid code' } }));
  assert.match(JSON.stringify(app.tree.toJSON()), /en:auth.callback.errorDescription/);
});

test('an implicit token callback is rejected without establishing a session', async t => {
  const app = await setup(t, { href: 'https://lyfttrack-app.vercel.app/callback#access_token=test-access&refresh_token=test-refresh' });
  assert.equal(app.exchanges.length, 0);
  assert.equal(app.sessions.length, 0);
  assert.equal(app.tree.root.findAllByType('Button').length, 1);
});

test('a lan_return parameter never forwards the session tokens to another host', async t => {
  const lanReturn = encodeURIComponent('http://192.168.1.50:8081/callback');
  const app = await setup(t, { href: `https://lyfttrack-app.vercel.app/callback?lan_return=${lanReturn}#access_token=test-access&refresh_token=test-refresh` });
  assert.deepEqual(app.redirects, []);
  assert.equal(app.sessions.length, 0);
});

test('a callback remount cannot consume the same authorization code twice', async t => {
  const app = await setup(t, { href: 'https://lyfttrack-app.vercel.app/callback', routeParams: { code: 'auth-code' } });
  await app.remount();
  assert.deepEqual(app.exchanges, ['auth-code']);
  assert.equal(app.tree.root.findAllByType('Button').length, 0);
});

test('successful and rejected callback URLs are scrubbed without navigating to another host', async t => {
  for (const tail of ['?code=auth-code&from=login', '?lan_return=http://192.168.1.50:8081/callback#access_token=test-access&refresh_token=test-refresh', '?error=access_denied&error_description=private-details']) {
    const app = await setup(t, { href: `https://lyfttrack-app.vercel.app/callback${tail}` });
    assert.ok(app.cleanedUrls.length > 0);
    assert.ok(Object.hasOwn(app.routeUpdates.at(-1) ?? {}, '#'), 'the router must clear its own fragment state');
    const url = new URL(app.browserWindow.location.href);
    assert.equal(url.origin, 'https://lyfttrack-app.vercel.app');
    for (const key of ['code', 'lan_return', 'error', 'error_description']) assert.equal(url.searchParams.has(key), false, key);
    assert.equal(url.hash, '');
    assert.deepEqual(app.redirects, []);
  }
});

test('equivalent route parameter arrays do not repeat the authorization exchange', async t => {
  const app = await setup(t, { href: 'https://lyfttrack-app.vercel.app/callback', routeParams: { code: ['auth-code', 'ignored'] } });
  await app.changeLanguage();
  assert.deepEqual(app.exchanges, ['auth-code']);
});

test('provider errors do not attempt authentication and show a way back', async t => {
  const app = await setup(t, { href: 'https://lyfttrack-app.vercel.app/callback?error=access_denied' });
  assert.equal(app.exchanges.length, 0);
  assert.equal(app.sessions.length, 0);
  assert.equal(app.tree.root.findAllByType('Button').length, 1);
});

test('a callback reload keeps an established session and rejects an empty return', async t => {
  const existing = await setup(t, { href: 'https://lyfttrack-app.vercel.app/callback', session: { user: { id: 'test' } } });
  assert.equal(existing.tree.root.findAllByType('Button').length, 0);
  const missing = await setup(t, { href: 'https://lyfttrack-app.vercel.app/callback' });
  assert.match(JSON.stringify(missing.tree.toJSON()), /auth.callback.missingCode/);
  assert.equal(missing.tree.root.findAllByType('Button').length, 1);
});
