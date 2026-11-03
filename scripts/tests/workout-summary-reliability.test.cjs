const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const loadSource = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('a saved workout distinguishes unavailable records from a confirmed zero', async t => {
  const load = loadSource({
    'react-native': { Modal: 'Modal', Platform: { OS: 'web' }, ScrollView: 'Scroll', StyleSheet: { create: x => x }, Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '@/constants/Styles': { ACTIVE_OPACITY: 0.8, Radius: {} },
    '@/context/PreferencesContext': { usePreferences: () => ({ language: 'pt', countWorkingSetsOnly: false }) },
    '@/components/common/PrBadge': { PrBadge: () => null },
  });
  const { WorkoutSummary } = load('app/src/components/workout/WorkoutSummary.tsx');
  const props = { visible: true, durationSeconds: 90, prCount: 0, completedSetCount: 3, completedWorkingSetCount: 3, exerciseNames: [], onShareAndFinish() {} };
  let tree;
  await act(async () => { tree = create(React.createElement(WorkoutSummary, { ...props, prCheckFailed: true })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.match(JSON.stringify(tree.toJSON()), /workout.summaryPrsUnavailable/);
  assert.ok(tree.root.findAllByType('Text').some(text => text.props.children === '—'));
  await act(async () => tree.update(React.createElement(WorkoutSummary, props)));
  assert.doesNotMatch(JSON.stringify(tree.toJSON()), /workout.summaryPrsUnavailable/);
});
