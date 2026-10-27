const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

const user = { id: 'user-1', email: 'me@example.com', user_metadata: { username: 'me' } };
const profile = { id: 'user-1', username: 'me', full_name: null, bio: null, avatar_url: null };

function loadService() {
  const uploads = [];
  const query = {
    select() { return this; },
    eq() { return this; },
    update() { return this; },
    maybeSingle: async () => ({ data: profile, error: null }),
    single: async () => ({ data: profile, error: null }),
  };
  const supabase = {
    from: () => query,
    auth: { updateUser: async () => ({ error: null }) },
    storage: {
      from: () => ({
        upload: async (filePath, _data, options) => {
          uploads.push({ filePath, contentType: options.contentType });
          return { error: null };
        },
        getPublicUrl: filePath => ({ data: { publicUrl: `https://cdn.test/${filePath}` } }),
      }),
    },
  };
  const load = createSourceLoader({
    '@/services/supabase': { supabase },
    '@/services/workoutService': { getAuthenticatedUserOrThrow: async () => user },
    'expo-image-picker': {},
  });
  return { ...load('app/src/services/profileService.ts'), uploads };
}

const base64Of = bytes => Buffer.alloc(bytes, 1).toString('base64');

test('svg and other non-image types are refused before upload', async () => {
  const { uploadAvatar, uploads } = loadService();
  for (const input of [
    { fileUri: 'file:///avatar.svg', contentType: 'image/svg+xml' },
    { fileUri: 'file:///avatar.gif' },
    { fileUri: 'file:///avatar.heic', contentType: 'image/heic' },
  ]) {
    await assert.rejects(uploadAvatar({ ...input, base64Data: base64Of(10) }), { reason: 'unsupported-type' });
  }
  assert.equal(uploads.length, 0);
});

test('files over 5 MB are refused before upload', async () => {
  const { uploadAvatar, uploads, AVATAR_MAX_BYTES } = loadService();
  await assert.rejects(
    uploadAvatar({ fileUri: 'file:///big.jpg', contentType: 'image/jpeg', base64Data: base64Of(AVATAR_MAX_BYTES + 1) }),
    { reason: 'too-large' }
  );
  assert.equal(uploads.length, 0);
});

test('jpeg, png and webp upload with a matching extension', async () => {
  const { uploadAvatar, uploads } = loadService();
  await uploadAvatar({ fileUri: 'file:///a.jpeg', contentType: 'image/jpg', base64Data: base64Of(10) });
  await uploadAvatar({ fileUri: 'file:///b.png', base64Data: base64Of(10) });
  await uploadAvatar({ fileUri: 'blob:http://localhost/abc', contentType: 'image/webp', base64Data: base64Of(10) });
  assert.deepEqual(uploads.map(upload => upload.contentType), ['image/jpeg', 'image/png', 'image/webp']);
  assert.deepEqual(uploads.map(upload => upload.filePath.split('.').pop()), ['jpg', 'png', 'webp']);
  assert.ok(uploads.every(upload => upload.filePath.startsWith('user-1/')));
});
