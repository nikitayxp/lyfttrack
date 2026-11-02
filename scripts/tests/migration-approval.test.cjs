const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const sha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const command = path.resolve(__dirname, '../check-migration-approval.cjs');

function run(overrides = {}) {
  return spawnSync(process.execPath, [command], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha, APPROVED_SHA: sha, APPLY_MIGRATIONS: 'true', ...overrides },
  });
}

test('only an explicit manual production run approves the exact main revision', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
});

for (const [scenario, overrides] of [
  ['automatic push', { GITHUB_EVENT_NAME: 'push' }],
  ['missing confirmation', { APPLY_MIGRATIONS: '' }],
  ['false confirmation', { APPLY_MIGRATIONS: 'false' }],
  ['different revision', { APPROVED_SHA: 'b'.repeat(40) }],
  ['a revision different from the checkout', { APPROVED_SHA: 'b'.repeat(40), GITHUB_SHA: 'b'.repeat(40) }],
  ['missing revision', { APPROVED_SHA: '' }],
  ['invalid revision', { APPROVED_SHA: 'main', GITHUB_SHA: 'main' }],
  ['another branch', { GITHUB_REF: 'refs/heads/dev' }],
]) {
  test(`production migration approval refuses ${scenario}`, () => {
    const result = run(overrides);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production migrations require/);
  });
}
