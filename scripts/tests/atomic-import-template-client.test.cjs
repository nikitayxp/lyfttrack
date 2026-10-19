const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

const user = {id:'owner'};
const storageRows = new Map();
const storage = {getItem:async key=>storageRows.get(key)??null,setItem:async(key,value)=>storageRows.set(key,value),removeItem:async key=>storageRows.delete(key)};
const exercises=[{id:'exercise',name:'Bench',name_en:'Bench',name_pt:'Bench',is_custom:false}];
function setup({fail=false, rows=0, serverCap=1000, rpc: rpcOverride}={}) {
  const calls=[];let fails=fail;
  const supabase={
    rpc:async(name,args)=>{calls.push({name,args});if(rpcOverride){const response=await rpcOverride(name,args);if(response)return response;}if(fails){fails=false;return {error:{message:'Response lost'},data:null};} return {error:null,data:name==='import_workout_snapshots'?Object.fromEntries(args.p_workout_ids.map(id=>[id,{name:'Old',notes:null,exercises:[{id:'relation',exercise_id:'exercise',order:1}],sets:[]}])):name==='save_template_atomic'?args.p_template_id:name==='import_workouts_atomic'?{workouts:1,sets:1,skipped:0}:null};},
    from:table=>{
      const query={select(){return query},eq(){return query},gte(){return query},lte(){return query},in(){return query},order(){return query},gt(column,value){query.cursor=value;return query},range(from,to){query.page={from,to};return query},
        maybeSingle:async()=>({data:{id:'template',user_id:user.id,name:'Template',notes:null,created_at:'now'},error:null}),
        then(resolve){if(table==='workouts'){const {from=0,to=999}=query.page??{};resolve({data:Array.from({length:Math.max(0,Math.min(to+1,serverCap,rows-(query.cursor?Number(query.cursor.split('-')[1])+1:0))-from)},(_,i)=>({id:'workout-'+String((query.cursor?Number(query.cursor.split('-')[1])+1:0)+from+i).padStart(4,'0'),name:'Old',start_time:new Date(Date.UTC(2026,0,1,0,(query.cursor?Number(query.cursor.split('-')[1])+1:0)+from+i)).toISOString()})),error:null});}else resolve({data:[],error:null});}};
      return query;
    }
  };
  const dependencies={'@/services/supabase':{supabase},'@react-native-async-storage/async-storage':storage,'expo-router':{router:{}},'@/services/workoutService':{
    getAuthenticatedUserOrThrow:async()=>user,getExercisesCatalog:async()=>exercises,
    normalizeWriteText:v=>v??null,buildSetInsertRow:(wid,draft,rid)=>({workout_id:wid,workout_exercise_id:rid,exercise_id:draft.exerciseId,set_number:draft.setNumber,weight:draft.weight,reps:draft.reps,set_type:draft.setType??'normal',side:'both'})
  }};
  const parsed={workouts:[{title:'Workout',startTime:'2026-01-01T00:00:00.000Z',endTime:'2026-01-01T01:00:00.000Z',description:null,exercises:[{title:'Bench',notes:null,sets:[{setNumber:1,weightKg:20,reps:8,setType:'normal'}]}]}]};
  const parser={parseHevyCsv:()=>parsed,collectExerciseTitles:()=>['Bench']};
  const load=createSourceLoader({...dependencies,'./hevyCsv':parser});
  return {calls,templates:load('app/src/services/templateService.ts'),imports:load('app/src/services/import/importService.ts'),cache:load('app/src/services/dataCache.ts'),parsed};
}

test('template lost-response retries reuse durable identity and never use multiwrite fallback',async()=>{
  storageRows.clear(); const first=setup({fail:true});
  await assert.rejects(first.templates.saveTemplate('Template',['exercise']),/Response lost/);
  assert.equal(first.calls[0]?.name,'save_template_atomic');
  const second=setup();await second.templates.saveTemplate('Template',['exercise']);
  assert.equal(first.calls[0].args.p_mutation_id,second.calls[0].args.p_mutation_id);
  assert.equal(first.calls[0].args.p_template_id,second.calls[0].args.p_template_id);
});

test('import sends complete stable batch to one atomic RPC',async()=>{
  const {imports,calls,parsed}=setup();
  const plan={ownerUserId:'owner',source:'hevy',parse:parsed,matches:[{title:'Bench',exerciseId:'exercise',matchedName:'Bench',kind:'exact'}],duplicateStartTimes:[],repairChanges:[]};
  const result=await imports.runImport(plan);
  assert.equal(result.importedWorkouts,1);assert.equal(calls.length,1);assert.equal(calls[0].name,'import_workouts_atomic');
  assert.equal(calls[0].args.p_batch[0].workout.session_started_at,parsed.workouts[0].startTime);
  assert.equal(calls[0].args.p_batch[0].sets.length,1);
});

test('dedupe lookup reaches history beyond the API page size',async()=>{
  const {imports,parsed}=setup({rows:1001});
  parsed.workouts[0].startTime=new Date(Date.UTC(2026,0,1,0,1000)).toISOString();
  const plan=await imports.buildImportPlan('csv');
  assert.deepEqual([...plan.duplicateStartTimes],[parsed.workouts[0].startTime]);
});

test('dedupe lookup reaches a duplicate beyond a smaller server row cap',async()=>{
  const {imports,parsed}=setup({rows:23,serverCap:10});
  parsed.workouts[0].startTime=new Date(Date.UTC(2026,0,1,0,22)).toISOString();
  const plan=await imports.buildImportPlan('csv');
  assert.deepEqual([...plan.duplicateStartTimes],[parsed.workouts[0].startTime]);
  assert.equal(plan.importableWorkouts,0);
});

test('completing an older retry cannot remove a newer pending identity',async()=>{
  storageRows.clear();
  const load=createSourceLoader({'@react-native-async-storage/async-storage':storage});
  const api=load('app/src/services/pendingMutationService.ts');
  const old=await api.getPendingMutation('owner','create',['same']);
  await api.completePendingMutation(old);
  const current=await api.getPendingMutation('owner','create',['same']);
  await api.completePendingMutation(old);
  const restarted=createSourceLoader({'@react-native-async-storage/async-storage':storage})('app/src/services/pendingMutationService.ts');
  const retry=await restarted.getPendingMutation('owner','create',['same']);
  assert.equal(retry.mutationId,current.mutationId);
});

test('an import preview cannot be executed after changing accounts',async()=>{
  const {imports,calls,parsed}=setup();
  const plan={ownerUserId:'other',source:'hevy',parse:parsed,matches:[],duplicateStartTimes:[],repairChanges:[]};
  await assert.rejects(imports.runImport(plan),/Account changed/);
  assert.equal(calls.length,0);
});

test('template updates submit the original editor snapshot rather than a fresh read',async()=>{
  const {templates,calls}=setup();
  const original={id:'template',user_id:'owner',name:'Editor original',notes:'Original notes',created_at:'now',exercises:[]};
  await templates.updateTemplate('template','Edited locally',['exercise'],original);
  const rpc=calls.find(call=>call.name==='save_template_atomic');
  assert.deepEqual(JSON.parse(JSON.stringify(rpc.args.p_expected_snapshot)),{name:'Editor original',notes:'Original notes',exercises:[]});
});

test('repair confirmation uses its preview snapshot and rejects newer server data',async()=>{
  const original={name:'Old',notes:'Preview notes',exercises:[{id:'relation',workout_id:'workout-0000',exercise_id:'old-exercise',order:1,notes:null,rest_time:90}],sets:[{id:'set',weight:30}]};
  let current=structuredClone(original);
  const {imports,calls}=setup({rows:1,rpc:(name,args)=>{
    if(name==='import_workout_snapshots')return {error:null,data:{'workout-0000':structuredClone(current)}};
    if(name==='import_workout_snapshot')return {error:null,data:structuredClone(current)};
    if(name==='repair_imported_workout_atomic'){
      if(JSON.stringify(args.p_expected_snapshot)!==JSON.stringify(current))return {error:{message:'Workout changed. Reload before repairing.'},data:null};
      current.sets[0].weight=20;return {error:null,data:'workout-0000'};
    }
  }});
  const plan=await imports.buildImportPlan('csv');
  current.notes='Latest notes';current.sets[0].weight=55;
  const result=await imports.runRepair(plan);
  assert.equal(result.repairedWorkouts,0);
  assert.match(result.failedWorkouts[0].reason,/changed/);
  assert.equal(current.sets[0].weight,55);assert.equal(current.notes,'Latest notes');
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find(call=>call.name==='repair_imported_workout_atomic').args.p_expected_snapshot)),original);
});

test('committed import batches invalidate pending references even when a later batch fails',async()=>{
  let batches=0;
  const {imports,parsed,cache}=setup({rpc:name=>{
    if(name!=='import_workouts_atomic')return;
    batches++;
    return batches===1?{error:null,data:{workouts:20,sets:20,skipped:0}}:{error:{message:'Invalid second batch'},data:null};
  }});
  const first=parsed.workouts[0];
  parsed.workouts=Array.from({length:21},(_,i)=>({...first,startTime:new Date(Date.UTC(2026,0,1,0,i)).toISOString()}));
  let release;
  const stale=cache.workoutReferenceCache.get('owner','exercise',()=>new Promise(resolve=>{release=resolve}));
  const other=cache.workoutReferenceCache.get('other','exercise',async()=>44);
  const plan={ownerUserId:'owner',source:'hevy',parse:parsed,matches:[{title:'Bench',exerciseId:'exercise',kind:'exact'}],duplicateStartTimes:[],repairChanges:[]};
  const result=await imports.runImport(plan);
  assert.equal(result.importedWorkouts,20);assert.equal(result.failedWorkouts.length,1);
  const fresh=cache.workoutReferenceCache.get('owner','exercise',async()=>99);
  assert.notEqual(fresh,stale);
  release(11);assert.equal(await stale,11);assert.equal(await fresh,99);
  assert.equal(cache.workoutReferenceCache.get('other','exercise',async()=>0),other);
  assert.equal(await cache.workoutReferenceCache.get('owner','exercise',async()=>0),99);
});

test('custom exercise resolution invalidates catalogue on an idempotent success before a failed import',async()=>{
  const {imports,parsed,cache}=setup({rpc:name=>name==='ensure_import_exercises'
    ?{error:null,data:{ids:['custom-exercise'],created:0}}
    :{error:{message:'Invalid import'},data:null}});
  await cache.exerciseCatalogCache.get('owner','all',async()=>['old']);
  const plan={ownerUserId:'owner',source:'hevy',parse:parsed,matches:[{title:'Bench',exerciseId:null,kind:'none'}],duplicateStartTimes:[],repairChanges:[]};
  await imports.runImport(plan);
  assert.deepEqual(await cache.exerciseCatalogCache.get('owner','all',async()=>['fresh']),['fresh']);
});

test('a successful repair receipt invalidates previous workout reference data',async()=>{
  const {imports,parsed,cache}=setup();
  await cache.workoutReferenceCache.get('owner','exercise',async()=>11);
  const plan={ownerUserId:'owner',source:'hevy',parse:parsed,matches:[{title:'Bench',exerciseId:'exercise',kind:'exact'}],duplicateStartTimes:[],
    repairChanges:[{workoutId:'workout',startTime:parsed.workouts[0].startTime,mode:'remap'}],repairSnapshots:{workout:{name:'Original',exercises:[],sets:[]}}};
  const result=await imports.runRepair(plan);
  assert.equal(result.repairedWorkouts,1);
  assert.equal(await cache.workoutReferenceCache.get('owner','exercise',async()=>99),99);
});
