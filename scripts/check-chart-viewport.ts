import assert from 'node:assert/strict';
import {
  isChartAtNewestEnd,
  resolveChartScrollMax,
  resolveInitialPointerIndex,
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
