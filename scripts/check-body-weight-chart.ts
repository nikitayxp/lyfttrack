import assert from 'node:assert/strict';
import {
  BODY_WEIGHT_CHART_EDGE_SPACING,
  resolveBodyWeightChartRange,
  resolveBodyWeightLineSpacing,
  toBodyWeightChartPoints,
} from '../app/src/utils/bodyWeightChart.ts';

assert.deepEqual(toBodyWeightChartPoints([]), []);
assert.deepEqual(
  toBodyWeightChartPoints([{ id: 'a', weight: 80, recorded_at: '2026-08-01T00:00:00.000Z' }]),
  [],
);

const newestFirst = [
  { id: 'b', weight: 82, recorded_at: '2026-08-10T00:00:00.000Z' },
  { id: 'a', weight: 80, recorded_at: '2026-08-01T00:00:00.000Z' },
];
assert.deepEqual(toBodyWeightChartPoints(newestFirst), [
  { id: 'a', value: 80, recordedAt: '2026-08-01T00:00:00.000Z' },
  { id: 'b', value: 82, recordedAt: '2026-08-10T00:00:00.000Z' },
]);

assert.deepEqual(
  toBodyWeightChartPoints([
    { id: 'c', weight: 83, recorded_at: '2026-08-12T00:00:00.000Z' },
    { id: 'skip', weight: 0, recorded_at: '2026-08-11T00:00:00.000Z' },
    { id: 'a', weight: 80, recorded_at: '2026-08-01T00:00:00.000Z' },
  ]),
  [
    { id: 'a', value: 80, recordedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'c', value: 83, recordedAt: '2026-08-12T00:00:00.000Z' },
  ],
);

const tightRange = resolveBodyWeightChartRange([80, 82]);
assert.ok(tightRange.min < 80);
assert.ok(tightRange.max > 82);
assert.ok(tightRange.min >= 0);
assert.ok(tightRange.max > tightRange.min);

const flatRange = resolveBodyWeightChartRange([80, 80]);
assert.ok(flatRange.max > flatRange.min);

const spacing = resolveBodyWeightLineSpacing(200, 5);
assert.ok(spacing >= 8);
assert.ok(BODY_WEIGHT_CHART_EDGE_SPACING * 2 + spacing * 4 <= 200);
