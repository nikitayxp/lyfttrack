const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

function flatten(style) {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style;
}

async function setup(t, platform, active) {
  let hasActiveWorkout = active;
  const colors = createSourceLoader()('app/src/constants/Colors.ts');
  const empty = () => null;
  const load = createSourceLoader({
    'react-native': {
      Platform: { OS: platform, select: values => values[platform] ?? values.default },
      StyleSheet: { create: value => value, absoluteFillObject: {} },
      ScrollView: 'ScrollView', View: 'View', Text: 'Text', TextInput: 'TextInput',
      TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable', Modal: 'Modal', ActivityIndicator: 'ActivityIndicator',
    },
    '@expo/vector-icons': { Ionicons: empty },
    'expo-router': { router: { push() {}, replace() {} } },
    'react-i18next': { useTranslation: () => ({ t: value => value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
    '@/constants/theme': colors,
    '@/components/common/BackButton': { BackButton: empty },
    '@/context/ToastContext': { useAppToast: () => ({ showToast() {} }) },
    '@/context/PreferencesContext': { usePreferences: () => ({ language: 'pt', setLanguage() {}, countWorkingSetsOnly: false, setCountWorkingSetsOnly() {} }) },
    '@/context/WorkoutContext': { useWorkoutContext: () => ({ hasActiveWorkout, activeExercises: [], elapsedSeconds: 0 }) },
    '@/services/supabase': { supabase: { auth: { signOut: async () => ({ error: null }) } } },
    '@/services/profileService': { getProfile: async () => ({ visibility: 'public' }), updateProfile() {}, deleteOwnAccount() {} },
    '@/utils/confirmAction': { confirmAction: async () => false },
    '@/utils/showAlert': { showAlert() {} },
    '@/utils/exerciseLocalization': { getLocalizedExerciseName: exercise => exercise.name },
  });
  const Screen = load('app/app/(tabs)/profile/settings.tsx').default;
  const { MinimizedWorkoutBar } = load('app/src/components/workout/MinimizedWorkoutBar.tsx');
  const { getTabBarHeight } = load('app/src/constants/tabBar.ts');
  const content = () => React.createElement(React.Fragment, null,
    React.createElement(Screen), React.createElement(MinimizedWorkoutBar, { visible: true }));
  let tree;
  await act(async () => { tree = create(content()); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return {
    get padding() { return flatten(tree.root.findByType('ScrollView').props.contentContainerStyle).paddingBottom; },
    get requiredPadding() {
      const tabHeight = getTabBarHeight(platform === 'web', 34);
      if (!hasActiveWorkout) return 28 + (platform === 'web' ? tabHeight : 0);
      const bar = flatten(tree.root.findByType('Pressable').props.style);
      return 28 + bar.bottom + bar.minHeight - (platform === 'web' ? 0 : tabHeight);
    },
    async setActive(value) { hasActiveWorkout = value; await act(async () => { tree.update(content()); }); },
  };
}

for (const [platform, active] of [['web', false], ['web', true], ['ios', true], ['ios', false]]) {
  test(`settings content clears bottom navigation on ${platform}, workout active=${active}`, async t => {
    const screen = await setup(t, platform, active);
    assert.ok(screen.padding >= screen.requiredPadding, `${screen.padding}px padding cannot clear ${screen.requiredPadding}px of bottom space`);
  });
}

test('settings follows the presence of the minimized workout without keeping extra space', async t => {
  const screen = await setup(t, 'web', false);
  const idlePadding = screen.padding;
  await screen.setActive(true);
  assert.ok(screen.padding >= screen.requiredPadding);
  assert.ok(screen.padding > idlePadding);
  await screen.setActive(false);
  assert.equal(screen.padding, idlePadding);
});
