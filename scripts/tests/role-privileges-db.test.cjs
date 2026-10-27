const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const root = path.resolve(__dirname, '../..');
const migrationName = '20261027094000_tighten_role_privileges.sql';
const readMigration = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
const appTables = [
  'body_measurements', 'exercises', 'profiles', 'routine_exercises', 'routines',
  'sets', 'template_exercises', 'workout_exercises', 'workout_templates', 'workouts',
];
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const requestId = '00000000-0000-0000-0000-000000000101';

function functionDefinition(file, name) {
  const source = readMigration(file);
  const start = source.indexOf('create or replace function public.' + name + '(');
  assert.notEqual(start, -1, name);
  const end = source.indexOf('$$;', start);
  assert.notEqual(end, -1, name);
  return source.slice(start, end + 3);
}

async function createDb({ remoteObjects = false } = {}) {
  const db = await PGlite.create();
  await db.exec(`
    create role anon; create role authenticated; create role unrelated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid
    $$;
    grant usage on schema public, auth to anon, authenticated, unrelated;
    create table auth.users(id uuid primary key);
    create table public.profiles(
      id uuid primary key references auth.users(id) on delete cascade, username text unique,
      full_name text, avatar_url text, bio text, height_cm numeric,
      visibility text not null default 'private', updated_at timestamptz default now()
    );
    create table public.exercises(id uuid primary key default gen_random_uuid(), created_by uuid references auth.users(id) on delete cascade, is_custom boolean not null default false);
    create table public.workouts(id uuid primary key default gen_random_uuid(), user_id uuid not null, name text);
    create table public.workout_exercises(id uuid primary key default gen_random_uuid(), workout_id uuid references public.workouts(id) on delete cascade, exercise_id uuid references public.exercises(id));
    create table public.sets(id uuid primary key default gen_random_uuid(), workout_id uuid references public.workouts(id) on delete cascade, exercise_id uuid references public.exercises(id));
    create table public.routines(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
    create table public.routine_exercises(id uuid primary key default gen_random_uuid(), routine_id uuid references public.routines(id) on delete cascade, exercise_id uuid references public.exercises(id) on delete cascade);
    create table public.workout_templates(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
    create table public.template_exercises(id uuid primary key default gen_random_uuid(), template_id uuid references public.workout_templates(id) on delete cascade, exercise_id uuid references public.exercises(id) on delete restrict);
    create table public.body_measurements(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
    create table public.workout_comments(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, workout_id uuid references public.workouts(id) on delete cascade, content text, created_at timestamptz default now());
    create table public.workout_likes(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, workout_id uuid references public.workouts(id) on delete cascade);
    create table public.friend_requests(id uuid primary key default gen_random_uuid(), from_user_id uuid not null references public.profiles(id) on delete cascade, to_user_id uuid not null references public.profiles(id) on delete cascade, status text not null default 'pending', responded_at timestamptz);
    create table public.friends(id uuid primary key default gen_random_uuid(), user_low_id uuid references public.profiles(id) on delete cascade, user_high_id uuid references public.profiles(id) on delete cascade, created_by_request_id uuid references public.friend_requests(id) on delete set null, unique(user_low_id, user_high_id));
    grant all on all tables in schema public to anon, authenticated;
    grant select(username) on public.profiles to anon;
    alter table public.workouts enable row level security;
    create policy workouts_own on public.workouts for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
    insert into auth.users values ('${owner}'), ('${other}');
    insert into public.profiles(id,username,bio,height_cm) values
      ('${owner}', 'owner', 'Owner bio', 180),
      ('${other}', 'other', 'Other bio', 170);
  `);
  for (const [file, names] of [
    ['20260421000000_hevy_parity_features.sql', ['wipe_my_workouts', 'wipe_my_custom_exercises']],
    ['20260409010000_rls_security_hardening.sql', ['touch_profiles_updated_at', 'respond_to_friend_request']],
    ['20260727090000_public_profile_visibility.sql', ['can_view_user_content']],
  ]) {
    for (const name of names) await db.exec(functionDefinition(file, name));
  }
  await db.exec(readMigration('20260727091000_delete_own_account.sql'));
  await db.exec(readMigration('20261015230000_friend_request_integrity.sql'));
  await db.exec(readMigration('20261019142000_username_availability_contract.sql'));
  await db.exec(`
    grant execute on all functions in schema public to anon, authenticated;
    create trigger profile_updated before update on public.profiles
      for each row execute function public.touch_profiles_updated_at();
  `);
  if (remoteObjects) {
    await db.exec(`
      create table public.projeto_ativo(id int primary key, name text);
      insert into public.projeto_ativo values (1, 'Keep this existing row');
      alter table public.projeto_ativo enable row level security;
      grant all on public.projeto_ativo to public, anon, authenticated;
      create function public.set_profiles_updated_at() returns trigger
        language plpgsql set search_path = public as $$
        begin new.updated_at = now(); return new; end;
      $$;
      create function public.check_comment_rate_limit() returns trigger
        language plpgsql set search_path = public as $$
        begin
          if (select count(*) from public.workout_comments
              where user_id = new.user_id and created_at > now() - interval '5 seconds') > 0 then
            raise exception 'Spam detected';
          end if;
          return new;
        end;
      $$;
      grant execute on function public.set_profiles_updated_at(), public.check_comment_rate_limit() to anon, authenticated;
      create trigger rate_limit before insert on public.workout_comments
        for each row execute function public.check_comment_rate_limit();
      create trigger remote_profile_updated before update on public.profiles
        for each row execute function public.set_profiles_updated_at();
    `);
  }
  return db;
}

async function asRole(db, role, work, userId = owner) {
  await db.exec('set role ' + role);
  await db.query("select set_config('test.user_id', $1, false)", [userId]);
  try {
    return await work();
  } finally {
    await db.exec('reset role');
  }
}

async function apply(db) {
  if (!process.env.TEST_BASELINE_ROLE_PRIVILEGES) await db.exec(readMigration(migrationName));
}

async function seedAccountData(db) {
  for (const userId of [owner, other]) {
    await db.query('insert into public.exercises(id,created_by,is_custom) values ($1,$1,true)', [userId]);
    await db.query("insert into public.workouts(id,user_id,name) values ($1,$1,'Original workout')", [userId]);
    await db.query('insert into public.workout_exercises(workout_id,exercise_id) values ($1,$1)', [userId]);
    await db.query('insert into public.sets(workout_id,exercise_id) values ($1,$1)', [userId]);
    await db.query('insert into public.routines(id,user_id) values ($1,$1)', [userId]);
    await db.query('insert into public.routine_exercises(routine_id,exercise_id) values ($1,$1)', [userId]);
    await db.query('insert into public.workout_templates(id,user_id) values ($1,$1)', [userId]);
    await db.query('insert into public.template_exercises(template_id,exercise_id) values ($1,$1)', [userId]);
    await db.query('insert into public.body_measurements(user_id) values ($1)', [userId]);
    await db.query('insert into public.workout_comments(user_id,workout_id,created_at) values ($1,$1,now()-interval \'1 day\')', [userId]);
    await db.query('insert into public.workout_likes(user_id,workout_id) values ($1,$1)', [userId]);
  }
}

test('role hardening applies twice without remote-only tables or functions', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await apply(db);
  await apply(db);
  assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n, 2);
  assert.equal((await db.query("select to_regclass('public.projeto_ativo') missing")).rows[0].missing, null);
});

test('anonymous table access and inherited PUBLIC grants are removed', async t => {
  const db = await createDb({ remoteObjects: true });
  t.after(() => db.close());
  await db.exec('grant all on public.workouts to public; grant select(username) on public.profiles to public');
  await apply(db);
  for (const table of appTables) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES']) {
      assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed', ['anon', 'public.' + table, privilege])).rows[0].allowed, false, table + ': ' + privilege);
    }
    assert.equal((await db.query('select has_any_column_privilege($1,$2,$3) allowed', ['anon', 'public.' + table, 'SELECT,INSERT,UPDATE,REFERENCES'])).rows[0].allowed, false, table + ': column grants');
  }
  await asRole(db, 'anon', async () => {
    await assert.rejects(db.query('select username from public.profiles'), /permission denied/);
    await assert.rejects(db.exec('truncate public.workouts cascade'), /permission denied/);
  }, '');
});

test('authenticated CRUD remains available without table administration privileges', async t => {
  const db = await createDb({ remoteObjects: true });
  t.after(() => db.close());
  await apply(db);
  const version = Number((await db.query("select current_setting('server_version_num') version")).rows[0].version);
  for (const table of appTables) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed', ['authenticated', 'public.' + table, privilege])).rows[0].allowed, true, table + ': ' + privilege);
    }
    for (const privilege of ['TRUNCATE', 'TRIGGER', 'REFERENCES', ...(version >= 170000 ? ['MAINTAIN'] : [])]) {
      assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed', ['authenticated', 'public.' + table, privilege])).rows[0].allowed, false, table + ': ' + privilege);
    }
  }
  await asRole(db, 'authenticated', async () => {
    const created = await db.query("insert into public.workouts(user_id,name) values ($1,'New workout') returning id", [owner]);
    const id = created.rows[0].id;
    assert.equal((await db.query("update public.workouts set name='Updated' where id=$1 returning name", [id])).rows[0].name, 'Updated');
    assert.equal((await db.query('select count(*)::int n from public.workouts where id=$1', [id])).rows[0].n, 1);
    await db.query('delete from public.workouts where id=$1', [id]);
    await assert.rejects(db.exec('truncate public.workouts cascade'), /permission denied/);
  });
});

test('definer helpers require authentication and use an empty search path', async t => {
  const db = await createDb({ remoteObjects: true });
  t.after(() => db.close());
  await apply(db);
  const functions = await db.query(`
    select p.proname,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anonymous,
      has_function_privilege('unrelated',p.oid,'EXECUTE') inherited,
      has_function_privilege('authenticated',p.oid,'EXECUTE') signed_in
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef order by p.proname
  `);
  assert.equal(functions.rows.length, 6);
  for (const row of functions.rows) {
    assert.deepEqual(row.proconfig, ['search_path=""'], row.proname);
    assert.equal(row.anonymous, row.proname === 'check_username_available', row.proname);
    assert.equal(row.inherited, false, row.proname);
    assert.equal(row.signed_in, true, row.proname);
  }
  await asRole(db, 'anon', async () => {
    assert.equal((await db.query("select public.check_username_available('available_user') available")).rows[0].available, true);
    assert.equal((await db.query("select public.check_username_available('owner') available")).rows[0].available, false);
    for (const sql of ['select public.wipe_my_workouts()', 'select public.wipe_my_custom_exercises()', 'select public.delete_own_account()', "select public.can_view_user_content('" + other + "')"]) {
      await assert.rejects(db.query(sql), /permission denied/, sql);
    }
  }, '');
});

test('cleanup helpers remove only the signed-in account data', async t => {
  const db = await createDb({ remoteObjects: true });
  t.after(() => db.close());
  await seedAccountData(db);
  await apply(db);
  await asRole(db, 'authenticated', async () => {
    assert.equal((await db.query('select public.wipe_my_workouts() deleted')).rows[0].deleted, 1);
  });
  assert.deepEqual((await db.query('select user_id from public.workouts')).rows, [{ user_id: other }]);
  await db.query('delete from public.routine_exercises where routine_id=$1', [owner]);
  await db.query('delete from public.template_exercises where template_id=$1', [owner]);
  await asRole(db, 'authenticated', async () => {
    assert.equal((await db.query('select public.wipe_my_custom_exercises() deleted')).rows[0].deleted, 1);
  });
  assert.deepEqual((await db.query('select created_by from public.exercises')).rows, [{ created_by: other }]);
});

test('account deletion still clears related data and preserves the other account', async t => {
  const db = await createDb({ remoteObjects: true });
  t.after(() => db.close());
  await seedAccountData(db);
  await db.query('insert into public.friend_requests(id,from_user_id,to_user_id) values ($1,$2,$3)', [requestId, other, owner]);
  await db.query('insert into public.friends(user_low_id,user_high_id,created_by_request_id) values ($1,$2,$3)', [owner, other, requestId]);
  await apply(db);
  await asRole(db, 'authenticated', () => db.query('select public.delete_own_account()'));
  assert.deepEqual((await db.query('select id from auth.users')).rows, [{ id: other }]);
  assert.deepEqual((await db.query('select id from public.profiles')).rows, [{ id: other }]);
  assert.deepEqual((await db.query('select id from public.workouts')).rows, [{ id: other }]);
  assert.deepEqual((await db.query('select created_by from public.exercises')).rows, [{ created_by: other }]);
  for (const table of ['routines', 'workout_templates', 'body_measurements', 'workout_comments', 'workout_likes']) {
    assert.deepEqual((await db.query('select user_id from public.' + table)).rows, [{ user_id: other }], table);
  }
  for (const table of ['friend_requests', 'friends']) {
    assert.equal((await db.query('select count(*)::int n from public.' + table)).rows[0].n, 0, table);
  }
});

test('friendship RPC and trigger execution survive anonymous function revocation', async t => {
  const db = await createDb({ remoteObjects: true });
  t.after(() => db.close());
  await db.query("update public.profiles set visibility='friends' where id=$1", [other]);
  await db.query('insert into public.friend_requests(id,from_user_id,to_user_id) values ($1,$2,$3)', [requestId, other, owner]);
  await apply(db);
  await asRole(db, 'authenticated', async () => {
    assert.equal((await db.query('select public.can_view_user_content($1) visible', [other])).rows[0].visible, false);
    assert.equal((await db.query("select status from public.respond_to_friend_request($1,'accepted')", [requestId])).rows[0].status, 'accepted');
    assert.equal((await db.query('select public.can_view_user_content($1) visible', [other])).rows[0].visible, true);
    await db.query("update public.profiles set full_name='New name' where id=$1", [owner]);
    await db.query("insert into public.workout_comments(user_id,content) values ($1,'Hello')", [owner]);
    await assert.rejects(db.query("insert into public.workout_comments(user_id,content) values ($1,'Too soon')", [owner]), /Spam detected/);
  });
  const triggers = await db.query(`
    select p.proname, has_function_privilege('anon',p.oid,'EXECUTE') allowed
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype='trigger'::regtype
  `);
  assert.ok(triggers.rows.length >= 4);
  assert.ok(triggers.rows.every(row => row.allowed === false));
});

test('profile column restrictions stay intact after table privilege hardening', async t => {
  const db = await createDb({ remoteObjects: true });
  t.after(() => db.close());
  await db.exec(`
    revoke select on public.profiles from authenticated;
    grant select(id,username,full_name,avatar_url,visibility,updated_at) on public.profiles to authenticated;
  `);
  await apply(db);
  await asRole(db, 'authenticated', async () => {
    assert.equal((await db.query('select username from public.profiles where id=$1', [owner])).rows[0].username, 'owner');
    await assert.rejects(db.query('select bio,height_cm from public.profiles where id=$1', [other]), /permission denied/);
    await db.query("update public.profiles set full_name='Still editable' where id=$1", [owner]);
  });
});

test('the unversioned project table is quarantined without deleting its row', async t => {
  const db = await createDb({ remoteObjects: true });
  t.after(() => db.close());
  await apply(db);
  await apply(db);
  assert.deepEqual((await db.query('select * from public.projeto_ativo')).rows, [{ id: 1, name: 'Keep this existing row' }]);
  for (const role of ['anon', 'authenticated', 'unrelated']) {
    assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed', [role, 'public.projeto_ativo', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'])).rows[0].allowed, false, role);
    await asRole(db, role, () => assert.rejects(db.query('select * from public.projeto_ativo'), /permission denied/));
  }
});
