const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const loadSource = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('saving the template editor passes the snapshot captured when editing began', async t => {
  const translate = key => key;
  const toast = () => {};
  const animation = new Proxy({}, { get: () => () => animation });
  const exercise = { id: 'exercise', name: 'Bench', muscle_group: 'chest', equipment: 'barbell' };
  const original = { id: 'template', user_id: 'owner', name: 'Original', notes: 'Original notes', created_at: 'now',
    exercises: [{ id: 'relation', order_index: 1, rest_seconds: 90, exercise }] };
  const saves = [];
  const load = loadSource({
    'react-native': { ActivityIndicator: 'Spinner', Platform: { OS: 'web' }, ScrollView: 'ScrollView',
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
    '@/components/common/ExerciseThumbnail': { ExerciseThumbnail: () => null },
    '@/components/ui/Chip': { Chip: () => null },
    '@/components/common/EmptyState': { EmptyState: () => null },
    '@/services/workoutService': { getExercisesCatalog: async () => [exercise], getRecentExerciseIds: async () => [], getErrorMessage: e => e.message, orderExercisesByIds: x => x },
    '@/services/templateService': { getTemplates: async () => [{ ...original, exerciseCount: 1, exerciseNames: [exercise] }],
      getTemplateById: async () => original, updateTemplate: async (...args) => { saves.push(args); return original; } },
    '@/utils/confirmAction': {},
    '@/utils/showAlert': { showAlert() {} },
  });
  const Screen = load('app/app/(tabs)/workout.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const button = label => tree.root.findAllByType('Button').find(b => b.props.accessibilityLabel === label);
  await act(async () => button('workout.templatesModeLabel').props.onPress());
  await act(async () => button('workout.editTemplateA11y').props.onPress());
  const name = tree.root.findAllByType('Input').find(input => input.props.accessibilityLabel === 'accessibility.templateName');
  await act(async () => name.props.onChangeText('Locally edited'));
  await act(async () => button('workout.editTemplate').props.onPress());
  assert.equal(saves.length, 1);
  assert.equal(saves[0][1], 'Locally edited');
  assert.equal(saves[0][3], original);
});
