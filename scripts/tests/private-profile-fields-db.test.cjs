const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const hidden = '00000000-0000-0000-0000-000000000001';
const friend = '00000000-0000-0000-0000-000000000002';
const stranger = '00000000-0000-0000-0000-000000000003';
const migration = path.resolve(__dirname, '../../supabase/migrations/20261027092000_private_profile_fields.sql');

async function createDb() {
  const db = await PGlite.create();
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    create table public.profiles(
      id uuid primary key, username text, avatar_url text, full_name text, bio text,
      updated_at timestamptz default now(), visibility text not null default 'public', height_cm numeric
    );
    create table public.friends(user_low_id uuid, user_high_id uuid);
    alter table public.profiles enable row level security;
    grant select, insert, update, delete on public.profiles to anon, authenticated;
    create policy profiles_select_public on public.profiles for select to authenticated using (true);
    create policy profiles_update_own on public.profiles for update to authenticated
      using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
    create function public.can_view_user_content(target_user_id uuid) returns boolean
    language sql stable security definer set search_path to '' as $$
      select case
        when target_user_id is null then false
        when (select auth.uid()) = target_user_id then true
        else exists (
          select 1 from public.profiles p where p.id = target_user_id
          and (p.visibility = 'public' or (p.visibility = 'friends' and exists (
            select 1 from public.friends f
            where f.user_low_id = least((select auth.uid()), target_user_id)
              and f.user_high_id = greatest((select auth.uid()), target_user_id)
          )))
        )
      end;
    $$;
    grant execute on function public.can_view_user_content(uuid) to authenticated;
    insert into public.profiles(id, username, full_name, bio, visibility, height_cm) values
      ('${hidden}', 'hidden', 'Hidden Person', 'private bio', 'friends', 181),
      ('${friend}', 'friend', 'Friend', null, 'public', 170),
      ('${stranger}', 'stranger', 'Stranger', null, 'public', 160);
    insert into public.friends values ('${hidden}', '${friend}');
  `);
  return db;
}

async function as(db, userId, work) {
  await db.exec(`set role authenticated; set test.user_id = '${userId}'`);
  try {
    return await work();
  } finally {
    await db.exec('reset role');
  }
}

test('before the migration anyone signed in reads the height and bio of a private profile', async t => {
  const db = await createDb();
  t.after(() => db.close());
  const row = await as(db, stranger, () => db.query('select bio, height_cm from profiles where id = $1', [hidden]));
  assert.equal(row.rows[0].bio, 'private bio');
  assert.equal(Number(row.rows[0].height_cm), 181);
});

test('private fields are only readable by the people allowed to see them', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await assert.doesNotReject(db.exec(fs.readFileSync(migration, 'utf8')), 'the migration must be safe to apply again');

  await as(db, stranger, async () => {
    await assert.rejects(db.query('select height_cm from profiles where id = $1', [hidden]), /permission denied/);
    await assert.rejects(db.query('select bio from profiles where id = $1', [hidden]), /permission denied/);
    await assert.rejects(db.query('select * from profiles'), /permission denied/);
    const card = await db.query('select id, username, full_name, avatar_url, visibility, updated_at from profiles where id = $1', [hidden]);
    assert.equal(card.rows[0].username, 'hidden');
    assert.equal((await db.query('select * from profile_details where id = $1', [hidden])).rows.length, 0);
    const publicDetails = await db.query('select bio, height_cm from profile_details where id = $1', [friend]);
    assert.equal(publicDetails.rows.length, 1);
    assert.equal(publicDetails.rows[0].height_cm, null);
  });

  await as(db, friend, async () => {
    const details = await db.query('select bio, height_cm from profile_details where id = $1', [hidden]);
    assert.equal(details.rows[0].bio, 'private bio');
    assert.equal(details.rows[0].height_cm, null);
  });

  await as(db, hidden, async () => {
    const own = await db.query('select bio, height_cm from profile_details where id = $1', [hidden]);
    assert.equal(own.rows[0].bio, 'private bio');
    assert.equal(Number(own.rows[0].height_cm), 181);
    const updated = await db.query("update profiles set bio = 'new bio', height_cm = 182 where id = $1 returning id, username", [hidden]);
    assert.equal(updated.rows.length, 1);
  });

  await db.exec('set role anon');
  await assert.rejects(db.query('select username from profiles'), /permission denied/);
  await assert.rejects(db.query('select * from profile_details'), /permission denied/);
});
