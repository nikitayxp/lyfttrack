const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const loadSource = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

const source = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bench_Press/0.jpg';
const thumbnail = '/exercise-thumbnails/0123456789abcdef.webp';

function setup(platform) {
  const load = loadSource({
    'react-native': { Image: 'Image', Platform: { OS: platform }, StyleSheet: { create: x => x }, View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    './exerciseImageMap.json': {},
    './exerciseThumbnails.json': {
      sourceRevision: 'fixture',
      thumbnails: { 'Bench_Press/0.jpg': '0123456789abcdef.webp' },
    },
  });
  return load('app/src/components/common/ExerciseThumbnail.tsx').ExerciseThumbnail;
}

async function render(t, platform, url) {
  const Thumbnail = setup(platform);
  const exercise = image_url => ({ name: 'Fixture', name_pt: null, name_en: null, image_url });
  let tree;
  await act(async () => { tree = create(React.createElement(Thumbnail, { exercise: exercise(url) })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return {
    uri: () => tree.root.findAllByType('Image')[0]?.props.source.uri,
    fail: () => act(async () => tree.root.findByType('Image').props.onError()),
    update: url => act(async () => tree.update(React.createElement(Thumbnail, { exercise: exercise(url) }))),
  };
}

test('web uses the local variant and falls back to the original and then the placeholder', async t => {
  const app = await render(t, 'web', source);
  assert.equal(app.uri(), thumbnail);
  await app.fail();
  assert.equal(app.uri(), source);
  await app.fail();
  assert.equal(app.uri(), undefined);
  const different = 'https://images.example.test/exercise.jpg';
  await app.update(different);
  assert.equal(app.uri(), different, 'a new image should not inherit the old failure');
});

test('native and URLs without a generated variant keep the original source', async t => {
  const native = await render(t, 'android', source);
  assert.equal(native.uri(), source);
  const unrelated = 'https://images.example.test/Bench_Press/0.jpg';
  const web = await render(t, 'web', unrelated);
  assert.equal(web.uri(), unrelated);
});

test('generated web thumbnails match the manifest hashes and list-sized dimensions', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { createHash } = require('node:crypto');
  const root = path.resolve(__dirname, '../..');
  const manifest = require('../../app/src/utils/exerciseThumbnails.json');
  const files = new Set(Object.values(manifest.thumbnails));
  const directory = path.join(root, 'app/public/exercise-thumbnails');
  assert.ok(files.size > 0);
  assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/);
  assert.deepEqual(new Set(fs.readdirSync(directory).filter(name => name.endsWith('.webp'))), files);
  for (const name of files) {
    const bytes = fs.readFileSync(path.join(directory, name));
    assert.equal(name, createHash('sha256').update(bytes).digest('hex').slice(0, 16) + '.webp');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8 ');
    assert.equal(bytes.subarray(23, 26).toString('hex'), '9d012a');
    assert.equal(bytes.readUInt16LE(26) & 0x3fff, 128);
    assert.equal(bytes.readUInt16LE(28) & 0x3fff, 128);
  }
});
