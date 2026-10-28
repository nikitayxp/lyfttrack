const assert = require('node:assert/strict');
const { test } = require('node:test');
const createSourceLoader = require('./load-source.cjs');

const user = { id: 'user-1', email: 'me@example.com', user_metadata: { username: 'me' } };
const profile = { id: 'user-1', username: 'me', full_name: null, bio: null, avatar_url: null };

function loadService(pickerAsset, fetch, switchDuringUpload = false, switchDuringProfileRead = false) {
  const uploads = [];
  const updates = [];
  const metadataUpdates = [];
  let activeUser = user;
  let targetId;
  let updateRow;
  const query = {
    select() { return this; },
    eq(_column, id) { targetId = id; return this; },
    update(row) { updateRow = row; return this; },
    maybeSingle: async () => {
      if (switchDuringProfileRead) activeUser = { ...user, id: 'user-2' };
      return { data: switchDuringProfileRead ? { ...profile, full_name: 'Private name A' } : profile, error: null };
    },
    single: async () => {
      updates.push({ id: targetId, row: updateRow });
      return targetId === activeUser.id
        ? { data: { ...profile, id: targetId, ...updateRow }, error: null }
        : { data: null, error: { message: 'RLS denied' } };
    },
  };
  const supabase = {
    from: () => query,
    auth: { updateUser: async input => { metadataUpdates.push({ userId: activeUser.id, input }); return { error: null }; } },
    storage: {
      from: () => ({
        upload: async (filePath, _data, options) => {
          uploads.push({ filePath, contentType: options.contentType });
          if (switchDuringUpload) activeUser = { ...user, id: 'user-2' };
          return { error: null };
        },
        getPublicUrl: filePath => ({ data: { publicUrl: `https://cdn.test/${filePath}` } }),
      }),
    },
  };
  const load = createSourceLoader({
    '@/services/supabase': { supabase },
    '@/services/workoutService': { getAuthenticatedUserOrThrow: async () => activeUser },
    'expo-image-picker': {
      MediaTypeOptions: { Images: 'images' },
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
      launchImageLibraryAsync: async () => pickerAsset ? { canceled: false, assets: [pickerAsset] } : { canceled: true, assets: [] },
    },
  }, { fetch });
  return { ...load('app/src/services/profileService.ts'), uploads, updates, metadataUpdates };
}

const signatures = {
  jpeg: [255, 216, 255],
  png: [137, 80, 78, 71, 13, 10, 26, 10],
  webp: [82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80],
};
const base64Of = (bytes, format = 'jpeg') => {
  const data = Buffer.alloc(bytes, 1);
  Buffer.from(signatures[format]).copy(data);
  return data.toString('base64');
};

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

test('files over 2 MiB are refused before upload', async () => {
  const { uploadAvatar, uploads, AVATAR_MAX_BYTES } = loadService();
  await assert.rejects(
    uploadAvatar({ fileUri: 'file:///big.jpg', contentType: 'image/jpeg', base64Data: base64Of(2 * 1024 * 1024 + 1) }),
    { reason: 'too-large' }
  );
  assert.equal(uploads.length, 0);
  assert.equal(AVATAR_MAX_BYTES, 2 * 1024 * 1024);
});

test('the exact 2 MiB boundary is accepted', async () => {
  const { uploadAvatar, uploads } = loadService();
  await uploadAvatar({ fileUri: 'file:///limit.png', contentType: 'image/png', base64Data: base64Of(2 * 1024 * 1024) });
  assert.equal(uploads.length, 1);
});

test('picker metadata rejects oversized and unsupported photos before creating a pending preview', async () => {
  for (const [asset, reason] of [
    [{ uri: 'file:///large.jpg', mimeType: 'image/jpeg', fileSize: 2 * 1024 * 1024 + 1 }, 'too-large'],
    [{ uri: 'file:///photo.gif', mimeType: 'image/gif', fileSize: 10 }, 'unsupported-type'],
  ]) {
    const { pickAvatarFromLibrary, uploads } = loadService(asset);
    await assert.rejects(pickAvatarFromLibrary(), { reason });
    assert.equal(uploads.length, 0);
  }
});

test('canceling the picker does not select or upload a photo', async () => {
  const { pickAvatarFromLibrary, uploads } = loadService();
  assert.equal(await pickAvatarFromLibrary(), null);
  assert.equal(uploads.length, 0);
});

test('actual fetched bytes enforce the limit even if a smaller base64 fallback is supplied', async () => {
  const { uploadAvatar, uploads } = loadService(undefined, async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(2 * 1024 * 1024 + 1) }));
  await assert.rejects(uploadAvatar({ fileUri: 'blob:http://localhost/large', contentType: 'image/png', base64Data: base64Of(10) }), { reason: 'too-large' });
  assert.equal(uploads.length, 0);
});

test('picker checks URI file size even when its differently encoded fallback is smaller', async () => {
  const { pickAvatarFromLibrary } = loadService({ uri: 'file:///cropped.jpg', mimeType: 'image/jpeg', fileSize: 5 * 1024 * 1024, base64: base64Of(2 * 1024 * 1024) });
  await assert.rejects(pickAvatarFromLibrary(), { reason: 'too-large' });
});

test('picker rejects oversized bytes when file-size metadata is unavailable', async () => {
  const { pickAvatarFromLibrary } = loadService({ uri: 'file:///large.jpg', mimeType: 'image/jpeg', base64: base64Of(2 * 1024 * 1024 + 1) });
  await assert.rejects(pickAvatarFromLibrary(), { reason: 'too-large' });
});

test('jpeg, png and webp upload with a matching extension', async () => {
  const { uploadAvatar, uploads } = loadService();
  await uploadAvatar({ fileUri: 'file:///a.jpeg', contentType: 'image/jpg', base64Data: base64Of(10) });
  await uploadAvatar({ fileUri: 'file:///b.png', base64Data: base64Of(16, 'png') });
  await uploadAvatar({ fileUri: 'blob:http://localhost/abc', contentType: 'image/webp', base64Data: base64Of(16, 'webp') });
  assert.deepEqual(uploads.map(upload => upload.contentType), ['image/jpeg', 'image/png', 'image/webp']);
  assert.deepEqual(uploads.map(upload => upload.filePath.split('.').pop()), ['jpg', 'png', 'webp']);
  assert.ok(uploads.every(upload => upload.filePath.startsWith('user-1/')));
});

test('a session switch cannot update the second account with the first account avatar', async () => {
  const { uploadAvatar, updates } = loadService(undefined, undefined, true);
  await assert.rejects(uploadAvatar({ fileUri: 'file:///a.jpg', base64Data: base64Of(16) }), /RLS denied/);
  assert.deepEqual(updates.map(update => update.id), ['user-1']);
});

test('preparing an avatar never synchronizes profile metadata into a changed session', async () => {
  const { uploadAvatar, metadataUpdates } = loadService(undefined, undefined, false, true);
  await assert.doesNotReject(uploadAvatar({ fileUri: 'file:///a.jpg', base64Data: base64Of(16) }));
  assert.deepEqual(metadataUpdates, []);
});

test('native JPEG fallback uses JPEG metadata even when the picked file was PNG', async () => {
  const { uploadAvatar, uploads } = loadService();
  await uploadAvatar({ fileUri: 'file:///a.png', contentType: 'image/png', base64Data: base64Of(16) });
  assert.equal(uploads[0].contentType, 'image/jpeg');
  assert.match(uploads[0].filePath, /\.jpg$/);
});

test('fetched image bytes determine the uploaded format', async () => {
  const bytes = Uint8Array.from(Buffer.from(base64Of(16, 'png'), 'base64')).buffer;
  const { uploadAvatar, uploads } = loadService(undefined, async () => ({ ok: true, arrayBuffer: async () => bytes }));
  await uploadAvatar({ fileUri: 'file:///a.jpg', contentType: 'image/jpeg', base64Data: base64Of(16) });
  assert.equal(uploads[0].contentType, 'image/png');
  assert.match(uploads[0].filePath, /\.png$/);
});

test('an unsupported byte signature is refused despite an allowed declared type', async () => {
  const { uploadAvatar, uploads } = loadService();
  await assert.rejects(uploadAvatar({ fileUri: 'file:///a.png', contentType: 'image/png', base64Data: Buffer.from('<svg></svg>').toString('base64') }), { reason: 'unsupported-type' });
  assert.equal(uploads.length, 0);
});
