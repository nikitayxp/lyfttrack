const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const createSourceLoader = require('./load-source.cjs');

test('root HTML includes generated styles, document attributes and hydration resources', () => {
  const load = createSourceLoader({
    '@/constants/Styles': { Spacing: { lg: 16 } },
    'expo-router/html': {
      ScrollViewStyleReset: () => null,
      useServerDocumentContext: () => ({
        htmlAttributes: { dir: 'ltr' },
        bodyAttributes: { 'data-expo-document': 'streamed' },
        headNodes: React.createElement('style', { id: 'generated-styles' }, '.fixture{display:flex}'),
        bodyNodes: React.createElement('script', { src: '/_expo/static/js/web/entry-fixture.js' }),
      }),
    },
  });
  const RootHtml = load('app/app/+html.tsx').default;
  const html = renderToStaticMarkup(React.createElement(RootHtml, null, React.createElement('div', { id: 'root' })));
  assert.match(html, /dir="ltr"/);
  assert.match(html, /data-expo-document="streamed"/);
  assert.match(html, /id="generated-styles"/);
  assert.match(html, /id="root"/);
  assert.match(html, /src="\/_expo\/static\/js\/web\/entry-fixture\.js"/);
  assert.match(html, /interactive-widget=resizes-content/);
});
