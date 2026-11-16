const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('Google profile setup applies canonical input before availability and saving', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = [];
  const checked = [];
  const metadataUpdates = [];
  const routes = [];
  const translate = key => key;
  const user = { id: 'owner', user_metadata: {}, app_metadata: { provider: 'google' } };
  const load = createSourceLoader({
    'react-native': {
      ActivityIndicator: 'Spinner', KeyboardAvoidingView: 'Keyboard', Platform: { OS: 'web' },
      ScrollView: 'Scroll', Text: 'Text', TextInput: 'Input', View: 'View', StyleSheet: { create: value => value },
    },
    'expo-router': { router: { replace: route => routes.push(route) } },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/constants/Styles': { Radius: {}, Spacing: {} },
    '@/components/auth/AuthAmbientGlow': { AuthAmbientGlow: ({ children }) => React.createElement('Glow', null, children) },
    '@/components/auth/AuthFeedback': { AuthFeedback: () => null },
    '@/components/ui/AppButton': { AppButton: props => React.createElement('Button', props) },
    '@/services/authUserService': { getSessionUserOrThrow: async () => user },
    '@/services/supabase': { supabase: { auth: { updateUser: async input => {
      metadataUpdates.push(input.data);
      return { error: null };
    } } } },
    '@/services/profileService': {
      getProfile: async () => ({ id: 'owner', username: '._existing__1.', full_name: 'Test user' }),
      checkUsernameAvailability: async value => { checked.push(value); return true; },
      updateProfile: async value => { saved.push(value); return { id: 'owner', ...value }; },
    },
  });
  const Screen = load(process.env.LYFTTRACK_USERNAME_SETUP_SOURCE || 'app/app/(auth)/complete-profile.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const input = () => tree.root.findAllByType('Input').find(node => node.props.accessibilityLabel === 'auth.signUp.usernameLabel');
  assert.equal(input().props.value, '._existing__1.');
  assert.equal(input().props.maxLength, 24);
  for (const [value, expected] of [
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwx'],
    ['Bad Name!', 'bad_name'],
    ['._Keep__01.', '._keep__01.'],
  ]) {
    await act(async () => input().props.onChangeText(value));
    assert.equal(input().props.value, expected);
  }
  await act(async () => t.mock.timers.tick(501));
  assert.deepEqual(checked, ['._keep__01.']);
  await act(async () => tree.root.findByType('Button').props.onPress());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].username, '._keep__01.');
  assert.equal(saved[0].fullName, 'Test user');
  assert.equal(metadataUpdates.length, 1);
  assert.equal(typeof metadataUpdates[0].username_confirmed_at, 'string');
  assert.deepEqual(routes, ['/(auth)/onboarding']);
});
