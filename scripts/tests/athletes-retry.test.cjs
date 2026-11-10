const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const loadSource = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('athlete search can retry the same query after a read timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const requests = [];
  const translate = key => key;
  const load = loadSource({
    'react-native': {
      ActivityIndicator: 'Spinner', Image: 'Image', Platform: { OS: 'web', select: options => options.web ?? options.default },
      RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', StyleSheet: { create: styles => styles },
      Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', View: 'View',
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { router: {} },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/context/WorkoutContext': { useWorkoutContext: () => ({ hasActiveWorkout: false }) },
    '@/constants/tabBar': { getTabBarHeight: () => 0 },
    '@/components/common/BackButton': { BackButton: () => null },
    '@/context/ToastContext': { useAppToast: () => ({}) },
    '@/services/socialService': {
      getAllAthletes: async () => [],
      searchUsers: async query => {
        requests.push(query);
        if (requests.length === 1) throw new Error('Data read timed out. Please try again.');
        return [{ id: 'athlete-id', username: 'trainingmate', relation: 'none' }];
      },
    },
    '@/utils/showAlert': {},
  });
  const Screen = load('app/app/(tabs)/athletes.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  await act(async () => tree.root.findByType('Input').props.onChangeText('mate'));
  await act(async () => t.mock.timers.tick(300));
  assert.deepEqual(requests, ['mate']);
  const retry = tree.root.findAllByType('Button').find(button => button.props.accessibilityLabel === 'common.retry');
  assert.ok(retry, 'the read error should offer a retry');
  await act(async () => retry.props.onPress());
  assert.deepEqual(requests, ['mate', 'mate']);
  assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === 'trainingmate'));
  assert.equal(tree.root.findAllByType('Button').some(button => button.props.accessibilityLabel === 'common.retry'), false);
});
