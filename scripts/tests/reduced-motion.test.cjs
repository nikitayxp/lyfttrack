const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { create, act } = require('react-test-renderer');
const ts = require('typescript');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('motion preference uses a stable server snapshot and follows live changes', async t => {
  let matches = true;
  const listeners = new Set();
  const media = {
    get matches() { return matches; },
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  };
  const source = fs.readFileSync('site/src/lib/use-reduced-motion.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const sourceModule = { exports: {} };
  vm.runInNewContext(compiled, {
    require,
    exports: sourceModule.exports,
    module: sourceModule,
    window: { matchMedia: () => media },
  });
  function Consumer() {
    const reduced = sourceModule.exports.useReducedMotion();
    return React.createElement('p', null, String(reduced));
  }
  assert.equal(renderToString(React.createElement(Consumer)), '<p>false</p>');
  let tree;
  await act(async () => { tree = create(React.createElement(Consumer)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(tree.root.findByType('p').children.join(''), 'true');
  await act(async () => { matches = false; listeners.forEach(listener => listener()); });
  assert.equal(tree.root.findByType('p').children.join(''), 'false');
});
