import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const manifestPath = new URL('app/src/utils/exerciseThumbnails.json', root);
const output = new URL('app/public/exercise-thumbnails/', root);
const require = createRequire(new URL('site/package.json', root));
// Next.js already installs Sharp in the site workspace. This generator runs locally.
const sharp = require('sharp');
const sourcePrefix = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const [sourcesPath, revision] = process.argv.slice(2);
const previous = sourcesPath ? null : JSON.parse(await readFile(manifestPath, 'utf8'));
const sourceRevision = revision ?? previous?.sourceRevision;

if (!sourceRevision || !/^[a-f0-9]{40}$/.test(sourceRevision)) {
  throw new Error('Provide a source JSON file and the upstream commit SHA, or regenerate from the manifest.');
}

const sources = sourcesPath
  ? JSON.parse(await readFile(sourcesPath, 'utf8')).map(url => {
      if (typeof url !== 'string' || !url.startsWith(sourcePrefix)) throw new Error('Unexpected exercise image host');
      return url.slice(sourcePrefix.length);
    })
  : Object.keys(previous.thumbnails);
const paths = [...new Set(sources)].sort();
if (!paths.length || paths.some(path => !/^[A-Za-z0-9_-]+\/[01]\.jpg$/.test(path))) {
  throw new Error('Expected paths from the public exercise catalog');
}

await mkdir(output, { recursive: true });
const entries = [];
for (let start = 0; start < paths.length; start += 4) {
  const batch = await Promise.all(paths.slice(start, start + 4).map(async path => {
    const source = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/' + sourceRevision + '/exercises/' + path;
    const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (response.status === 404) {
      console.warn('Missing source image: ' + path);
      return null;
    }
    if (!response.ok) throw new Error('Source image ' + path + ' returned HTTP ' + response.status);
    const original = Buffer.from(await response.arrayBuffer());
    const thumbnail = await sharp(original).resize(128, 128, { fit: 'cover' }).webp({ quality: 78 }).toBuffer();
    const filename = createHash('sha256').update(thumbnail).digest('hex').slice(0, 16) + '.webp';
    await writeFile(new URL(filename, output), thumbnail);
    return { path, filename, originalBytes: original.length, thumbnailBytes: thumbnail.length };
  }));
  entries.push(...batch.filter(Boolean));
}
const thumbnails = Object.fromEntries(entries.map(entry => [entry.path, entry.filename]));
await writeFile(manifestPath, JSON.stringify({ sourceRevision, thumbnails }, null, 2) + '\n');
const currentFiles = new Set(Object.values(thumbnails));
for (const filename of await readdir(output)) {
  if (/^[a-f0-9]{16}\.webp$/.test(filename) && !currentFiles.has(filename)) {
    await unlink(new URL(filename, output));
  }
}
console.log(JSON.stringify({
  images: entries.length,
  uniqueFiles: new Set(Object.values(thumbnails)).size,
  originalBytes: entries.reduce((total, entry) => total + entry.originalBytes, 0),
  thumbnailBytes: entries.reduce((total, entry) => total + entry.thumbnailBytes, 0),
}));
