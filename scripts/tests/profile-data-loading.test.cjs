const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const loadSource = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

async function setup(t, resolveHistory = async () => [], resolveComments = async () => []) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let profileCalls = 0;
  const histories = [];
  const translate = key => key;
  const showToast = () => {};
  const value = () => ({ start() {}, stop() {} });
  const load = loadSource({
    'react-native': {
      ActivityIndicator: 'Spinner', Image: 'Image', Modal: 'Modal', Platform: { OS: 'web' },
      Pressable: 'Pressable', RefreshControl: 'Refresh', Text: 'Text', TextInput: 'Input',
      TouchableOpacity: 'Button', View: 'View', StyleSheet: { create: x => x },
      Animated: { Value: class {}, View: 'View', loop: value, sequence: value, timing: value },
      DeviceEventEmitter: { addListener: () => ({ remove() {} }) },
      FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }) => React.createElement(React.Fragment, null,
        ListHeaderComponent, data.map(item => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))), !data.length ? ListEmptyComponent : null, ListFooterComponent),
    },
    'expo-router': { router: {}, useFocusEffect: callback => React.useEffect(() => callback(), [callback]) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t: translate, i18n: { language: 'pt', resolvedLanguage: 'pt' } }) },
    '@/constants/theme': loadSource()('app/src/constants/Colors.ts'),
    '@/constants/Styles': { ACTIVE_OPACITY: 0.8, Radius: {} },
    '@/context/ToastContext': { useAppToast: () => ({ showToast }) },
    '@/context/WorkoutContext': { useWorkoutContext: () => ({ activeExercises: [] }) },
    '@/hooks/useWorkoutDelete': { useWorkoutDelete: () => ({ confirmAndDelete: async () => false }) },
    '@/services/authUserService': { getAuthenticatedUserOrThrow: async () => ({ id: 'owner', email: 'test@example.test' }), getSessionUserOrThrow: async () => ({ id: 'owner', email: 'test@example.test' }) },
    '@/services/profileService': { getProfile: async () => { profileCalls++; return { id: 'owner', username: 'Owner' }; } },
    '@/services/measurementService': { getWeightHistory: async () => [] },
    '@/services/statsService': { getAllTimePRs: async () => [] },
    '@/services/workoutService': {
      getUserWorkouts: async (id, page, limit, filter) => { histories.push({ ...filter }); return resolveHistory(filter); },
      getUserWorkoutMonthBuckets: async () => [], getErrorMessage: e => e.message,
    },
    '@/services/interactionService': {
      getWorkoutComments: resolveComments,
      getCurrentCommentAuthorProfile: async () => ({ id: 'owner', username: 'Owner' }),
      addComment: async (workoutId, content) => ({ id: 'saved-comment', workout_id: workoutId, user_id: 'owner', content, created_at: '2026-10-19T12:00:00Z' }),
    },
    '@/components/feed/FeedCommentsModal': { FeedCommentsModal: props => React.createElement('Comments', props) },
    '@/components/feed/WorkoutFeedCard': { WorkoutFeedCard: props => React.createElement('WorkoutCard', props) },
    '@/components/common/EmptyState': { EmptyState: () => null },
    '@/components/profile/TrophyRoom': { TrophyRoom: () => null, TrophyRoomPreview: () => null },
    '@/components/profile/BodyWeightChart': { BodyWeightChart: () => null },
    '@/components/history/HistoryJumpBar': { HistoryJumpBar: props => React.createElement('HistoryFilter', props) },
    '@/utils/showAlert': {},
  });
  const Screen = load('app/app/(tabs)/profile.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { tree, histories, get profileCalls() { return profileCalls; }, async search(text) {
    await act(async () => tree.root.findByType('HistoryFilter').props.onChangeQuery(text));
    await act(async () => t.mock.timers.tick(300));
  } };
}

test('the initial profile focus shares the bootstrap profile and history requests', async t => {
  const app = await setup(t);
  assert.equal(app.profileCalls, 1);
  assert.equal(app.histories.length, 1);
});

test('a slower old profile search cannot replace the newer history', async t => {
  const pending = new Map();
  const app = await setup(t, filter => filter?.search ? new Promise(resolve => pending.set(filter.search, resolve)) : []);
  await app.search('older');
  await app.search('newer');
  await act(async () => pending.get('newer')([{ id: 'newer', user_id: 'owner' }]));
  await act(async () => pending.get('older')([{ id: 'older', user_id: 'owner' }]));
  assert.deepEqual(app.tree.root.findAllByType('WorkoutCard').map(c => c.props.workout.id), ['newer']);
});

test('comments load in pages without replacing the full card count with the first page size', async t => {
  const offsets = [];
  const app = await setup(t,
    async () => [{ id: 'workout', user_id: 'owner', comments_count: 51 }],
    async (_id, options) => {
      const offset = options?.offset ?? 0;
      offsets.push(offset);
      return Array.from({ length: offset === 0 ? 50 : offset === 50 ? 1 : 0 }, (_, i) => ({ id: `c${offset + i}`, content: 'Comment' }));
    });
  await act(async () => app.tree.root.findByType('WorkoutCard').props.onOpenComments());
  const first = app.tree.root.findByType('Comments');
  assert.equal(first.props.comments.length, 50);
  assert.equal(app.tree.root.findByType('WorkoutCard').props.commentsCount, 51);
  assert.equal(first.props.hasMore, true);
  await act(async () => first.props.onLoadMore());
  const next = app.tree.root.findByType('Comments');
  assert.equal(next.props.comments.length, 51);
  assert.equal(next.props.hasMore, true);
  await act(async () => next.props.onLoadMore());
  assert.equal(app.tree.root.findByType('Comments').props.hasMore, false);
  assert.deepEqual(offsets, [0, 50, 51]);
});

test('comments continue until an empty page when the server caps responses below the requested limit', async t => {
  const offsets = [];
  const app = await setup(t, async () => [{ id: 'workout', user_id: 'owner', comments_count: 23 }],
    async (_id, options) => {
      const offset = options.offset; offsets.push(offset);
      return Array.from({ length: Math.min(10, Math.max(0, 23 - offset)) }, (_, i) => ({ id: 'c' + (offset + i), content: 'Comment' }));
    });
  await act(async () => app.tree.root.findByType('WorkoutCard').props.onOpenComments());
  assert.equal(app.tree.root.findByType('WorkoutCard').props.commentsCount, 23);
  for (let i = 0; i < 3; i++) {
    assert.equal(app.tree.root.findByType('Comments').props.hasMore, true);
    await act(async () => app.tree.root.findByType('Comments').props.onLoadMore());
  }
  assert.equal(app.tree.root.findByType('Comments').props.comments.length, 23);
  assert.equal(app.tree.root.findByType('Comments').props.hasMore, false);
  assert.deepEqual(offsets, [0, 10, 20, 23]);
});

test('publishing a comment preserves loaded pages and the new comment', async t => {
  const offsets = [];
  const app = await setup(t, async () => [{ id: 'workout', user_id: 'owner', comments_count: 51 }],
    async (_id, { offset }) => {
      offsets.push(offset);
      if (offset === 51) return [{ id: 'saved-comment', content: 'New comment' }];
      return Array.from({ length: offset === 0 ? 50 : offset === 50 ? 1 : 0 }, (_, i) => ({ id: `c${offset + i}`, content: 'Existing' }));
    });
  await act(async () => app.tree.root.findByType('WorkoutCard').props.onOpenComments());
  await act(async () => app.tree.root.findByType('Comments').props.onLoadMore());
  await act(async () => app.tree.root.findByType('Comments').props.onChangeInput('New comment'));
  await act(async () => app.tree.root.findByType('Comments').props.onSend());
  assert.equal(app.tree.root.findByType('Comments').props.comments.length, 52);
  assert.equal(app.tree.root.findByType('Comments').props.comments.at(-1).id, 'saved-comment');
  assert.equal(app.tree.root.findByType('WorkoutCard').props.commentsCount, 52);
  assert.deepEqual(offsets, [0, 50]);
  await act(async () => app.tree.root.findByType('Comments').props.onLoadMore());
  assert.equal(app.tree.root.findByType('Comments').props.comments.length, 52);
  await act(async () => app.tree.root.findByType('Comments').props.onLoadMore());
  assert.equal(app.tree.root.findByType('WorkoutCard').props.commentsCount, 52);
  assert.equal(app.tree.root.findByType('Comments').props.hasMore, false);
  assert.deepEqual(offsets, [0, 50, 51, 52]);
});

test('an in-flight initial comments page preserves a comment published after it started', async t => {
  let finishPage;
  const app = await setup(t, async () => [{ id: 'workout', user_id: 'owner', comments_count: 50 }],
    () => new Promise(resolve => { finishPage = resolve; }));
  await act(async () => app.tree.root.findByType('WorkoutCard').props.onOpenComments());
  await act(async () => app.tree.root.findByType('Comments').props.onChangeInput('New comment'));
  await act(async () => app.tree.root.findByType('Comments').props.onSend());
  await act(async () => finishPage(Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, content: 'Existing' }))));
  assert.equal(app.tree.root.findByType('Comments').props.comments.length, 51);
  assert.equal(app.tree.root.findByType('Comments').props.comments.at(-1).id, 'saved-comment');
});
