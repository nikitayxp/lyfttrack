const assert = require('node:assert/strict');
const { test } = require('node:test');
const load = require('./load-source.cjs')();
const { getBarChartLayout } = load('app/src/utils/barChartLayout.ts');

for (const containerWidth of [218, 250, 294, 330]) {
  test(`all 12 bars and the axis stay within a ${containerWidth}px card`, () => {
    const layout = getBarChartLayout(containerWidth, 50, 12);
    assert.ok(layout.width + 50 + 10 + 18 <= containerWidth);
    assert.ok(12 * (layout.barWidth + layout.spacing) + 12 <= layout.width);
    assert.ok(layout.barWidth > 0);
  });
}
