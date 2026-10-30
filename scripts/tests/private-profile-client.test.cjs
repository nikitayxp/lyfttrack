const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createClient } = require('@supabase/supabase-js');
const createSourceLoader = require('./load-source.cjs');

const ownId = '00000000-0000-0000-0000-000000000001';
const hiddenId = '00000000-0000-0000-0000-000000000002';

function setup({ bootstrap = false, failCards = false, bootstrapRace = false, usernameCollision = false } = {}) {
  const requests = [];
  let ownExists = !bootstrap;
  let insertAttempts = 0;
  const own = { id: ownId, username: 'owner', full_name: 'Own name', bio: 'Own bio', height_cm: 180, avatar_url: null, visibility: 'private', updated_at: '2026-01-01' };
  const hidden = { id: hiddenId, username: 'hidden', full_name: null, avatar_url: 'https://example.test/avatar.jpg', visibility: 'private', updated_at: '2026-01-01' };
  const user = { id: ownId, email: 'owner@example.test', user_metadata: { username: 'owner', full_name: 'Own name', display_name: 'Own name', bio: 'Own bio' } };
  const fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const table = url.pathname.split('/').pop();
    const columns = url.searchParams.get('select') ?? '*';
    const method = options.method ?? 'GET';
    requests.push({ table, columns, method, url });
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.startsWith('/storage/v1/object/avatars/')) {
      return reply({ Key: url.pathname.split('/object/')[1] });
    }
    if ((table === 'profiles' && /full_name|bio|height_cm|\*/.test(columns)) || /profiles\([^)]*full_name/.test(columns)) {
      return reply({ code: '42501', message: 'permission denied for protected profile columns' }, 403);
    }
    if (table === 'profile_cards' && failCards) return reply({ code: 'XX000', message: 'cards unavailable' }, 500);
    if (table === 'profiles' && method === 'POST') {
      if (new Headers(options.headers).get('Prefer')?.includes('resolution=merge-duplicates')) return reply({ code: '42501', message: 'ON CONFLICT UPDATE needs protected column SELECT' }, 403);
      insertAttempts++;
      if (insertAttempts === 1 && (bootstrapRace || usernameCollision)) {
        if (bootstrapRace) ownExists = true;
        return reply({ code: '23505', message: 'duplicate key' }, 409);
      }
    }
    if (table === 'profiles' && method !== 'GET') { Object.assign(own, JSON.parse(options.body)); ownExists = true; }
    let rows = table === 'profiles' ? (ownExists ? [own] : [])
      : table === 'profile_cards' ? [own, hidden]
      : table === 'profile_private_details' ? [{ id: ownId, full_name: own.full_name, bio: own.bio, height_cm: own.height_cm }]
      : table === 'workout_comments' ? [{ id: 'comment', workout_id: 'workout', user_id: hiddenId, content: 'Hello', created_at: '2026-01-01' }]
      : table === 'workouts' ? [{ id: 'workout', user_id: ownId, name: 'Training', start_time: '2026-01-01', end_time: '2026-01-01' }]
      : table === 'friend_requests' ? [{ id: 'request', from_user_id: hiddenId, to_user_id: ownId, status: 'pending', created_at: '2026-01-01' }]
      : [];
    for (const [column, filter] of url.searchParams) {
      if (filter.startsWith('eq.')) rows = rows.filter(row => String(row[column]) === filter.slice(3));
      if (filter.startsWith('neq.')) rows = rows.filter(row => String(row[column]) !== filter.slice(4));
      if (filter.startsWith('in.')) rows = rows.filter(row => filter.slice(4, -1).split(',').includes(row[column]));
    }
    rows = rows.map(row => columns.startsWith('*') ? row : Object.fromEntries(columns.split(',').map(column => [column.trim(), row[column.trim()]])));
    const headers = new Headers(options.headers);
    return reply(headers.get('Accept')?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
  };
  const supabase = createClient('https://fixture.supabase.co', 'public-test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } });
  supabase.auth.updateUser = async () => ({ data: { user }, error: null });
  const load = createSourceLoader({
    '@/services/supabase': { supabase },
    '@/services/workoutService': { getAuthenticatedUserOrThrow: async () => user },
    '@/services/authUserService': { getAuthenticatedUserOrThrow: async () => user },
    'expo-image-picker': {},
  });
  return { load, requests, own, hidden };
}

test('own profile load and edits request only public columns from the table', async () => {
  const { load } = setup();
  const service = load('app/src/services/profileService.ts');
  const profile = await service.getProfile();
  assert.equal(profile.full_name, 'Own name');
  assert.equal(profile.height_cm, 180);
  const saved = await service.updateProfile({ fullName: 'Updated name', heightCm: 182, bio: 'Updated bio' });
  assert.equal(saved.full_name, 'Updated name');
  assert.equal(saved.bio, 'Updated bio');
  assert.equal(saved.height_cm, 182);
});

test('avatar upload returns own details without selecting revoked table columns', async () => {
  const { load, requests } = setup();
  const profile = await load('app/src/services/profileService.ts').uploadAvatar({
    fileUri: 'file:///avatar.jpg',
    base64Data: Buffer.from([255, 216, 255, 1, 1, 1, 1, 1]).toString('base64'),
  });
  assert.equal(profile.id, ownId);
  assert.equal(profile.full_name, 'Own name');
  assert.equal(profile.bio, 'Own bio');
  assert.equal(profile.height_cm, 180);
  assert.match(profile.avatar_url, /\/avatars\/00000000-0000-0000-0000-000000000001\//);
  const writes = requests.filter(request => request.table === 'profiles' && request.method === 'PATCH');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url.searchParams.get('id'), `eq.${ownId}`);
  assert.ok(requests.some(request => request.table === 'profile_private_details'));
});

test('onboarding profile bootstrap does not request revoked columns in RETURNING', async () => {
  const { load } = setup({ bootstrap: true });
  const profile = await load('app/src/services/profileService.ts').getProfile();
  assert.equal(profile.full_name, 'Own name');
  assert.equal(profile.id, ownId);
});

test('concurrent profile creation reads the existing own profile without an upsert', async () => {
  const { load, requests } = setup({ bootstrap: true, bootstrapRace: true });
  const profile = await load('app/src/services/profileService.ts').getProfile();
  assert.equal(profile.full_name, 'Own name');
  assert.equal(requests.filter(request => request.table === 'profiles' && request.method === 'POST').length, 1);
});

test('a username collision still retries a plain insert when no own profile exists', async () => {
  const { load } = setup({ bootstrap: true, usernameCollision: true });
  const profile = await load('app/src/services/profileService.ts').getProfile();
  assert.match(profile.username, /^owner_\d+$/);
});

test('a private public-profile card keeps username and avatar with no protected fields', async () => {
  const { load, hidden } = setup();
  const profile = await load('app/src/services/profileService.ts').getPublicProfileById(hiddenId);
  assert.equal(profile.full_name, null);
  assert.equal(profile.bio, null);
  assert.equal(profile.username, hidden.username);
  assert.equal(profile.avatar_url, hidden.avatar_url);
});

for (const [method, args] of [['searchUsers', ['hidden']], ['getActiveUsers', ['hidden']], ['getAllAthletes', []]]) {
  test(`${method} reads the masked card endpoint rather than protected table columns`, async () => {
    const { load, requests } = setup();
    const rows = await load('app/src/services/socialService.ts')[method](...args);
    assert.equal(rows[0].username, 'hidden');
    assert.equal(rows[0].full_name, null);
    assert.ok(requests.some(request => request.table === 'profile_cards'));
  });
}

test('pending friend requests can still show a private author username and avatar', async () => {
  const { load } = setup();
  const rows = await load('app/src/services/socialService.ts').getPendingRequests();
  assert.equal(rows[0].fromProfile.username, 'hidden');
  assert.equal(rows[0].fromProfile.full_name, null);
});

test('comments batch safe author cards without embedding protected table fields', async () => {
  const { load, requests } = setup();
  const service = load('app/src/services/interactionService.ts');
  assert.equal((await service.getCurrentCommentAuthorProfile()).full_name, 'Own name');
  const rows = await service.getWorkoutComments('workout');
  assert.equal(rows[0].profile.username, 'hidden');
  assert.equal(rows[0].profile.full_name, null);
  assert.equal(requests.filter(request => request.table === 'profile_cards' && request.url.searchParams.has('id')).length, 2);
});

test('a card endpoint error is surfaced instead of falling back to the unprotected table', async () => {
  const { load, requests } = setup({ failCards: true });
  await assert.rejects(load('app/src/services/profileService.ts').getPublicProfileById(hiddenId), /cards unavailable/);
  assert.equal(requests.some(request => request.table === 'profiles'), false);
});

test('workout feed profiles use the card view after sensitive table reads are revoked', async () => {
  const { load, requests } = setup();
  const rows = await load('app/src/services/workoutService.ts').getFeedWorkouts();
  assert.equal(rows[0].profile.username, 'owner');
  assert.equal(rows[0].profile.full_name, 'Own name');
  assert.ok(requests.some(request => request.table === 'profile_cards'));
});
