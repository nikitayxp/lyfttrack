const assert = require('node:assert/strict');
const { test } = require('node:test');
const loadSource = require('./load-source.cjs');

function setup(pageLimit = 137, builtInCount = 1201) {
  let account = 'a';
  const calls = [];
  const rows = Array.from({ length: builtInCount }, (_, index) => ({
    id: String(index).padStart(8, '0'),
    name: `Exercise ${index}`,
    is_custom: false,
    listed: true,
    aliases: [],
  }));
  rows.push(
    { id: 'custom-a', created_by: 'a', name: 'My A', is_custom: true, listed: false },
    { id: 'custom-b', created_by: 'b', name: 'My B', is_custom: true, listed: true },
    { id: 'unlisted', name: 'Legacy exercise', is_custom: false, listed: false },
  );

  const supabase = {
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      const data = args.p_exercise_ids.map(id => ({
        exercise_id: id,
        best_weight: 100,
        best_e1rm: 120,
        rest_time: 90,
        last_sets: [{ setNumber: 1, weight: 100, reps: 6, rir: 2, setType: 'normal' }],
      }));
      return { data, error: null };
    },
    from(table) {
      assert.equal(table, 'exercises');
      let cursor = '';
      let visibility;
      let wantsCount = false;
      const query = {
        select(_columns, options) { wantsCount = options?.count === 'exact'; return query; },
        or(value) { visibility = value; return query; },
        order() { return query; },
        range() { return query; },
        gt(_column, value) { cursor = value; return query; },
        then(resolve) {
          const scope = visibility?.match(/^(is_custom\.eq\.false|and\(is_custom\.eq\.false,listed\.eq\.true\)),and\(is_custom\.eq\.true,created_by\.eq\.([ab])\)$/);
          if (visibility) assert.ok(scope, 'expected a built-in or owned custom filter');
          const eligible = rows.filter(row => {
            if (row.id <= cursor) return false;
            if (!scope) return true;
            if (row.is_custom) return row.created_by === scope[2];
            return scope[1] === 'is_custom.eq.false' || row.listed;
          });
          const data = eligible.slice(0, pageLimit);
          calls.push({ ids: data.map(row => row.id), wantsCount });
          return resolve({ data, count: wantsCount ? eligible.length : null, error: null });
        },
      };
      return query;
    },
  };

  const getUser = async () => ({ id: account });
  const service = loadSource({
    '@/services/supabase': { supabase },
    '@/services/authUserService': {
      getSessionUserOrThrow: getUser,
      getAuthenticatedUserOrThrow: getUser,
    },
  })('app/src/services/workoutService.ts');
  return { service, calls, switchAccount(id) { account = id; } };
}

test('visible catalog omits hidden built-ins on the wire, preserves owned custom rows and paginates', async () => {
  const { service, calls } = setup();
  const [all, filtered] = await Promise.all([
    service.getExercisesCatalog(),
    service.getExercisesCatalog({ muscle: 'all' }),
  ]);
  assert.equal(all.length, 1202);
  assert.deepEqual(all, filtered);
  assert.equal(calls.length, 10, 'concurrent filters share one paginated load');
  assert.equal(calls[0].wantsCount, true);
  assert.equal(calls.slice(1).some(call => call.wantsCount), false);
  const transferred = calls.flatMap(call => call.ids);
  assert.equal(transferred.length, 1202);
  assert.equal(transferred.includes('custom-a'), true);
  assert.equal(transferred.includes('custom-b'), false);
  assert.equal(transferred.includes('unlisted'), false);
});

test('visible catalog skips the empty request when the first page reports every row', async () => {
  const { service, calls } = setup(137, 50);
  assert.equal((await service.getExercisesCatalog()).length, 51);
  assert.deepEqual(calls.map(call => call.wantsCount), [true]);
  calls.length = 0;
  assert.equal((await service.getExercisesCatalog({ includeUnlisted: true })).length, 52);
  assert.deepEqual(calls.map(call => call.wantsCount), [false, false]);
});

test('full and visible catalogs have separate caches scoped to the account', async () => {
  const { service, calls, switchAccount } = setup();
  const full = await service.getExercisesCatalog({ includeUnlisted: true });
  assert.equal(full.some(row => row.id === 'unlisted'), true);
  assert.equal(full.some(row => row.id === 'custom-b'), false);
  const fullRequests = calls.length;
  const visible = await service.getExercisesCatalog();
  assert.equal(visible.some(row => row.id === 'unlisted'), false);
  assert.equal(calls.length, fullRequests * 2);
  await service.getExercisesCatalog({ includeUnlisted: true });
  await service.getExercisesCatalog();
  assert.equal(calls.length, fullRequests * 2);
  switchAccount('b');
  const other = await service.getExercisesCatalog();
  assert.equal(other.some(row => row.id === 'custom-a'), false);
  assert.equal(other.some(row => row.id === 'custom-b'), true);
});
test('active exercise references batch all requested ids and dedupe pending requests',async()=>{
 const {service,calls}=setup();const [a,b]=await Promise.all([service.getExerciseReferenceData(['e2','e1'],'draft'),service.getExerciseReferenceData(['e1','e2'],'draft')]);assert.equal(calls.length,1);assert.equal(a.bests.e1.bestWeight,100);assert.equal(b.previousByExerciseId.e2[0].weight,100);assert.deepEqual(Array.from(calls[0].args.p_exercise_ids),['e1','e2']);
});
