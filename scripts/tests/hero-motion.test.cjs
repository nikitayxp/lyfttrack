const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const ts = require('typescript');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('changing motion preference preserves the pinned hero root and cleans its animation', async t => {
  let reduced = false;
  let reverted = 0;
  const empty = () => null;
  const replacements = {
    'next/link': 'a',
    'lucide-react': { Activity: empty, Dumbbell: empty, Layers: empty, Rocket: empty, TrendingUp: empty },
    sonner: { toast() {} },
    gsap: { gsap: { registerPlugin() {}, context: () => ({ revert: () => { reverted++; } }) } },
    'gsap/ScrollTrigger': { ScrollTrigger: {} },
    '@/components/ui/flow-field-background': { __esModule: true, default: empty },
    '@/lib/use-reduced-motion': { useReducedMotion: () => reduced },
    '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
  };
  const source = fs.readFileSync('site/src/components/ui/cinematic-hero.tsx', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const sourceModule = { exports: {} };
  vm.runInNewContext(compiled, {
    require: name => replacements[name] ?? require(name),
    module: sourceModule,
    exports: sourceModule.exports,
    window: { innerWidth: 390, innerHeight: 844, addEventListener() {}, removeEventListener() {} },
    cancelAnimationFrame() {},
  });
  const Hero = sourceModule.exports.CinematicHero;
  let tree;
  await act(async () => { tree = create(React.createElement(Hero)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(tree.toJSON().type, 'div');
  await act(async () => { reduced = true; tree.update(React.createElement(Hero)); });
  assert.equal(tree.toJSON().type, 'div');
  assert.equal(reverted, 1);
  assert.equal(tree.root.findAllByType('canvas').length, 0);
  assert.equal(tree.root.findByType('a').props.href, 'https://lyfttrack-app.vercel.app/');
});
