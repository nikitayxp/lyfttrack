const assert=require('node:assert/strict');
const {test}=require('node:test');
const createSourceLoader=require('./load-source.cjs');
const owner='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';

function app(options={}){
 let active=options.initialAccount??owner,lostReply=options.lostReply;
 const accounts=new Set([owner,other]);
 const files=new Set(options.files||[owner+'/avatar.png',other+'/keep.png']);
 const finalCalls=[],signOuts=[],removed=[],cleared=[];
 let affected=0;
 const supabase={
  auth:{
   getSession:async()=>({data:{session:active?{user:{id:active},access_token:'fixture'}:null},error:null}),
   getUser:async()=>accounts.has(active)?{data:{user:{id:active}},error:null}:{data:{user:null},error:{message:'User no longer exists'}},
   signOut:async input=>{signOuts.push(input);active=null;return{error:null};},
  },
  rpc:async(name,args)=>{
   assert.equal(name,'delete_own_account');finalCalls.push({name,args});
   if(args?.p_expected_user_id&&args.p_expected_user_id!==active)return{data:null,error:{code:'42501',message:'Account changed while deleting. Please try again.'}};
   if(accounts.delete(active))affected++;
   if(options.swapAfterDelete)active=other;
   if(lostReply){lostReply=false;return{data:null,error:{message:'Response lost after commit'}};}
   return{data:null,error:null};
  },
  storage:{from:bucket=>{
   assert.equal(bucket,'avatars');
   return{
    list:async(prefix,listOptions={})=>{
     if(options.listError)return{data:null,error:{message:'Storage list failed'}};
     if(prefix.split('/')[0]!==active)return{data:[],error:null};
     const entries=new Map();
     for(const file of files){
      if(!file.startsWith(prefix+'/'))continue;
      const relative=file.slice(prefix.length+1),name=relative.split('/')[0];
      entries.set(name,{name,id:relative.includes('/')?null:name});
     }
     const all=[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name));
     const offset=listOptions.offset||0;return{data:all.slice(offset,offset+(listOptions.limit||100)),error:null};
    },
    remove:async paths=>{
     if(options.removeError)return{data:null,error:{message:'Storage remove failed'}};
     for(const file of paths){if(file.startsWith(active+'/')&&files.delete(file))removed.push(file);}
     if(options.swapDuringCleanup)active=other;
     return{data:[],error:null};
    },
   };
  }},
 };
 const deleteAccountForCurrentSession=async id=>{
  const result=await supabase.rpc('delete_own_account',{p_expected_user_id:id});
  if(result.error)return{error:result.error,accountChanged:false};
  if(active!==id)return{error:null,accountChanged:true};
  active=null;cleared.push(id);return{error:null,accountChanged:false};
 };
 const load=createSourceLoader({'@/services/supabase':{supabase,deleteAccountForCurrentSession},'@/services/authSessionStore':{onAuthAccountChange(){}},'expo-image-picker':{}});
 return{service:load('app/src/services/profileService.ts'),accounts,files,removed,finalCalls,signOuts,cleared,affected:()=>affected};
}

for(const failure of ['listError','removeError']){
 test('a '+failure+' keeps the account and leaves cleanup retryable',async()=>{
  const subject=app({[failure]:true});
  await assert.rejects(subject.service.deleteOwnAccount(owner),error=>error.reason==='avatar-cleanup-failed');
  assert.equal(subject.finalCalls.length,0);assert.equal(subject.signOuts.length,0);
  assert.ok(subject.accounts.has(owner));assert.ok(subject.files.has(owner+'/avatar.png'));
 });
}
test('all pages and nested avatar folders are cleaned before the bound account deletion',async()=>{
 const own=Array.from({length:115},(_,i)=>owner+'/photo-'+String(i).padStart(3,'0')+'.png');
 const subject=app({files:[...own,owner+'/nested/deeper/photo.png',other+'/keep.png']});
 await subject.service.deleteOwnAccount(owner);
 assert.equal([...subject.files].filter(file=>file.startsWith(owner+'/')).length,0);
 assert.ok(subject.files.has(other+'/keep.png'));assert.ok(subject.accounts.has(other));
 assert.equal(subject.finalCalls[0].args?.p_expected_user_id,owner);
 assert.equal(subject.cleared[0],owner);assert.equal(subject.signOuts.length,0);
});
test('an account switch during cleanup cannot delete or sign out the new account',async()=>{
 const subject=app({swapDuringCleanup:true});
 await assert.rejects(subject.service.deleteOwnAccount(owner),error=>error.reason==='account-changed');
 assert.ok(subject.accounts.has(other));assert.equal(subject.signOuts.length,0);
});
test('a deletion confirmed for one account never starts cleanup for a different current account',async()=>{
 const subject=app({initialAccount:other});
 await assert.rejects(subject.service.deleteOwnAccount(owner),error=>error.reason==='account-changed');
 assert.equal(subject.finalCalls.length,0);assert.equal(subject.removed.length,0);
 assert.ok(subject.accounts.has(owner));assert.ok(subject.accounts.has(other));
});
test('an account switch after the deletion response keeps the new session',async()=>{
 const subject=app({swapAfterDelete:true});
 await assert.rejects(subject.service.deleteOwnAccount(owner),error=>error.reason==='account-changed');
 assert.ok(subject.accounts.has(other));assert.equal(subject.signOuts.length,0);
});
test('a lost response can be retried with the old session after the account is gone',async()=>{
 const subject=app({lostReply:true});
 await assert.rejects(subject.service.deleteOwnAccount(owner),/Response lost after commit/);
 assert.equal(subject.accounts.has(owner),false);
 await subject.service.deleteOwnAccount(owner);
 assert.equal(subject.affected(),1);assert.equal(subject.cleared[0],owner);assert.equal(subject.signOuts.length,0);
 assert.ok(subject.accounts.has(other));
});
