const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

test('returning to the feed preserves existing cards instead of replaying their mount', async () => {
  let focus;
  let mounts = 0;
  const translate = key => key;
  const toast = () => {};
  const animation = { springify() { return animation; }, damping() { return animation; }, stiffness() { return animation; }, duration() { return animation; }, delay() { return animation; } };
  function Card() { React.useEffect(() => { mounts += 1; }, []); return null; }
  function List({ data, renderItem, ListHeaderComponent }) { return React.createElement(React.Fragment, null, ListHeaderComponent, data.map((item, index) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index })))); }
  const load = createSourceLoader({
    '@/constants/Styles': { ACTIVE_OPACITY: 0.8, Radius: {} },
    'react-native': { ActivityIndicator: 'Spinner', FlatList: List, RefreshControl: 'Refresh', StyleSheet: { create: value => value }, Text: 'Text', TouchableOpacity: 'Button', View: 'View', DeviceEventEmitter: { addListener: () => ({ remove() {} }) } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, FadeInDown: animation, FadeInUp: animation, LinearTransition: animation },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { router: {}, useFocusEffect: callback => { React.useEffect(() => { focus = callback; return callback(); }, [callback]); } },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/services/interactionService': {},
    '@/services/authUserService': { getSessionUserOrThrow: async () => ({ id: 'owner' }) },
    '@/services/workoutService': { getAuthenticatedUserOrThrow: async () => ({ id: 'owner' }), getFeedWorkouts: async () => [{ id: 'w1', user_id: 'owner' }], getErrorMessage: error => error.message },
    '@/services/import/importEvents': { WORKOUTS_IMPORTED_EVENT: 'import' },
    '@/components/common/EmptyState': { EmptyState: () => null },
    '@/components/feed/FeedCommentsModal': { FeedCommentsModal: () => null },
    '@/components/feed/WorkoutFeedCard': { WorkoutFeedCard: Card },
    '@/context/ToastContext': { useAppToast: () => ({ showToast: toast }) },
    '@/hooks/useWorkoutDelete': { useWorkoutDelete: () => ({ confirmAndDelete: async () => false }), WORKOUT_DELETED_EVENT: 'delete' },
    '@/utils/showAlert': {},
  });
  const Screen = load('app/app/(tabs)/index.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  assert.equal(mounts, 1);
  await act(async () => { if (focus) focus(); });
  assert.equal(mounts, 1, 'The existing workout card remounted when the tab regained focus');
  await act(async () => tree.unmount());
});
