const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const loadSource = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

for (const screen of ['sign-in', 'sign-up']) {
  test(`${screen} gives feedback and prevents concurrent Google presses`, async t => {
    let finish, calls = 0;
    const pending = new Promise(resolve => { finish = resolve; });
    const passthrough = ({ children }) => children;
    const native = Object.fromEntries(['KeyboardAvoidingView', 'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View', 'ActivityIndicator'].map(name => [name, name]));
    const load = loadSource({
      'react-native': { ...native, Platform: { OS: 'ios', select: values => values.default }, StyleSheet: { create: value => value } },
      '@expo/vector-icons': { AntDesign: 'AntDesign', Ionicons: 'Ionicons' },
      'expo-router': { router: {} },
      'react-i18next': { useTranslation: () => ({ t: key => key }) },
      '@/components/auth/AuthAmbientGlow': { AuthAmbientGlow: passthrough },
      '@/components/auth/AuthFeedback': { AuthFeedback: () => null },
      '@/components/auth/PasswordRequirements': { PasswordRequirements: () => null },
      '@/components/auth/AuthLanguageToggle': { AuthLanguageToggle: () => null },
      '@/components/ui/AppButton': { AppButton: 'AppButton' },
      '@/services/authService': { markTermsAcceptedForOAuth: async () => {}, startGoogleOAuth: async () => { calls++; await pending; } },
      '@/services/profileService': { checkUsernameAvailability: async () => true },
      '@/services/signUpDraft': { loadSignUpDraft: async () => null },
      '@/services/supabase': { supabase: { auth: {} } },
    });
    const Screen = load(`app/app/(auth)/${screen}.tsx`).default;
    let tree;
    await act(async () => { tree = create(React.createElement(Screen)); });
    t.after(async () => { await act(async () => tree.unmount()); });
    const button = () => tree.root.findAllByType('TouchableOpacity').find(node => /continueWithGoogle/.test(node.props.accessibilityLabel || ''));
    await act(async () => { void button().props.onPress(); void button().props.onPress(); });
    assert.equal(calls, 1);
    assert.equal(button().props.disabled, true);
    assert.equal(button().findAllByType('ActivityIndicator').length, 1);
    await act(async () => finish());
    assert.equal(button().props.disabled, false);
  });
}
