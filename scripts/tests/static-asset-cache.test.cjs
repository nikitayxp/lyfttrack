const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pathToRegexp } = require('next/dist/compiled/path-to-regexp');
const config = require('../../app/vercel.json');
const cacheRules = config.headers.filter(rule => rule.headers.some(header => header.key.toLowerCase() === 'cache-control'));

const matches = (source, path) => pathToRegexp(source, [], { strict: true, sensitive: true, delimiter: '/' }).test(path);

test('missing hashed scripts cannot fall through to the SPA document', () => {
  const path = '/_expo/static/js/web/missing-00000000000000000000000000000000.js';
  assert.ok(cacheRules.some(rule => matches(rule.source, path)));
  assert.equal(config.rewrites.some(rule => matches(rule.source, path)), false);
});

test('SPA navigation remains available without immutable document caching', () => {
  for (const path of ['/', '/profile', '/callback', '/sign-in', '/workout/123']) {
    assert.ok(config.rewrites.some(rule => matches(rule.source, path)), path);
    assert.equal(cacheRules.some(rule => matches(rule.source, path)), false, path);
  }
});

test('immutable caching is limited to hashed JavaScript and exercise thumbnails', () => {
  for (const path of [
    '/_expo/static/js/web/entry-053bd685ce572c60cb10e425a25f4dad.js',
    '/_expo/static/js/web/[id]-c690ff91afdccf0e8546c21d148ae055.js',
    '/exercise-thumbnails/0123456789abcdef.webp',
  ]) {
    const rule = cacheRules.find(rule => matches(rule.source, path));
    assert.ok(rule, path);
    assert.equal(rule.headers.find(h => h.key === 'Cache-Control').value, 'public, max-age=31536000, immutable');
  }
  for (const other of ['/_expo/static/js/web/entry.js', '/_expo/static/js/web/[id].js', '/_expo/static/js/web/entry-abcd.js', '/profile.html', '/assets/image.png']) {
    assert.equal(cacheRules.some(rule => matches(rule.source, other)), false, other);
  }
});

test('training and authentication responses set browser security headers', () => {
  const paths = ['/', '/profile', '/sign-in', '/sign-up', '/callback', '/reset-password', '/verify'];
  const required = {
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };

  for (const path of paths) {
    const headers = Object.fromEntries(config.headers
      .filter(rule => matches(rule.source, path))
      .flatMap(rule => rule.headers)
      .map(({ key, value }) => [key.toLowerCase(), value]));

    for (const [key, value] of Object.entries(required)) {
      assert.equal(headers[key], value, path + ' ' + key);
    }
  }
});
