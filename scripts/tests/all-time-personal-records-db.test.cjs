const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const migration = 'supabase/migrations/20261107145755_all_time_personal_records.sql';
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const empty = '00000000-0000-0000-0000-000000000003';
const baseline = `select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) as value from (
 select e.id,e.name,e.name_en,e.name_pt,e.muscle_group,e.muscle_en,e.muscle_pt,records.sets
 from public.exercises e
 join lateral (
   select jsonb_agg(to_jsonb(s)) as sets from (
     select s.weight,jsonb_build_object('start_time',w.start_time,'end_time',w.end_time) as workouts
     from public.sets s join public.workouts w on w.id=s.workout_id
     where s.exercise_id=e.id and w.user_id=(select auth.uid()) and w.end_time is not null and s.weight>0
     order by s.weight desc,w.end_time desc limit 1
   ) s
 ) records on records.sets is not null
) e`;

async function setup(t) {
  const db = await PGlite.create(); t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table exercises(id uuid primary key,name text,name_en text,name_pt text,muscle_group text,muscle_en text,muscle_pt text,is_custom boolean default false,created_by uuid,listed boolean default true);
    create table workouts(id uuid primary key,user_id uuid,start_time timestamptz,end_time timestamptz);
    create table sets(id uuid primary key default gen_random_uuid(),workout_id uuid,exercise_id uuid,weight numeric);
    create index sets_workout_exercise_idx on sets(workout_id,exercise_id);
    create index workouts_owner_idx on workouts(user_id);
    create index sets_exercise_idx on sets(exercise_id);
    grant select on all tables in schema public to authenticated;
    alter table workouts enable row level security;
    alter table sets enable row level security;
    alter table exercises enable row level security;
    create policy workout_read on workouts for select to authenticated using(user_id=auth.uid() or user_id='${other}');
    create policy set_read on sets for select to authenticated using(exists(select 1 from workouts w where w.id=workout_id));
    create policy exercise_read on exercises for select to authenticated using(not is_custom or created_by=auth.uid());
    insert into workouts values
      ('20000000-0000-0000-0000-000000000001','${owner}','2026-10-01Z','2026-10-01T01:00:00Z'),
      ('20000000-0000-0000-0000-000000000002','${owner}','2026-10-02Z','2026-10-02T01:00:00Z'),
      ('20000000-0000-0000-0000-000000000003','${owner}','2026-10-03Z',null),
      ('20000000-0000-0000-0000-000000000004','${other}','2026-10-04Z','2026-10-04T01:00:00Z'),
      ('20000000-0000-0000-0000-000000000005','${owner}',null,'2026-10-05T01:00:00Z');
    insert into exercises(id,name,name_en,name_pt,muscle_group,muscle_en,muscle_pt)
      select ('10000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'Exercise '||i,'Exercise '||i,'Exercício '||i,'chest','Chest','Peito' from generate_series(1,1600) i;
    insert into sets(workout_id,exercise_id,weight)
      select '20000000-0000-0000-0000-000000000001',id,10.06 from exercises where id<='10000000-0000-0000-0000-000000001005';
    insert into sets(workout_id,exercise_id,weight)
      select '20000000-0000-0000-0000-000000000002',id,10.09 from exercises where id<='10000000-0000-0000-0000-000000000003';
    insert into sets(workout_id,exercise_id,weight)
      select '20000000-0000-0000-0000-000000000004',id,1000 from exercises where id<='10000000-0000-0000-0000-000000000003';
    insert into sets(workout_id,exercise_id,weight)
      select '20000000-0000-0000-0000-000000000003',id,2000 from exercises where id<='10000000-0000-0000-0000-000000000003';
    update exercises set is_custom=true,created_by='${other}' where id='10000000-0000-0000-0000-000000000004';
    update exercises set is_custom=true,created_by='${owner}',listed=false where id='10000000-0000-0000-0000-000000000005';
    insert into sets(workout_id,exercise_id,weight) values
      ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000010',10.06),
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000001100',null),
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000001101',0),
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000001102',-1),
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000001103','NaN'),
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000001104','Infinity'),
      ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000001105',20);
  `);
  await db.exec(fs.readFileSync(migration,'utf8'));
  await db.exec(`set role authenticated;set test.user_id='${owner}'`);
  return db;
}

test('one own-account trophy summary preserves the legacy result beyond 1000 exercises under RLS', async t => {
  const db = await setup(t);
  for (const account of [owner,other,empty]) {
    await db.query("select set_config('test.user_id',$1,false)",[account]);
    const previous = (await db.query(baseline)).rows[0].value;
    const current = (await db.query('select public.all_time_personal_records() as value')).rows[0].value;
    assert.deepEqual(current,previous);
    if (account===owner) {
      assert.ok(current.length>1000);
      assert.equal(current[0].sets[0].weight,10.09);
      assert.ok(!current.some(row=>row.id==='10000000-0000-0000-0000-000000000004'));
      assert.ok(current.some(row=>row.id==='10000000-0000-0000-0000-000000000005'));
      assert.equal(current.find(row=>row.id==='10000000-0000-0000-0000-000000000010').sets[0].workouts.end_time,'2026-10-02T01:00:00+00:00');
    }
    if (account===empty) assert.deepEqual(current,[]);
  }
  await db.exec('reset role');
  await db.exec(fs.readFileSync(migration,'utf8'));
  const metadata = (await db.query("select provolatile,prosecdef,proconfig,has_function_privilege('anon',oid,'execute') as anon,has_function_privilege('authenticated',oid,'execute') as authenticated from pg_proc where oid='public.all_time_personal_records()'::regprocedure")).rows[0];
  assert.equal(metadata.provolatile,'s'); assert.equal(metadata.prosecdef,false);
  assert.deepEqual(metadata.proconfig,['search_path=""']);
  assert.equal(metadata.anon,false); assert.equal(metadata.authenticated,true);
  await db.exec('set role anon');
  await assert.rejects(db.query('select public.all_time_personal_records()'),/permission denied/);
});
