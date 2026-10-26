const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const exercise = '30000000-0000-0000-0000-000000000001';
const privateExercise = '30000000-0000-0000-0000-000000000002';
const otherTemplate = '40000000-0000-0000-0000-000000000001';
const header = { session_started_at: '2026-10-18T10:00:00Z', name: 'Treino', notes: null, template_id: null, start_time: '2026-10-18T10:00:00Z', end_time: '2026-10-18T10:30:00Z' };
const exercises = [{ exercise_id: exercise, order: 1, rest_time: 90, notes: 'Controlled' }];
const set = { exercise_id: exercise, set_number: 1, weight: 30.25, reps: 8, rir: 2, set_type: 'normal', side: 'both' };

test('atomic imports, repairs and templates retain data and identity', async t => {
  const db = await PGlite.create(); t.after(() => db.close());
  await db.exec(`
    create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${owner}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    create table exercises (id uuid primary key default gen_random_uuid(), created_by uuid, name text, name_en text, name_pt text, is_custom boolean, muscle_group text, equipment text);
    create table workout_templates (id uuid primary key default gen_random_uuid(), user_id uuid, name text, notes text, created_at timestamptz default now()); create table template_exercises (id uuid primary key default gen_random_uuid(), template_id uuid references workout_templates(id), exercise_id uuid references exercises(id), order_index integer, rest_seconds integer);
    create table workouts (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null, notes text, template_id uuid references workout_templates(id), start_time timestamptz, end_time timestamptz);
    create table workout_exercises (id uuid primary key default gen_random_uuid(), workout_id uuid references workouts(id), exercise_id uuid references exercises(id), "order" integer, rest_time integer, notes text);
    create table sets (id uuid primary key default gen_random_uuid(), workout_id uuid references workouts(id), workout_exercise_id uuid references workout_exercises(id), exercise_id uuid references exercises(id), set_number integer, weight numeric, reps integer, rir integer, set_type text, side text);
    insert into exercises (id, created_by) values ('${exercise}', null), ('${privateExercise}', '${other}');
    insert into workout_templates (id, user_id) values ('${otherTemplate}', '${other}');
    alter table exercises enable row level security; alter table workouts enable row level security; alter table workout_exercises enable row level security; alter table sets enable row level security;
    create policy exercise_read on exercises for select to authenticated using (created_by is null or created_by = auth.uid());
    create policy workout_read on workouts for select to authenticated using (true);
    create policy workout_insert on workouts for insert to authenticated with check (user_id = auth.uid());
    create policy workout_update on workouts for update to authenticated using (user_id = auth.uid());
    create policy relation_read on workout_exercises for select to authenticated using (true);
    create policy relation_insert on workout_exercises for insert to authenticated with check (exists(select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));
    create policy set_read on sets for select to authenticated using (true);
    create policy set_insert on sets for insert to authenticated with check (exists(select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));
    grant select on exercises, workout_templates to authenticated;
    grant select, insert, update on workouts to authenticated; grant select, insert on workout_exercises, sets to authenticated;
    alter default privileges in schema public grant all on tables to authenticated, anon;
  `);
  await db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261018140000_atomic_workout_creation.sql'), 'utf8'));

  const migration = path.resolve(__dirname, '../../supabase/migrations/20261026220000_atomic_import_templates.sql');
  assert.ok(fs.existsSync(migration), 'atomic import/template migration must exist');
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await db.exec(`
    alter table workout_templates enable row level security; alter table template_exercises enable row level security;
    create policy template_owner on workout_templates for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy template_child on template_exercises for all to authenticated using (exists(select 1 from workout_templates t where t.id=template_id and t.user_id=auth.uid()));
    create policy workout_delete on workouts for delete to authenticated using (user_id=auth.uid());
    create policy relation_delete on workout_exercises for delete to authenticated using (exists(select 1 from workouts w where w.id=workout_id and w.user_id=auth.uid()));
    create policy exercise_insert on exercises for insert to authenticated with check (created_by=auth.uid() and is_custom);
    grant insert on exercises to authenticated;
    create policy set_delete on sets for delete to authenticated using (exists(select 1 from workouts w where w.id=workout_id and w.user_id=auth.uid()));
    grant all on workout_templates, template_exercises to authenticated;
    grant update, delete on workouts, workout_exercises, sets to authenticated;
    create policy relation_update on workout_exercises for update to authenticated using (exists(select 1 from workouts w where w.id=workout_id and w.user_id=auth.uid()));
    create policy set_update on sets for update to authenticated using (exists(select 1 from workouts w where w.id=workout_id and w.user_id=auth.uid()));
    set role authenticated; set test.user_id = '${owner}';
  `);
  const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`, args.map(a => a && typeof a === 'object' ? JSON.stringify(a) : a))).rows[0].result;
  const batch = [{workout:header, exercises, sets:[set]}];
  const importBatch = b => rpc('import_workouts_atomic', [owner, '70000000-0000-0000-0000-000000000001', b]);
  await t.test('late batch failure rolls back earlier complete workouts', async()=> {
    await assert.rejects(importBatch([...batch,{workout:{...header,start_time:'2026-10-19T10:00:00Z',session_started_at:'2026-10-19T10:00:00Z',end_time:'2026-10-19T11:00:00Z'},exercises,sets:[{...set,reps:-1}]}]));
    assert.equal((await db.query('select count(*)::int n from workouts')).rows[0].n,0);
  });
  let id;
  await t.test('lost response and queued import retries do not duplicate history', async()=> {
    const [a,b] = await Promise.all([importBatch(batch),importBatch(batch)]); id=a.workout_ids[0];
    assert.equal(b.workout_ids[0],id); assert.deepEqual(b,a); assert.equal((await db.query('select count(*)::int n from workouts')).rows[0].n,1);
  });
  const templateId='40000000-0000-0000-0000-000000000003';
  const entries=[{exercise_id:exercise,order_index:1,rest_seconds:90}];
  const save=(mutation,name='Template',list=entries,expected=null)=>rpc('save_template_atomic',[owner,mutation,templateId,name,list,expected]);
  const mutation='50000000-0000-0000-0000-000000000001';
  await t.test('template creation retry returns same identity and failed replacement rolls back',async()=> {
    await save(mutation); await save(mutation);
    assert.equal((await db.query('select count(*)::int n from workout_templates where id=$1',[templateId])).rows[0].n,1);
    const snapshot=(await db.query('select public.template_snapshot($1) s',[templateId])).rows[0].s;
    await assert.rejects(save('50000000-0000-0000-0000-000000000002','Changed',[...entries,{exercise_id:privateExercise,order_index:2,rest_seconds:90}],snapshot));
    assert.equal((await db.query('select name from workout_templates where id=$1',[templateId])).rows[0].name,'Template');
    assert.equal((await db.query('select count(*)::int n from template_exercises')).rows[0].n,1);
  });
  await t.test('stale template writes reject without replacing a newer edit',async()=> {
    const snapshot=(await db.query('select public.template_snapshot($1) s',[templateId])).rows[0].s;
    await save('50000000-0000-0000-0000-000000000003','Newer',entries,snapshot);
    await assert.rejects(save('50000000-0000-0000-0000-000000000004','Stale',entries,snapshot),/changed/);
    await save(mutation);
    assert.equal((await db.query('select name from workout_templates where id=$1',[templateId])).rows[0].name,'Newer');
  });
  const repair=(mutation,relations=exercises,sets=[set],snapshot=null)=>rpc('repair_imported_workout_atomic',[owner,mutation,id,header,relations,sets,'rebuild',snapshot]);
  await t.test('failed repair restores old history and repeat repair is idempotent',async()=> {
    const snapshot=(await db.query('select public.import_workout_snapshot($1) s',[id])).rows[0].s;
    await assert.rejects(repair('60000000-0000-0000-0000-000000000001',exercises,[{...set,reps:-1}],snapshot));
    assert.equal((await db.query('select weight::float from sets where workout_id=$1',[id])).rows[0].weight,30.25);
    await repair('60000000-0000-0000-0000-000000000002',exercises,[{...set,weight:45}],snapshot);
    await repair('60000000-0000-0000-0000-000000000002',exercises,[{...set,weight:45}],snapshot);
    await assert.rejects(repair('60000000-0000-0000-0000-000000000003',exercises,[set],snapshot),/changed/);
    assert.equal((await db.query('select weight::float from sets where workout_id=$1',[id])).rows[0].weight,45);
  });
  await t.test('remapping preserves edited sets and notes while changing exercise references atomically',async()=> {
    await db.exec('reset role');
    const replacement='30000000-0000-0000-0000-000000000003';
    await db.query('insert into exercises(id,created_by) values($1,null)',[replacement]);
    await db.exec(`set role authenticated; set test.user_id='${owner}'`);
    await db.exec('reset role');
    await db.query("update workout_exercises set notes='Edited notes',rest_time=123 where workout_id=$1",[id]);
    await db.exec(`set role authenticated; set test.user_id='${owner}'`);
    const before=(await db.query('select id,workout_exercise_id from sets where workout_id=$1',[id])).rows[0];
    const snapshot=(await db.query('select public.import_workout_snapshot($1) s',[id])).rows[0].s;
    await rpc('repair_imported_workout_atomic',[owner,'60000000-0000-0000-0000-000000000005',id,{...header,name:'Renamed'},[{...exercises[0],exercise_id:replacement}],[],'remap',snapshot]);
    const row=(await db.query('select s.exercise_id,s.weight::float,w.name from sets s join workouts w on w.id=s.workout_id where w.id=$1',[id])).rows[0];
    assert.deepEqual(row,{exercise_id:replacement,weight:45,name:'Renamed'});
    assert.deepEqual((await db.query('select id,workout_exercise_id from sets where workout_id=$1',[id])).rows[0],before);
    assert.deepEqual((await db.query('select notes,rest_time from workout_exercises where workout_id=$1',[id])).rows[0],{notes:'Edited notes',rest_time:123});
  });
  await t.test('remapping refuses a legacy unlinked set without deleting or changing any history',async()=>{
    const legacyId='20000000-0000-0000-0000-000000000099';
    await db.query("insert into sets(id,workout_id,workout_exercise_id,exercise_id,set_number,weight,reps,set_type,side) values($1,$2,null,$3,2,99,4,'normal','both')",[legacyId,id,exercise]);
    const before=(await db.query('select id,weight::float,workout_exercise_id from sets where workout_id=$1 order by id',[id])).rows;
    const snapshot=(await db.query('select public.import_workout_snapshot($1) s',[id])).rows[0].s;
    await assert.rejects(rpc('repair_imported_workout_atomic',[owner,'60000000-0000-0000-0000-000000000009',id,header,exercises,[],'remap',snapshot]),/unmapped|mapping/i);
    assert.deepEqual((await db.query('select id,weight::float,workout_exercise_id from sets where workout_id=$1 order by id',[id])).rows,before);
    await db.query('delete from sets where id=$1',[legacyId]);
  });
  await t.test('data edited after preview cannot be replaced by repair confirmation',async()=>{
    const preview=(await db.query('select public.import_workout_snapshot($1) s',[id])).rows[0].s;
    await db.query('update sets set weight=67 where workout_id=$1',[id]);
    await db.query("update workouts set notes='Latest notes' where id=$1",[id]);
    await assert.rejects(repair('60000000-0000-0000-0000-000000000010',exercises,[set],preview),/changed/);
    assert.equal((await db.query('select weight::float from sets where workout_id=$1',[id])).rows[0].weight,67);
    assert.equal((await db.query('select notes from workouts where id=$1',[id])).rows[0].notes,'Latest notes');
  });
  await t.test('custom exercise resolution is idempotent after a lost response',async()=> {
    const custom=[{name:'Custom Bench',muscle_group:'chest',equipment:'barbell'}];
    const first=await rpc('ensure_import_exercises',[owner,custom]);
    const second=await rpc('ensure_import_exercises',[owner,custom]);
    assert.equal(first.created,1);assert.equal(second.created,0);assert.deepEqual(first.ids,second.ids);
  });
  await t.test('queued competing repairs and template edits cannot overwrite the winning snapshot',async()=>{
    const templateSnapshot=(await db.query('select public.template_snapshot($1) s',[templateId])).rows[0].s;
    const edits=await Promise.allSettled([
      save('50000000-0000-0000-0000-000000000007','Winner A',entries,templateSnapshot),
      save('50000000-0000-0000-0000-000000000008','Winner B',entries,templateSnapshot)
    ]);
    assert.equal(edits.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(edits.filter(result=>result.status==='rejected').length,1);
    const workoutSnapshot=(await db.query('select public.import_workout_snapshot($1) s',[id])).rows[0].s;
    const repairs=await Promise.allSettled([
      repair('60000000-0000-0000-0000-000000000007',exercises,[{...set,weight:50}],workoutSnapshot),
      repair('60000000-0000-0000-0000-000000000008',exercises,[{...set,weight:55}],workoutSnapshot)
    ]);
    assert.equal(repairs.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(repairs.filter(result=>result.status==='rejected').length,1);
  });
  await t.test('account changes and private exercises cannot bypass invoker permissions',async()=> {
    await db.exec(`set test.user_id='${other}'`);
    await assert.rejects(importBatch(batch),/Account changed/);
    await assert.rejects(save('50000000-0000-0000-0000-000000000005'),/Account changed/);
    await assert.rejects(repair('60000000-0000-0000-0000-000000000004'),/Account changed/);
    await db.exec(`set test.user_id='${owner}'`);
    await assert.rejects(save('50000000-0000-0000-0000-000000000006','Bad',[{...entries[0],exercise_id:privateExercise}]));
    await db.exec(`set test.user_id='${other}'`);
    assert.equal(await rpc('template_snapshot',[templateId]),null);
    assert.equal(await rpc('import_workout_snapshot',[id]),null);
    await db.exec('reset role');
    assert.equal((await db.query("select count(*)::int n from pg_proc where proname in ('save_template_atomic','repair_imported_workout_atomic','import_workouts_atomic') and prosecdef")).rows[0].n,0);
  });
  await t.test('mutation receipts cannot be rewritten or removed by their owner',async()=>{
    await db.exec(`set role authenticated; set test.user_id='${owner}'`);
    await assert.rejects(db.query("update public.client_mutation_receipts set fingerprint='forged'"),/permission denied/);
    await assert.rejects(db.query('delete from public.client_mutation_receipts'),/permission denied/);
    await db.exec('reset role');
  });
  await t.test('anonymous execution is denied',async()=>{
    await db.exec('set role anon');
    await assert.rejects(importBatch(batch),/permission denied/);
    await assert.rejects(save('50000000-0000-0000-0000-000000000009'),/permission denied/);
  });
});
