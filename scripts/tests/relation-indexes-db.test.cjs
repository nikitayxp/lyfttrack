const assert=require('node:assert/strict');const {test}=require('node:test');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
test('foreign key lookup indexes avoid full table scans for relation and exercise queries',async t=>{
 const db=await PGlite.create();t.after(()=>db.close());
 await db.exec(`create table sets(id uuid primary key default gen_random_uuid(),workout_exercise_id uuid);create table workout_exercises(id uuid primary key default gen_random_uuid(),exercise_id uuid,workout_id uuid);insert into sets(workout_exercise_id) select gen_random_uuid() from generate_series(1,12000);insert into workout_exercises(exercise_id,workout_id) select gen_random_uuid(),gen_random_uuid() from generate_series(1,12000);analyze;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261026223000_relation_lookup_indexes.sql','utf8'));
 for(const query of ["select * from sets where workout_exercise_id='00000000-0000-0000-0000-000000000001'", "select workout_id from workout_exercises where exercise_id='00000000-0000-0000-0000-000000000001'"]){const plan=(await db.query('explain (analyze,buffers) '+query)).rows;assert.match(JSON.stringify(plan),/Index (Only )?Scan|Bitmap Index Scan/);assert.doesNotMatch(JSON.stringify(plan),/Seq Scan/);}
});
