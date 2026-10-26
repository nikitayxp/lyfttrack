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
  let language = 'pt';
  let translate = key => `${language}:${key}`;
  const load = createSourceLoader({
    'react-native': { ActivityIndicator: 'Spinner', StyleSheet: { create: value => value }, Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-linking': { createURL: () => 'lyfttrack://callback?code=auth-code' },
    'expo-router': { router: {}, useLocalSearchParams: () => ({ ...routeParams, code: Array.isArray(routeParams.code) ? [...routeParams.code] : routeParams.code }) },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/constants/Styles': { Radius: {}, Spacing: {} },
    '@/components/auth/AuthAmbientGlow': { AuthAmbientGlow: ({ children }) => children },
    '@/components/ui/AppButton': { AppButton: props => React.createElement('Button', props) },
    '@/services/supabase': { supabase: { auth: {
      exchangeCodeForSession: async code => { exchanges.push(code); return exchange ? exchange() : { error: null }; },
      setSession: async value => { sessions.push(value); return { error: null }; },
      getSession: async () => ({ data: { session } }),
    } } },
  }, { window: { location: { href, replace: url => redirects.push(url) } } });
  const Screen = load('app/app/(auth)/callback.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { tree, exchanges, sessions, redirects, async changeLanguage() { language = 'en'; translate = key => `${language}:${key}`; await act(async () => tree.update(React.createElement(Screen))); } };
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

test('implicit token callbacks still use setSession without exchanging a code', async t => {
  const app = await setup(t, { href: 'https://lyfttrack-app.vercel.app/callback#access_token=test-access&refresh_token=test-refresh' });
  assert.equal(app.exchanges.length, 0);
  assert.equal(app.sessions[0].access_token, 'test-access');
  assert.equal(app.sessions[0].refresh_token, 'test-refresh');
});

test('a lan_return parameter never forwards the session tokens to another host', async t => {
  const lanReturn = encodeURIComponent('http://192.168.1.50:8081/callback');
  const app = await setup(t, { href: `https://lyfttrack-app.vercel.app/callback?lan_return=${lanReturn}#access_token=test-access&refresh_token=test-refresh` });
  assert.deepEqual(app.redirects, []);
  assert.equal(app.sessions[0].access_token, 'test-access');
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
