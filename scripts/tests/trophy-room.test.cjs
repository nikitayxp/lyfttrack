const assert = require('node:assert/strict');
const { test } = require('node:test');
const load = require('./load-source.cjs')();
const { selectTrophies, trophyShareText } = load('app/src/utils/trophyRoom.ts');
const records = [
  { exerciseId: 'a', exercise: { name: 'Supino inclinado', name_en: 'Incline bench press' }, maxWeight: 80, achievedAt: '2026-01-01T09:00:00Z', muscleKey: 'chest' },
  { exerciseId: 'b', exercise: { name: 'Elevação lateral' }, maxWeight: 20, achievedAt: '2026-10-01T09:00:00Z', muscleKey: 'shoulders' },
  { exerciseId: 'c', exercise: { name: 'Supino reto' }, maxWeight: 100, achievedAt: '2026-08-01T09:00:00Z', muscleKey: 'chest' },
];

test('recent preview shows dates rather than comparing weights across exercises', () => {
  assert.deepEqual(Array.from(selectTrophies(records, { language: 'pt', limit: 2 }), r => r.exerciseId), ['b', 'c']);
  assert.equal(records[0].exerciseId, 'a');
});
test('search ignores accents and matches either translated name', () => {
  assert.equal(selectTrophies(records, { language: 'pt', query: 'elevacao' })[0].exerciseId, 'b');
  assert.equal(selectTrophies(records, { language: 'pt', query: 'BENCH' })[0].exerciseId, 'a');
});
test('muscle, search and sorting combine without hiding matching records', () => {
  assert.deepEqual(Array.from(selectTrophies(records, { language: 'pt', muscle: 'chest', query: 'supino', sort: 'weight' }), r => r.exerciseId), ['c', 'a']);
  assert.equal(selectTrophies(records, { language: 'pt', muscle: 'shoulders', query: 'supino' }).length, 0);
});
test('empty collections and absent muscle metadata remain usable', () => {
  assert.equal(selectTrophies([], { language: 'en' }).length, 0);
  assert.equal(selectTrophies([{ ...records[0], muscleKey: null }], { language: 'pt' }).length, 1);
});
test('clipboard text includes the complete name, exact weight and localized date', () => {
  const text = trophyShareText(records[0], 'pt');
  assert.ok(text.includes('Supino inclinado'));
  assert.ok(text.includes('80 kg'));
  assert.ok(text.includes('2026'));
  assert.ok(text.includes('LyftTrack'));
});
