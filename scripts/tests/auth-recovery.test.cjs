const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

async function setup(t, { route = 'reset-password', params = {}, verificationError = null, language = 'pt', returnUrl, platform = 'web', recoveryRequest = async () => ({ error: null }), controlledTimers = false } = {}) {
  const recoveryRequests = [];
  const timers = [];
  const verifications = [];
  const exchanges = [];
  const updates = [];
  const alerts = [];
  const routeUpdates = [];
  let session = null;
  let switchOnSessionRead = false;
  const href = returnUrl ?? `https://app.example.test/${route}?${new URLSearchParams(params)}`;
  const browserWindow = { location: { href }, history: { replaceState: (_state, _title, value) => { browserWindow.location.href = value; } } };
  const translations = createSourceLoader()('app/src/i18n/resources.ts').resources[language].translation;
  const translate = key => key.split('.').reduce((value, part) => value?.[part], translations) ?? key;
  const load = createSourceLoader({
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', KeyboardAvoidingView: 'View', ScrollView: 'View', ActivityIndicator: 'Spinner', Platform: { OS: 'web', select: options => options.web ?? options.default }, StyleSheet: { create: value => value } },
    '@expo/vector-icons': { AntDesign: 'Icon', Ionicons: 'Icon' },
    'expo-router': { useLocalSearchParams: () => ({ ...params }), router: { setParams: value => routeUpdates.push(value) } },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/components/auth/AuthAmbientGlow': { AuthAmbientGlow: ({ children }) => children },
    '@/components/auth/AuthLanguageToggle': { AuthLanguageToggle: () => null },
    '@/components/auth/PasswordRequirements': { PasswordRequirements: () => null },
    '@/components/auth/AuthFeedback': { AuthFeedback: ({ feedback }) => React.createElement('Text', null, feedback?.message) },
    '@/components/ui/AppButton': { AppButton: props => React.createElement('Action', props) },
    '@/context/ToastContext': { useAppToast: () => ({ showToast() {} }) },
    '@/utils/navigation': { goBack() {} },
    '@/utils/showAlert': { showAlert: (...args) => alerts.push(args) },
    '@/services/authService': { markTermsAcceptedForOAuth: async () => {}, startGoogleOAuth: async () => { throw new Error('oauth-insecure-context'); } },
    '@/services/profileService': { checkUsernameAvailability: async () => true },
    '@/services/signUpDraft': { loadSignUpDraft: async () => null, saveSignUpDraft: async () => {} },
    '@/services/supabase': { getPasswordResetRedirectTo: () => 'https://app.example.test/reset-password', updateRecoveredPassword: async (verifiedSession, password) => { updates.push({ userId: verifiedSession.user.id, password }); }, supabase: { auth: {
      resetPasswordForEmail: async (...args) => { recoveryRequests.push(args); return recoveryRequest(...args); },
      verifyOtp: async value => { verifications.push(value); if (!verificationError) session = { user: { id: 'test-user' } }; return { data: { session }, error: verificationError }; },
      exchangeCodeForSession: async code => { exchanges.push(code); if (!verificationError) session = { user: { id: 'test-user' } }; return { data: { session, user: session?.user }, error: verificationError }; },
      getSession: async () => { const snapshot = session; if (switchOnSessionRead) { switchOnSessionRead = false; session = { user: { id: 'different-account' } }; } return { data: { session: snapshot }, error: null }; },
      updateUser: async value => { assert.ok(session, 'password updates require a verified recovery session'); updates.push({ userId: session.user.id, ...value }); return { error: null }; },
    } } },
  }, { window: platform === 'web' ? browserWindow : undefined, ...(controlledTimers ? {
    setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout: timer => { const index = timers.indexOf(timer); if (index >= 0) timers.splice(index, 1); },
  } : {}) });
  const Screen = load(`app/app/(auth)/${route}.tsx`).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { get tree() { return tree; }, translate, verifications, exchanges, updates, alerts, browserWindow, routeUpdates, recoveryRequests, timers,
    async input(key, value) { await act(async () => tree.root.findByProps({ accessibilityLabel: translate(key) }).props.onChangeText(value)); },
    async press(key) { const button = tree.root.findAllByType('Action').find(button => button.props.label === translate(key)); assert.ok(button, 'Missing action: '+key); await act(async () => button.props.onPress()); },
    async remount() { await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(Screen)); }); },
    switchAccount(userId) { session = { user: { id: userId } }; },
    switchDuringNextSessionRead() { switchOnSessionRead = true; },
    async navigateReturn(fragment) { params['#'] = fragment; browserWindow.location.href = `https://app.example.test/reset-password#${fragment}`; await act(async () => tree.update(React.createElement(Screen))); },
  };
}

test('a recovery token-hash link opens password entry without a verifier or existing session', async t => {
  const app = await setup(t, { params: { token_hash: 'recovery-hash', type: 'recovery' } });
  assert.equal(app.verifications.length, 1);
  assert.equal(app.verifications[0].token_hash, 'recovery-hash');
  assert.equal(app.verifications[0].type, 'recovery');
  assert.ok(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.newPasswordLabel') }));
  await app.input('auth.resetPassword.newPasswordLabel', 'new-test-password');
  await app.input('auth.resetPassword.confirmPasswordLabel', 'new-test-password');
  await app.press('auth.resetPassword.updateAction');
  assert.equal(app.updates.length, 1);
  await app.remount();
  assert.equal(app.verifications.length, 1, 'a remount cannot consume a single-use token twice');
  assert.equal(new URL(app.browserWindow.location.href).searchParams.has('token_hash'), false);
});

test('an older PKCE recovery link exchanges its code once', async t => {
  const app = await setup(t, { params: { code: 'recovery-code' } });
  assert.deepEqual(app.exchanges, ['recovery-code']);
  assert.ok(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.newPasswordLabel') }));
  await app.remount();
  assert.equal(app.exchanges.length, 1);
});

test('a native recovery route preserves its recovery type when constructing the return URL', async t => {
  const app = await setup(t, { platform: 'ios', params: { token_hash: 'native-recovery', type: 'recovery' } });
  assert.equal(app.verifications.length, 1);
  assert.equal(app.verifications[0].type, 'recovery');
  assert.ok(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.newPasswordLabel') }));
});

test('an expired recovery link retains the email and code fallback', async t => {
  const app = await setup(t, { params: { token_hash: 'expired-hash', type: 'recovery' }, verificationError: { message: 'Expired' } });
  assert.equal(app.verifications.length, 1);
  assert.ok(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.emailLabel') }));
  assert.ok(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.codeLabel') }));
  assert.equal(app.updates.length, 0);
  assert.match(JSON.stringify(app.tree.toJSON()), new RegExp(app.translate('auth.resetPassword.invalidLink')));
  assert.notEqual(app.translate('auth.resetPassword.invalidLink'), 'auth.resetPassword.invalidLink');
});

test('a non-recovery token cannot authorize a password update', async t => {
  const app = await setup(t, { params: { token_hash: 'confirmation-hash', type: 'email' } });
  assert.equal(app.verifications.length, 0);
  assert.equal(app.updates.length, 0);
  assert.equal(app.tree.root.findAllByProps({ accessibilityLabel: app.translate('auth.resetPassword.newPasswordLabel') }).length, 0);
});

test('legacy recovery credentials are scrubbed and rejected with the numeric fallback available', async t => {
  for (const credentials of ['#access_token=old-access&refresh_token=old-refresh', '?access_token=old-access&refresh_token=old-refresh']) {
    const app = await setup(t, { returnUrl: `https://app.example.test/reset-password${credentials}` });
    const url = new URL(app.browserWindow.location.href);
    assert.equal(url.hash, '');
    assert.equal(url.searchParams.has('access_token'), false);
    assert.equal(url.searchParams.has('refresh_token'), false);
    assert.equal(app.verifications.length, 0);
    assert.equal(app.exchanges.length, 0);
    assert.ok(Object.hasOwn(app.routeUpdates.at(-1) ?? {}, '#'), 'the router must clear its own fragment state');
    assert.equal(app.routeUpdates.at(-1)['#'], '');
    assert.ok(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.codeLabel') }));
    assert.match(JSON.stringify(app.tree.toJSON()), new RegExp(app.translate('auth.resetPassword.invalidLink')));
  }
});

test('opening a legacy fragment while recovery is mounted still clears and rejects it', async t => {
  const app = await setup(t);
  await app.navigateReturn('access_token=old-access&refresh_token=old-refresh');
  assert.equal(new URL(app.browserWindow.location.href).hash, '');
  assert.match(JSON.stringify(app.tree.toJSON()), new RegExp(app.translate('auth.resetPassword.invalidLink')));
});

test('numeric email recovery still reaches password entry and submits the new password', async t => {
  const app = await setup(t);
  await app.input('auth.resetPassword.emailLabel', ' TEST@example.test ');
  await app.input('auth.resetPassword.codeLabel', '123456');
  await app.press('auth.resetPassword.verifyCodeAction');
  assert.equal(app.verifications[0].email, 'test@example.test');
  assert.equal(app.verifications[0].token, '123456');
  assert.equal(app.verifications[0].type, 'recovery');
  await app.input('auth.resetPassword.newPasswordLabel', 'new-test-password');
  await app.input('auth.resetPassword.confirmPasswordLabel', 'new-test-password');
  await app.press('auth.resetPassword.updateAction');
  assert.equal(app.updates[0].password, 'new-test-password');
});

test('a previously consumed recovery link cannot verify a different account', async t => {
  const app = await setup(t, { params: { token_hash: 'recovery-hash', type: 'recovery' } });
  app.switchAccount('different-account');
  await app.remount();
  assert.equal(app.verifications.length, 1);
  assert.equal(app.tree.root.findAllByProps({ accessibilityLabel: app.translate('auth.resetPassword.newPasswordLabel') }).length, 0);
});

test('changing accounts after recovery verification cannot update the other password', async t => {
  const app = await setup(t);
  await app.input('auth.resetPassword.emailLabel', 'test@example.test');
  await app.input('auth.resetPassword.codeLabel', '123456');
  await app.press('auth.resetPassword.verifyCodeAction');
  await app.input('auth.resetPassword.newPasswordLabel', 'new-test-password');
  await app.input('auth.resetPassword.confirmPasswordLabel', 'new-test-password');
  app.switchAccount('different-account');
  await app.press('auth.resetPassword.updateAction');
  assert.equal(app.updates.length, 0);
  assert.equal(app.tree.root.findAllByProps({ accessibilityLabel: app.translate('auth.resetPassword.newPasswordLabel') }).length, 0);
});

test('an account change between the session check and password update cannot target the new account', async t => {
  const app = await setup(t, { params: { token_hash: 'recovery-hash', type: 'recovery' } });
  await app.input('auth.resetPassword.newPasswordLabel', 'new-test-password');
  await app.input('auth.resetPassword.confirmPasswordLabel', 'new-test-password');
  app.switchDuringNextSessionRead();
  await app.press('auth.resetPassword.updateAction');
  assert.equal(app.updates.length, 1);
  assert.equal(app.updates[0].userId, 'test-user');
});

for (const route of ['sign-in', 'sign-up']) {
  for (const language of ['pt', 'en']) {
    test(`${route} explains the secure-context requirement in ${language}`, async t => {
      const app = await setup(t, { route, language });
      const key = route === 'sign-in' ? 'auth.signIn.continueWithGoogle' : 'auth.signUp.continueWithGoogle';
      await act(async () => app.tree.root.findByProps({ accessibilityLabel: app.translate(key) }).props.onPress());
      assert.match(JSON.stringify(app.tree.toJSON()), /HTTPS/);
      assert.match(JSON.stringify(app.tree.toJSON()), /localhost/);
    });
  }
}

for (const language of ['pt','en']) {
  test(`recovery offers a new code without leaving the screen (${language})`, async t => {
    const app = await setup(t, { language, controlledTimers: true, params: { '#': 'access_token=old&refresh_token=old' } });
    await app.press('auth.resetPassword.requestCodeAction');
    assert.equal(app.recoveryRequests.length, 0);
    await app.input('auth.resetPassword.emailLabel', '  TEST@example.com ');
    await app.input('auth.resetPassword.codeLabel', '123456');
    await app.press('auth.resetPassword.requestCodeAction');
    assert.equal(app.recoveryRequests.length, 1);
    assert.equal(app.recoveryRequests[0][0], 'test@example.com');
    assert.equal(app.recoveryRequests[0][1].redirectTo, 'https://app.example.test/reset-password');
    assert.equal(app.verifications.length, 0);
    assert.equal(app.updates.length, 0);
    assert.ok(JSON.stringify(app.tree.toJSON()).includes(app.translate('auth.resetPassword.requestCodeSent')));
    assert.equal(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.codeLabel') }).props.value, '');
    await app.press('auth.resetPassword.requestCodeAction');
    assert.equal(app.recoveryRequests.length, 1, 'successful request must have a cooldown');
    const timer = app.timers.find(timer => timer.delay === 60000);
    assert.ok(timer);
    await act(async () => timer.callback());
    await app.press('auth.resetPassword.requestCodeAction');
    assert.equal(app.recoveryRequests.length, 2);
  });
}

test('a failed new-code request keeps the entered code and permits retry', async t => {
  let fail = true;
  const app = await setup(t, { controlledTimers: true, recoveryRequest: async () => { if (fail) throw new Error('network unavailable'); return { error: null }; } });
  await app.input('auth.resetPassword.emailLabel', 'test@example.com');
  await app.input('auth.resetPassword.codeLabel', '123456');
  await app.press('auth.resetPassword.requestCodeAction');
  assert.equal(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.codeLabel') }).props.value, '123456');
  assert.ok(JSON.stringify(app.alerts).includes(app.translate('auth.resetPassword.requestCodeFailed')));
  fail = false;
  await app.press('auth.resetPassword.requestCodeAction');
  assert.equal(app.recoveryRequests.length, 2);
});


test('concurrent clicks request only one recovery email', async t => {
  let resolveRequest;
  const app = await setup(t, { controlledTimers: true, recoveryRequest: () => new Promise(resolve => { resolveRequest = resolve; }) });
  await app.input('auth.resetPassword.emailLabel', 'test@example.com');
  await app.press('auth.resetPassword.requestCodeAction');
  await app.press('auth.resetPassword.requestCodeAction');
  assert.equal(app.recoveryRequests.length, 1);
  assert.equal(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.emailLabel') }).props.editable, false);
  assert.equal(app.tree.root.findByProps({ accessibilityLabel: app.translate('auth.resetPassword.codeLabel') }).props.editable, false);
  await act(async () => resolveRequest({ error: null }));
  assert.equal(app.timers.length, 1);
});

test('an invalid email never sends a recovery request', async t => {
  const app = await setup(t);
  for (const email of ['not-an-email', 'a@b', 'a b@example.com']) {
    await app.input('auth.resetPassword.emailLabel', email);
    await app.press('auth.resetPassword.requestCodeAction');
  }
  assert.equal(app.recoveryRequests.length, 0);
});

test('leaving recovery during a pending request does not start a late cooldown timer', async t => {
  let resolveRequest;
  const app = await setup(t, { controlledTimers: true, recoveryRequest: () => new Promise(resolve => { resolveRequest = resolve; }) });
  await app.input('auth.resetPassword.emailLabel', 'test@example.com');
  await app.press('auth.resetPassword.requestCodeAction');
  await act(async () => app.tree.unmount());
  await act(async () => resolveRequest({ error: null }));
  assert.equal(app.timers.length, 0);
});
