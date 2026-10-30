const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const hidden = '00000000-0000-0000-0000-000000000001';
const friend = '00000000-0000-0000-0000-000000000002';
const stranger = '00000000-0000-0000-0000-000000000003';
const migration = path.resolve(__dirname, '../../supabase/migrations/20261027092000_private_profile_fields.sql');
const followUp = path.resolve(__dirname, '../../supabase/migrations/20261027092100_private_profile_cards.sql');

async function applyMigrations(db) {
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await db.exec(fs.readFileSync(followUp, 'utf8'));
}

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
    create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
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
  await applyMigrations(db);
  await assert.doesNotReject(applyMigrations(db), 'the migrations must be safe to apply again');

  await as(db, stranger, async () => {
    await assert.rejects(db.query('select height_cm from profiles where id = $1', [hidden]), /permission denied/);
    await assert.rejects(db.query('select bio from profiles where id = $1', [hidden]), /permission denied/);
    await assert.rejects(db.query('select full_name from profiles where id = $1', [hidden]), /permission denied/);
    await assert.rejects(db.query('select * from profiles'), /permission denied/);
    const card = await db.query('select id, username, avatar_url, visibility, updated_at from profiles where id = $1', [hidden]);
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

test('cards hide names from strangers and never match a hidden name in search', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await applyMigrations(db);
  await as(db, stranger, async () => {
    const card = (await db.query('select * from profile_cards where id=$1', [hidden])).rows[0];
    assert.equal(card.username, 'hidden');
    assert.equal(card.full_name, null);
    assert.equal(Object.hasOwn(card, 'bio'), false);
    assert.equal(Object.hasOwn(card, 'height_cm'), false);
    assert.equal((await db.query("select id from profile_cards where full_name ilike '%Hidden Person%'")).rows.length, 0);
    assert.equal((await db.query("select id from profile_cards where username ilike '%hidden%'")).rows.length, 1);
  });
  await as(db, friend, async () => {
    assert.equal((await db.query('select full_name from profile_cards where id=$1', [hidden])).rows[0].full_name, 'Hidden Person');
    assert.equal((await db.query('select full_name from profile_private_details where id=$1', [hidden])).rows[0].full_name, 'Hidden Person');
  });
  await db.query("update profiles set visibility='private' where id=$1", [hidden]);
  await as(db, friend, async () => {
    assert.equal((await db.query('select full_name from profile_cards where id=$1', [hidden])).rows[0].full_name, null);
    assert.equal((await db.query('select * from profile_details where id=$1', [hidden])).rows.length, 0);
  });
  await as(db, hidden, async () => {
    assert.equal((await db.query('select full_name from profile_cards where id=$1', [hidden])).rows[0].full_name, 'Hidden Person');
    assert.equal((await db.query('select full_name from profile_private_details where id=$1', [hidden])).rows[0].full_name, 'Hidden Person');
    assert.equal((await db.query("update profiles set full_name='New name' where id=$1 returning id,username", [hidden])).rows.length, 1);
  });
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from profile_cards'), /permission denied/);
});

test('previous column grants and PUBLIC privileges cannot preserve sensitive-field access', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await db.exec('grant select(full_name,bio,height_cm) on profiles to authenticated; grant select on profiles to public');
  await applyMigrations(db);
  await as(db, stranger, async () => {
    for (const column of ['full_name', 'bio', 'height_cm']) {
      await assert.rejects(db.query(`select ${column} from profiles`), /permission denied/);
    }
  });
  await db.exec('set role anon');
  await assert.rejects(db.query('select username from profiles'), /permission denied/);
});

test('the additive rollout keeps legacy reads working until the explicit permission cutover', async t => {
  const db = await createDb();
  t.after(() => db.close());
  const original = (await db.query('select * from profiles order by id')).rows;
  const viewsSql = fs.readFileSync(path.resolve(__dirname, '../../supabase/rollouts/profile_read_views.sql'), 'utf8');
  await db.exec(viewsSql);
  await db.exec(viewsSql);
  await as(db, hidden, async () => {
    const legacy = (await db.query('select * from profiles where id=$1', [hidden])).rows[0];
    assert.equal(legacy.full_name, 'Hidden Person');
    assert.equal(Number(legacy.height_cm), 181);
  });
  await as(db, stranger, async () => {
    assert.equal((await db.query('select full_name from profile_cards where id=$1', [hidden])).rows[0].full_name, null);
    assert.equal((await db.query('select * from profile_private_details where id=$1', [hidden])).rows.length, 0);
  });
  await applyMigrations(db);
  await as(db, hidden, async () => {
    await assert.rejects(db.query('select * from profiles where id=$1', [hidden]), /permission denied/);
    assert.equal((await db.query('select full_name from profile_private_details where id=$1', [hidden])).rows[0].full_name, 'Hidden Person');
  });
  assert.deepEqual((await db.query('select * from profiles order by id')).rows, original);
});

test('bootstrap uses plain INSERT because ON CONFLICT UPDATE requires revoked SELECT privileges', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await applyMigrations(db);
  const newcomer = '00000000-0000-0000-0000-000000000004';
  await as(db, newcomer, async () => {
    await assert.rejects(db.query(`insert into profiles(id,username,full_name,bio) values ($1,'new','New name','New bio')
      on conflict(id) do update set full_name=excluded.full_name,bio=excluded.bio returning id,username`, [newcomer]), /permission denied/);
    assert.equal((await db.query(`insert into profiles(id,username,full_name,bio) values ($1,'new','New name','New bio') returning id,username`, [newcomer])).rows[0].id, newcomer);
    assert.equal((await db.query('select full_name,bio from profile_private_details where id=$1', [newcomer])).rows[0].full_name, 'New name');
  });
});
