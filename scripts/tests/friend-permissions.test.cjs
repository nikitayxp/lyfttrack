const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const root = path.resolve(__dirname, '../..');
const readMigration = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const C = '00000000-0000-0000-0000-000000000003';
const requestId = '00000000-0000-0000-0000-000000000101';

test('friendship authorization on PostgreSQL', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to authenticated, anon;
    create table public.profiles (id uuid primary key, visibility text);
    create table public.friend_requests (
      id uuid primary key default gen_random_uuid(),
      from_user_id uuid not null references profiles(id),
      to_user_id uuid not null references profiles(id),
      status text not null default 'pending',
      responded_at timestamptz,
      check (from_user_id <> to_user_id)
    );
    create table public.friends (
      id uuid primary key default gen_random_uuid(),
      user_low_id uuid not null references profiles(id),
      user_high_id uuid not null references profiles(id),
      created_by_request_id uuid references friend_requests(id),
      unique(user_low_id, user_high_id),
      check (user_low_id < user_high_id)
    );
    grant select, insert, update, delete on public.friend_requests, public.friends to authenticated;
    alter table public.friend_requests enable row level security;
    alter table public.friends enable row level security;
    insert into public.profiles values ('${A}', 'friends'), ('${B}', 'friends'), ('${C}', 'friends');
  `);
  const baseline = readMigration('20260409010000_rls_security_hardening.sql');
  for (const name of ['friend_requests_select_own', 'friend_requests_insert_own', 'friend_requests_update_recipient', 'friends_select_own_network', 'friends_insert_from_incoming_request']) {
    await db.exec(baseline.match(new RegExp(`create policy ${name}\\b[\\s\\S]*?;`))[0]);
  }
  await db.exec(baseline.match(/create or replace function public\.respond_to_friend_request[\s\S]*?\$\$;/)[0]);
  await db.exec('grant execute on function public.respond_to_friend_request(uuid, text) to authenticated;');
  const visibility = readMigration('20260727090000_public_profile_visibility.sql');
  await db.exec(visibility.match(/create or replace function public\.can_view_user_content[\s\S]*?\$\$;/)[0]);
  const fix = path.join(root, 'supabase/migrations/20261015230000_friend_request_integrity.sql');
  if (fs.existsSync(fix) && !process.env.TEST_BASELINE_POLICIES) await db.exec(fs.readFileSync(fix, 'utf8'));

  async function reset() {
    await db.exec('reset role; truncate public.friends, public.friend_requests;');
    await db.query('insert into public.friend_requests(id, from_user_id, to_user_id) values ($1, $2, $3)', [requestId, B, A]);
    await db.exec('set role authenticated;');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [A]);
  }

  await t.test('recipient cannot substitute a third person as sender', async () => {
    await reset();
    await assert.rejects(db.query('update public.friend_requests set from_user_id = $1 where id = $2', [C, requestId]), { code: '42501' });
    const { rows } = await db.query('select public.can_view_user_content($1) as visible', [C]);
    assert.equal(rows[0].visible, false);
  });

  await t.test('request identity cannot be replaced by its recipient', async () => {
    await reset();
    await assert.rejects(db.query('update public.friend_requests set id = gen_random_uuid() where id = $1', [requestId]), { code: '42501' });
  });

  await t.test('direct friendship writes cannot bypass the response function', async () => {
    await reset();
    await assert.rejects(db.query('insert into public.friends(user_low_id,user_high_id,created_by_request_id) values ($1,$2,$3)', [A, B, requestId]), { code: '42501' });
  });

  await t.test('acceptance atomically creates the correct friendship and grants access', async () => {
    await reset();
    const result = await db.query("select * from public.respond_to_friend_request($1,'accepted')", [requestId]);
    assert.equal(result.rows[0].status, 'accepted');
    const friends = await db.query('select * from public.friends');
    assert.equal(friends.rows.length, 1);
    assert.equal(friends.rows[0].user_low_id, A);
    assert.equal(friends.rows[0].user_high_id, B);
    assert.equal(friends.rows[0].created_by_request_id, requestId);
    const { rows } = await db.query('select public.can_view_user_content($1) as friend, public.can_view_user_content($2) as stranger', [B, C]);
    assert.equal(rows[0].friend, true);
    assert.equal(rows[0].stranger, false);
  });

  await t.test('a third party cannot accept another recipient request', async () => {
    await reset();
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [C]);
    await assert.rejects(db.query("select * from public.respond_to_friend_request($1,'accepted')", [requestId]));
    const result = await db.query('select count(*)::int as count from public.friends');
    assert.equal(result.rows[0].count, 0);
  });

  await t.test('accepted requests cannot be reopened and reused after removing a friendship', async () => {
    await reset();
    await db.query("select * from public.respond_to_friend_request($1,'accepted')", [requestId]);
    const result = await db.query("update public.friend_requests set status = 'pending' where id = $1 returning id", [requestId]);
    assert.equal(result.rows.length, 0);
    await db.exec('reset role; delete from public.friends; set role authenticated;');
    await assert.rejects(db.query("select * from public.respond_to_friend_request($1,'accepted')", [requestId]));
  });

  await t.test('rejecting a request creates no friendship', async () => {
    await reset();
    await db.query("select * from public.respond_to_friend_request($1,'rejected')", [requestId]);
    const result = await db.query('select count(*)::int as count from public.friends');
    assert.equal(result.rows[0].count, 0);
  });

  await t.test('anonymous clients cannot invoke the privileged response function', async () => {
    await reset();
    await db.exec('reset role; set role anon;');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await assert.rejects(db.query("select * from public.respond_to_friend_request($1,'accepted')", [requestId]), { code: '42501' });
  });
});
