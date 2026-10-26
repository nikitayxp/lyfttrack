const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('username availability works before sign-in without exposing private profile rows', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role unrelated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    create table public.profiles(id uuid primary key, username text unique, bio text);
    alter table public.profiles enable row level security;
    create policy profiles_select_own on public.profiles for select to authenticated using(id = auth.uid());
    grant select on public.profiles to authenticated;
    insert into public.profiles values
      ('00000000-0000-0000-0000-000000000001', 'taken_user', 'Private profile content');
    -- Captured deployed contract, which was absent from versioned migrations.
    create function public.check_username_available(target_username text)
    returns boolean language plpgsql security definer set search_path to 'public' as $$
    begin
      return not exists(select 1 from profiles where username = lower(trim(target_username)));
    end;
    $$;
  `);
  const migration = path.resolve(__dirname, '../../supabase/migrations/20261019142000_username_availability_contract.sql');
  await db.exec(fs.readFileSync(migration, 'utf8'));

  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    for (const [input, expected] of [
      ['available_user', true], ['taken_user', false], [' TAKEN_USER ', false],
      [' Available_User ', true], ['a.b_c', true], ['a'.repeat(100), true],
      [null, false], ['', false], ['   ', false], ['ab', false],
      ['a'.repeat(101), false], ['bad name', false], ["x' OR true --", false],
    ]) {
      const result = await db.query('select public.check_username_available($1) as available', [input]);
      assert.deepEqual(result.rows, [{ available: expected }], `${role}: ${JSON.stringify(input)}`);
    }
    if (role === 'anon') {
      await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
    } else {
      assert.deepEqual((await db.query('select * from public.profiles')).rows, []);
    }
    await db.exec('reset role');
  }

  // A caller-controlled temporary table must not change the definer lookup.
  await db.exec('create temporary table profiles(username text); set role anon');
  assert.equal((await db.query("select public.check_username_available('taken_user') as available")).rows[0].available, false);
  await db.exec('reset role; set role unrelated');
  await assert.rejects(db.query("select public.check_username_available('taken_user')"), /permission denied/);
  await db.exec('reset role');
  const contract = (await db.query(`
    select prosecdef, proconfig, prorettype::regtype::text as result_type
    from pg_proc where oid = 'public.check_username_available(text)'::regprocedure
  `)).rows[0];
  assert.deepEqual(contract, { prosecdef: true, proconfig: ['search_path=""'], result_type: 'boolean' });
});
