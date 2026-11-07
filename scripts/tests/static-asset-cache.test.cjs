const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pathToRegexp } = require('next/dist/compiled/path-to-regexp');
const config = require('../../app/vercel.json');

const matches = (source, path) => pathToRegexp(source, [], { strict: true, sensitive: true, delimiter: '/' }).test(path);

test('missing hashed scripts cannot fall through to the SPA document', () => {
  const path = '/_expo/static/js/web/missing-00000000000000000000000000000000.js';
  assert.ok(config.headers.some(rule => matches(rule.source, path)));
  assert.equal(config.rewrites.some(rule => matches(rule.source, path)), false);
});

test('SPA navigation remains available without immutable document caching', () => {
  for (const path of ['/', '/profile', '/callback', '/sign-in', '/workout/123']) {
    assert.ok(config.rewrites.some(rule => matches(rule.source, path)), path);
    assert.equal(config.headers.some(rule => matches(rule.source, path)), false, path);
  }
});

test('immutable caching is limited to hashed Expo JavaScript paths', () => {
  const path = '/_expo/static/js/web/entry-053bd685ce572c60cb10e425a25f4dad.js';
  const rule = config.headers.find(rule => matches(rule.source, path));
  assert.equal(rule.headers.find(h => h.key === 'Cache-Control').value, 'public, max-age=31536000, immutable');
  for (const other of ['/_expo/static/js/web/entry.js', '/_expo/static/js/web/entry-abcd.js', '/profile.html', '/assets/image.png']) {
    assert.equal(config.headers.some(rule => matches(rule.source, other)), false, other);
  }
});
