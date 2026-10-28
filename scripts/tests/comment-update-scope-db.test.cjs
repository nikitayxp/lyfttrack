const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const me = '00000000-0000-0000-0000-000000000001';
const privateOwner = '00000000-0000-0000-0000-000000000002';
const publicOwner = '00000000-0000-0000-0000-000000000003';
const migration = path.resolve(__dirname, '../../supabase/migrations/20261027091000_comment_update_content_only.sql');

async function createDb() {
  const db = await PGlite.create();
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    create table workouts(id int primary key, user_id uuid);
    create table workout_comments(
      id int primary key,
      user_id uuid not null,
      workout_id int not null references workouts(id),
      content text not null,
      created_at timestamptz not null default now()
    );
    alter table workout_comments enable row level security;
    grant select, insert, update, delete on workout_comments to authenticated;
    grant select on workouts to authenticated;
    create policy workout_comments_select on workout_comments for select to authenticated using (true);
    create policy workout_comments_update_own on workout_comments for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    insert into workouts values (1, '${me}'), (2, '${privateOwner}');
    insert into workout_comments(id, user_id, workout_id, content) values (10, '${me}', 1, 'hello');
  `);
  return db;
}

async function asMe(db, work) {
  await db.exec(`set role authenticated; set test.user_id = '${me}'`);
  try {
    return await work();
  } finally {
    await db.exec('reset role');
  }
}

async function createDbWithVisibility() {
  const db = await createDb();
  const visibilitySql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20260727090000_public_profile_visibility.sql'), 'utf8');
  const ownershipSql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20260409010000_rls_security_hardening.sql'), 'utf8');
  const helper = visibilitySql.match(/create or replace function public\.can_view_user_content[\s\S]*?\$\$;/)[0];
  const policy = (sql, name) => sql.match(new RegExp(`create policy ${name}\\s[\\s\\S]*?;`))[0];
  await db.exec(`
    create table profiles(id uuid primary key, visibility text);
    create table friends(user_low_id uuid, user_high_id uuid);
    insert into profiles values ('${me}', 'public'), ('${privateOwner}', 'private'), ('${publicOwner}', 'public');
    insert into workouts values (3, '${publicOwner}');
    insert into workout_comments(id,user_id,workout_id,content) values (20, '${publicOwner}', 1, 'not mine');
    drop policy workout_comments_select on workout_comments;
    drop policy workout_comments_update_own on workout_comments;
    ${helper}
    ${policy(visibilitySql, 'workout_comments_select_workout_visible')}
    ${policy(visibilitySql, 'workout_comments_insert_own_on_visible_workout')}
    ${policy(ownershipSql, 'workout_comments_update_own')}
    ${policy(ownershipSql, 'workout_comments_delete_own')}
  `);
  await db.exec(fs.readFileSync(migration, 'utf8'));
  return db;
}

test('before the migration a comment can be moved onto a private workout', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await asMe(db, () => db.query('update workout_comments set workout_id = 2 where id = 10'));
  assert.equal((await db.query('select workout_id from workout_comments where id = 10')).rows[0].workout_id, 2);
});

test('only the comment text can be changed', async t => {
  const db = await createDb();
  t.after(() => db.close());
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await assert.doesNotReject(db.exec(fs.readFileSync(migration, 'utf8')), 'the migration must be safe to apply again');

  await asMe(db, async () => {
    for (const column of ['workout_id = 2', `user_id = '${privateOwner}'`, "created_at = now() - interval '1 year'", 'id = 11']) {
      await assert.rejects(
        db.query(`update workout_comments set ${column} where id = 10`),
        /permission denied/,
        column
      );
    }
    const edited = await db.query("update workout_comments set content = 'edited' where id = 10 returning content");
    assert.equal(edited.rows[0].content, 'edited');
  });

  const row = (await db.query('select workout_id, user_id from workout_comments where id = 10')).rows[0];
  assert.equal(row.workout_id, 1);
  assert.equal(row.user_id, me);
});

test('visible-workout commenting and deleting my comment still work after the column restriction', async t => {
  const db = await createDbWithVisibility();
  t.after(() => db.close());
  await asMe(db, async () => {
    const inserted = await db.query(`insert into workout_comments(id,user_id,workout_id,content) values (30,$1,3,'new comment') returning id`, [me]);
    assert.equal(inserted.rows[0].id, 30);
    assert.equal((await db.query("update workout_comments set content='edited' where id=30 returning content")).rows[0].content, 'edited');
    assert.equal((await db.query('delete from workout_comments where id=30 returning id')).rows[0].id, 30);
  });
  assert.equal((await db.query('select id from workout_comments where id=30')).rows.length, 0);
});

test('private-workout and forged-author inserts remain blocked', async t => {
  const db = await createDbWithVisibility();
  t.after(() => db.close());
  await asMe(db, async () => {
    await assert.rejects(db.query(`insert into workout_comments(id,user_id,workout_id,content) values (30,$1,2,'private')`, [me]), /row-level security/);
    await assert.rejects(db.query(`insert into workout_comments(id,user_id,workout_id,content) values (31,$1,3,'forged')`, [publicOwner]), /row-level security/);
  });
});

test('another author content and comment deletion remain protected', async t => {
  const db = await createDbWithVisibility();
  t.after(() => db.close());
  await asMe(db, async () => {
    assert.equal((await db.query("update workout_comments set content='changed' where id=20 returning id")).rows.length, 0);
    assert.equal((await db.query('delete from workout_comments where id=20 returning id')).rows.length, 0);
  });
  assert.equal((await db.query('select content from workout_comments where id=20')).rows[0].content, 'not mine');
});

test('anonymous sessions cannot insert, update or delete comments', async t => {
  const db = await createDbWithVisibility();
  t.after(() => db.close());
  await db.exec('set role anon');
  for (const sql of [
    `insert into workout_comments(id,user_id,workout_id,content) values (30,'${me}',1,'anonymous')`,
    "update workout_comments set content='anonymous' where id=10",
    'delete from workout_comments where id=10',
  ]) await assert.rejects(db.query(sql), /permission denied/);
});
