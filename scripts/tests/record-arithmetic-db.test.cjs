const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const loadSource = require('./load-source.cjs');

test('SQL record baselines match JavaScript arithmetic for repeated and fractional sets', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  const owner = '00000000-0000-0000-0000-000000000001';
  const previous = '20000000-0000-0000-0000-000000000001';
  const current = '20000000-0000-0000-0000-000000000002';
  const samples = [[100, 3], [0.1, 3], [10.09, 11], [82.5, 7], [33.33, 13], [99.99, 19]].map(([weight,reps], i) => ({
    exerciseId: `10000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`, weight, reps,
  }));
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select '${owner}'::uuid $$;
    create table profiles(id uuid primary key,username text);
    create table workouts(id uuid primary key,user_id uuid,name text,start_time timestamptz,end_time timestamptz);
    create table sets(id uuid primary key default gen_random_uuid(),workout_id uuid,exercise_id uuid,weight numeric,reps integer,set_number integer,rir integer,set_type text);
    create table workout_exercises(id uuid primary key,workout_id uuid,exercise_id uuid,rest_time integer);
    create table workout_comments(id uuid primary key,workout_id uuid,user_id uuid,content text,created_at timestamptz);
    insert into workouts values ('${previous}','${owner}','Previous','2026-09-01Z','2026-09-01Z'),('${current}','${owner}','Current','2026-10-01Z','2026-10-01Z');
  `);
  for (const workoutId of [previous,current]) for (const sample of samples) {
    await db.query('insert into sets(workout_id,exercise_id,weight,reps) values($1,$2,$3,$4)', [workoutId,sample.exerciseId,sample.weight,sample.reps]);
  }
  await db.exec(fs.readFileSync('supabase/migrations/20261026221000_batched_read_models.sql','utf8'));
  const workout = {id:current,user_id:owner,name:'Current',start_time:'2026-10-01T00:00:00Z',end_time:'2026-10-01T00:00:00Z'};
  const sets = samples.map((sample,i) => ({id:`s${i}`,workout_id:current,exercise_id:sample.exerciseId,weight:sample.weight,reps:sample.reps,set_number:1,set_type:'normal',exercises:{id:sample.exerciseId,name:`Exercise ${i}`}}));
  const supabase = {
    async rpc(name,args) {
      const result = name === 'workout_record_summaries'
        ? await db.query('select public.workout_record_summaries($1::uuid[]) value',[args.p_workout_ids])
        : await db.query('select public.exercise_training_references($1::uuid[],$2::uuid) value',[args.p_exercise_ids,args.p_excluded_workout_id]);
      return {data:result.rows[0].value,error:null};
    },
    from(table) {
      let cursor = '';
      const q = {
        select(){return q;},eq(){return q;},in(){return q;},order(){return q;},range(){return q;},
        gt(_key,value){cursor=value;return q;},
        then(resolve,reject){return Promise.resolve({data:(table==='workouts'?[workout]:table==='sets'?sets:[]).filter(row=>row.id>cursor),error:null}).then(resolve,reject);},
      };
      return q;
    },
  };
  const load = loadSource({'@/services/supabase':{supabase},'@/services/authUserService':{getSessionUserOrThrow:async()=>({id:owner})}});
  const service = load('app/src/services/workoutService.ts');
  const {findPersonalRecordExerciseIds,isRecordSet} = load('app/src/utils/personalRecords.ts');
  assert.equal(findPersonalRecordExerciseIds(samples,samples).length,0);
  assert.equal((await service.getUserWorkouts(owner))[0].prCount,0,'repeating a set cannot become a PR through SQL rounding');
  const summaries = (await supabase.rpc('workout_record_summaries',{p_workout_ids:[current]})).data;
  const references = await service.getExerciseReferenceData(samples.map(sample=>sample.exerciseId),current);
  for (const sample of samples) {
    const expected = sample.weight*(1+sample.reps/30);
    assert.equal(summaries.find(row=>row.exercise_id===sample.exerciseId).best_e1rm,expected);
    assert.equal(references.bests[sample.exerciseId].bestE1rm,expected);
    assert.equal(isRecordSet(sample,references.bests[sample.exerciseId]),false);
  }
});
