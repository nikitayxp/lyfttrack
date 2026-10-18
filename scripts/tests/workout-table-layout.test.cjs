const assert = require('node:assert/strict');
const { test } = require('node:test');
const loadSource = require('./load-source.cjs')();

const { getWorkoutTableLayout } = loadSource('app/src/utils/workoutTableLayout.ts');

test('a 320px phone keeps the completion control inside the row with previous performance loaded', () => {
  const layout = getWorkoutTableLayout(255, 61);
  assert.equal(layout.stackPrevious, true);
  assert.ok(layout.minimumWidth <= 255);
});

test('a wider row keeps previous performance next to the editable fields when it fits', () => {
  const layout = getWorkoutTableLayout(328, 61);
  assert.equal(layout.stackPrevious, false);
  assert.ok(layout.minimumWidth <= 328);
});

test('a long previous result moves below the row instead of clipping the completion control', () => {
  const layout = getWorkoutTableLayout(328, 96);
  assert.equal(layout.stackPrevious, true);
  assert.ok(layout.minimumWidth <= 328);
});

test('the first render uses the compact layout until its real width is measured', () => {
  assert.equal(getWorkoutTableLayout(0, 61).stackPrevious, true);
});
