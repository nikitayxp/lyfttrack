const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

function setup(t, { failFirst = false } = {}) {
  let imports = 0;
  const replacements = {
    'react-native': {
      ActivityIndicator: 'Spinner',
      StyleSheet: { create: value => value },
      View: 'View',
    },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '@/components/ui/AppButton': { AppButton: props => React.createElement('Retry', props) },
    get 'react-native-gifted-charts'() {
      imports += 1;
      if (failFirst && imports === 1) throw new Error('Chart chunk unavailable');
      return { BarChart: props => React.createElement('RenderedBars', props), LineChart: props => React.createElement('RenderedLine', props) };
    },
  };
  const { BarChart, LineChart } = createSourceLoader(replacements)('app/src/components/common/WorkoutCharts.web.tsx');
  let tree;
  t.after(async () => { if (tree) await act(async () => tree.unmount()); });
  return {
    get imports() { return imports; },
    get tree() { return tree; },
    async render(element) { await act(async () => { tree = create(element); }); },
    BarChart,
    LineChart,
  };
}

test('the chart library loads only on demand and is shared by both chart types', async t => {
  const app = setup(t);
  assert.equal(app.imports, 0);
  const data = [{ value: 72 }];
  await app.render(React.createElement(React.Fragment, null,
    React.createElement(app.BarChart, { data, height: 160 }),
    React.createElement(app.LineChart, { data, height: 168 }),
  ));
  assert.equal(app.imports, 1);
  assert.equal(app.tree.root.findByType('RenderedBars').props.data, data);
  assert.equal(app.tree.root.findByType('RenderedLine').props.data, data);
});

test('a failed chart download leaves its sibling visible and can be retried', async t => {
  const app = setup(t, { failFirst: true });
  const data = [{ value: 72 }];
  await app.render(React.createElement(React.Fragment, null,
    React.createElement('WorkoutCard'),
    React.createElement(app.LineChart, { data, height: 168 }),
  ));
  assert.equal(app.tree.root.findAllByType('WorkoutCard').length, 1);
  assert.equal(app.tree.root.findAllByType('RenderedLine').length, 0);
  assert.equal(app.tree.root.findByType('Retry').props.label, 'common.retry');
  await act(async () => app.tree.root.findByType('Retry').props.onPress());
  assert.equal(app.imports, 2);
  assert.equal(app.tree.root.findByType('RenderedLine').props.data, data);
});


test('exercise range changes before the chart mounts keep the newest end pinned', async t => {
  const translate = key => key;
  const progress = Array.from({ length: 16 }, (_, i) => {
    const date = new Date(Date.now() - (16 - i) * 86400000).toISOString().slice(0, 10);
    return { date, label: date, value: 60 + i, maxWeight: 60 + i, maxWeightReps: 6, estimated1RMMax: 72 + i };
  });
  const load = createSourceLoader({
    'react-native': {
      ActivityIndicator: 'Spinner',
      Image: 'Image',
      Platform: { OS: 'web', select: choices => choices.default },
      ScrollView: 'ScrollView',
      StyleSheet: { create: value => value },
      Text: 'Text',
      TouchableOpacity: 'Touch',
      View: 'View',
      useWindowDimensions: () => ({ width: 360 }),
    },
    'react-i18next': { useTranslation: () => ({ t: translate, i18n: { language: 'pt' } }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-router': { router: {}, useLocalSearchParams: () => ({ id: 'exercise' }) },
    '@/constants/theme': { Colors: { dark: {} } },
    '@/components/common/BackButton': { BackButton: 'BackButton' },
    '@/components/common/WorkoutCharts': { LineChart: 'PendingLineChart' },
    '@/context/PreferencesContext': { usePreferences: () => ({ language: 'pt' }) },
    '@/context/WorkoutContext': { useWorkoutContext: () => ({ activeExercises: [], hasActiveWorkout: false }) },
    '@/services/authUserService': { getSessionUserOrThrow: async () => ({ id: 'owner' }) },
    '@/services/workoutService': { getExercisesByIds: async () => [{ id: 'exercise', name: 'Exercise' }] },
    '@/utils/exerciseImage': { getExerciseImageUrl: () => null },
    '@/hooks/useExerciseDetailsData': { useExerciseDetailsData: () => ({ progress, records: null, history: [], isLoadingStats: false }) },
    '@/services/statsService': { formatExerciseAxisDate: date => date, formatExerciseHistoryDate: date => date },
  }, {
    requestAnimationFrame: callback => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
  });
  const Screen = load('app/app/exercise/[id].tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const chart = () => tree.root.findByType('PendingLineChart');
  assert.equal(chart().props.scrollRef.current, null);
  assert.equal(chart().props.scrollToEnd, true);
  const range = tree.root.findAllByType('Touch').find(button => button.props.children.props?.children === 'exercise.detail.rangeAll');
  assert.ok(range);
  await act(async () => range.props.onPress());
  assert.equal(chart().props.scrollToEnd, true);
});
