const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');

const author = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const migrationRoot = path.resolve(__dirname, '../../supabase/migrations');
const read = name => fs.readFileSync(path.join(migrationRoot, name), 'utf8');
const rateError = /Spam detected: Please wait 5 seconds between comments\./;

async function createDb(t, { recentComment = false } = {}) {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    create table public.profiles(id uuid primary key);
    insert into public.profiles values ('${author}'), ('${other}');
    create table public.workouts(id integer primary key, visible boolean not null);
    insert into public.workouts values (1, true), (2, true), (3, false);
    grant select on public.workouts to authenticated;
    create table public.workout_comments(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      workout_id integer not null references public.workouts(id),
      content text not null, created_at timestamptz not null default now()
    );
    alter table public.workout_comments enable row level security;
    grant select, insert, update, delete on public.workout_comments to authenticated;
    create policy comment_read on public.workout_comments for select to authenticated
      using (exists (select 1 from public.workouts where id = workout_id and visible));
    create policy comment_insert on public.workout_comments for insert to authenticated
      with check (user_id = auth.uid() and exists (select 1 from public.workouts where id = workout_id and visible));
    create policy comment_update on public.workout_comments for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy comment_delete on public.workout_comments for delete to authenticated
      using (user_id = auth.uid());
  `);
  await db.exec(read('20261027091000_comment_update_content_only.sql'));
  if (recentComment) {
    await db.exec(`
      create function public.check_comment_rate_limit() returns trigger language plpgsql as $$
      begin return new; end;
      $$;
      create trigger tr_comment_rate_limit before insert on public.workout_comments
        for each row execute function public.check_comment_rate_limit();
    `);
    await db.query("insert into public.workout_comments (user_id, workout_id, content) values ($1, 1, 'existing')", [author]);
  }
  await db.exec(read('20261115214000_workout_comment_cooldown.sql'));
  return db;
}

async function asAuthor(db, id, run) {
  await db.exec('set role authenticated');
  await db.query("select set_config('test.user_id', $1, false)", [id]);
  try {
    return await run();
  } finally {
    await db.exec('reset role');
  }
}

function post(db, id, workoutId, text = 'New comment') {
  return db.query(`insert into public.workout_comments (user_id, workout_id, content)
    values ($1, $2, $3) returning id, created_at`, [id, workoutId, text]);
}

test('the server timestamps comments and enforces the author interval across workouts', async t => {
  const db = await createDb(t);
  await asAuthor(db, author, async () => {
    const first = await db.query(`insert into public.workout_comments (user_id, workout_id, content, created_at)
      values ($1, 1, 'First comment', '2020-01-01Z')
      returning id, created_at >= statement_timestamp() as server_time`, [author]);
    assert.equal(first.rows[0].server_time, true);
    await assert.rejects(post(db, author, 2), rateError);
    await assert.rejects(db.query('update public.workout_comments set created_at = now()'), /permission denied/);
    const edited = await db.query("update public.workout_comments set content = 'Edited' returning content");
    assert.equal(edited.rows[0].content, 'Edited');
    await db.query('delete from public.workout_comments where id = $1', [first.rows[0].id]);
    await assert.rejects(post(db, author, 2), rateError);
  });
  await asAuthor(db, other, async () => assert.equal((await post(db, other, 2)).rows.length, 1));

  // Advance the stored time only in this disposable fixture to exercise the interval boundary.
  await db.query("update private.workout_comment_cooldowns set last_created_at = clock_timestamp() - interval '5 seconds' where user_id = $1", [author]);
  await asAuthor(db, author, async () => assert.equal((await post(db, author, 2)).rows.length, 1));
});

test('existing comment visibility and account cleanup survive the cooldown migration', async t => {
  const db = await createDb(t, { recentComment: true });
  const original = (await db.query('select * from public.workout_comments')).rows;
  assert.deepEqual((await db.query('select user_id, last_created_at from private.workout_comment_cooldowns')).rows, [
    { user_id: author, last_created_at: original[0].created_at },
  ]);
  await db.exec(read('20261115214000_workout_comment_cooldown.sql'));
  assert.deepEqual((await db.query('select * from public.workout_comments')).rows, original);
  const roles = (await db.query(`select rolname,
    has_table_privilege(rolname, 'private.workout_comment_cooldowns', 'SELECT, INSERT, UPDATE, DELETE') as table_access,
    has_function_privilege(rolname, 'public.check_comment_rate_limit()', 'EXECUTE')
      or has_function_privilege(rolname, 'private.set_workout_comment_created_at()', 'EXECUTE') as direct_execution
    from pg_roles where rolname in ('anon', 'authenticated', 'service_role')`)).rows;
  assert.equal(roles.length, 3);
  assert.ok(roles.every(role => !role.table_access && !role.direct_execution));
  const triggers = (await db.query(`select tgname, pg_get_triggerdef(oid) as definition from pg_trigger
    where tgrelid = 'public.workout_comments'::regclass and not tgisinternal order by tgname`)).rows;
  assert.deepEqual(triggers.map(row => row.tgname), ['tr_comment_created_at', 'tr_comment_rate_limit']);
  assert.match(triggers[1].definition, /AFTER INSERT/);
  await asAuthor(db, other, async () => {
    await assert.rejects(post(db, other, 3), /row-level security/);
    assert.equal((await post(db, other, 2)).rows.length, 1);
  });
  await db.query('delete from public.profiles where id = $1', [other]);
  assert.equal((await db.query('select user_id from private.workout_comment_cooldowns where user_id = $1', [other])).rows.length, 0);
  assert.deepEqual((await db.query('select * from public.workout_comments')).rows, original);
});

test('a duplicate no-op does not spend the interval for a new comment', async t => {
  const db = await createDb(t);
  const first = (await asAuthor(db, author, () => post(db, author, 1))).rows[0];
  const retryExisting = async () => {
    const retry = await db.query(`insert into public.workout_comments (id, user_id, workout_id, content)
      values ($1, $2, 1, 'Retry') on conflict (id) do nothing returning id`, [first.id, author]);
    assert.equal(retry.rows.length, 0);
  };
  await asAuthor(db, author, retryExisting);
  await db.query("update private.workout_comment_cooldowns set last_created_at = clock_timestamp() - interval '5 seconds' where user_id = $1", [author]);
  await asAuthor(db, author, async () => {
    await retryExisting();
    assert.equal((await post(db, author, 2)).rows.length, 1);
  });
});
