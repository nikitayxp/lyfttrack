const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');
const i18next = require('i18next');
global.IS_REACT_ACT_ENVIRONMENT = true;

async function setup(t, platform = 'web', available = true, deferredAvailability = false) {
  const i18n = i18next.createInstance();
  const plain = createSourceLoader();
  await i18n.init({ lng: 'pt', resources: plain('app/src/i18n/resources.ts').resources, interpolation: { escapeValue: false } });
  const records = Array.from({ length: 30 }, (_, index) => ({
    exerciseId: `exercise-${index}`, exercise: { name: `Exercício ${index}` },
    maxWeight: 20 + index, achievedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    muscleKey: index % 2 === 0 ? 'chest' : 'back',
  }));
  const state = { copied: [], shared: [], captured: 0, toasts: [], routes: [] };
  const ViewShot = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ capture: async () => { state.captured++; return 'file:///test-record.png'; } }));
    return React.createElement('ViewShot', null, props.children);
  });
  const load = createSourceLoader({
    'react-native': {
      Platform: { OS: platform }, StyleSheet: { create: value => value },
      Alert: { alert: (title, message) => state.toasts.push({ title, message }) },
      ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', Pressable: 'Pressable',
      ScrollView: 'ScrollView', View: 'View', Text: 'Text', TextInput: 'TextInput',
      Modal: props => props.visible ? React.createElement('Modal', props, props.children) : null,
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: () => null },
    'expo-router': { router: { push: route => state.routes.push(route) } },
    'expo-clipboard': { setStringAsync: async text => { state.copied.push(text); return true; } },
    'expo-sharing': { isAvailableAsync: () => deferredAvailability ? new Promise(resolve => { state.resolveAvailability = resolve; }) : Promise.resolve(available), shareAsync: async (...args) => state.shared.push(args) },
    'react-native-view-shot': ViewShot,
    'react-i18next': { useTranslation: () => ({ t: i18n.t.bind(i18n) }) },
    '@/context/ToastContext': { useAppToast: () => ({ showToast: payload => state.toasts.push(payload) }) },
    '@/services/workoutService': { getErrorMessage: error => error.message },
    '@/constants/theme': plain('app/src/constants/Colors.ts'),
  });
  const components = load('app/src/components/profile/TrophyRoom.tsx');
  function TrophyRoom(props) {
    const [selection, setSelection] = React.useState(null);
    return React.createElement(React.Fragment, null,
      React.createElement(components.TrophyRoomPreview, { ...props, onSelect: record => setSelection({ id: record.exerciseId }), onBrowse: () => setSelection({ id: null }) }),
      selection ? React.createElement(components.TrophyRoom, { records: props.records, language: props.language, initialSelectedId: selection.id, onClose: () => setSelection(null) }) : null);
  }
  const props = { records, language: 'pt', loading: false, error: null, onRetry() {} };
  let tree;
  await act(async () => { tree = create(React.createElement(TrophyRoom, props)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const buttons = () => tree.root.findAllByType('Pressable');
  async function pressText(text) {
    const button = buttons().find(node => node.findAllByType('Text').some(label => label.props.children === text));
    assert.ok(button, `Button not found: ${text}`);
    await act(async () => button.props.onPress());
  }
  async function openFeatured() {
    const button = buttons().find(node => node.props.accessibilityLabel === 'Abrir recorde: Exercício 29');
    await act(async () => button.props.onPress());
  }
  return { tree, state, props, TrophyRoom, pressText, openFeatured,
    async update(next) { await act(async () => tree.update(React.createElement(TrophyRoom, { ...props, ...next }))); },
  };
}

test('profile mounts three previews and creates only one capture after opening a detail', async t => {
  const ui = await setup(t);
  assert.equal(ui.tree.root.findAllByType('Pressable').filter(node => node.props.accessibilityLabel?.startsWith('Abrir recorde:')).length, 3);
  assert.equal(ui.tree.root.findAllByType('ViewShot').length, 0);
  await ui.openFeatured();
  assert.equal(ui.tree.root.findAllByType('ViewShot').length, 1);
  await ui.pressText('Ver progresso do exercício');
  assert.equal(ui.state.routes[0].params.id, 'exercise-29');
});

test('collection applies muscle and search filters and preserves highest-weight sorting', async t => {
  const ui = await setup(t);
  await ui.pressText('Ver os 30 recordes');
  assert.equal(ui.tree.root.findByType('FlatList').props.data.length, 30);
  await ui.pressText('Peito');
  assert.equal(ui.tree.root.findByType('FlatList').props.data.length, 15);
  await ui.pressText('Maior carga');
  assert.equal(ui.tree.root.findByType('FlatList').props.data[0].maxWeight, 48);
  await act(async () => ui.tree.root.findByType('TextInput').props.onChangeText('sem resultados'));
  assert.equal(ui.tree.root.findByType('FlatList').props.data.length, 0);
  assert.ok(ui.tree.root.findAllByType('Text').some(node => node.props.children === '0 recordes'));
});

test('web copies the record without creating a capture or opening native sharing', async t => {
  const ui = await setup(t);
  await ui.openFeatured();
  await ui.pressText('Copiar recorde');
  assert.ok(ui.state.copied[0].includes('Exercício 29'));
  assert.equal(ui.state.captured, 0);
  assert.equal(ui.state.shared.length, 0);
  assert.equal(ui.state.toasts.length, 1);
});

test('native sharing captures the selected record with PNG metadata', async t => {
  const ui = await setup(t, 'ios');
  await ui.openFeatured();
  await ui.pressText('Partilhar recorde');
  assert.equal(ui.state.captured, 1);
  assert.equal(ui.state.shared[0][1].mimeType, 'image/png');
});

test('unavailable native sharing reports feedback and restores the button', async t => {
  const ui = await setup(t, 'ios', false);
  await ui.openFeatured();
  await ui.pressText('Partilhar recorde');
  assert.equal(ui.state.captured, 0);
  assert.equal(ui.state.shared.length, 0);
  assert.equal(ui.state.toasts.length, 1);
  const button = ui.tree.root.findAllByType('Pressable').find(node => node.props.disabled !== undefined);
  assert.equal(button.props.disabled, false);
});

test('a selected record removed from props cannot retain the old account details', async t => {
  const ui = await setup(t);
  await ui.openFeatured();
  await ui.update({ records: [] });
  assert.equal(ui.tree.root.findAllByType('ViewShot').length, 0);
  assert.equal(ui.tree.root.findByType('FlatList').props.data.length, 0);
});

test('changing detail during pending availability cannot capture the replacement record', async t => {
  const ui = await setup(t, 'ios', true, true);
  await ui.openFeatured();
  await ui.pressText('Partilhar recorde');
  await act(async () => ui.tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Voltar a todos os recordes').props.onPress());
  const row = ui.tree.root.findByType('FlatList').props.renderItem({ item: ui.props.records[0] });
  await act(async () => row.props.onSelect(row.props.record));
  await act(async () => ui.state.resolveAvailability(true));
  assert.equal(ui.state.captured, 0);
  assert.equal(ui.state.shared.length, 0);
});
