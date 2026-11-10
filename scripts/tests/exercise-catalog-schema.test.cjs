const assert = require('node:assert/strict');
const { test } = require('node:test');
const loadSource = require('./load-source.cjs');

const productionColumns = new Set([
  'id', 'name', 'name_en', 'name_pt', 'aliases', 'listed', 'muscle_group',
  'muscle_en', 'muscle_pt', 'equipment', 'is_custom', 'image_url', 'description', 'created_by',
]);
const exercise = {
  id: 'exercise-1',
  name: 'Bench press',
  name_pt: 'Supino',
  aliases: ['Press'],
  description: 'Press the bar.',
  is_custom: false,
  listed: true,
};

function setup() {
  const supabase = {
    from(table) {
      assert.equal(table, 'exercises');
      let columns;
      let missingColumn;
      let ids;
      let cursor;
      const query = {
        select(projection) {
          columns = projection.split(',');
          missingColumn = columns.find(column => !productionColumns.has(column));
          return query;
        },
        in(column, values) {
          assert.equal(column, 'id');
          ids = values;
          return query;
        },
        or() { return query; },
        order() { return query; },
        range() { return query; },
        gt(_column, value) { cursor = value; return query; },
        then(resolve) {
          if (missingColumn) {
            return resolve({ data: null, error: { message: `column exercises.${missingColumn} does not exist` } });
          }
          const matches = (!ids || ids.includes(exercise.id)) && (!cursor || cursor < exercise.id);
          const projected = Object.fromEntries(
            columns.filter(column => Object.hasOwn(exercise, column)).map(column => [column, exercise[column]]),
          );
          return resolve({ data: matches ? [projected] : [], error: null });
        },
      };
      return query;
    },
  };
  return loadSource({
    '@/services/supabase': { supabase },
    '@/services/authUserService': { getSessionUserOrThrow: async () => ({ id: 'account' }) },
  })('app/src/services/workoutService.ts');
}

test('loads the exercise catalog with the deployed exercise columns', async () => {
  const [result] = await setup().getExercisesCatalog();
  assert.deepEqual(result, exercise);
});

test('loads exercise details by id with the deployed exercise columns', async () => {
  const [result] = await setup().getExercisesByIds([exercise.id]);
  assert.deepEqual(result, exercise);
});
