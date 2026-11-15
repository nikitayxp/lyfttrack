const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('auxiliary screens stay routable while only the three main tabs have buttons', async () => {
  let policy;
  const vendor = createSourceLoader({
    '../link/Link': {},
    '../react-navigation/bottom-tabs/navigators/createBottomTabNavigator': {},
    '../react-navigation/native': {},
    '../standard-navigation': { integrateWithRouter: (_, __, options) => { policy = options; return {}; } },
    '../standard-navigation/appendMissingPlaceholderTabRoutes': {},
    './createBaseTabProps': {},
    '../react-navigation/bottom-tabs': {},
  });
  vendor('node_modules/expo-router/build/layouts/TabsClient.js');
  const Tabs = Object.assign(({ children }) => children, {
    Screen: props => React.createElement('Screen', props),
  });
  const load = createSourceLoader({
    'expo-router': { Tabs },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native': { View: 'View', Platform: { OS: 'web' }, StyleSheet: { create: styles => styles } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
  });
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(load('app/app/(tabs)/_layout.tsx').default)); });
    const screens = policy.processScreens(tree.root.findAllByType('Screen').map(node => node.props));
    const main = ['index', 'workout', 'profile'];
    const auxiliary = screens.filter(screen => !main.includes(screen.name));
    assert.ok(auxiliary.length >= 9);
    for (const screen of auxiliary) {
      assert.notEqual(screen.options.hidden, true, `${screen.name} must not redirect away`);
    }
    assert.deepEqual(screens.filter(screen => !screen.options.tabBarButton || screen.options.tabBarButton({}) !== null).map(screen => screen.name), main);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
