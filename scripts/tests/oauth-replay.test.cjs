const assert = require('node:assert/strict');
const { test } = require('node:test');
const loadSource = require('./load-source.cjs');

function setup() {
  let session = null, restored = 0, exchanges = 0;
  // Provider-side code consumption persists across client module reloads.
  const consumedCodes = new Set();
  const createService = browserWindow => loadSource({
    '@/services/supabase': { supabase: { auth: {
      setSession: async () => { throw new Error('Implicit credentials must never be installed'); },
      exchangeCodeForSession: async code => {
        exchanges++;
        if (consumedCodes.has(code)) return { data: { session: null }, error: { message: 'used-code' } };
        consumedCodes.add(code);
        restored++;
        session = { user: { id: 'old-account' } };
        return { data: { session }, error: null };
      },
      getSession: async () => ({ data: { session }, error: null }),
    } } },
  }, { window: browserWindow })('app/src/services/oauthReturn.ts');
  return { createService, get restored() { return restored; }, get exchanges() { return exchanges; }, signOut() { session = null; }, switchUser(id) { session = { user: { id } }; } };
}

for (const restart of [false, true]) {
  test(`a consumed PKCE return cannot restore a signed-out account${restart ? ' after a module restart' : ''}`, async () => {
    const app = setup();
    let service = app.createService();
    const url = 'lyfttrack://callback?code=owned-code';
    await service.completeGoogleOAuthReturn(url);
    app.signOut();
    if (restart) service = app.createService();
    await assert.rejects(service.completeGoogleOAuthReturn(url), /oauth-missing-code|used-code/);
    assert.equal(app.restored, 1);
  });
  test(`implicit credentials cannot restore an account${restart ? ' after a module restart' : ''}`, async () => {
    const app = setup();
    let service = app.createService();
    await assert.rejects(service.completeGoogleOAuthReturn('lyfttrack://callback#access_token=old-access&refresh_token=old-refresh'), /oauth-unexpected-credentials/);
    if (restart) service = app.createService();
    await assert.rejects(service.completeGoogleOAuthReturn('lyfttrack://callback#access_token=old-access&refresh_token=altered-refresh'), /oauth-unexpected-credentials/);
    assert.equal(app.restored, 0);
    assert.equal(app.exchanges, 0);
  });
}

test('a PKCE return can complete after loading a fresh module', async () => {
  const app = setup();
  app.createService();
  await app.createService().completeGoogleOAuthReturn('lyfttrack://callback?code=fresh-code');
  assert.equal(app.restored, 1);
});

for (const [credential, rejected] of [['?from=keep&code=fresh-code',false],['?from=keep&access_token=a&refresh_token=r#provider_token=secret',true]]) {
  test(`browser history is scrubbed for ${rejected ? 'rejected token' : 'successful PKCE'} returns`,async()=>{
    const app=setup();
    const browser={location:{href:'https://app.test/callback'+credential},history:{replaceState(_state,_title,url){browser.location.href=url;}}};
    const completion=app.createService(browser).completeGoogleOAuthReturn(browser.location.href);
    if(rejected)await assert.rejects(completion,/oauth-unexpected-credentials/);else await completion;
    assert.equal(browser.location.href,'https://app.test/callback?from=keep');
    assert.equal(app.restored,rejected?0:1);
  });
}

test('concurrent handlers exchange the same PKCE return only once',async()=>{
  const app=setup(),service=app.createService();
  await Promise.all([service.completeGoogleOAuthReturn('lyfttrack://callback?code=one'),service.completeGoogleOAuthReturn('lyfttrack://callback?code=one')]);
  assert.equal(app.restored,1);assert.equal(app.exchanges,1);
});

test('a completed return cannot replace a different current account',async()=>{
  const app=setup(),service=app.createService();
  await service.completeGoogleOAuthReturn('lyfttrack://callback?code=one');
  app.switchUser('new-account');
  await assert.rejects(service.completeGoogleOAuthReturn('lyfttrack://callback?code=one'),/auth-return-session-changed/);
  assert.equal(app.restored,1);
});
