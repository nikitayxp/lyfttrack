const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const own = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const migration = path.resolve(__dirname, '../../supabase/migrations/20261019140000_avatar_storage_ownership.sql');

test('avatar writes are scoped to the authenticated folder while avatars stay publicly readable', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id',true),'')::uuid
    $$;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select string_to_array(substring(name from '^(.*)/[^/]*$'), '/')
    $$;
    create table storage.objects(id integer generated always as identity primary key,bucket_id text,name text,content text);
    alter table storage.objects enable row level security;
    create policy "Avatar Select" on storage.objects for select to public using(bucket_id='avatars');
    create policy "Avatar Insert" on storage.objects for insert to authenticated with check(bucket_id='avatars');
    create policy "Avatar Update" on storage.objects for update to authenticated using(bucket_id='avatars');
    create policy "Avatar Delete" on storage.objects for delete to authenticated using(bucket_id='avatars');
    grant usage on schema auth,storage to authenticated,anon;
    grant execute on function auth.uid(),storage.foldername(text) to authenticated;
    grant select on storage.objects to anon;
    grant select,insert,update,delete on storage.objects to authenticated;
    grant usage,select on sequence storage.objects_id_seq to authenticated;
    insert into storage.objects(bucket_id,name,content) values('avatars','${other}/existing.jpg','original');
    set role authenticated; set test.user_id='${own}';
  `);
  const baseline = await db.query(`insert into storage.objects(bucket_id,name) values('avatars',$1) returning id`, [`${other}/baseline-vulnerability.jpg`]);
  assert.equal(baseline.rows.length, 1, 'the captured baseline permits writes into another account folder');
  await db.query('delete from storage.objects where id=$1', [baseline.rows[0].id]);
  await db.exec('reset role');
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await db.exec(`set role authenticated; set test.user_id='${own}'`);

  await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values('avatars',$1)`, [`${other}/attack.jpg`]), /row-level security/);
  await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values('avatars',$1)`, [own]), /row-level security/);
  await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values('other',$1)`, [`${own}/attack.jpg`]), /row-level security/);
  const foreignUpdate = await db.query(`update storage.objects set content='changed' where name=$1 returning id`, [`${other}/existing.jpg`]);
  assert.equal(foreignUpdate.rows.length, 0);
  const foreignDelete = await db.query('delete from storage.objects where name=$1 returning id', [`${other}/existing.jpg`]);
  assert.equal(foreignDelete.rows.length, 0);

  const ownAvatar = (await db.query(`insert into storage.objects(bucket_id,name,content) values('avatars',$1,'own') returning id`, [`${own}/avatar.jpg`])).rows[0].id;
  assert.equal((await db.query(`update storage.objects set content='updated' where id=$1 returning id`, [ownAvatar])).rows.length, 1);
  await assert.rejects(db.query('update storage.objects set name=$1 where id=$2', [`${other}/moved.jpg`, ownAvatar]), /row-level security/);
  await assert.rejects(db.query(`update storage.objects set bucket_id='other' where id=$1`, [ownAvatar]), /row-level security/);
  assert.equal((await db.query('delete from storage.objects where id=$1 returning id', [ownAvatar])).rows.length, 1);
  await db.exec('reset role; set role anon');
  assert.equal((await db.query(`select content from storage.objects where name=$1`, [`${other}/existing.jpg`])).rows[0].content, 'original');
  await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values('avatars',$1)`, [`${own}/anonymous.jpg`]), /permission denied/);
});
