const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const i18next = require('i18next');
const createSourceLoader = require('./load-source.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

test('period selection separates year browsing, whole year, month, and all dates', async () => {
  const i18n = i18next.createInstance();
  await i18n.init({ lng: 'pt', resources: createSourceLoader()('app/src/i18n/resources.ts').resources });
  const load = createSourceLoader({
    'react-native': { Modal: ({ visible, children }) => visible ? children : null, Pressable: 'Button', ScrollView: 'Scroll', TextInput: 'Input', View: 'View', Text: 'Text', StyleSheet: { create: value => value, absoluteFillObject: {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t: i18n.t.bind(i18n) }) },
    '@/constants/Styles': { Radius: {} },
  });
  const { HistoryJumpBar } = load('app/src/components/history/HistoryJumpBar.tsx');
  let selected;
  let query;
  function Harness() {
    const [period, setPeriod] = React.useState(null);
    const [text, setText] = React.useState('squat');
    selected = period; query = text;
    return React.createElement(HistoryJumpBar, { months: [{ key: '2026-08', year: 2026, month: 8, count: 3 }, { key: '2024-12', year: 2024, month: 12, count: 2 }], selectedPeriodKey: period, onSelectPeriod: setPeriod, query: text, onChangeQuery: setText, searchPlaceholder: 'Pesquisar', allLabel: 'Tudo', locale: 'pt' });
  }
  let tree;
  await act(async () => { tree = create(React.createElement(Harness)); });
  async function click(label) { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress()); }
  await click('Período: Todas as datas');
  await click('2024');
  assert.equal(selected, null);
  await click('dezembro de 2024');
  assert.equal(selected, '2024-12');
  assert.equal(query, 'squat');
  await click('Período: dezembro de 2024');
  await click('Todo o ano 2024');
  assert.equal(selected, '2024');
  await click('Período: 2024');
  await click('Tudo');
  assert.equal(selected, null);
  await click('Limpar pesquisa');
  assert.equal(query, '');
  await act(async () => tree.unmount());
});
