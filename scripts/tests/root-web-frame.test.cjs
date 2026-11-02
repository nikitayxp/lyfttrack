const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

function eventTarget(values = {}) {
  const listeners = new Map();
  return Object.assign(values, {
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    emit(name) { for (const listener of listeners.get(name) ?? []) listener(); },
    get listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  });
}

async function setup(t, initialWidth = 375) {
  let width = initialWidth;
  let mounts = 0;
  let changeDraft;
  const css = new Map();
  const style = {
    getPropertyValue: name => css.get(name) ?? '',
    setProperty: (name, value) => css.set(name, value),
    removeProperty: name => css.delete(name),
  };
  const document = {
    documentElement: { style },
    body: { style: {}, classList: { toggle() {}, remove() {} } },
    getElementById: () => null,
  };
  const viewport = eventTarget({ height: 800 });
  const window = eventTarget({ innerHeight: 800, visualViewport: viewport,
    location: { pathname: '/callback' }, scrollTo() {} });
  function PreferencesProvider({ children }) {
    const [draft, setDraft] = React.useState('');
    changeDraft = setDraft;
    React.useEffect(() => { mounts++; }, []);
    return React.createElement('SessionProbe', { draft }, children);
  }
  const passthrough = ({ children }) => children;
  const empty = () => null;
  const Stack = Object.assign(passthrough, { Screen: empty });
  const colors = createSourceLoader()('app/src/constants/Colors.ts');
  const load = createSourceLoader({
    '@react-navigation/native': { DarkTheme: { colors: {} }, ThemeProvider: passthrough },
    'react-native': { View: 'View', ActivityIndicator: empty, Platform: { OS: 'web' },
      useWindowDimensions: () => ({ width, height: 800 }),
      StyleSheet: { create: value => value, absoluteFillObject: {} } },
    'expo-router': { Stack, useSegments: () => ['(auth)', 'sign-in'], router: { replace() {} } },
    'expo-status-bar': { StatusBar: empty },
    'expo-linear-gradient': { LinearGradient: empty },
    'expo-web-browser': { maybeCompleteAuthSession() {} },
    'react-native-safe-area-context': { SafeAreaProvider: passthrough },
    '@/constants/theme': colors,
    '@/services/authService': { applyPendingTermsAcceptance: async () => {} },
    '@/services/authSetup': { needsUsernameReview: () => false, needsOptionalOnboarding: () => false },
    '@/services/supabase': { supabase: { auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } } },
    '@/components/ui/flow-field-background': { __esModule: true, default: empty },
    '@/components/ui/SplashLoader': { SplashLoader: empty },
    '@/components/workout/MinimizedWorkoutBar': { MinimizedWorkoutBar: empty },
    '@/components/common/AppToastHost': { AppToastHost: empty },
    '@/components/common/ConfirmHost': { ConfirmHost: empty },
    '@/context/PreferencesContext': { PreferencesProvider },
    '@/context/ConfirmContext': { ConfirmProvider: passthrough },
    '@/context/ToastContext': { ToastProvider: passthrough },
    '@/context/WorkoutContext': { WorkoutProvider: passthrough },
  }, { window, document });
  const Root = load('app/app/_layout.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Root)); });
  t.after(async () => { if (tree) await act(async () => tree.unmount()); });
  return {
    css, viewport, window,
    get mounts() { return mounts; },
    get draft() { return tree.root.findByType('SessionProbe').props.draft; },
    get shellHeight() {
      const shell = tree.root.findAllByType('View').find(node => node.props.testID === 'app-web-shell');
      return Object.assign({}, ...shell.props.style.filter(Boolean)).height;
    },
    async typeDraft(value) { await act(async () => changeDraft(value)); },
    async resize(nextWidth, visualHeight = viewport.height) {
      await act(async () => {
        width = nextWidth;
        viewport.height = visualHeight;
        window.emit('resize');
        viewport.emit('resize');
        tree.update(React.createElement(Root));
      });
    },
    async pan(top) {
      await act(async () => {
        viewport.offsetTop = top;
        viewport.emit('scroll');
      });
    },
    async unmount() { await act(async () => tree.unmount()); tree = null; },
  };
}

test('crossing the phone-frame breakpoint retains the mounted app and unsaved input', async t => {
  const screen = await setup(t);
  await screen.typeDraft('unsent comment');
  await screen.resize(1280);
  assert.equal(screen.draft, 'unsent comment');
  await screen.resize(375);
  assert.equal(screen.draft, 'unsent comment');
  assert.equal(screen.mounts, 1);
});

test('a visual-only keyboard resize publishes the same visible height for body portals', async t => {
  const screen = await setup(t);
  await screen.resize(375, 400);
  assert.equal(screen.window.innerHeight, 800);
  assert.equal(screen.shellHeight, 400);
  assert.equal(screen.css.get('--app-visible-viewport-height'), '400px');
  await screen.resize(375, 800);
  assert.equal(screen.css.get('--app-visible-viewport-height'), '800px');
  await screen.unmount();
  assert.equal(screen.css.has('--app-visible-viewport-height'), false);
  assert.equal(screen.viewport.listenerCount, 0);
});

test('a wide browser with a virtual keyboard also uses the visible viewport', async t => {
  const screen = await setup(t, 1280);
  await screen.resize(1280, 400);
  assert.equal(screen.shellHeight, 400);
  assert.equal(screen.css.get('--app-visible-viewport-height'), '400px');
});

test('visual viewport panning updates portal position without a layout or height resize', async t => {
  const screen = await setup(t);
  await screen.pan(120);
  assert.equal(screen.window.innerHeight, 800);
  assert.equal(screen.viewport.height, 800);
  assert.equal(screen.shellHeight, 800);
  assert.equal(screen.css.get('--app-visible-viewport-top'), '120px');
  await screen.pan(0);
  assert.equal(screen.css.get('--app-visible-viewport-top'), '0px');
  await screen.unmount();
  assert.equal(screen.css.has('--app-visible-viewport-top'), false);
});
