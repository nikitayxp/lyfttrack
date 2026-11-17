const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261116123900_account_deletion_avatar_guard.sql'),'utf8');
async function fixture(t,{history=true,apply=true}={}){
 const db=await PGlite.create();t.after(()=>db.close());
 await db.exec(`
  create role anon;create role authenticated;create role service_role bypassrls;create role auth_admin;
  create schema auth;create schema storage;
  create table auth.users(id uuid primary key);
  create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
  create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
  grant usage on schema auth,storage to authenticated;grant execute on function auth.uid(),storage.foldername(text) to authenticated;
  grant usage on schema auth to auth_admin;grant select,delete on auth.users to auth_admin;
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to authenticated;
  grant usage on schema storage to service_role;
  grant select,insert,update on storage.objects to service_role;
  create policy "Avatar Insert" on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
  create policy "Avatar Update" on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
  create policy "Avatar Select Own" on storage.objects for select to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
  create policy "Avatar Delete" on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
  create table public.profiles(id uuid primary key references auth.users(id) on delete cascade);
  create table public.exercises(id uuid primary key default gen_random_uuid(),created_by uuid references auth.users(id) on delete cascade,is_custom boolean,name text);
  create table public.workouts(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),name text);
  create table public.workout_exercises(id uuid primary key default gen_random_uuid(),workout_id uuid references public.workouts(id),exercise_id uuid references public.exercises(id));
  create table public.sets(id uuid primary key default gen_random_uuid(),workout_id uuid references public.workouts(id),exercise_id uuid references public.exercises(id),weight numeric);
  create table public.workout_templates(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id));
  create table public.template_exercises(id uuid primary key default gen_random_uuid(),template_id uuid references public.workout_templates(id),exercise_id uuid references public.exercises(id));
  create table public.routines(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id));
  create table public.routine_exercises(id uuid primary key default gen_random_uuid(),routine_id uuid references public.routines(id),exercise_id uuid references public.exercises(id));
  create table public.body_measurements(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id));
  create table public.workout_comments(id uuid primary key default gen_random_uuid(),user_id uuid,workout_id uuid references public.workouts(id));
  create table public.workout_likes(id uuid primary key default gen_random_uuid(),user_id uuid,workout_id uuid references public.workouts(id));
  create table public.friends(id uuid primary key default gen_random_uuid(),user_low_id uuid,user_high_id uuid);
  create table public.friend_requests(id uuid primary key default gen_random_uuid(),from_user_id uuid,to_user_id uuid);
 `);
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20260727091000_delete_own_account.sql'),'utf8'));
 await db.exec("alter function public.delete_own_account() set search_path=''");
 await db.query('insert into auth.users values($1),($2)',[owner,other]);
 for(const id of [owner,other]){
  await db.query('insert into public.profiles values($1)',[id]);await db.query('insert into auth.sessions(user_id) values($1)',[id]);
  if(history){
   const exercise=(await db.query('insert into public.exercises(created_by,is_custom,name) values($1,true,$2) returning id',[id,id===owner?'Original':'Independent copy'])).rows[0].id;
   const workout=(await db.query('insert into public.workouts(user_id,name) values($1,$2) returning id',[id,'Keep my history'])).rows[0].id;
   await db.query('insert into public.workout_exercises(workout_id,exercise_id) values($1,$2)',[workout,exercise]);
   await db.query('insert into public.sets(workout_id,exercise_id,weight) values($1,$2,37.5)',[workout,exercise]);
  }
 }
 if(apply)await db.exec(migration);return db;
}
async function as(db,id=owner){await db.query("select set_config('test.user_id',$1,false)",[id]);await db.exec('set role authenticated');}
async function count(db,table,id=owner){return(await db.query('select count(*)::int as n from '+table+' where id=$1',[id])).rows[0].n;}
async function avatar(db,id=owner){await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)",[id+'/avatar.png']);}
test('the legacy account RPC cannot bypass remaining avatar cleanup',async t=>{
 const db=await fixture(t);await avatar(db);await as(db);
 await assert.rejects(db.query('select public.delete_own_account()'),error=>error.code==='23503'&&error.hint==='account_avatar_cleanup_required');
 await db.exec('reset role');assert.equal(await count(db,'auth.users'),1);assert.equal(await count(db,'public.profiles'),1);
});
test('Auth administration also preserves an account while its avatar remains',async t=>{
 const db=await fixture(t,{history:false});await avatar(db);await db.exec('set role auth_admin');
 await assert.rejects(db.query('delete from auth.users where id=$1',[owner]),error=>error.code==='23503'&&error.hint==='account_avatar_cleanup_required');
 await db.exec('reset role');assert.equal(await count(db,'auth.users'),1);
});
test('a removed account claim cannot create an avatar',async t=>{
 const db=await fixture(t);await db.query('select set_config($1,$2,false)',['test.user_id',owner]);
 await db.query('select public.delete_own_account()');await as(db);
 await assert.rejects(avatar(db),error=>error.hint==='avatar_account_unavailable');
});
test('the actual Storage write requires a live owner even for a privileged writer',async t=>{
 const db=await fixture(t,{history:false});await avatar(db,other);
 await db.query('delete from auth.users where id=$1',[owner]);
 await db.exec('set role service_role');
 await assert.rejects(avatar(db),error=>error.hint==='avatar_account_unavailable');
 await assert.rejects(db.query("update storage.objects set name=$1 where name=$2",[owner+'/avatar.png',other+'/avatar.png']),error=>error.hint==='avatar_account_unavailable');
 await db.query("insert into storage.objects(bucket_id,name) values('unrelated','existing-behaviour.png')");
 const paths=(await db.query('select name from storage.objects order by name')).rows.map(row=>row.name);
 assert.deepEqual(paths,[other+'/avatar.png','existing-behaviour.png']);
});
test('normal deletion retains the independent copy and other account history',async t=>{
 const db=await fixture(t);
 const before=(await db.query('select row_to_json(s) as row from public.sets s join public.workouts w on w.id=s.workout_id where w.user_id=$1',[other])).rows;
 await as(db);await db.query('select public.delete_own_account()');await db.exec('reset role');
 assert.equal(await count(db,'auth.users'),0);assert.equal(await count(db,'public.profiles'),0);
 assert.equal((await db.query('select count(*)::int as n from auth.sessions where user_id=$1',[owner])).rows[0].n,0);
 assert.equal(await count(db,'auth.users',other),1);
 assert.deepEqual((await db.query('select row_to_json(s) as row from public.sets s join public.workouts w on w.id=s.workout_id where w.user_id=$1',[other])).rows,before);
 assert.equal((await db.query('select name from public.exercises where created_by=$1',[other])).rows[0].name,'Independent copy');
});
test('the bound RPC rejects another account and tolerates a completed retry',async t=>{
 const db=await fixture(t);await as(db);
 await assert.rejects(db.query('select public.delete_own_account($1::uuid)',[other]),error=>error.code==='42501');
 await db.query('select public.delete_own_account($1::uuid)',[owner]);
 await db.query('select public.delete_own_account($1::uuid)',[owner]);
 await db.exec('reset role');assert.equal(await count(db,'auth.users',other),1);assert.equal(await count(db,'auth.users'),0);
});
test('the new entry points keep an empty path and explicit authenticated grants',async t=>{
 const db=await fixture(t);
 const query="select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated from pg_proc p where p.oid=$1::regprocedure";
 const wrapper=(await db.query(query,['public.delete_own_account(uuid)'])).rows[0];
 assert.equal(wrapper.prosecdef,false);assert.equal(wrapper.anon,false);assert.equal(wrapper.authenticated,true);assert.ok(wrapper.proconfig.includes('search_path=""'));
 const trigger=(await db.query(query,['private.require_account_avatar_cleanup()'])).rows[0];
 assert.equal(trigger.prosecdef,true);assert.equal(trigger.anon,false);assert.equal(trigger.authenticated,false);assert.ok(trigger.proconfig.includes('search_path=""'));
 const storageTrigger=(await db.query(query,['private.require_live_avatar_owner()'])).rows[0];
 assert.equal(storageTrigger.prosecdef,true);assert.equal(storageTrigger.anon,false);assert.equal(storageTrigger.authenticated,false);assert.ok(storageTrigger.proconfig.includes('search_path=""'));
});
test('account deletion refuses a stale transaction snapshot',async t=>{
 const db=await fixture(t,{history:false});await db.exec('begin isolation level repeatable read');
 await db.query('select count(*) from auth.users');
 await assert.rejects(db.query('delete from auth.users where id=$1',[owner]),error=>error.code==='25001');
 await db.exec('rollback');assert.equal(await count(db,'auth.users'),1);
});
test('existing orphan avatar metadata aborts the migration without deleting it',async t=>{
 const db=await fixture(t,{history:false,apply:false});
 const ghost='00000000-0000-0000-0000-000000000099';
 await avatar(db,ghost);
 const before=(await db.query('select * from storage.objects')).rows;
 await assert.rejects(db.exec(migration),/Existing avatar objects without an account need review/);
 await db.exec('rollback');
 assert.deepEqual((await db.query('select * from storage.objects')).rows,before);
 assert.equal((await db.query("select count(*)::int as n from pg_trigger where tgname='auth_user_avatar_cleanup'")).rows[0].n,0);
});
