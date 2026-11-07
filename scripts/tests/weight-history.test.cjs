const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

function setup(count, options = {}) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: String(index).padStart(8, '0'),
    user_id: 'owner',
    weight: 70 + index / 100,
    measured_at: options.sameTimestamp ? '2026-10-01T10:00:00.000Z' : new Date(Date.UTC(2020, 0, index + 1)).toISOString(),
    created_at: new Date(Date.UTC(2020, 0, index + 1)).toISOString(),
  }));
  rows.push({ ...rows[0], id: 'other-user', user_id: 'other' });
  const calls = [];
  const supabase = {
    from(table) {
      const call = { table, filters: {}, orders: [], range: [0, 999] };
      const query = {
        select(columns) { call.columns = columns; return query; },
        eq(key, value) { call.filters[key] = value; return query; },
        order(key, options) { call.orders.push({ key, ...options }); return query; },
        limit(count) { call.range = [0, count - 1]; return query; },
        range(from, to) { call.range = [from, to]; return query; },
        or(filter) { call.cursor = filter; return query; },
        then(resolve, reject) {
          calls.push(call);
          const error = options.error?.(call, calls.length);
          if (error) return Promise.resolve({ data: null, error }).then(resolve, reject);
          let data = rows.filter((row) => Object.entries(call.filters).every(([key, value]) => row[key] === value));
          data.sort((a, b) => {
            for (const { key, ascending } of call.orders) {
              const comparison = String(a[key]).localeCompare(String(b[key]));
              if (comparison) return ascending ? comparison : -comparison;
            }
            return 0;
          });
          if (call.cursor) {
            const match = call.cursor.match(/^(measured_at|created_at)\.lt\.([^,]+),and\(\1\.eq\.([^,]+),id\.lt\.([^,)]+)\)$/);
            assert.ok(match, `Unexpected cursor: ${call.cursor}`);
            const [, column, timestamp, repeatedTimestamp, id] = match;
            assert.equal(timestamp, repeatedTimestamp);
            data = data.filter((row) => row[column] < timestamp || (row[column] === timestamp && row.id < id));
          }
          data = data.slice(call.range[0], Math.min(call.range[1] + 1, call.range[0] + (options.serverCap ?? 1000)));
          const selected = data.map((row) => Object.fromEntries(call.columns.split(', ').map((key) => [key, row[key]])));
          options.afterPage?.(rows, calls.length);
          return Promise.resolve({ data: selected, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const load = createSourceLoader({
    '@/services/supabase': { supabase },
    '@/services/workoutService': { getAuthenticatedUserOrThrow: async () => ({ id: 'owner' }) },
  });
  return { calls, getWeightHistory: load('app/src/services/measurementService.ts').getWeightHistory };
}

test('weight history includes every owned measurement beyond 30 and the server row cap', async () => {
  const { calls, getWeightHistory } = setup(1205);
  const history = await getWeightHistory();
  assert.equal(history.length, 1205);
  assert.equal(history[0].id, '00001204');
  assert.equal(history.at(-1).id, '00000000');
  assert.equal(new Set(history.map((row) => row.id)).size, 1205);
  assert.ok(calls.length > 1);
  for (const call of calls) {
    assert.equal(call.filters.user_id, 'owner');
    assert.ok(call.range[1] - call.range[0] < 1000);
    assert.deepEqual(call.orders.map(({ key }) => key), ['measured_at', 'id']);
  }
});

test('equal timestamps use a stable id boundary without losing or repeating records', async () => {
  const { getWeightHistory } = setup(403, { sameTimestamp: true });
  const history = await getWeightHistory();
  assert.deepEqual(Array.from(history, (row) => row.id), Array.from({ length: 403 }, (_, index) => String(402 - index).padStart(8, '0')));
});

test('new measurements between pages do not shift or repeat the existing history', async () => {
  const { getWeightHistory } = setup(405, {
    afterPage(rows, page) {
      if (page === 1) rows.push({ id: 'new', user_id: 'owner', weight: 80, measured_at: '2030-01-01T00:00:00.000Z', created_at: '2030-01-01T00:00:00.000Z' });
    },
  });
  const history = await getWeightHistory();
  assert.equal(history.length, 405);
  assert.equal(new Set(history.map((row) => row.id)).size, 405);
  assert.equal(history.at(-1).id, '00000000');
});

test('deleting an already loaded measurement does not skip the next page boundary', async () => {
  const { getWeightHistory } = setup(405, {
    afterPage(rows, page) {
      if (page === 1) rows.splice(rows.findIndex((row) => row.id === '00000404'), 1);
    },
  });
  const history = await getWeightHistory();
  assert.equal(history.length, 405);
  assert.equal(new Set(history.map((row) => row.id)).size, 405);
  assert.equal(history.at(-1).id, '00000000');
});

for (const count of [0, 31, 200]) {
  test(`history ends correctly with ${count} measurements`, async () => {
    const { getWeightHistory } = setup(count);
    const history = await getWeightHistory();
    assert.equal(history.length, count);
  });
}

test('legacy tables load the complete history ordered by created_at', async () => {
  const { calls, getWeightHistory } = setup(1003, {
    error(call) { return call.columns.includes('measured_at') ? { code: '42703', message: 'column measured_at does not exist' } : null; },
  });
  const history = await getWeightHistory();
  assert.equal(history.length, 1003);
  assert.equal(history[0].recorded_at, history[0].created_at);
  for (const call of calls.slice(1)) {
    assert.equal(call.filters.user_id, 'owner');
    assert.deepEqual(call.orders.map(({ key }) => key), ['created_at', 'id']);
  }
});

test('an unrelated missing column does not trigger the legacy fallback', async () => {
  const { calls, getWeightHistory } = setup(50, {
    error: () => ({ code: '42703', message: 'column weight does not exist' }),
  });
  await assert.rejects(getWeightHistory());
  assert.equal(calls.length, 1);
});

for (const legacy of [false, true]) {
  test(`a later ${legacy ? 'legacy' : 'current'} page failure rejects instead of returning partial history`, async () => {
    const { calls, getWeightHistory } = setup(450, {
      error(call, number) {
        if (legacy && call.columns.includes('measured_at')) return { code: '42703', message: 'column measured_at does not exist' };
        return number === (legacy ? 3 : 2) ? { code: '42501', message: 'permission denied' } : null;
      },
    });
    await assert.rejects(getWeightHistory());
    assert.equal(calls.length, legacy ? 3 : 2);
  });
}

test('weight history does not truncate when project max_rows is lower than 200', async()=>{
 const {getWeightHistory}=setup(405,{serverCap:73});
 assert.equal((await getWeightHistory()).length,405);
});

test('legacy insert recovery updates only the latest owned measurement',async()=>{
 const rows=[{id:'old',user_id:'owner',weight:70,created_at:'2026-01-01Z',measured_at:'2026-01-01Z'},{id:'latest',user_id:'owner',weight:75,created_at:'2026-02-01Z',measured_at:'2026-02-01Z'},{id:'other',user_id:'other',weight:90,created_at:'2026-03-01Z',measured_at:'2026-03-01Z'}];
 const updates=[];
 const supabase={from(){
   let operation='select',patch;const filters={};let limit=1000;
   const q={select(){return q;},insert(){operation='insert';return q;},update(p){operation='update';patch=p;return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},limit(n){limit=n;return q;},maybeSingle(){limit=1;return q;},then(resolve,reject){
     if(operation==='insert')return Promise.resolve({error:{code:'23505',message:'duplicate user constraint'}}).then(resolve,reject);
     const data=rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,limit);
     if(operation==='update'){updates.push({...filters});data.forEach(r=>Object.assign(r,patch));return Promise.resolve({error:null,count:data.length}).then(resolve,reject);}
     return Promise.resolve({error:null,data:data[0]??null}).then(resolve,reject);
   }};return q;
 }};
 const service=createSourceLoader({'@/services/supabase':{supabase},'@/services/workoutService':{getAuthenticatedUserOrThrow:async()=>({id:'owner'})}})('app/src/services/measurementService.ts');
 await service.addWeight(80);
 assert.equal(rows[0].weight,70);assert.equal(rows[1].weight,80);assert.equal(rows[2].weight,90);
 assert.equal(updates[0].id,'latest');assert.equal(updates[0].user_id,'owner');
});
