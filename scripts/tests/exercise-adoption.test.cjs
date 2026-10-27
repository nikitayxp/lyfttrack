const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

const me = 'user-me';
const friend = 'user-friend';

function loadService(ownRows, { returnedRows, loadError, createError } = {}) {
  const inserted = [];
  const query = {
    select() { return this; },
    eq() { return this; },
    then(resolve) { resolve({ data: ownRows, error: loadError ?? null }); },
    insert(rows) {
      inserted.push(...rows);
      return { select: async () => ({ data: returnedRows ?? rows, error: createError ?? null }) };
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

test('same-name exercises with different equipment or content remain independent', async () => {
  const own = { ...mine, name: 'Curl', equipment: 'dumbbell', muscle_group: 'biceps' };
  const foreign = { ...friendNew, name: 'Curl', equipment: 'machine', muscle_group: 'back' };
  const second = { ...foreign, id: 'friend-second', description: 'Different movement' };
  const { adoptForeignCustomExercises, inserted } = loadService([own]);
  const result = await adoptForeignCustomExercises([foreign, second]);
  assert.equal(inserted.length, 2);
  assert.notEqual(result.get(foreign.id).id, own.id);
  assert.notEqual(result.get(foreign.id).id, result.get(second.id).id);
  assert.equal(result.get(foreign.id).equipment, 'machine');
  assert.equal(result.get(second.id).description, 'Different movement');
});

test('copies preserve aliases and whether the source is listed', async () => {
  const foreign = { ...friendNew, aliases: ['Rotação', 'Twist'], listed: false };
  const { adoptForeignCustomExercises, inserted } = loadService([]);
  const result = await adoptForeignCustomExercises([foreign]);
  assert.deepEqual([...inserted[0].aliases], foreign.aliases);
  assert.equal(result.get(foreign.id).listed, false);
});

test('changes in translations, labels, images, aliases or listing prevent accidental reuse', async () => {
  const base = { ...friendNew, aliases: [], listed: true };
  const differences = {
    name_en: 'Twist variant', name_pt: 'Outra rotação', muscle_en: 'Back',
    muscle_pt: 'Costas', image_url: 'https://example.test/move.png',
    aliases: ['Another move'], listed: false,
  };
  for (const [field, value] of Object.entries(differences)) {
    const own = { ...base, id: 'own-copy', created_by: me, [field]: value };
    const { adoptForeignCustomExercises, inserted } = loadService([own]);
    const result = await adoptForeignCustomExercises([base]);
    assert.equal(inserted.length, 1, field);
    assert.notEqual(result.get(base.id).id, own.id, field);
  }
});

test('repeated source rows and an unchanged owned copy do not create extra exercises', async () => {
  const ownRows = [];
  const { adoptForeignCustomExercises, inserted } = loadService(ownRows);
  const first = await adoptForeignCustomExercises([friendNew, friendNew]);
  assert.equal(inserted.length, 1);
  ownRows.push(first.get(friendNew.id));
  const second = await adoptForeignCustomExercises([friendNew]);
  assert.equal(inserted.length, 1);
  assert.equal(second.get(friendNew.id).id, first.get(friendNew.id).id);
});

test('an incomplete copy result aborts instead of silently omitting an exercise', async () => {
  const { adoptForeignCustomExercises } = loadService([], { returnedRows: [] });
  await assert.rejects(adoptForeignCustomExercises([friendNew]), /Unable to (copy|create) exercises/);
});

test('a database failure aborts adoption without returning foreign references', async () => {
  for (const failure of [{ loadError: { message: 'Read failed' } }, { createError: { message: 'Write failed' } }]) {
    const { adoptForeignCustomExercises } = loadService([], failure);
    await assert.rejects(adoptForeignCustomExercises([friendNew]), /Unable to (load|create) exercises/);
  }
});
