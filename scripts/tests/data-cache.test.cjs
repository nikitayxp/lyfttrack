const assert=require('node:assert/strict');
const {test}=require('node:test');
const loadSource=require('./load-source.cjs');
test('account caches deduplicate pending reads and invalidation rejects stale refill',async()=>{
 const {createDataCache}=loadSource()('app/src/services/dataCache.ts');
 const cache=createDataCache(60_000); let resolve,calls=0;
 const fetch=()=>{calls++;return new Promise(r=>resolve=r);};
 const a=cache.get('owner','catalog',fetch),b=cache.get('owner','catalog',fetch);
 assert.equal(calls,1);cache.invalidate('owner');resolve(['old']);await Promise.all([a,b]);
 assert.deepEqual(await cache.get('owner','catalog',async()=>['fresh']),['fresh']);
 assert.deepEqual(await cache.get('other','catalog',async()=>['other']),['other']);
 cache.invalidate();let attempts=0;
 await assert.rejects(cache.get('owner','catalog',async()=>{attempts++;throw Error('offline');}),/offline/);
 assert.deepEqual(await cache.get('owner','catalog',async()=>{attempts++;return ['retry'];}),['retry']);assert.equal(attempts,2);
});
