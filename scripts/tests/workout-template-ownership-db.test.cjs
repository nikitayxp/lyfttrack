const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261116111500_workout_template_ownership.sql'),'utf8');
const owner='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
const ownTemplate='40000000-0000-0000-0000-000000000001';
const otherTemplate='40000000-0000-0000-0000-000000000002';
const workout='50000000-0000-0000-0000-000000000001';

async function fixture(t,apply=true){
  const db=await PGlite.create();
  t.after(()=>db.close());
  await db.exec([
    'create role authenticated; create role anon; create schema auth;',
    'create table auth.users(id uuid primary key);',
    "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;",
    'grant usage on schema auth to authenticated;',
    'create table public.workout_templates(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,name text);',
    'create table public.workouts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),name text,template_id uuid constraint workouts_template_id_fkey references public.workout_templates(id) on delete set null);',
    'create table public.sets(id uuid primary key default gen_random_uuid(),workout_id uuid references public.workouts(id) on delete cascade,weight numeric);',
    'alter table public.workouts enable row level security;',
    'alter table public.workout_templates enable row level security;',
    'create policy workout_owner on public.workouts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());',
    'create policy template_owner on public.workout_templates for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());',
    'grant select,insert,update,delete on public.workouts,public.workout_templates to authenticated;',
  ].join('\n'));
  await db.query('insert into auth.users values($1),($2)',[owner,other]);
  await db.query('insert into public.workout_templates values($1,$2,$3),($4,$5,$6)',[ownTemplate,owner,'Own model',otherTemplate,other,'Other model']);
  await db.query('insert into public.workouts values($1,$2,$3,$4)',[workout,owner,'Existing history',ownTemplate]);
  await db.query('insert into public.sets(workout_id,weight) values($1,37.5)',[workout]);
  if(apply)await db.exec(migration);
  return db;
}
async function asOwner(db){
  await db.query("select set_config('test.user_id',$1,false)",[owner]);
  await db.exec('set role authenticated');
}
async function data(db){
  const result={};
  for(const table of ['workout_templates','workouts','sets']){
    result[table]=(await db.query('select * from public.'+table+' order by id')).rows;
  }
  return result;
}

test('ownership migration preserves existing templates and complete history',async t=>{
  const db=await fixture(t,false);
  await db.query('insert into public.workouts(user_id,name) values($1,$2)',[owner,'No model']);
  const before=await data(db);
  await db.exec(migration);
  assert.deepEqual(await data(db),before);
});

test('direct own-workout writes reject foreign and missing template references',async t=>{
  const db=await fixture(t);
  await asOwner(db);
  for(const id of [otherTemplate,'40000000-0000-0000-0000-000000000099']){
    await assert.rejects(db.query('insert into public.workouts(user_id,name,template_id) values($1,$2,$3)',[owner,'New history',id]),error=>error.code==='23503');
    await assert.rejects(db.query('update public.workouts set template_id=$1 where id=$2',[id,workout]),error=>error.code==='23503');
  }
  assert.equal((await db.query('select template_id from public.workouts where id=$1',[workout])).rows[0].template_id,ownTemplate);
});

test('own and null links stay valid and deleting a model clears only template_id',async t=>{
  const db=await fixture(t);
  const setsBefore=(await db.query('select * from public.sets')).rows;
  await asOwner(db);
  await db.query('insert into public.workouts(user_id,name,template_id) values($1,$2,$3)',[owner,'Own link',ownTemplate]);
  await db.query('insert into public.workouts(user_id,name) values($1,$2)',[owner,'No model']);
  await db.query('delete from public.workout_templates where id=$1',[ownTemplate]);
  const rows=(await db.query('select user_id,template_id from public.workouts')).rows;
  assert.equal(rows.length,3);
  assert.ok(rows.every(row=>row.user_id===owner&&row.template_id===null));
  await db.exec('reset role');
  assert.deepEqual((await db.query('select * from public.sets')).rows,setsBefore);
  assert.equal((await db.query('select id from public.workout_templates')).rows[0].id,otherTemplate);
});

test('a referenced template cannot be moved to another owner',async t=>{
  const db=await fixture(t);
  await assert.rejects(db.query('update public.workout_templates set user_id=$1 where id=$2',[other,ownTemplate]),error=>error.code==='23503');
  assert.equal((await db.query('select user_id from public.workout_templates where id=$1',[ownTemplate])).rows[0].user_id,owner);
});

test('legacy cross-account links require a decision and are not rewritten',async t=>{
  const db=await fixture(t,false);
  await db.query('update public.workouts set template_id=$1 where id=$2',[otherTemplate,workout]);
  const before=await data(db);
  await assert.rejects(db.exec(migration),/existing workout template links need review/i);
  await db.exec('rollback');
  assert.deepEqual(await data(db),before);
});

test('the validated relationship includes owner and nulls only the optional column',async t=>{
  const db=await fixture(t);
  const row=(await db.query([
    'select c.convalidated,',
    '(select array_agg(a.attname order by k.n) from unnest(c.conkey) with ordinality k(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num) as columns,',
    '(select array_agg(a.attname order by k.n) from unnest(c.confkey) with ordinality k(num,n) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num) as referenced,',
    '(select array_agg(a.attname) from unnest(c.confdelsetcols) k(num) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num) as cleared',
    "from pg_constraint c where c.conrelid='public.workouts'::regclass and c.conname='workouts_template_id_fkey'",
  ].join(' '))).rows[0];
  assert.equal(row.convalidated,true);
  assert.deepEqual(row.columns,['template_id','user_id']);
  assert.deepEqual(row.referenced,['id','user_id']);
  assert.deepEqual(row.cleared,['template_id']);
});
