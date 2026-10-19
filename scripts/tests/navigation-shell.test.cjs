const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('athlete exploration belongs to the tab shell without adding a fourth tab', async t => {
  const Tabs = Object.assign(({ children }) => children, { Screen: 'Screen' });
  const load = createSourceLoader({
    'expo-router': { Tabs },
    '@expo/vector-icons': { Ionicons: () => null },
    'react-native': { Platform: { OS: 'web' }, StyleSheet: { create: value => value }, View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(load('app/app/(tabs)/_layout.tsx').default)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(tree.root.findByType(Tabs).props.backBehavior, 'history', 'secondary pages must return to the page that opened them');
  const screens = tree.root.findAllByType('Screen');
  const athletes = screens.find(screen => screen.props.name === 'athletes');
  assert.ok(athletes, 'the explorer must remain inside the tab navigator');
  assert.equal(athletes.props.options.href, null);
  assert.deepEqual(screens.filter(screen => screen.props.options.href !== null).map(screen => screen.props.name), ['index', 'workout', 'profile']);
  assert.ok(fs.existsSync(path.resolve(__dirname, '../../app/app/(tabs)/athletes.tsx')));
  assert.equal(fs.existsSync(path.resolve(__dirname, '../../app/app/athletes.tsx')), false, 'avoid duplicate /athletes routes');
});
