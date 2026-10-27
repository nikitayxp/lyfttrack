const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

const me = 'user-me';
const friend = 'user-friend';

function loadService(ownRows) {
  const inserted = [];
  const query = {
    select() { return this; },
    eq() { return this; },
    then(resolve) { resolve({ data: ownRows, error: null }); },
    insert(rows) {
      inserted.push(...rows);
      return { select: async () => ({ data: rows, error: null }) };
    },
  };
  let nextId = 0;
  const load = createSourceLoader({
    '@/services/supabase': { supabase: { from: () => query } },
    '@/services/authUserService': { getAuthenticatedUserOrThrow: async () => ({ id: me }) },
    '@/utils/uuid': { generateId: () => `copy-${++nextId}` },
  });
  return { ...load('app/src/services/exerciseAdoptionService.ts'), inserted };
}

const catalog = { id: 'catalog', name: 'Bench Press', is_custom: false, created_by: null };
const mine = { id: 'mine', name: 'My Move', is_custom: true, created_by: me };
const friendNew = { id: 'friend-new', name: 'Landmine Twist', name_en: 'Landmine Twist', name_pt: 'Rotação landmine', is_custom: true, created_by: friend, muscle_group: 'core' };
const friendSameName = { id: 'friend-same', name: ' my move ', is_custom: true, created_by: friend };

test('catalog and own exercises are kept as they are', async () => {
  const { adoptForeignCustomExercises, inserted } = loadService([]);
  const result = await adoptForeignCustomExercises([catalog, mine]);
  assert.equal(result.get('catalog'), catalog);
  assert.equal(result.get('mine'), mine);
  assert.equal(inserted.length, 0);
});

test('a friend custom exercise becomes an own copy and never keeps the friend id', async () => {
  const { adoptForeignCustomExercises, inserted } = loadService([mine]);
  const result = await adoptForeignCustomExercises([catalog, friendNew, friendSameName]);

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].created_by, me);
  assert.equal(inserted[0].is_custom, true);
  assert.equal(inserted[0].name_pt, 'Rotação landmine');
  assert.equal(result.get('friend-new').id, 'copy-1');
  assert.equal(result.get('friend-same'), mine);
  for (const row of result.values()) {
    assert.notEqual(row.created_by, friend);
  }
});
