import assert from 'node:assert/strict';
import { resolveAuthAvatarUrl } from '../app/src/utils/authAvatarUrl.ts';

assert.equal(resolveAuthAvatarUrl(null), null);
assert.equal(resolveAuthAvatarUrl(undefined), null);
assert.equal(resolveAuthAvatarUrl({}), null);
assert.equal(resolveAuthAvatarUrl({ avatar_url: '' }), null);
assert.equal(resolveAuthAvatarUrl({ avatar_url: '   ' }), null);
assert.equal(resolveAuthAvatarUrl({ picture: 'not-a-url' }), null);
assert.equal(resolveAuthAvatarUrl({ avatar_url: 'http://lh3.googleusercontent.com/photo' }), null);
assert.equal(resolveAuthAvatarUrl({ avatar_url: 'javascript:alert(1)' }), null);
assert.equal(
  resolveAuthAvatarUrl({
    avatar_url: 'http://lh3.googleusercontent.com/photo',
    picture: 'https://lh3.googleusercontent.com/a/photo',
  }),
  'https://lh3.googleusercontent.com/a/photo',
);

const googlePhoto = 'https://lh3.googleusercontent.com/a/photo';
assert.equal(resolveAuthAvatarUrl({ avatar_url: googlePhoto }), googlePhoto);
assert.equal(resolveAuthAvatarUrl({ picture: googlePhoto }), googlePhoto);
assert.equal(
  resolveAuthAvatarUrl({
    avatar_url: googlePhoto,
    picture: 'https://example.com/other.png',
  }),
  googlePhoto,
);
assert.equal(
  resolveAuthAvatarUrl({ avatar_url: `  ${googlePhoto}  ` }),
  googlePhoto,
);

const tooLong = `https://lh3.googleusercontent.com/${'a'.repeat(500)}`;
assert.equal(resolveAuthAvatarUrl({ avatar_url: tooLong }), null);
