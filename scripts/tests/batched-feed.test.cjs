const assert=require('node:assert/strict');
const {test}=require('node:test');
const loadSource=require('./load-source.cjs');
function setup(authors=20, failRecords=false) {
 const calls=[]; const rpc=[];
 const workouts=Array.from({length:20},(_,i)=>({id:`w${i}`,user_id:`u${i%authors}`,name:'Workout',start_time:'2026-10-19T10:00:00Z',end_time:'2026-10-19T11:00:00Z'}));
 const sets=workouts.map(w=>({id:`s${w.id}`,workout_id:w.id,exercise_id:'e',weight:120,reps:5,set_number:1,exercises:{id:'e',name:'Squat'}}));
 const supabase={rpc:async(name,args)=>{rpc.push({name,args});if(failRecords&&name==='workout_record_summaries')return {data:null,error:{message:'offline'}};return {error:null,data:name==='workout_record_summaries'?workouts.map(w=>({workout_id:w.id,exercise_id:'e',has_history:true,best_weight:100,best_e1rm:116.66666666666667})):[]};},from(table){
  const call={table,cursor:'',range:[0,999],filters:[]};
  const q={select(){return q;},eq(){return q;},not(){return q;},or(){return q;},in(key,ids){call.filters.push(r=>ids.includes(r[key]));return q;},gt(key,value){call.cursor=value;return q;},order(){return q;},range(a,b){call.range=[a,b];return q;},then(resolve,reject){calls.push(call);const rows=(table==='workouts'?workouts:table==='sets'?sets:table==='friends'?Array.from({length:Math.max(0,authors-1)},(_,i)=>({id:`f${i}`,user_low_id:'u0',user_high_id:`u${i+1}`})):[]).filter(r=>r.id>call.cursor&&call.filters.every(f=>f(r))).sort((a,b)=>a.id.localeCompare(b.id));return Promise.resolve({data:rows.slice(...[call.range[0],call.range[1]+1]),error:null}).then(resolve,reject);}};return q;
 }};
 const service=loadSource({'@/services/supabase':{supabase},'@/services/authUserService':{getAuthenticatedUserOrThrow:async()=>({id:'u0'}),getSessionUserOrThrow:async()=>({id:'u0'})}})('app/src/services/workoutService.ts');
 return {service,calls,rpc};
}
test('feed records use one batch regardless of author count and preserve result',async()=>{
 for(const count of [1,5,20]) {const {service,calls,rpc}=setup(count);const feed=await service.getFeedWorkouts();assert.equal(feed.length,20);assert.ok(feed.every(w=>w.prCount===1));assert.equal(calls.length+rpc.length,8);assert.equal(rpc.filter(c=>c.name==='workout_record_summaries').length,1);assert.equal(calls.filter(c=>c.table==='workouts').length,1);assert.equal(rpc.filter(c=>c.name==='latest_workout_comments').length,1);}
});

test('record enrichment failure keeps the feed with an unknown count',async()=>{
 const {service}=setup(20,true);const feed=await service.getFeedWorkouts();assert.equal(feed.length,20);assert.ok(feed.every(row=>row.prCount===null));
});
