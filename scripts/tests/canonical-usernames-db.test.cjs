const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261115233000_canonical_profile_usernames.sql'), 'utf8');
const previous = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261019142000_username_availability_contract.sql'), 'utf8');
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';

async function fixture(t, apply = true) {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec([
    'create role anon; create role authenticated; create role service_role; create role unrelated;',
    'create schema auth;',
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;",
    'grant usage on schema auth to authenticated;',
    'create table public.profiles(id uuid primary key, username text unique, bio text);',
    'alter table public.profiles enable row level security;',
    'create policy own_read on public.profiles for select to authenticated using (id=auth.uid());',
    'create policy own_insert on public.profiles for insert to authenticated with check (id=auth.uid());',
    'create policy own_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());',
    'grant select(id,username), insert(id,username), update(username) on public.profiles to authenticated;',
  ].join('\n'));
  await db.query('insert into public.profiles values ($1,$2,$3)', [owner, 'existing._1', 'Private bio']);
  await db.exec(previous);
  if (apply) await db.exec(migration);
  return db;
}

test('profile persistence uses one canonical username and preserves allowed punctuation', async t => {
  const db = await fixture(t);
  const before = (await db.query('select * from public.profiles')).rows;
  await db.query('insert into public.profiles(id,username) values ($1,$2)', [other, ' \tMiXeD.User_1\n ']);
  assert.equal((await db.query('select username from public.profiles where id=$1', [other])).rows[0].username, 'mixed.user_1');
  await db.query('update public.profiles set username=$1 where id=$2', ['._Keep__01.', other]);
  assert.equal((await db.query('select username from public.profiles where id=$1', [other])).rows[0].username, '._keep__01.');
  assert.deepEqual((await db.query('select * from public.profiles where id=$1', [owner])).rows, before);
});

test('profile constraints reject invalid usernames on insert and update', async t => {
  const db = await fixture(t);
  for (const value of [null, '', 'ab', 'a'.repeat(25), 'bad name', 'josé', 'bad/name', '\u00a0abc\u00a0']) {
    await assert.rejects(db.query('insert into public.profiles(id,username) values ($1,$2)', [other, value]),
      error => ['23502', '23514'].includes(error.code), JSON.stringify(value));
    await assert.rejects(db.query('update public.profiles set username=$1 where id=$2', [value, owner]),
      error => ['23502', '23514'].includes(error.code), JSON.stringify(value));
  }
  assert.equal((await db.query('select count(*)::int as count from public.profiles')).rows[0].count, 1);
});

test('canonical uniqueness applies to legitimate insert and update requests', async t => {
  const db = await fixture(t);
  await assert.rejects(db.query('insert into public.profiles(id,username) values ($1,$2)', [other, ' EXISTING._1 ']),
    error => error.code === '23505');
  await db.query('insert into public.profiles(id,username) values ($1,$2)', [other, 'another_01']);
  await assert.rejects(db.query('update public.profiles set username=$1 where id=$2', ['\tExisting._1\n', other]),
    error => error.code === '23505');
});

test('availability shares the format without exposing private rows or trigger execution', async t => {
  const db = await fixture(t);
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    for (const [value, available] of [
      ['new._1', true], [' \tNEW._1\n ', true], ['existing._1', false], [' EXISTING._1 ', false],
      ['._allowed__1.', true], ['a'.repeat(24), true], ['a'.repeat(25), false],
      [null, false], ['ab', false], ['bad name', false], ['josé', false], ['\u00a0abc\u00a0', false],
    ]) {
      assert.deepEqual((await db.query('select public.check_username_available($1) as available', [value])).rows,
        [{ available }], role + ': ' + JSON.stringify(value));
    }
    if (role === 'anon') await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
    else assert.deepEqual((await db.query('select id,username from public.profiles')).rows, []);
    await db.exec('reset role');
  }
  await db.query("select set_config('test.user_id',$1,false)", [owner]);
  await db.exec('set role authenticated');
  await db.query('update public.profiles set username=$1 where id=$2', [' My._Name ', owner]);
  assert.deepEqual((await db.query('select username from public.profiles')).rows, [{ username: 'my._name' }]);
  await assert.rejects(db.query('select bio from public.profiles'), /permission denied/);
  await db.exec('reset role');
  const rpc = (await db.query("select prosecdef,proconfig from pg_proc where oid='public.check_username_available(text)'::regprocedure")).rows[0];
  assert.equal(rpc.prosecdef, true);
  assert.deepEqual(rpc.proconfig, ['search_path=""']);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await db.query("select has_function_privilege($1,'private.canonicalize_profile_username()','execute') as allowed", [role])).rows[0].allowed, false);
  }
  await db.exec('set role unrelated');
  await assert.rejects(db.query("select public.check_username_available('new_name')"), /permission denied/);
});

test('migration stops for legacy data that needs a separate decision', async t => {
  const db = await fixture(t, false);
  await db.query('insert into public.profiles(id,username) values ($1,$2)', [other, 'NeedsReview']);
  await assert.rejects(db.exec(migration), /existing usernames need review/i);
  await db.exec('rollback');
  assert.equal((await db.query('select username from public.profiles where id=$1', [other])).rows[0].username, 'NeedsReview');
});
