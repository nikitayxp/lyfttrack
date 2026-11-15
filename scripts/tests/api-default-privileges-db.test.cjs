const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const migration = path.join(__dirname, '../../supabase/migrations/20261115225000_explicit_api_defaults.sql');

async function createDb(t) {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    create table public.profiles(id integer primary key, username text, updated_at timestamptz default '2000-01-01Z');
    insert into public.profiles(id,username) values (1,'existing');
    create table public.projeto_ativo(id serial primary key);
    insert into public.projeto_ativo default values;
    revoke all on public.projeto_ativo from public, anon, authenticated;
    create function public.check_username_available(p_username text) returns boolean language sql stable as $$
      select not exists(select 1 from public.profiles where username=p_username)
    $$;
    grant execute on function public.check_username_available(text) to anon, authenticated;
    create function public.set_profiles_updated_at() returns trigger language plpgsql set search_path=public as $$
      begin new.updated_at=now(); return new; end;
    $$;
    create trigger profile_updated before update on public.profiles for each row execute function public.set_profiles_updated_at();
  `);
  return db;
}

test('new API tables, sequences and functions require explicit grants', async t => {
  const db = await createDb(t);
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await db.exec(`
    create table public.future_data(id serial primary key, name text);
    create function public.future_value() returns integer language sql as $$ select 1 $$;
  `);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const actual = (await db.query(`select
      has_table_privilege($1,'public.future_data','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as relation,
      has_sequence_privilege($1,'public.future_data_id_seq','USAGE,SELECT,UPDATE') as sequence,
      has_function_privilege($1,'public.future_value()','EXECUTE') as function`, [role])).rows[0];
    assert.deepEqual(actual, { relation: false, sequence: false, function: false });
  }
  await db.exec('grant select on public.future_data to authenticated; grant execute on function public.future_value() to service_role');
  assert.equal((await db.query("select has_table_privilege('authenticated','public.future_data','SELECT') as allowed")).rows[0].allowed, true);
  assert.equal((await db.query("select has_function_privilege('service_role','public.future_value()','EXECUTE') as allowed")).rows[0].allowed, true);
});

test('existing table access and username lookup survive while internal privileges are narrowed', async t => {
  const db = await createDb(t);
  const before = (await db.query("select relacl::text as acl from pg_class where oid='public.profiles'::regclass")).rows;
  await db.exec(fs.readFileSync(migration, 'utf8'));
  assert.deepEqual((await db.query("select relacl::text as acl from pg_class where oid='public.profiles'::regclass")).rows, before);
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query("select has_sequence_privilege($1,'public.projeto_ativo_id_seq','USAGE,SELECT,UPDATE') as allowed", [role])).rows[0].allowed, false);
    await db.exec('set role ' + role);
    const available = await db.query("select public.check_username_available('new_handle') as available");
    assert.equal(available.rows[0].available, true);
    await db.exec('reset role');
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await db.query("select has_function_privilege($1,'public.set_profiles_updated_at()','EXECUTE') as allowed", [role])).rows[0].allowed, false);
  }
  const config = (await db.query("select proconfig from pg_proc where oid='public.set_profiles_updated_at()'::regprocedure")).rows[0].proconfig;
  assert.deepEqual(config, ['search_path=""']);
  await db.exec("set role authenticated; update public.profiles set username='edited' where id=1; reset role");
  assert.equal((await db.query("select updated_at > '2020-01-01Z'::timestamptz as touched from public.profiles where id=1")).rows[0].touched, true);
  assert.equal((await db.query("select has_sequence_privilege('service_role','public.projeto_ativo_id_seq','USAGE') as allowed")).rows[0].allowed, true);
});
