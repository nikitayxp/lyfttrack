const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('custom exercises stay private unless they are already in a visible workout', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  const owner = '00000000-0000-0000-0000-000000000001';
  const other = '00000000-0000-0000-0000-000000000002';
  const stranger = '00000000-0000-0000-0000-000000000003';
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    create function public.can_view_user_content(target_user_id uuid) returns boolean language sql stable as $$
      select target_user_id = nullif(current_setting('test.user_id', true), '')::uuid
          or target_user_id::text = current_setting('test.visible_user', true)
    $$;
    grant execute on function public.can_view_user_content(uuid) to authenticated;
    create table exercises(id int primary key,is_custom boolean,created_by uuid,name text);
    alter table exercises enable row level security;
    grant select,insert,update,delete on exercises to authenticated;
    create table workouts(id int primary key, user_id uuid);
    create table workout_exercises(id int primary key, workout_id int references workouts(id), exercise_id int);
    grant select on workouts, workout_exercises to authenticated;
    create policy exercises_select_authenticated on exercises for select to authenticated using(true);
    create policy exercises_insert_own_custom on exercises for insert to authenticated with check(auth.uid()=created_by and is_custom=true);
    create policy exercises_update_own_custom on exercises for update to authenticated using(auth.uid()=created_by) with check(auth.uid()=created_by);
    insert into exercises values
      (1,false,null,'Catalog'),
      (2,true,'${owner}','Own'),
      (3,true,'${other}','Private'),
      (5,true,'${other}','Visible custom'),
      (6,true,'${stranger}','Hidden custom');
    insert into workouts values (10,'${other}'),(11,'${stranger}');
    insert into workout_exercises values (1,10,5),(2,11,6);
  `);
  const migration = path.resolve(__dirname, '../../supabase/migrations/20261019141000_restore_exercise_privacy.sql');
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await db.exec(`set role authenticated; set test.user_id='${owner}'; set test.visible_user='${other}'`);
  assert.deepEqual((await db.query('select id from exercises order by id')).rows.map(r => r.id), [1, 2, 5]);
  await db.exec(`set test.visible_user=''`);
  assert.deepEqual((await db.query('select id from exercises order by id')).rows.map(r => r.id), [1, 2]);
  await db.exec(`set test.visible_user='${other}'`);
  assert.equal((await db.query("update exercises set name='Attack' where id=5 returning id")).rows.length, 0);
  assert.equal((await db.query('delete from exercises where id=5 returning id')).rows.length, 0);
  assert.equal((await db.query("update exercises set name='Attack' where id=3 returning id")).rows.length, 0);
  assert.equal((await db.query('delete from exercises where id=3 returning id')).rows.length, 0);
  assert.equal((await db.query("update exercises set name='Attack' where id=1 returning id")).rows.length, 0);
  assert.equal((await db.query('delete from exercises where id=1 returning id')).rows.length, 0);
  await assert.rejects(db.exec(`insert into exercises values(4,true,'${other}','Attack')`), /row-level security/);
  await assert.rejects(db.exec(`insert into exercises values(4,false,'${owner}','Fake catalog')`), /row-level security/);
  await assert.rejects(db.exec('update exercises set is_custom=false where id=2'), /row-level security/);
  await assert.rejects(db.exec(`update exercises set created_by='${other}' where id=2`), /row-level security/);
  await db.exec(`insert into exercises values(4,true,'${owner}','New custom')`);
  assert.equal((await db.query("update exercises set name='Updated custom' where id=4 returning id")).rows.length, 1);
  assert.equal((await db.query('delete from exercises where id=2 returning id')).rows.length, 1);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from exercises'), /permission denied/);
});
