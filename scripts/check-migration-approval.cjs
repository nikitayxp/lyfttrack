const { execFileSync } = require('node:child_process');

const approvedSha = process.env.APPROVED_SHA ?? '';
const currentSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch'
  || process.env.GITHUB_REF !== 'refs/heads/main'
  || process.env.APPLY_MIGRATIONS !== 'true'
  || !/^[a-f0-9]{40}$/.test(approvedSha)
  || approvedSha !== process.env.GITHUB_SHA
  || approvedSha !== currentSha) {
  console.error('Production migrations require explicit manual confirmation of the exact checked-out main revision.');
  process.exit(1);
}
