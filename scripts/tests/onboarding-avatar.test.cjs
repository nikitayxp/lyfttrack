const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

class AvatarValidationError extends Error {
  constructor(reason) { super('Invalid avatar'); this.reason = reason; }
}

async function setup(t, { language = 'pt', pickerError, uploadErrors = [], picks } = {}) {
  const stored = 'https://cdn.example.test/stored.jpg';
  const selected = { fileUri: 'file:///selected.jpg', contentType: 'image/jpeg' };
  const saved = 'https://cdn.example.test/new.jpg';
  const resources = createSourceLoader()('app/src/i18n/resources.ts').resources[language].translation;
  const translate = key => key.split('.').reduce((value, part) => value?.[part], resources) ?? key;
  const uploads = [];
  const profileUpdates = [];
  const routes = [];
  let completed = 0;
  let pickNumber = 0;
  const load = createSourceLoader({
    'react-native': { Image: 'Image', View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', KeyboardAvoidingView: 'View', ScrollView: 'View', Platform: { OS: 'web', select: values => values.web ?? values.default }, StyleSheet: { create: value => value } },
    'expo-router': { router: { replace: route => routes.push(route) } },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/components/auth/AuthAmbientGlow': { AuthAmbientGlow: ({ children }) => children },
    '@/components/auth/AuthFeedback': { AuthFeedback: ({ feedback }) => React.createElement('Feedback', feedback) },
    '@/components/ui/AppButton': { AppButton: props => React.createElement('Action', props) },
    '@/services/authSetup': { markOnboardingCompleted: async () => { completed++; } },
    '@/services/measurementService': { addWeight: async () => {}, parseBodyWeightInput: Number },
    '@/services/profileService': {
      AvatarValidationError,
      getProfile: async () => ({ username: 'test-user', avatar_url: stored, height_cm: null }),
      pickAvatarFromLibrary: async () => { if (pickerError) throw pickerError; return picks ? picks[pickNumber++] : selected; },
      uploadAvatar: async input => { uploads.push(input); const error = uploadErrors[uploads.length - 1]; if (error) throw error; return { avatar_url: saved }; },
      updateProfile: async input => { profileUpdates.push(input); },
      withAvatarCacheBuster: url => url,
    },
  });
  const Screen = load('app/app/(auth)/onboarding.tsx').default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { tree, translate, uploads, profileUpdates, routes, stored, saved,
    get completed() { return completed; },
    get preview() { return tree.root.findByType('Image').props.source.uri; },
    get feedback() { return tree.root.findAllByType('Feedback')[0]?.props.message; },
    async choose() { await act(async () => tree.root.findByProps({ accessibilityLabel: translate('auth.onboarding.photoLabel') }).props.onPress()); },
    async discard() { await act(async () => tree.root.findByProps({ accessibilityLabel: translate('auth.onboarding.discardPhoto') }).props.onPress()); },
    async continue() { await act(async () => tree.root.findByType('Action').props.onPress()); },
  };
}

for (const language of ['pt', 'en']) {
  test(`a rejected upload can be discarded and onboarding completed without replacing the stored avatar (${language})`, async t => {
    const app = await setup(t, { language, uploadErrors: [new AvatarValidationError('too-large')] });
    await app.choose();
    await app.continue();
    assert.equal(app.completed, 0);
    assert.match(app.feedback, /2 MB/);
    await app.discard();
    assert.equal(app.preview, app.stored);
    await app.continue();
    assert.equal(app.completed, 1);
    assert.equal(app.uploads.length, 1);
    assert.equal(app.profileUpdates.length, 0);
    assert.equal(app.routes.length, 1);
  });
}

test('discarding a selection before upload keeps the existing stored photo', async t => {
  const app = await setup(t);
  await app.choose();
  await app.discard();
  assert.equal(app.preview, app.stored);
  await app.continue();
  assert.equal(app.uploads.length, 0);
  assert.equal(app.completed, 1);
});

test('a transient upload failure keeps the pending photo available for retry', async t => {
  const app = await setup(t, { uploadErrors: [new Error('Network unavailable')] });
  await app.choose();
  await app.continue();
  assert.equal(app.completed, 0);
  assert.equal(app.preview, 'file:///selected.jpg');
  await app.continue();
  assert.equal(app.completed, 1);
  assert.equal(app.uploads.length, 2);
  assert.equal(app.preview, app.saved);
});

test('an unsupported selection shows translated feedback and leaves onboarding usable', async t => {
  const app = await setup(t, { pickerError: new AvatarValidationError('unsupported-type') });
  await app.choose();
  assert.equal(app.feedback, app.translate('profileEdit.alerts.avatarUnsupportedType'));
  assert.equal(app.preview, app.stored);
  await app.continue();
  assert.equal(app.completed, 1);
  assert.equal(app.uploads.length, 0);
});

test('canceling a second selection preserves the first selection and allows discarding it', async t => {
  const app = await setup(t, { picks: [{ fileUri: 'file:///first.jpg' }, null] });
  await app.choose();
  await app.choose();
  assert.equal(app.preview, 'file:///first.jpg');
  await app.discard();
  assert.equal(app.preview, app.stored);
});
