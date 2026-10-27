const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const own = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const ownership = path.resolve(__dirname, '../../supabase/migrations/20261019140000_avatar_storage_ownership.sql');
const migration = path.resolve(__dirname, '../../supabase/migrations/20261027093000_avatar_bucket_limits.sql');

async function createDb() {
  const db = await PGlite.create();
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id',true),'')::uuid
    $$;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select string_to_array(substring(name from '^(.*)/[^/]*$'), '/')
    $$;
    create table storage.buckets(id text primary key, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id integer generated always as identity primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    create policy "Avatar Select" on storage.objects for select to public using(bucket_id='avatars');
    grant usage on schema auth,storage to authenticated,anon;
    grant execute on function auth.uid(),storage.foldername(text) to authenticated;
    grant select on storage.objects to anon;
    grant select,insert,update,delete on storage.objects to authenticated;
    insert into storage.buckets values ('avatars', true, null, null);
    insert into storage.objects(bucket_id,name) values('avatars','${own}/me.jpg'),('avatars','${other}/them.jpg');
  `);
  await db.exec(fs.readFileSync(ownership, 'utf8'));
  return db;
}

async function names(db, role, userId) {
  await db.exec(`set role ${role}; set test.user_id='${userId ?? ''}'`);
  try {
    return (await db.query('select name from storage.objects order by name')).rows.map(row => row.name);
  } finally {
    await db.exec('reset role');
  }
}

test('before the migration anyone can list every avatar folder', async t => {
  const db = await createDb();
  t.after(() => db.close());
  assert.deepEqual(await names(db, 'anon'), [`${own}/me.jpg`, `${other}/them.jpg`]);
});

test('avatar listing is limited to the own folder and the bucket only takes small images', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await assert.doesNotReject(db.exec(fs.readFileSync(migration, 'utf8')), 'the migration must be safe to apply again');

  assert.deepEqual(await names(db, 'anon'), []);
  assert.deepEqual(await names(db, 'authenticated', own), [`${own}/me.jpg`]);
  assert.deepEqual(await names(db, 'authenticated', other), [`${other}/them.jpg`]);

  const bucket = (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id='avatars'`)).rows[0];
  assert.equal(bucket.public, true);
  assert.equal(Number(bucket.file_size_limit), 5 * 1024 * 1024);
  assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
});
