const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

const session = { user: { id: 'account-a' }, access_token: 'test-token' };

async function setup(t, segments = ['(tabs)']) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolveSession;
  let rejectSession;
  const pendingSession = new Promise((resolve, reject) => { resolveSession = resolve; rejectSession = reject; });
  let authListener;
  let unsubscribed = false;
  let acceptedTerms = 0;
  const routes = [];
  const passthrough = ({ children }) => children;
  const empty = () => null;
  const Stack = Object.assign(passthrough, { Screen: empty });
  const colors = createSourceLoader()('app/src/constants/Colors.ts');
  const load = createSourceLoader({
    'react-native': {
      ActivityIndicator: 'ActivityIndicator', View: 'View',
      Platform: { OS: 'ios' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
      StyleSheet: { create: value => value, absoluteFillObject: {} },
    },
    'expo-router': { Stack, useSegments: () => segments, router: { replace: route => routes.push(route) } },
    'expo-status-bar': { StatusBar: empty },
    'expo-linear-gradient': { LinearGradient: passthrough },
    'expo-web-browser': { maybeCompleteAuthSession() {} },
    'react-native-safe-area-context': { SafeAreaProvider: passthrough },
    '@/constants/theme': colors,
    '@/services/authService': { applyPendingTermsAcceptance: async () => { acceptedTerms += 1; } },
    '@/services/authSetup': { needsUsernameReview: () => false, needsOptionalOnboarding: () => false },
    '@/services/supabase': { supabase: { auth: {
      getSession: () => pendingSession,
      onAuthStateChange: listener => {
        authListener = listener;
        return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
      },
    } } },
    '@/components/ui/flow-field-background': { default: empty },
    '@/components/ui/SplashLoader': { SplashLoader: 'SplashLoader' },
    '@/components/workout/MinimizedWorkoutBar': { MinimizedWorkoutBar: empty },
    '@/components/common/AppToastHost': { AppToastHost: empty },
    '@/components/common/ConfirmHost': { ConfirmHost: empty },
    '@/context/PreferencesContext': { PreferencesProvider: passthrough },
    '@/context/ConfirmContext': { ConfirmProvider: passthrough },
    '@/context/ToastContext': { ToastProvider: passthrough },
    '@/context/WorkoutContext': { WorkoutProvider: passthrough },
  });
  const Root = load('app/app/_layout.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Root)); });
  t.after(async () => { if (tree) await act(async () => tree.unmount()); });
  return {
    routes,
    get loading() { return tree.root.findAllByType('SplashLoader').length > 0; },
    get acceptedTerms() { return acceptedTerms; },
    get unsubscribed() { return unsubscribed; },
    async event(name, value) { await act(async () => authListener(name, value)); },
    async resolve(value) { await act(async () => { resolveSession({ data: { session: value }, error: null }); t.mock.timers.tick(1500); }); },
    async reject() { await act(async () => { rejectSession(new Error('Session storage unavailable')); t.mock.timers.tick(1500); }); },
    async unmount() { await act(async () => tree.unmount()); tree = null; },
  };
}

test('a newer sign-in survives an older empty bootstrap response', async t => {
  const screen = await setup(t);
  await screen.event('SIGNED_IN', session);
  assert.equal(screen.acceptedTerms, 1);
  await screen.resolve(null);
  assert.equal(screen.loading, false);
  assert.deepEqual(screen.routes, []);
});

test('a newer sign-out survives an older authenticated bootstrap response', async t => {
  const screen = await setup(t, ['(auth)', 'sign-in']);
  await screen.event('SIGNED_OUT', null);
  await screen.resolve(session);
  assert.equal(screen.loading, false);
  assert.deepEqual(screen.routes, []);
});

test('a rejected bootstrap releases the splash and redirects protected routes to sign-in', async t => {
  const screen = await setup(t);
  await screen.reject();
  assert.equal(screen.loading, false);
  assert.deepEqual(screen.routes, ['/(auth)/sign-in']);
});

test('a rejected bootstrap cannot clear a newer authenticated session', async t => {
  const screen = await setup(t);
  await screen.event('SIGNED_IN', session);
  await screen.reject();
  assert.equal(screen.loading, false);
  assert.deepEqual(screen.routes, []);
});

test('the initial session still opens authenticated home when there is no newer event', async t => {
  const screen = await setup(t, ['(auth)', 'sign-in']);
  assert.equal(screen.loading, true);
  await screen.resolve(session);
  assert.equal(screen.loading, false);
  assert.deepEqual(screen.routes, ['/(tabs)']);
  assert.equal(screen.acceptedTerms, 0);
});

test('unmount unsubscribes and ignores a late initial session', async t => {
  const screen = await setup(t, ['(auth)', 'sign-in']);
  await screen.unmount();
  assert.equal(screen.unsubscribed, true);
  await screen.resolve(session);
  assert.deepEqual(screen.routes, []);
});
