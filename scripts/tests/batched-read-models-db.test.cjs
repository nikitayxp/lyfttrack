const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const {PGlite} = require('@electric-sql/pglite');
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const ex = '10000000-0000-0000-0000-000000000001';
const ids = Array.from({length:5}, (_,i)=>`20000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
test('batch read RPCs preserve PR chronology and obey caller RLS', async t => {
 const db=await PGlite.create(); t.after(()=>db.close());
 await db.exec(`
 create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table profiles(id uuid primary key, username text);
 create table workouts(id uuid primary key, user_id uuid, start_time timestamptz, end_time timestamptz, name text);
 create table sets(id uuid primary key default gen_random_uuid(),workout_id uuid,exercise_id uuid,weight numeric,reps integer,set_number integer,rir integer,set_type text);
 create table workout_exercises(id uuid primary key default gen_random_uuid(),workout_id uuid,exercise_id uuid,rest_time integer);
 create table workout_comments(id uuid primary key default gen_random_uuid(),workout_id uuid,user_id uuid,content text,created_at timestamptz);
 insert into profiles values ('${owner}','Owner'),('${other}','Hidden');
 insert into workouts(id,user_id,start_time,end_time) values
 ('${ids[0]}','${owner}','2026-09-01Z','2026-09-01Z'),
 ('${ids[1]}','${owner}','2026-10-01Z','2026-10-01Z'),
 ('${ids[2]}','${owner}','2026-10-01Z','2026-10-01Z'),
 ('${ids[3]}','${other}','2026-08-01Z','2026-08-01Z'),
 ('${ids[4]}','${owner}','2026-08-01Z',null);
 insert into sets(workout_id,exercise_id,weight,reps) values
 ('${ids[0]}','${ex}',100,5),('${ids[1]}','${ex}',100,6),('${ids[2]}','${ex}',500,5),('${ids[3]}','${ex}',1000,5),('${ids[4]}','${ex}',2000,5);
 insert into workout_comments(workout_id,user_id,content,created_at) values ('${ids[0]}','${owner}','one','2026-10-01Z'),('${ids[1]}','${owner}','old','2026-10-01Z'),('${ids[1]}','${owner}','latest','2026-10-02Z'),('${ids[3]}','${other}','secret','2026-10-03Z');
 alter table profiles enable row level security; alter table workouts enable row level security; alter table sets enable row level security; alter table workout_comments enable row level security;
 create policy own_profile on profiles for select to authenticated using(id=auth.uid());
 create policy own_workout on workouts for select to authenticated using(user_id=auth.uid());
 create policy own_set on sets for select to authenticated using(exists(select 1 from workouts w where w.id=workout_id));
 create policy own_comment on workout_comments for select to authenticated using(exists(select 1 from workouts w where w.id=workout_id));
 grant select on profiles,workouts,sets,workout_comments,workout_exercises to authenticated;
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261026221000_batched_read_models.sql','utf8'));
 await db.exec(`set role authenticated; set test.user_id='${owner}'`);
 const rpc = async (name, arg) => (await db.query(`select public.${name}($1::uuid[]) value`, [arg])).rows[0].value;
 const rows = await rpc('workout_record_summaries', ids);
 assert.equal(rows.find(r=>r.workout_id===ids[0]).has_history,false);
 const best=rows.find(r=>r.workout_id===ids[1]);
 assert.equal(best.best_weight,100); assert.ok(Math.abs(best.best_e1rm-100*(1+5/30))<1e-8);
 assert.equal(rows.some(r=>r.workout_id===ids[3]),false);
 assert.equal(rows.find(r=>r.workout_id===ids[2]).best_weight,100);
 await db.exec(`reset role;insert into sets(workout_id,exercise_id,weight,reps) select '${ids[0]}','${ex}',case when i=7961 then 200 else 10 end,5 from generate_series(1,7961) i;set role authenticated`);
 const large=await rpc('workout_record_summaries',[ids[1]]);assert.equal(large[0].best_weight,200);
 const comments=await rpc('latest_workout_comments',ids);
 assert.equal(comments.length,2); assert.equal(comments.find(r=>r.workout_id===ids[1]).content,'latest');
 const months=(await db.query(`select public.workout_month_buckets($1::uuid,'UTC') value`,[owner])).rows[0].value;
 assert.deepEqual(months,[{year:2026,month:10,count:2},{year:2026,month:9,count:1},{year:2026,month:8,count:1}]);
 assert.deepEqual((await db.query(`select public.workout_month_buckets($1::uuid,'UTC') value`,[other])).rows[0].value,[]);
 const reference=(await db.query('select public.exercise_training_references($1::uuid[],$2::uuid) value',[[ex],ids[1]])).rows[0].value;
 assert.equal(reference[0].best_weight,500);
 assert.equal(reference[0].last_sets[0].weight,500);
 const history=(await db.query('select public.exercise_history_page($1::uuid,2,0) value',[ex])).rows[0].value;
 assert.equal(history.length,2); assert.equal(history[0].workouts.id,ids[2]); assert.equal(history[0].sets.length,1);
 const activity=await rpc('recent_candidate_activity',[owner,other]);
 assert.equal(activity.length,1); assert.equal(activity[0].user_id,owner);
 await db.exec('reset role; set role anon');
 await assert.rejects(rpc('workout_record_summaries',ids),/permission denied/);
});
