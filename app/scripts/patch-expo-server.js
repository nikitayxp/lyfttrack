const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.dirname(require.resolve('expo-server/package.json'));
const files = [
  path.join(packageRoot, 'build/cjs/vendor/http.js'),
  path.join(packageRoot, 'build/mjs/vendor/http.js'),
];
const guard = '    if (res.writableEnded || res.destroyed) {\n        return;\n    }\n';

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');

  if (source.includes(guard)) {
    continue;
  }

  const functionStart = source.includes('export async function respond(res, expoRes) {')
    ? 'export async function respond(res, expoRes) {'
    : 'async function respond(res, expoRes) {';

  if (!source.includes(functionStart)) {
    throw new Error(`Unable to patch ${file}`);
  }

  fs.writeFileSync(file, source.replace(functionStart, `${functionStart}\n${guard}`));
}
