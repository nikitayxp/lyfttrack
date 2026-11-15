const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { getExactRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { getStateFromPath } = require('expo-router/build/fork/getStateFromPath');

test('the root URL opens the feed and explicit auth routes keep their destinations', () => {
  const appRoot = path.resolve(__dirname, '../../app/app');
  const routeFiles = fs.readdirSync(appRoot, { recursive: true })
    .filter(name => /\.[jt]sx?$/.test(name))
    .map(name => './' + name.replaceAll('\\', '/'));
  const context = () => ({ default: () => null });
  context.keys = () => routeFiles;
  const routeTree = getExactRoutes(context, { importMode: 'lazy', ignoreEntryPoints: true });
  const config = getReactNavigationConfig(routeTree);

  for (const [url, expected] of Object.entries({
    '/': ['(tabs)', 'index'],
    '/(tabs)': ['(tabs)', 'index'],
    '/(auth)/sign-in': ['(auth)', 'sign-in'],
    '/sign-in': ['(auth)', 'sign-in'],
    '/reset-password': ['(auth)', 'reset-password'],
    '/verify-email-change': ['(auth)', 'verify-email-change'],
    '/callback': ['(auth)', 'callback'],
  })) {
    const segments = [];
    let state = getStateFromPath(url, config);
    while (state?.routes.length) {
      const route = state.routes[state.index ?? state.routes.length - 1];
      segments.push(route.name);
      state = route.state;
    }
    assert.deepEqual(segments, expected, url);
  }
});
