const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const original = fs.readFileSync('supabase/migrations/20261026221000_batched_read_models.sql', 'utf8').split('$$;')[0] + '$$;';
const migration = 'supabase/migrations/20261107132414_record_summary_history_aggregation.sql';
const candidate = fs.existsSync(migration) ? fs.readFileSync(migration, 'utf8') : original;
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const body = sql => sql.split('$$')[1];
const sorted = rows => rows.sort((a,b) => (a.workout_id + a.exercise_id).localeCompare(b.workout_id + b.exercise_id));

async function setup(t) {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table workouts(id uuid primary key,user_id uuid,start_time timestamptz,end_time timestamptz);
    create table sets(id uuid primary key default gen_random_uuid(),workout_id uuid,exercise_id uuid,weight numeric,reps integer);
    create index on workouts(user_id,start_time);
    create index on sets(workout_id,exercise_id);
    insert into workouts
      select md5('w'||i)::uuid, '${owner}', '2026-01-01Z'::timestamptz + (i/2)*interval '1 day',
        case when i%17=0 then null else '2026-12-01Z'::timestamptz end
      from generate_series(1,300) i;
    insert into sets(workout_id,exercise_id,weight,reps)
      select md5('w'||i)::uuid,md5('e'||e)::uuid,
        case when n%11=0 then null else (i%70+n)::numeric/10 end,
        case when n%13=0 then null else n%10 end
      from generate_series(1,300) i cross join generate_series(1,4) e cross join generate_series(1,20) n;
    insert into workouts values (md5('hidden')::uuid,'${other}','2025-01-01Z','2025-01-01Z');
    insert into sets(workout_id,exercise_id,weight,reps) values (md5('hidden')::uuid,md5('e1')::uuid,99999,99);
    insert into workouts values (md5('null-time')::uuid,'${owner}',null,null),(md5('empty')::uuid,'${owner}','2026-11-01Z','2026-11-01Z');
    insert into sets(workout_id,exercise_id,weight,reps) values (md5('null-time')::uuid,md5('e1')::uuid,-1,0),(md5('w1')::uuid,null,99999,99);
    alter table workouts enable row level security;
    alter table sets enable row level security;
    create policy visible_workouts on workouts for select to authenticated using(user_id=auth.uid());
    create policy visible_sets on sets for select to authenticated using(exists(select 1 from workouts w where w.id=workout_id));
    grant select on workouts,sets to authenticated;
  `);
  await db.exec(original);
  await db.exec(`revoke all on function public.workout_record_summaries(uuid[]) from public, anon; grant execute on function public.workout_record_summaries(uuid[]) to authenticated;`);
  await db.exec(candidate.replace('public.workout_record_summaries(', 'public.optimized_record_summaries('));
  await db.exec(`revoke all on function public.optimized_record_summaries(uuid[]) from public, anon; grant execute on function public.optimized_record_summaries(uuid[]) to authenticated; analyze; set role authenticated; set test.user_id='${owner}';`);
  return db;
}

test('record history aggregation preserves chronology, ties, nulls, duplicate IDs and RLS', async t => {
  const db = await setup(t);
  const ids = (await db.query(`select id from workouts order by start_time desc nulls last limit 25`)).rows.map(r => r.id);
  for (const input of [ids, [ids[0], ids[0]], [], null]) {
    const a = (await db.query('select public.workout_record_summaries($1::uuid[]) value',[input])).rows[0].value;
    const b = (await db.query('select public.optimized_record_summaries($1::uuid[]) value',[input])).rows[0].value;
    assert.deepEqual(sorted(b),sorted(a));
  }
  await db.exec('reset role;');
  const extra=(await db.query(`select id from workouts where id in (md5('hidden')::uuid,md5('w1')::uuid,md5('w2')::uuid,md5('null-time')::uuid,md5('empty')::uuid)`)).rows.map(r=>r.id);
  await db.exec('set role authenticated');
  const rpc=async name=>(await db.query(`select public.${name}($1::uuid[]) value`,[extra])).rows[0].value;
  assert.deepEqual(sorted(await rpc('optimized_record_summaries')),sorted(await rpc('workout_record_summaries')));
  await db.exec(`set test.user_id='${other}'`);
  assert.deepEqual(sorted(await rpc('optimized_record_summaries')),sorted(await rpc('workout_record_summaries')));
  await db.exec('reset role');
  await db.exec(`create policy shared_workouts on workouts for select to authenticated using(current_setting('test.share',true)='on'); set role authenticated; set test.user_id='${owner}'; set test.share='on'`);
  const shared=await rpc('optimized_record_summaries');
  assert.deepEqual(sorted(shared),sorted(await rpc('workout_record_summaries')));
  assert.ok(shared.some(r=>!r.has_history));
  const allIds=(await db.query('select id from workouts')).rows.map(r=>r.id);
  const oldAll=(await db.query('select public.workout_record_summaries($1::uuid[]) value',[allIds])).rows[0].value;
  const newAll=(await db.query('select public.optimized_record_summaries($1::uuid[]) value',[allIds])).rows[0].value;
  assert.deepEqual(sorted(newAll),sorted(oldAll));
  await db.exec('reset role');
  await db.exec(candidate);
  await db.exec(candidate);
  const metadata=(await db.query(`select p.prosecdef,p.provolatile,has_function_privilege('anon',p.oid,'execute') anonymous,has_function_privilege('authenticated',p.oid,'execute') authenticated from pg_proc p where p.oid='public.workout_record_summaries(uuid[])'::regprocedure`)).rows[0];
  assert.deepEqual(metadata,{prosecdef:false,provolatile:'s',anonymous:false,authenticated:true});
  await db.exec('set role anon');
  await assert.rejects(db.query('select public.workout_record_summaries($1::uuid[])',[ids]),/permission denied/);
});

test('a twenty-workout page reduces intermediate rows without changing its result', async t => {
  const db=await setup(t);
  const ids=(await db.query('select id from workouts order by start_time desc limit 20')).rows.map(r=>r.id);
  const work=plan=>Number(plan['Actual Rows'])*Number(plan['Actual Loops'])+(plan.Plans??[]).reduce((n,p)=>n+work(p),0);
  const results=[];
  for(const sql of [original,candidate]) {
    const result=await db.query('explain (analyze,format json) '+body(sql).replaceAll('p_workout_ids','$1::uuid[]'),[ids]);
    const plan=result.rows[0]['QUERY PLAN'][0];
    results.push({rows:work(plan.Plan),ms:plan['Execution Time']});
  }
  t.diagnostic(JSON.stringify({baseline:results[0],candidate:results[1]}));
  assert.ok(results[1].rows < results[0].rows*0.7,'must reduce intermediate row processing by at least 30%');
});
