const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const ts = require('typescript');

global.IS_REACT_ACT_ENVIRONMENT = true;

function loadSite(environment = {}, replacements = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const sourceModule = { exports: {} };
    cache.set(file, sourceModule);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    } }).outputText;
    vm.runInNewContext(source, {
      ...environment, URL, URLSearchParams, console,
      exports: sourceModule.exports, module: sourceModule,
      require: name => {
        if (Object.hasOwn(replacements, name)) return replacements[name];
        if (name === 'next/link') return { __esModule: true, default: 'a' };
        if (name.startsWith('@/')) {
          const base = path.join('site/src', name.slice(2));
          return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
        }
        if (name.startsWith('.')) {
          const base = path.join(path.dirname(file), name);
          return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
        }
        return require(name);
      },
    });
    return sourceModule.exports;
  }
  return load;
}

test('blog resolves promised route parameters and preserves the requested language', async () => {
  const load = loadSite({}, {
    'next/navigation': { notFound() { throw Error('NOT_FOUND'); } },
    '@/components/blog/blog-article-view': { BlogArticleView: () => null },
  });
  const Page = load('site/src/app/blog/[slug]/page.tsx').default;
  const article = await Page({ params: Promise.resolve({ slug: 'active-workout-system' }), searchParams: Promise.resolve({ lang: 'en' }) });
  assert.equal(article.props.post.slug, 'active-workout-system');
  assert.equal(article.props.initialLanguage, 'en');
  await assert.rejects(async () => Page({ params: Promise.resolve({ slug: 'missing' }) }), /NOT_FOUND/);
});

test('English legal documents keep their language when switching documents or returning home', async t => {
  const values = new Map();
  const document = { documentElement: { lang: 'pt-PT' } };
  const window = {
    location: { href: 'http://localhost/termos?lang=en', search: '?lang=en' },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    addEventListener() {}, removeEventListener() {},
    history: { replaceState() {} },
  };
  const load = loadSite({ window, document });
  const { LegalDocumentView } = load('site/src/components/legal/legal-document-view.tsx');
  const { TERMS_OF_SERVICE } = load('site/src/lib/legal.ts');
  let tree;
  await act(async () => { tree = create(React.createElement(LegalDocumentView, { document: TERMS_OF_SERVICE, initialLanguage: 'en' })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const links = tree.root.findAllByType('a').map(link => link.props.href);
  assert.ok(links.includes('/privacidade?lang=en'));
  assert.ok(links.includes('/?lang=en'));
  assert.equal(document.documentElement.lang, 'en');
});

test('cookie consent follows language changes and essential-only never enables optional categories', async t => {
  const values = new Map();
  const window = {
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  };
  const document = { documentElement: {} };
  const load = loadSite({ window, document, CustomEvent: class {} });
  const { useSiteLanguage } = load('site/src/lib/use-site-language.ts');
  const { CookieConsentBanner } = load('site/src/components/ui/cookie-consent-banner.tsx');
  let changeLanguage;
  function Controls() {
    [, changeLanguage] = useSiteLanguage();
    return null;
  }
  let tree;
  await act(async () => { tree = create(React.createElement(React.Fragment, null, React.createElement(Controls), React.createElement(CookieConsentBanner))); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(tree.root.findByProps({ role: 'dialog' }).props['aria-label'], 'Consentimento de cookies');
  await act(async () => changeLanguage('en'));
  assert.equal(tree.root.findByProps({ role: 'dialog' }).props['aria-label'], 'Cookie consent');
  const essential = tree.root.findAllByType('button').find(button => button.children.join('') === 'Essential only');
  assert.ok(essential);
  await act(async () => essential.props.onClick());
  assert.equal(tree.root.findAllByProps({ role: 'dialog' }).length, 0);
  assert.deepEqual(JSON.parse(values.get('lyfttrack.cookie.consent')).preferences, { essential: true, analytics: false, marketing: false });
});
