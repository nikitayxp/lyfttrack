const assert = require('node:assert/strict');
const { test } = require('node:test');
const sdk = require('@supabase/supabase-js');
const loadSource = require('./load-source.cjs');

const base = 'https://read-deadline.example.test';
const deadlineMs = 15_000;

function abortable(signal) {
  return new Promise((_, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function setup(t, respond) {
  const pendingTimers = new Map();
  const requests = [];
  let timerId = 0;
  const fetch = (input, init) => {
    const request = { url: new URL(input), method: init?.method ?? 'GET', signal: init?.signal };
    requests.push(request);
    return respond(request, requests.length);
  };
  const load = loadSource({
    '@supabase/supabase-js': { ...sdk, createClient: (url, key, options) => sdk.createClient(url, key, {
      ...options,
      auth: { ...options.auth, autoRefreshToken: false },
      global: { fetch: options.global?.fetch ?? fetch },
    }) },
    '@react-native-async-storage/async-storage': {},
    'expo-linking': {},
    'react-native': { Platform: { OS: 'web' } },
    '@/utils/authCrypto': {},
  }, {
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: base, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-key' } },
    AbortController,
    fetch,
    setTimeout(callback, delay) {
      assert.equal(delay, deadlineMs);
      pendingTimers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) { pendingTimers.delete(id); },
  });
  const { supabase } = load('app/src/services/supabase.ts');
  const { createDataCache } = load('app/src/services/dataCache.ts');
  await supabase.auth.getSession();
  t.after(() => supabase.auth.stopAutoRefresh());
  return {
    client: supabase, requests, pendingTimers, createDataCache,
    async waitForRequests(count) {
      for (let attempt = 0; requests.length < count && attempt < 8; attempt++) {
        await new Promise(resolve => setImmediate(resolve));
      }
      assert.equal(requests.length, count);
    },
    expire() {
      assert.equal(pendingTimers.size, 1, 'read must have one deadline');
      const [id, timeout] = pendingTimers.entries().next().value;
      pendingTimers.delete(id);
      timeout();
    },
  };
}

test('a stalled read is aborted and the account-scoped cache can retry it', async t => {
  const api = await setup(t, (request, number) => number === 1
    ? abortable(request.signal)
    : Promise.resolve(new Response('[{"id":"retry"}]', { headers: { 'content-range': '0-0/1' } })));
  const cache = api.createDataCache(1000);
  async function read() {
    const { data, count, error } = await api.client.from('exercises').select('id', { count: 'exact' });
    if (error) throw new Error(error.message);
    return { data, count };
  }
  const first = cache.get('account', 'catalog', read);
  assert.equal(cache.get('account', 'catalog', read), first);
  const rejected = assert.rejects(first, /read timed out/i);
  await api.waitForRequests(1);
  api.expire();
  await rejected;
  assert.equal(api.requests[0].signal.aborted, true);
  assert.deepEqual(await cache.get('account', 'catalog', read), { data: [{ id: 'retry' }], count: 1 });
  assert.equal(api.requests.length, 2);
  assert.equal(api.pendingTimers.size, 0);
});

test('the deadline also covers a read-only POST whose body stalls after headers', async t => {
  let bodyStarted = false;
  const api = await setup(t, async request => {
    const response = new Response(null, { status: 200 });
    response.text = () => { bodyStarted = true; return abortable(request.signal); };
    return response;
  });
  const result = api.client.rpc('recent_candidate_activity', { p_user_ids: ['candidate'] }).then(value => value);
  await api.waitForRequests(1);
  assert.equal(api.requests[0].method, 'POST');
  assert.equal(bodyStarted, true);
  api.expire();
  const { error } = await result;
  assert.match(error.message, /read timed out/i);
  assert.equal(api.requests.length, 1);
});

test('read deadlines keep a caller cancellation distinct and clear on successful HEAD', async t => {
  const api = await setup(t, request => request.method === 'HEAD'
    ? Promise.resolve(new Response(null, { headers: { 'content-range': '0-0/1' } }))
    : abortable(request.signal));
  const manual = new AbortController();
  const reading = api.client.from('profiles').select('id').abortSignal(manual.signal).then(value => value);
  await api.waitForRequests(1);
  assert.equal(api.pendingTimers.size, 1);
  manual.abort();
  const { error } = await reading;
  assert.match(error.message, /AbortError/);
  assert.doesNotMatch(error.message, /read timed out/i);
  assert.equal(api.pendingTimers.size, 0);
  const head = await api.client.from('profiles').select('id', { head: true, count: 'exact' });
  assert.equal(head.count, 1);
  assert.equal(api.pendingTimers.size, 0);
});

test('writes, authentication, and storage keep their existing transport', async t => {
  const api = await setup(t, async () => new Response('{}'));
  const manual = new AbortController();
  await api.client.from('profiles').update({ username: 'name' }).eq('id', 'account').abortSignal(manual.signal);
  await api.client.rpc('create_workout_atomic', {});
  await api.client.auth.signInWithPassword({ email: 'fixture@example.test', password: 'fixture-password' });
  await api.client.storage.from('avatars').list('account');
  assert.equal(api.requests.length, 4);
  assert.equal(api.requests[0].signal, manual.signal);
  assert.deepEqual(api.requests.slice(1).map(row => row.signal), [undefined, undefined, undefined]);
  assert.equal(api.pendingTimers.size, 0);
});
