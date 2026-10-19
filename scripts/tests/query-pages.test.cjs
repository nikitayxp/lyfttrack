const assert = require('node:assert/strict');
const { test } = require('node:test');
const load = require('./load-source.cjs')();
const { loadAllRows } = load('app/src/services/queryPages.ts');

function setup(count, { failPage, invalidBoundary = false, serverCap = 1000 } = {}) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: String(i).padStart(8, '0') }));
  const calls = [];
  const buildQuery = () => {
    const call = { cursor: '', range: [0, 999] };
    const query = {
      order(column, options) { assert.equal(column, 'id'); assert.equal(options.ascending, true); return query; },
      range(from, to) { call.range = [from, to]; return query; },
      gt(column, value) { assert.equal(column, 'id'); call.cursor = value; return query; },
      then(resolve, reject) {
        calls.push(call);
        if (calls.length === failPage) return Promise.resolve({ data: null, error: { message: 'offline' } }).then(resolve, reject);
        const data = rows.filter(row => row.id > call.cursor).slice(call.range[0], Math.min(call.range[1] + 1, serverCap));
        if (invalidBoundary && data.length) data[data.length - 1] = { id: null };
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  };
  return { rows, calls, run: () => loadAllRows(buildQuery, 'History') };
}

test('large histories stay complete with at most nine round trips for 7961 rows', async () => {
  const { rows, calls, run } = setup(7961);
  assert.deepEqual(Array.from(await run()), rows);
  assert.ok(calls.length <= 9, `History needed ${calls.length} sequential requests`);
  assert.ok(calls.every(call => call.range[0] === 0 && call.range[1] < 1000));
});

test('exact server page boundaries finish without dropping or duplicating rows', async () => {
  for (const count of [0, 1, 1000, 2000, 2001]) {
    const { rows, run } = setup(count);
    assert.deepEqual(Array.from(await run()), rows);
  }
});

test('later errors and invalid cursors cannot return a partial history', async () => {
  await assert.rejects(setup(2001, { failPage: 2 }).run(), /History: offline/);
  await assert.rejects(setup(2001, { invalidBoundary: true }).run(), /invalid page boundary/);
});

test('server caps smaller than requested page size do not truncate history', async () => {
 const {rows, run} = setup(2001, {serverCap: 137});
 assert.deepEqual(Array.from(await run()), rows);
});
