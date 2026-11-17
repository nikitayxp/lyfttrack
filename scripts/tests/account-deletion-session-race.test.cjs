const assert=require('node:assert/strict');
const {test}=require('node:test');
const {setImmediate}=require('node:timers/promises');
const {processLock}=require('@supabase/supabase-js');
const createSourceLoader=require('./load-source.cjs');
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
const session=id=>({access_token:'synthetic-'+id,refresh_token:'refresh-'+id,expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',user_metadata:{}}});

function gate(t){
 let enter,release;
 const entered=new Promise(resolve=>{enter=resolve;});
 const released=new Promise(resolve=>{release=resolve;});
 t.after(release);
 return {entered,release,async wait(){enter();await released;}};
}

let fixtureNumber=0;
async function setup(t,{rpcGate,rpcStatus=204,refreshGate,lateLoginGate}={}){
 const project=`session-${++fixtureNumber}`;
 const key=`sb-${project}-auth-token`;
 const values=new Map([[key,JSON.stringify(session(A))],[`${key}-code-verifier`,JSON.stringify('next-login-verifier')]]);
 const requests=[];
 const fetch=async(url,options={})=>{
  const parsed=new URL(String(url));requests.push(parsed.pathname);
  if(parsed.pathname==='/storage/v1/object/list/avatars')return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
  if(parsed.pathname==='/rest/v1/rpc/delete_own_account'){
   assert.equal(new Headers(options.headers).get('authorization'),'Bearer '+session(A).access_token);
   assert.equal(JSON.parse(options.body).p_expected_user_id,A);
   await rpcGate?.wait();
   return new Response(rpcStatus===204?null:JSON.stringify({message:'Deletion not confirmed'}),{status:rpcStatus,headers:{'content-type':'application/json'}});
  }
  if(parsed.pathname==='/auth/v1/token'){
   if(parsed.searchParams.get('grant_type')==='pkce'){
    assert.ok(JSON.parse(options.body).code_verifier);
    return new Response(JSON.stringify(session(B)),{status:200,headers:{'content-type':'application/json'}});
   }
   if(parsed.searchParams.get('grant_type')==='refresh_token'){
    await refreshGate?.wait();
    return new Response(JSON.stringify(session(A)),{status:200,headers:{'content-type':'application/json'}});
   }
   assert.equal(parsed.searchParams.get('grant_type'),'password');
   const id=JSON.parse(options.body).email.startsWith('old-')?A:B;
   if(id===A)await lateLoginGate?.wait();
   return new Response(JSON.stringify(session(id)),{status:200,headers:{'content-type':'application/json'}});
  }
  throw Error('Unexpected fixture request: '+parsed.pathname);
 };
 const load=createSourceLoader({
  'react-native':{Platform:{OS:'web'}},'expo-linking':{createURL:route=>'lyfttrack://'+route},
  '@react-native-async-storage/async-storage':{},'@/utils/authCrypto':{},
  '@/services/supabaseReadFetch':{createSupabaseReadFetch:()=>fetch},
  '@/services/dataCache':{invalidateExerciseCatalogCache(){},invalidateWorkoutDataCache(){}},
  'expo-image-picker':{},
 },{window:{localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}},process:{env:{EXPO_PUBLIC_SUPABASE_URL:`https://${project}.fixture.test`,EXPO_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon'}}});
 const authService=load('app/src/services/supabase.ts');
 const {supabase:client,deleteAccountForCurrentSession}=authService;
 t.after(()=>client.auth.stopAutoRefresh());
 const {subscribeAuthSession}=load('app/src/services/authSessionStore.ts');
 let snapshot;const unsubscribe=subscribeAuthSession(value=>{snapshot=value.session;});t.after(unsubscribe);
 assert.equal((await client.auth.getSession()).data.session.user.id,A);
 await setImmediate();
 assert.equal(snapshot.user.id,A);
 const signIn=email=>client.auth.signInWithPassword({email,password:'fixture'});
 return {key,values,client,requests,signIn,authService,deleteAccountForCurrentSession,snapshot:()=>snapshot,deleteFromProfile:()=>load('app/src/services/profileService.ts').deleteOwnAccount(A)};
}

test('account deletion clears only the deleted session without a shared logout request',async t=>{
 const app=await setup(t);
 await app.deleteFromProfile();
 assert.equal((await app.client.auth.getSession()).data.session,null);
 assert.equal(app.snapshot(),null);
 assert.equal(app.values.has(app.key),false);
 assert.equal(app.values.get(`${app.key}-code-verifier`),JSON.stringify('next-login-verifier'));
 assert.deepEqual(app.requests,['/storage/v1/object/list/avatars','/rest/v1/rpc/delete_own_account']);
});

test('a new login during the bound deletion request survives in the SDK and app store',async t=>{
 const rpc=gate(t),app=await setup(t,{rpcGate:rpc});
 const deletion=app.deleteFromProfile().then(()=>null,error=>error);
 await rpc.entered;
 assert.equal((await app.signIn('new-user@fixture.invalid')).error,null);
 rpc.release();
 assert.equal((await deletion)?.reason,'account-changed');
 assert.equal((await app.client.auth.getSession()).data.session.user.id,B);
 await setImmediate();
 assert.equal(app.snapshot().user.id,B);
 assert.equal(app.requests.includes('/auth/v1/logout'),false);
});

test('the deletion drains a running refresh and guards session reads until removal',async t=>{
 const refresh=gate(t),rpc=gate(t),app=await setup(t,{refreshGate:refresh,rpcGate:rpc});
 const refreshing=app.client.auth.refreshSession();
 await refresh.entered;
 const deletion=app.deleteAccountForCurrentSession(A);
 await setImmediate();
 assert.equal(app.requests.includes('/rest/v1/rpc/delete_own_account'),false);
 refresh.release();
 await rpc.entered;
 assert.equal((await refreshing).error,null);
 let readFinished=false;
 const reading=app.client.auth.getSession().then(value=>{readFinished=true;return value;});
 await setImmediate();
 assert.equal(readFinished,false);
 rpc.release();
 assert.equal((await deletion).error,null);
 assert.equal((await reading).data.session,null);
});

test('an unconfirmed RPC leaves the initiating session intact and retryable',async t=>{
 const app=await setup(t,{rpcStatus:500});
 await assert.rejects(app.deleteFromProfile(),/Deletion not confirmed/);
 assert.equal((await app.client.auth.getSession()).data.session.user.id,A);
 assert.equal(app.values.has(`${app.key}.deleted.${A}`),false);
 assert.equal(app.snapshot().user.id,A);
});

test('an old sign-in response cannot restore the deleted account over a new login',async t=>{
 const late=gate(t),app=await setup(t,{lateLoginGate:late});
 const oldLogin=app.signIn('old-user@fixture.invalid');
 await late.entered;
 await app.deleteFromProfile();
 assert.equal((await app.signIn('new-user@fixture.invalid')).error,null);
 late.release();
 await oldLogin;
 assert.equal((await app.client.auth.getSession()).data.session.user.id,B);
 await setImmediate();
 assert.equal(app.snapshot().user.id,B);
});

test('a pending password request and account deletion leave the following Google verifier usable',async t=>{
 const late=gate(t),rpc=gate(t),app=await setup(t,{lateLoginGate:late,rpcGate:rpc});
 const {signInWithPassword:password,beginOAuthSignIn:oauth}=app.authService;
 const signIn=password({email:'old-user@fixture.invalid',password:'fixture'});
 await late.entered;
 const deleting=app.deleteAccountForCurrentSession(A);
 let oauthStarted=false;
 const starting=oauth({provider:'google',options:{skipBrowserRedirect:true}}).then(value=>{oauthStarted=true;return value;});
 // Before the coordinated implementation this began while the old password was still in flight.
 await setImmediate();
 const overlapped=oauthStarted || app.requests.includes('/rest/v1/rpc/delete_own_account');
 late.release();
 await signIn;
 await rpc.entered;
 rpc.release();
 assert.equal((await deleting).error,null);
 assert.equal((await starting).error,null);
 const exchange=await app.client.auth.exchangeCodeForSession('local-test-code');
 assert.equal(exchange.error,null);
 assert.equal(exchange.data.session.user.id,B);
 assert.equal(overlapped,false);
});

test('a second async adapter preserves a queued new write and filters a deleted identity',async t=>{
 const key='cross-context-auth-session';
 const values=new Map([[key,JSON.stringify(session(A))]]);
 let heldRead;
 const raw={
  async getItem(keyToRead){
   const value=values.get(keyToRead)??null;
   if(heldRead&&keyToRead===key){const current=heldRead;heldRead=null;await current.wait();}
   return value;
  },
  async setItem(k,value){values.set(k,value);},
  async removeItem(k){values.delete(k);},
 };
 const makeAdapter=createSourceLoader()('app/src/services/authSessionStorage.ts').createAccountSessionStorage;
 const lock=work=>processLock('fixture-shared-adapter',3000,work);
 const first=makeAdapter(raw,key,lock),second=makeAdapter(raw,key,lock);
 const observed=[];const unsubscribe=second.subscribe(id=>observed.push(id));t.after(unsubscribe);
 const read=gate(t);heldRead=read;
 const deletion=first.clearForAccount(A);
 await read.entered;
 const nextLogin=second.storage.setItem(key,JSON.stringify(session(B)));
 read.release();
 assert.equal(await deletion,true);
 await nextLogin;
 const marker=`${key}.deleted.${A}`;
 second.observeDeletion(marker,values.get(marker));
 assert.deepEqual(observed,[A]);
 const restarted=makeAdapter(raw,key,lock);
 await restarted.storage.setItem(key,JSON.stringify(session(A)));
 assert.equal((await second.readSession()).user.id,B);
 assert.equal((await restarted.readSession()).user.id,B);
});

test('a timed-out browser waiter fails without running beside the owner of the lock',async()=>{
 const requests=[];
 const manager={request(name,options,run){
  requests.push({name,options});
  if(options.steal)return run({name});
  return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Waiting expired','AbortError')),{once:true}));
 }};
 const makeLock=createSourceLoader({}, {navigator:{locks:manager},AbortController,DOMException})('app/src/services/authSessionStorage.ts').createBrowserSessionLock;
 const lock=makeLock(manager);
 let ran=false;
 await assert.rejects(lock('fixture-busy-lock',10,async()=>{ran=true;}),error=>error.isAcquireTimeout===true);
 assert.equal(ran,false);
 assert.equal(requests.length,1);
 assert.equal(requests[0].options.steal,undefined);
});
