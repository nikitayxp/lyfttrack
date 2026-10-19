const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

async function renderProfile(visibility, relation, onRefresh = () => {}, scenario = {}) {
  const translate = (key, values) => key === 'publicProfile.historySince' ? values.date : key;
  const load = createSourceLoader({
    'react-native': { ActivityIndicator: 'Spinner', Image: 'Image', RefreshControl: 'Refresh', FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }) => React.createElement(React.Fragment, null, ListHeaderComponent, data.map(item => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))), !data.length ? ListEmptyComponent : null, ListFooterComponent), Platform: { OS: 'web' }, StyleSheet: { create: value => value }, Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t: translate, i18n: { resolvedLanguage: 'pt' } }) },
    'expo-router': { useLocalSearchParams: () => ({ id: scenario.id ?? 'athlete' }), router: {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/context/WorkoutContext': { useWorkoutContext: () => ({ hasActiveWorkout: true }) },
    '@/context/ToastContext': { useAppToast: () => ({ showToast() {} }) },
    '@/constants/Styles': { ACTIVE_OPACITY: 0.8, Radius: {} },
    '@/hooks/useAthleteHistory': { useAthleteHistory: () => ({ profile: { id: 'athlete', username: 'athlete', full_name: 'Long Athlete Name', visibility }, workouts: [{ id: 'session', likes_count: 0, comments_count: 0 }], historyMonths: [{ year: 2026, month: 8, count: 125 }, { year: 2024, month: 12, count: 40 }], hasSummary: true, isLoadingProfile: false, isLoadingHistory: false, isRefreshing: false, hasMore: true, refresh: onRefresh, loadMore() {}, retryHistory() {} }) },
    '@/services/socialService': { getRelationWithUser: async id => ({ relation: id === 'other' ? 'none' : relation, requestId: 'request' }), acceptRequest: async () => { if (scenario.accept) await scenario.accept; relation = 'friends'; } },
    '@/services/interactionService': {},
    '@/services/workoutService': {},
    '@/components/social/FriendActions': { FriendActions: props => React.createElement('FriendActions', props) },
    '@/components/common/EmptyState': { EmptyState: props => React.createElement('Empty', props) },
    '@/components/feed/FeedCommentsModal': { FeedCommentsModal: () => null },
    '@/components/feed/WorkoutFeedCard': { WorkoutFeedCard: props => React.createElement('WorkoutCard', props) },
    '@/components/history/HistoryJumpBar': { HistoryJumpBar: () => React.createElement('HistoryFilter') },
    '@/utils/confirmAction': {}, '@/utils/showAlert': {},
  });
  const Screen = load('app/app/(tabs)/public-profile/[id].tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  return tree;
}

test('the public profile summarizes the whole visible history instead of its first page', async () => {
  const tree = await renderProfile('public', 'none');
  const text = JSON.stringify(tree.toJSON());
  assert.match(text, /165/);
  assert.match(text, /dezembro de 2024/);
  assert.equal(tree.root.findAllByType('WorkoutCard').length, 1);
  assert.equal(tree.root.findAllByType('HistoryFilter').length, 1);
  await act(async () => tree.unmount());
});

test('private and friends-only profiles do not expose summaries or sessions to strangers', async () => {
  for (const visibility of ['private', 'friends']) {
    const tree = await renderProfile(visibility, 'none');
    assert.equal(tree.root.findAllByType('WorkoutCard').length, 0);
    assert.equal(tree.root.findAllByType('HistoryFilter').length, 0);
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /165/);
    await act(async () => tree.unmount());
  }
});

test('friends can browse friends-only history and owners can inspect their own profile', async () => {
  for (const [visibility, relation] of [['friends', 'friends'], ['private', 'self']]) {
    const tree = await renderProfile(visibility, relation);
    assert.equal(tree.root.findAllByType('WorkoutCard').length, 1);
    await act(async () => tree.unmount());
  }
});

test('accepting a friendship reloads history previously hidden by access rules', async () => {
  let refreshed = 0;
  const tree = await renderProfile('friends', 'request_received', () => { refreshed += 1; });
  assert.equal(tree.root.findAllByType('WorkoutCard').length, 0);
  await act(async () => tree.root.findByType('FriendActions').props.onAccept());
  assert.equal(refreshed, 1);
  assert.equal(tree.root.findAllByType('WorkoutCard').length, 1);
  await act(async () => tree.unmount());
});

test('a pending friendship action cannot apply the previous athlete relation after navigation', async () => {
  let finish;
  let refreshed = 0;
  const scenario = { accept: new Promise(resolve => { finish = resolve; }) };
  const tree = await renderProfile('friends', 'request_received', () => { refreshed += 1; }, scenario);
  await act(async () => tree.root.findByType('FriendActions').props.onAccept());
  const Screen = tree.root.type;
  scenario.id = 'other';
  await act(async () => tree.update(React.createElement(Screen)));
  await act(async () => finish());
  assert.equal(tree.root.findByType('FriendActions').props.relation, 'none');
  assert.equal(refreshed, 0);
  await act(async () => tree.unmount());
});
