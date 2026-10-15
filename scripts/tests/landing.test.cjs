const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const ts = require('typescript');

global.IS_REACT_ACT_ENVIRONMENT = true;

async function setup(t, stored, blocked = false) {
  const values = new Map([['lyfttrack.site.language', stored]]);
  const window = {
    scrollY: 200,
    localStorage: {
      getItem: key => { if (blocked) throw Error('Storage blocked'); return values.get(key) ?? null; },
      setItem: (key, value) => { if (blocked) throw Error('Storage blocked'); values.set(key, value); },
    },
    addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout,
  };
  const replacements = {
    'lucide-react': { ChevronDown: () => null, Globe: () => null },
    '@/components/ui/cinematic-hero': { CinematicHero: () => null },
    '@/components/home/features-section': { FeaturesSection: () => null },
    '@/components/ui/cookie-consent-banner': { CookiePreferencesLink: () => null },
  };
  const source = fs.readFileSync('site/src/components/home/landing-shell.tsx', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const sourceModule = { exports: {} };
  vm.runInNewContext(compiled, {
    window,
    require: name => replacements[name] ?? require(name),
    exports: sourceModule.exports,
    module: sourceModule,
  });
  let tree;
  await act(async () => { tree = create(React.createElement(sourceModule.exports.LandingShell)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { tree, values };
}

test('the header exposes an immediate app link without scrolling', async t => {
  const { tree } = await setup(t, null);
  const links = tree.root.findByType('header').findAllByType('a');
  assert.equal(links.length, 1);
  assert.equal(links[0].props.href, 'https://lyfttrack-app.vercel.app/');
  assert.equal(links[0].children.join(''), 'Entrar na app');
});

test('loading a saved English preference does not overwrite it with Portuguese', async t => {
  const { tree, values } = await setup(t, '"en"');
  assert.equal(values.get('lyfttrack.site.language'), '"en"');
  const links = tree.root.findByType('header').findAllByType('a');
  assert.equal(links[0]?.children.join(''), 'Open app');
});

test('language changes persist and remain usable with blocked storage', async t => {
  const { tree, values } = await setup(t, '"pt"');
  await act(async () => tree.root.findByType('header').findByType('button').props.onClick());
  assert.equal(values.get('lyfttrack.site.language'), '"en"');
  const blocked = await setup(t, null, true);
  await act(async () => blocked.tree.root.findByType('header').findByType('button').props.onClick());
  assert.equal(blocked.tree.root.findByType('header').findByType('a').children.join(''), 'Open app');
});
