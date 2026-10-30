const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createClient } = require('@supabase/supabase-js');
const { PGlite } = require('@electric-sql/pglite');
const createSourceLoader = require('./load-source.cjs');

async function setup(t) {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec('create table candidates(id text,username text,full_name text,avatar_url text)');
  for(const [id,username,name] of [
    ['literal-underscore','test_athlete',null],
    ['wildcard-underscore','testXathlete',null],
    ['literal-percent','percent','100% Athlete'],
    ['wildcard-percent','decoy','100 Fast Athlete'],
    ['literal-backslash','path','Path\\Athlete'],
    ['delimiters','delimiter','Mixed Name'],
  ]) await db.query('insert into candidates values ($1,$2,$3,null)',[id,username,name]);
  const requests=[];
  const client=createClient('https://search.example.test','public-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async input=>{
      const url=new URL(String(input));
      const table=url.pathname.split('/').pop();
      requests.push(url);
      let rows=[];
      if(['profiles','profile_cards'].includes(table)) {
        const match=url.searchParams.get('or')?.match(/^\(username\.ilike\.(.*),full_name\.ilike\.(.*)\)$/);
        assert.ok(match,'search must keep exactly two value-bound filters');
        rows=(await db.query('select * from candidates where username ilike $1 or full_name ilike $2 order by username',[match[1].replace(/\*/g,'%'),match[2].replace(/\*/g,'%')])).rows;
      }
      return new Response(JSON.stringify(rows),{headers:{'Content-Type':'application/json'}});
    }}
  });
  const service=createSourceLoader({
    '@/services/supabase':{supabase:client},
    '@/services/workoutService':{getAuthenticatedUserOrThrow:async()=>({id:'viewer'})},
  })('app/src/services/socialService.ts');
  return {service,requests};
}

for(const method of ['searchUsers','getActiveUsers']) {
  test(`${method} preserves underscores percent and backslash as literal search characters`,async t=>{
    const {service}=await setup(t);
    for(const [query,expected] of [
      ['test_athlete',['literal-underscore']],
      ['100%',['literal-percent']],
      ['Path\\Athlete',['literal-backslash']],
      ['  test_athlete  ',['literal-underscore']],
      ['Mixed,(Name)',['delimiters']],
    ]) assert.deepEqual((await service[method](query)).map(row=>row.id),expected,query);
  });
}

test('minimum input length is checked before LIKE escaping expands the query',async t=>{
  const {service,requests}=await setup(t);
  for(const query of ['', ' ', '_', '%', '\\', 'a']) assert.deepEqual(Array.from(await service.searchUsers(query)),[]);
  assert.equal(requests.length,0);
  assert.deepEqual(Array.from(await service.getActiveUsers('  ')),[]);
  assert.deepEqual(Array.from(await service.getActiveUsers(' ( , ) ')),[]);
  assert.equal(requests.length,0);
});

test('the PostgREST asterisk wildcard alias is refused before making a request',async t=>{
  const {service,requests}=await setup(t);
  for(const method of ['searchUsers','getActiveUsers']) {
    for(const query of ['*','**','test*athlete']) assert.deepEqual(Array.from(await service[method](query)),[]);
  }
  assert.equal(requests.length,0);
});
