import assert from 'node:assert/strict';
import {
  isChartAtNewestEnd,
  resolveChartScrollMax,
  resolveInitialPointerIndex,
  resolvePointerCardEdge,
  resolvePointerCardShiftX,
  resolveDragScrollX,
} from '../app/src/utils/chartViewport.ts';

assert.equal(resolveChartScrollMax(365, 300), 65);
assert.equal(resolveChartScrollMax(300, 300), 0);
assert.equal(resolveChartScrollMax(200, 300), 0);

assert.equal(isChartAtNewestEnd(0, 65), false);
assert.equal(isChartAtNewestEnd(63, 65), false);
assert.equal(isChartAtNewestEnd(64, 65), true);
assert.equal(isChartAtNewestEnd(65, 65), true);
assert.equal(isChartAtNewestEnd(0, 0), true);

assert.equal(resolveInitialPointerIndex([]), -1);
assert.equal(
  resolveInitialPointerIndex([{ isActive: false }, { isActive: false }]),
  1,
);
assert.equal(
  resolveInitialPointerIndex([{ isActive: false }, { isActive: false }, { isActive: true }]),
  2,
);
assert.equal(resolveInitialPointerIndex([{ isActive: true }]), 0);

assert.equal(resolvePointerCardEdge(-1, 10), 'start');
assert.equal(resolvePointerCardEdge(0, 1), 'start');
assert.equal(resolvePointerCardEdge(0, 10), 'start');
assert.equal(resolvePointerCardEdge(4, 10), 'middle');
assert.equal(resolvePointerCardEdge(9, 10), 'end');
assert.equal(resolvePointerCardEdge(2, 3), 'end');

const alignCorrection = -20;
assert.equal(resolvePointerCardShiftX('start', alignCorrection), alignCorrection);
assert.equal(resolvePointerCardShiftX('middle', alignCorrection), alignCorrection);
assert.equal(resolvePointerCardShiftX('end', alignCorrection), 0);

assert.equal(resolveDragScrollX(100, 200, 160, 400), 140);
assert.equal(resolveDragScrollX(100, 200, 250, 400), 50);
assert.equal(resolveDragScrollX(10, 200, 400, 400), 0);
assert.equal(resolveDragScrollX(350, 200, 50, 400), 400);
