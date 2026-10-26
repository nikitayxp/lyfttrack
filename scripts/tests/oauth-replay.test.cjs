const assert = require('node:assert/strict');
const { test } = require('node:test');
const loadSource = require('./load-source.cjs');

function setup() {
  const entries = new Map();
  let session = null, restored = 0, now = Date.now();
  const storage = { getItem: async key => entries.get(key) ?? null, setItem: async (key, value) => { entries.set(key, value); }, removeItem: async key => { entries.delete(key); } };
  const createService = browserWindow => loadSource({
    '@react-native-async-storage/async-storage': storage,
    '@/services/supabase': { supabase: { auth: {
      setSession: async () => { restored++; session = { user: { id: 'old-account' } }; return { error: null }; },
      exchangeCodeForSession: async () => { restored++; session = { user: { id: 'old-account' } }; return { error: null }; },
      getSession: async () => ({ data: { session }, error: null }),
    } } },
  }, { Date: class extends Date { static now() { return now; } }, window: browserWindow })('app/src/services/oauthReturn.ts');
  return { createService, entries, get restored() { return restored; }, signOut() { session = null; }, advance(ms) { now += ms; } };
}

for (const restart of [false, true]) {
  test(`an implicit callback cannot restore a signed-out account after ${restart ? 'a module restart' : 'five minutes'}`, async () => {
    const app = setup();
    let service = app.createService();
    if (service.beginGoogleOAuthReturn) await service.beginGoogleOAuthReturn();
    const url = 'lyfttrack://callback#access_token=old-access&refresh_token=old-refresh';
    await service.completeGoogleOAuthReturn(url);
    app.signOut();
    app.advance(300_001);
    if (restart) service = app.createService();
    await service.beginGoogleOAuthReturn();
    await assert.rejects(service.completeGoogleOAuthReturn(url), /oauth-(missing-code|unexpected-return)/);
    assert.equal(app.restored, 1);
    assert.equal([...app.entries.values()].some(value => value.includes('old-access') || value.includes('old-refresh')), false);
  });
}

test('a callback without an intentional launch cannot create a session', async () => {
  const app = setup();
  await assert.rejects(app.createService().completeGoogleOAuthReturn('lyfttrack://callback#access_token=a&refresh_token=r'), /oauth-unexpected-return/);
  assert.equal(app.restored, 0);
});

for (const restart of [false, true]) {
  test(`changing only an implicit refresh token cannot bypass the consumed access token${restart ? ' after a module restart' : ''}`, async () => {
    const app = setup();
    let service = app.createService();
    await service.beginGoogleOAuthReturn();
    await service.completeGoogleOAuthReturn('lyfttrack://callback#access_token=old-access&refresh_token=original-refresh');
    app.signOut();
    if (restart) service = app.createService();
    await service.beginGoogleOAuthReturn();
    await assert.rejects(
      service.completeGoogleOAuthReturn('lyfttrack://callback#access_token=old-access&refresh_token=altered-refresh'),
      /oauth-(missing-code|unexpected-return)/,
    );
    assert.equal(app.restored, 1);
  });
}

for (const credential of ['?code=fresh-code', '#access_token=fresh-access&refresh_token=fresh-refresh']) {
  test(`an intentional OAuth launch survives a module restart for ${credential.startsWith('?') ? 'PKCE' : 'implicit'} returns`, async () => {
    const app = setup();
    await app.createService().beginGoogleOAuthReturn();
    await app.createService().completeGoogleOAuthReturn(`lyfttrack://callback${credential}`);
    assert.equal(app.restored, 1);
  });
}

test('successful browser callbacks remove credentials from history while preserving unrelated parameters', async () => {
  const app = setup();
  const browser = { location: { href: 'https://app.test/callback?from=keep&access_token=a&refresh_token=r#provider_token=secret' }, history: { replaceState(_state, _title, url) { browser.location.href = url; } } };
  const service = app.createService(browser);
  await service.beginGoogleOAuthReturn();
  await service.completeGoogleOAuthReturn(browser.location.href);
  assert.equal(browser.location.href, 'https://app.test/callback?from=keep');
  assert.equal(app.restored, 1);
});

test('one intentional launch cannot authenticate two distinct concurrent returns', async () => {
  const app = setup();
  const service = app.createService();
  await service.beginGoogleOAuthReturn();
  await Promise.all([
    service.completeGoogleOAuthReturn('lyfttrack://callback#access_token=one&refresh_token=r1'),
    service.completeGoogleOAuthReturn('lyfttrack://callback#access_token=two&refresh_token=r2'),
  ]);
  assert.equal(app.restored, 1);
});
