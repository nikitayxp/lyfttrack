const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const createSourceLoader = require('./load-source.cjs');

test('the article index lists actual posts and preserves the requested language', async () => {
  const data = createSourceLoader()('site/src/lib/blog-data.ts');
  const load = createSourceLoader({
    '@/lib/blog-data': data,
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  });
  const Page = load('site/src/app/blog/page.tsx').default;
  for (const language of ['pt', 'en']) {
    const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ lang: language }) }));
    for (const post of data.BLOG_POSTS) {
      assert.ok(markup.includes(post.title[language]));
      assert.ok(markup.includes(`/blog/${post.slug}?lang=${language}`));
    }
    assert.ok(markup.includes(`/?lang=${language}`));
  }
});
