const assert=require('node:assert/strict');const {test}=require('node:test');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
const policies=require('./fixtures/rls-before-read-optimization.json');
const ids=Array.from({length:5},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
test('RLS optimization preserves all public policies and visibility permissions',async t=>{
 const db=await PGlite.create();t.after(()=>db.close());
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table profiles(id uuid primary key,visibility text default 'friends',username text,avatar_url text,updated_at timestamptz,full_name text,bio text,height_cm numeric);
 create table friends(id uuid primary key,user_low_id uuid,user_high_id uuid);
 create table workouts(id uuid primary key,user_id uuid,name text,start_time timestamptz default now(),end_time timestamptz default now());
 create table sets(id uuid primary key,workout_id uuid,workout_exercise_id uuid,exercise_id uuid,weight numeric,reps integer,set_number integer,rir integer,set_type text);
 create table workout_exercises(id uuid primary key,workout_id uuid,exercise_id uuid,rest_time integer);
 create table body_measurements(id uuid primary key,user_id uuid,weight numeric);
 create table exercises(id uuid primary key,created_by uuid,is_custom boolean);
 create table friend_requests(id uuid primary key,from_user_id uuid,to_user_id uuid,status text);
 create table routines(id uuid primary key,user_id uuid);
 create table routine_exercises(id uuid primary key,routine_id uuid);
 create table workout_templates(id uuid primary key,user_id uuid);
 create table template_exercises(id uuid primary key,template_id uuid);
 create table workout_likes(id uuid primary key,workout_id uuid,user_id uuid);
 create table workout_comments(id uuid primary key,workout_id uuid,user_id uuid,content text,created_at timestamptz default now());
 insert into profiles(id,visibility) values ('${ids[0]}','private'),('${ids[1]}','friends'),('${ids[2]}','public'),('${ids[3]}','private');
 update profiles set username='Private athlete',full_name='Private name' where id='${ids[3]}';
 insert into friends values ('${ids[4]}','${ids[0]}','${ids[1]}');
 insert into workouts(id,user_id,name) select id,id,'Training' from profiles;
 insert into body_measurements select id,id,70 from profiles;
 insert into sets(id,workout_id,workout_exercise_id) select id,id,null from profiles;
 insert into workout_exercises(id,workout_id,exercise_id) select id,id,null from profiles;
 insert into workout_templates select id,id from profiles;
 insert into template_exercises select id,id from profiles;
 insert into routines select id,id from profiles;
 insert into routine_exercises select id,id from profiles;
 insert into workout_likes select id,id,id from profiles;
 insert into workout_comments(id,workout_id,user_id) select id,id,id from profiles;
 update workout_comments set user_id='${ids[3]}',content='Public workout comment' where id='${ids[2]}';
 grant select,insert,update,delete on all tables in schema public to authenticated;
 `);
 const migration=fs.readFileSync('supabase/migrations/20260727090000_public_profile_visibility.sql','utf8');
 const start=migration.indexOf('create or replace function public.can_view_user_content');const end=migration.indexOf('grant execute on function public.can_view_user_content(uuid) to authenticated;',start)+'grant execute on function public.can_view_user_content(uuid) to authenticated;'.length;
 await db.exec(migration.slice(start,end));
 for(const p of policies){await db.exec(`alter table public.${p.tablename} enable row level security; create policy ${p.policyname} on public.${p.tablename} for ${p.cmd} to ${p.roles.join(',')} ${p.qual?'using ('+p.qual+')':''} ${p.with_check?'with check ('+p.with_check+')':''}`);}
 await db.exec(`alter table routine_exercises add column exercise_id uuid;
 alter table template_exercises add column exercise_id uuid;
 alter table exercises add column name text,add column muscle_group text,add column equipment text,
 add column name_pt text,add column image_url text,add column name_en text,add column muscle_en text,
 add column muscle_pt text,add column description text,add column aliases text[],add column listed boolean;
 create function wipe_my_workouts() returns void language sql as $$ select $$;
 create function wipe_my_custom_exercises() returns void language sql as $$ select $$;
 create function delete_own_account() returns void language sql as $$ select $$;
 create function respond_to_friend_request(uuid,text) returns void language sql as $$ select $$;
 create function check_username_available(text) returns boolean language sql as $$ select false $$;`);
 // Production already has these protections before the older optimization runs.
 for(const file of ['20261027090000_own_exercise_references.sql','20261027090100_repair_copied_exercise_references.sql','20261027092100_private_profile_cards.sql','20261027094000_tighten_role_privileges.sql']){
   await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 }
 const tables=[...new Set(policies.map(p=>p.tablename))];
 async function capture(){const result=[];await db.exec('set role authenticated');for(const actor of [...ids.slice(0,4),'']){await db.query(`select set_config('test.user_id',$1,false)`,[actor]);for(const table of tables){result.push({actor,table,rows:(await db.query(`select id from public.${table} order by id`)).rows});}for(const target of [...ids.slice(0,4),null])result.push({actor,target,value:(await db.query('select public.can_view_user_content($1::uuid) value',[target])).rows[0].value});}await db.exec('reset role');return result;}
 await db.exec(fs.readFileSync('supabase/migrations/20261026221000_batched_read_models.sql','utf8'));
 const before=await capture();
 await db.exec(fs.readFileSync('supabase/migrations/20261026222000_rls_initplans.sql','utf8'));
 assert.deepEqual(await capture(),before);
 const after=(await db.query("select policyname,qual,with_check from pg_policies where schemaname='public' order by policyname")).rows;
 for(const table of ['sets','workout_exercises','routine_exercises','template_exercises']){
   for(const operation of ['insert','update']){
     const name=table+'_'+operation+'_'+(table==='template_exercises'?'owner_templates':'owner_only');
     assert.match(after.find(policy=>policy.policyname===name).with_check,/can_reference_exercise/,'optimization removed exercise ownership protection: '+name);
   }
 }
 for(const operation of ['insert','update']){
   assert.match(after.find(policy=>policy.policyname==='sets_'+operation+'_owner_only').with_check,/we\.workout_id = sets\.workout_id/,'optimization removed set/block workout linkage');
 }
 await db.exec(fs.readFileSync('supabase/migrations/20261026222000_rls_initplans.sql','utf8'));
 assert.deepEqual((await db.query("select policyname,qual,with_check from pg_policies where schemaname='public' order by policyname")).rows,after,'reapplication must not keep nesting scalar subqueries');
 assert.equal(after.length,policies.length);
 for(const p of policies){const q=after.find(q=>q.policyname===p.policyname);assert.equal(Boolean(q.qual),Boolean(p.qual));assert.equal(Boolean(q.with_check),Boolean(p.with_check));}
 await db.exec(`set role authenticated;set test.user_id='${ids[0]}'`);
 const previews=(await db.query('select public.latest_workout_comments($1::uuid[]) value',[ids.slice(0,4)])).rows[0].value;
 assert.deepEqual(previews.map(r=>r.workout_id).sort(),ids.slice(0,3));
 assert.deepEqual(previews.find(r=>r.workout_id===ids[2]),{workout_id:ids[2],content:'Public workout comment',author:'Private athlete'});
 await assert.rejects(db.query('select full_name from public.profiles'),/permission denied/);
 const summaries=(await db.query('select public.workout_record_summaries($1::uuid[]) value',[ids.slice(0,4)])).rows[0].value;
 assert.equal(summaries.some(r=>r.workout_id===ids[3]),false);
 await db.query('insert into body_measurements values ($1,$2,80)',[ids[4],ids[0]]);
 await assert.rejects(db.query('insert into body_measurements values ($1,$2,80)',[ids[4],ids[1]]));
 assert.equal((await db.query('update body_measurements set weight=90 where user_id=$1 returning id',[ids[1]])).rows.length,0);
 const plan=await db.query('explain select * from body_measurements');assert.match(JSON.stringify(plan.rows),/InitPlan/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.can_view_user_content($1::uuid)',[ids[0]]),/permission denied/);
 await db.exec(`reset role; alter policy exercises_update_own_custom on public.exercises
   using (is_custom=true and created_by=(select auth.uid()))
   with check (is_custom=true and created_by=(select auth.uid()));`);
 await db.exec(fs.readFileSync('supabase/migrations/20261026222000_rls_initplans.sql','utf8'));
 const customPolicy=(await db.query("select qual,with_check from pg_policies where schemaname='public' and policyname='exercises_update_own_custom'")).rows[0];
 assert.match(customPolicy.qual,/is_custom = true/);
 assert.match(customPolicy.with_check,/is_custom = true/);
 await db.exec(`set role authenticated;set test.user_id='${ids[0]}'`);
 await db.query('insert into exercises(id,created_by,is_custom) values($1,$2,true)',[ids[4],ids[0]]);
 await assert.rejects(db.query('update exercises set is_custom=false where id=$1',[ids[4]]),/row-level security/);
});
