const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

async function mountFeed(t, {
  getFeedWorkouts = async () => [{ id: 'w1', user_id: 'owner', prCount: null }],
  getUserWorkoutRecordCounts = async () => new Map(),
} = {}) {
  let focus;
  let mounts = 0;
  const translate = key => key;
  const toast = () => {};
  const animation = { springify() { return animation; }, damping() { return animation; }, stiffness() { return animation; }, duration() { return animation; }, delay() { return animation; } };
  function Card(props) { React.useEffect(() => { mounts += 1; }, []); return React.createElement('WorkoutCard', props); }
  function List({ data, renderItem, ListHeaderComponent, refreshControl, onEndReached }) {
    return React.createElement('FeedList', { onEndReached }, ListHeaderComponent, refreshControl,
      data.map((item, index) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index }))));
  }
  const load = createSourceLoader({
    '@/constants/Styles': { ACTIVE_OPACITY: 0.8, Radius: {} },
    'react-native': { ActivityIndicator: 'Spinner', FlatList: List, RefreshControl: 'Refresh', StyleSheet: { create: value => value }, Text: 'Text', TouchableOpacity: 'Button', View: 'View', DeviceEventEmitter: { addListener: () => ({ remove() {} }) } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, FadeInDown: animation, FadeInUp: animation, LinearTransition: animation },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { router: {}, useFocusEffect: callback => { React.useEffect(() => { focus = callback; return callback(); }, [callback]); } },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/services/interactionService': {},
    '@/services/authUserService': { getSessionUserOrThrow: async () => ({ id: 'owner' }) },
    '@/services/workoutService': {
      getFeedWorkoutPage: async (page, size) => {
        const workouts = await getFeedWorkouts(page, size);
        return { workouts, recordCounts: getUserWorkoutRecordCounts(workouts) };
      },
      getErrorMessage: error => error.message,
    },
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
  t.after(async () => { await act(async () => tree.unmount()); });
  return {
    get mounts() { return mounts; },
    cards() { return tree.root.findAllByType('WorkoutCard').map(card => card.props.workout); },
    async focus() { await act(async () => { if (focus) focus(); }); },
    async refresh() { await act(async () => tree.root.findByType('Refresh').props.onRefresh()); },
    async nextPage() { await act(async () => tree.root.findByType('FeedList').props.onEndReached()); },
  };
}

test('returning to the feed preserves existing cards instead of replaying their mount', async t => {
  const app = await mountFeed(t);
  assert.equal(app.mounts, 1);
  await app.focus();
  assert.equal(app.mounts, 1, 'The existing workout card remounted when the tab regained focus');
});

test('feed cards appear while records are pending', async t => {
  let finishRecords;
  const app = await mountFeed(t, {
    getFeedWorkouts: async () => [{ id: 'w1', user_id: 'friend', totalSets: 3, prCount: null }],
    getUserWorkoutRecordCounts: () => new Promise(resolve => { finishRecords = resolve; }),
  });
  assert.deepEqual(app.cards().map(card => [card.id, card.totalSets, card.prCount]), [['w1', 3, null]]);
  await act(async () => finishRecords(new Map([['w1', 2]])));
  assert.equal(app.cards()[0].prCount, 2);
  assert.equal(app.mounts, 1);
});

test('an old record response cannot replace counts from a refreshed feed', async t => {
  const pending = [];
  const app = await mountFeed(t, {
    getFeedWorkouts: async () => [{ id: 'w1', user_id: 'friend', prCount: null }],
    getUserWorkoutRecordCounts: () => new Promise(resolve => pending.push(resolve)),
  });
  await app.refresh();
  assert.equal(pending.length, 2);
  await act(async () => pending[1](new Map([['w1', 4]])));
  await act(async () => pending[0](new Map([['w1', 1]])));
  assert.equal(app.cards()[0].prCount, 4);
});

test('records still enrich the visible cards if a refresh fails', async t => {
  let loads = 0;
  let finishRecords;
  const app = await mountFeed(t, {
    getFeedWorkouts: async () => {
      if (++loads > 1) throw new Error('Refresh failed');
      return [{ id: 'w1', user_id: 'friend', prCount: null }];
    },
    getUserWorkoutRecordCounts: () => new Promise(resolve => { finishRecords = resolve; }),
  });
  await app.refresh();
  await act(async () => finishRecords(new Map([['w1', 4]])));
  assert.deepEqual(app.cards().map(card => [card.id, card.prCount]), [['w1', 4]]);
});

test('a failed record lookup leaves the feed cards visible with unknown counts', async t => {
  let calls = 0;
  t.mock.method(console, 'warn', () => {});
  const app = await mountFeed(t, {
    getUserWorkoutRecordCounts: async () => { calls++; throw new Error('Records unavailable'); },
  });
  assert.equal(calls, 1);
  assert.deepEqual(app.cards().map(card => [card.id, card.prCount]), [['w1', null]]);
});

test('a late page does not replace a refreshed feed', async t => {
  let finishOldPage;
  let loads = 0;
  const app = await mountFeed(t, {
    getFeedWorkouts: () => ++loads === 1
      ? new Promise(resolve => { finishOldPage = resolve; })
      : Promise.resolve([{ id: 'new', user_id: 'friend', prCount: null }]),
  });
  await app.refresh();
  await act(async () => finishOldPage([{ id: 'old', user_id: 'friend', prCount: null }]));
  assert.deepEqual(app.cards().map(card => card.id), ['new']);
});

test('record counts can resolve out of order across two visible pages', async t => {
  const pending = [];
  const app = await mountFeed(t, {
    getFeedWorkouts: async (page, size) => page === 0
      ? Array.from({ length: size }, (_, index) => ({ id: `first-${index}`, user_id: 'friend', prCount: null }))
      : [{ id: 'second', user_id: 'friend', prCount: null }],
    getUserWorkoutRecordCounts: () => new Promise(resolve => pending.push(resolve)),
  });
  await app.nextPage();
  assert.equal(app.cards().length, 21);
  assert.equal(pending.length, 2);
  await act(async () => pending[1](new Map([['second', 2]])));
  await act(async () => pending[0](new Map([['first-0', 1]])));
  assert.equal(app.cards().find(card => card.id === 'first-0').prCount, 1);
  assert.equal(app.cards().find(card => card.id === 'second').prCount, 2);
});
