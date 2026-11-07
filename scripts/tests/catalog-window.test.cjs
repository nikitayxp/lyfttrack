const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const loadSource = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('the workout catalogue leaves exercise rows to the virtualized viewport', async t => {
  const translate = key => key;
  const toast = () => {};
  const animation = new Proxy({}, { get: () => () => animation });
  const catalog = Array.from({ length: 300 }, (_, i) => ({ id: `exercise-${i}`, name: `Bench ${i}`, muscle_group: 'chest', equipment: 'barbell' }));
  function List({ sections, renderItem, ListHeaderComponent, ListEmptyComponent }) {
    return React.createElement(React.Fragment, null, ListHeaderComponent,
      sections.flatMap(s => s.data).slice(0, 3).map(item => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))),
      !sections.length ? ListEmptyComponent : null);
  }
  const load = loadSource({
    'react-native': { ActivityIndicator: 'Spinner', Platform: { OS: 'web' }, ScrollView: 'ScrollView', SectionList: List,
      StyleSheet: { create: x => x }, Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-reanimated': { __esModule: true, default: { View: 'View' }, FadeInDown: animation, FadeInUp: animation, LinearTransition: animation },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { router: {}, useFocusEffect: cb => React.useEffect(() => cb(), [cb]) },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/constants/theme': loadSource()('app/src/constants/Colors.ts'),
    '@/constants/Styles': { ACTIVE_OPACITY: 0.8, Radius: {}, Spacing: {} },
    '@/context/PreferencesContext': { usePreferences: () => ({ language: 'pt' }) },
    '@/context/ToastContext': { useAppToast: () => ({ showToast: toast }) },
    '@/components/common/DismissibleBottomSheet': { DismissibleBottomSheet: ({ visible, children }) => visible ? children : null },
    '@/components/common/ExerciseThumbnail': { ExerciseThumbnail: () => React.createElement('Thumbnail') },
    '@/components/ui/Chip': { Chip: () => null },
    '@/components/common/EmptyState': { EmptyState: () => null },
    '@/services/workoutService': { getExercisesCatalog: async () => catalog, getRecentExerciseIds: async () => [], getErrorMessage: e => e.message, orderExercisesByIds: x => x },
    '@/services/templateService': { getTemplates: async () => [] },
    '@/utils/confirmAction': {},
    '@/utils/showAlert': {},
  });
  const Screen = load('app/app/(tabs)/workout.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const mode = tree.root.findAllByType('Button').find(b => b.props.accessibilityLabel === 'workout.exercisesModeLabel');
  assert.ok(mode);
  await act(async () => mode.props.onPress());
  const list = tree.root.findAllByType(List)[0];
  assert.ok(list, 'catalogue bypassed the native virtualized list');
  assert.equal(list.props.sections.flatMap(s => s.data).length, 300);
  assert.equal(tree.root.findAllByType('Thumbnail').length, 3);
});
