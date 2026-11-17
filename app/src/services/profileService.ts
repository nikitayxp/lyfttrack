import type { User } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { deleteAccountForCurrentSession, supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow, getSessionUserOrThrow } from '@/services/authUserService';
import { onAuthAccountChange } from '@/services/authSessionStore';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';
import { resolveAuthAvatarUrl } from '@/utils/authAvatarUrl';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';
import { USERNAME_MAX_LENGTH, isValidUsername, normalizeUsername, sanitizeUsernameInput } from '@/utils/username';

export type ProfileRow = Tables<'profiles'>;
export type PublicProfileView = Pick<
  ProfileRow,
  'id' | 'username' | 'full_name' | 'avatar_url' | 'bio' | 'visibility'
>;

const PROFILE_CARD_COLUMNS = 'id, username, avatar_url, visibility, updated_at';
let profileEpoch = 0;
let profileCache: { accountId: string; value: ProfileRow; expiresAt: number } | null = null;
const pendingProfiles = new Map<string, Promise<ProfileRow>>();

export function invalidateProfileCache(): void {
  profileEpoch++;
  profileCache = null;
  pendingProfiles.clear();
}

onAuthAccountChange(invalidateProfileCache);

type ProfileCard = Omit<ProfileRow, 'bio' | 'height_cm' | 'full_name'>;

async function getProfileDetails(profileId: string): Promise<Pick<ProfileRow, 'bio' | 'height_cm' | 'full_name'>> {
  const { data, error } = await supabase
    .from('profile_private_details')
    .select('bio, height_cm, full_name')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load profile: ${error.message}`);
  }

  return { bio: data?.bio ?? null, height_cm: data?.height_cm ?? null, full_name: data?.full_name ?? null };
}

async function withProfileDetails(card: ProfileCard): Promise<ProfileRow> {
  return { ...card, ...(await getProfileDetails(card.id)) };
}

export type UpdateProfileInput = {
  username?: string;
  fullName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  heightCm?: number | null;
  visibility?: 'public' | 'friends' | 'private';
};

export type UploadAvatarInput = {
  fileUri: string;
  fileName?: string;
  contentType?: string;
  base64Data?: string | null;
};

type AuthUserMetadata = {
  username?: unknown;
  full_name?: unknown;
  display_name?: unknown;
  bio?: unknown;
  [key: string]: unknown;
};

export function withAvatarCacheBuster(url: string | null | undefined, versionToken: number): string | null {
  if (!url) {
    return null;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${versionToken}`;
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
  stripTags = true
): string | null {
  return sanitizeText(value, {
    maxLength,
    allowEmpty: true,
    stripTags,
  });
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildBaseUsername(user: User): string {
  const metadata = user.user_metadata ?? {};

  const fromMetadata = sanitizeUsernameInput(typeof metadata.username === 'string' ? metadata.username : '');
  if (fromMetadata.length >= 3) {
    return fromMetadata;
  }

  const emailPrefix = user.email?.split('@')[0] ?? '';
  const fromEmail = sanitizeUsernameInput(emailPrefix);
  if (fromEmail.length >= 3) {
    return fromEmail;
  }

  return `user_${user.id.replace(/-/g, '').slice(0, 8)}`;
}

function buildCreateProfileRow(user: User, username: string): TablesInsert<'profiles'> {
  const metadata = (user.user_metadata ?? {}) as { full_name?: string; display_name?: string };
  const fullNameFromMetadata = metadata.full_name ?? metadata.display_name ?? null;

  return {
    id: user.id,
    username,
    full_name: normalizeOptionalText(fullNameFromMetadata, INPUT_LIMITS.nameMax),
    avatar_url: resolveAuthAvatarUrl(user.user_metadata),
    bio: null,
    visibility: 'public',
  };
}

function normalizeMetadataString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasMetadataMismatch(currentValue: unknown, nextValue: string | null): boolean {
  return normalizeMetadataString(currentValue) !== nextValue;
}

async function syncAuthMetadataFromProfile(user: User, profile: ProfileRow): Promise<void> {
  const currentMetadata = (user.user_metadata ?? {}) as AuthUserMetadata;
  const normalizedFullName = normalizeOptionalText(profile.full_name, INPUT_LIMITS.nameMax);
  const normalizedBio = normalizeOptionalText(profile.bio, INPUT_LIMITS.bioMax);

  const needsSync =
    hasMetadataMismatch(currentMetadata.username, profile.username) ||
    hasMetadataMismatch(currentMetadata.full_name, normalizedFullName) ||
    hasMetadataMismatch(currentMetadata.display_name, normalizedFullName) ||
    hasMetadataMismatch(currentMetadata.bio, normalizedBio);

  if (!needsSync) {
    return;
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      ...currentMetadata,
      username: profile.username,
      full_name: normalizedFullName,
      display_name: normalizedFullName,
      bio: normalizedBio,
    },
  });

  if (error) {
    throw new Error(`Unable to sync auth metadata: ${error.message}`);
  }
}

function inferExtension(fileUri: string, fileName?: string): string {
  const source = (fileName ?? fileUri).toLowerCase();
  const match = source.match(/\.([a-z0-9]+)(?:\?|$)/);

  if (!match) {
    return 'jpg';
  }

  return match[1];
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const AVATAR_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class AvatarValidationError extends Error {
  constructor(readonly reason: 'too-large' | 'unsupported-type') {
    super(reason === 'too-large' ? 'Avatar file is too large.' : 'Avatar file type is not supported.');
    this.name = 'AvatarValidationError';
  }
}

const AVATAR_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function inferContentType(extension: string, providedType?: string): string {
  const normalizedType = providedType?.trim().toLowerCase();
  const candidate = normalizedType === 'image/jpg'
    ? 'image/jpeg'
    : normalizedType || AVATAR_TYPE_BY_EXTENSION[extension];

  if (!candidate || !AVATAR_EXTENSION_BY_TYPE[candidate]) {
    throw new AvatarValidationError('unsupported-type');
  }

  return candidate;
}

export async function pickAvatarFromLibrary(): Promise<UploadAvatarInput | null> {
  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permissionResult.granted) {
    throw new Error('Photo library permission is required to upload an avatar.');
  }

  const pickerResult = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    base64: true,
  });

  if (pickerResult.canceled || pickerResult.assets.length === 0) {
    return null;
  }

  const asset = pickerResult.assets[0];
  const contentType = inferContentType(inferExtension(asset.uri, asset.fileName ?? undefined), asset.mimeType ?? undefined);
  const selectedSize = asset.fileSize ?? (asset.base64 ? decodeBase64(asset.base64).byteLength : undefined);
  if (selectedSize != null && selectedSize > AVATAR_MAX_BYTES) {
    throw new AvatarValidationError('too-large');
  }

  return {
    fileUri: asset.uri,
    fileName: asset.fileName ?? `avatar-${Date.now()}.${inferExtension(asset.uri)}`,
    contentType,
    base64Data: asset.base64,
  };
}

async function createProfileForExistingUser(user: User): Promise<ProfileRow> {
  const baseUsername = buildBaseUsername(user);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = attempt === 0 ? baseUsername : `${baseUsername.slice(0, USERNAME_MAX_LENGTH - 5)}_${Math.floor(Math.random() * 9000) + 1000}`;
    const insertRow = buildCreateProfileRow(user, username);

    const { data: card, error } = await supabase
      .from('profiles')
      .insert(insertRow)
      .select(PROFILE_CARD_COLUMNS)
      .single();

    if (!error && card) {
      const data = await withProfileDetails(card);

      try {
        await syncAuthMetadataFromProfile(user, data);
      } catch (syncError) {
        console.warn('[profileService] Metadata sync skipped after profile bootstrap', syncError);
      }

      return data;
    }

    if (error?.code === '23505') {
      const { data: existingCard, error: existingError } = await supabase
        .from('profiles')
        .select(PROFILE_CARD_COLUMNS)
        .eq('id', user.id)
        .maybeSingle();

      if (existingError) {
        throw new Error(`Unable to load profile: ${existingError.message}`);
      }

      if (existingCard) {
        return withProfileDetails(existingCard);
      }

      continue;
    }

    throw new Error(`Unable to initialize profile: ${error?.message ?? 'Unknown error'}`);
  }

  throw new Error('Unable to initialize profile: could not generate a unique username.');
}

async function loadProfile(user: User): Promise<ProfileRow> {
  const { data: card, error } = await supabase
    .from('profiles')
    .select(PROFILE_CARD_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load profile: ${error.message}`);
  }

  if (card) {
    return withProfileDetails(card);
  }

  return createProfileForExistingUser(user);
}

export async function getProfile(): Promise<ProfileRow> {
  const user = await getSessionUserOrThrow();
  if (profileCache && profileCache.accountId !== user.id) invalidateProfileCache();
  if (profileCache && profileCache.expiresAt > Date.now()) return profileCache.value;
  let pending = pendingProfiles.get(user.id);
  if (!pending) {
    const epoch = profileEpoch;
    pending = loadProfile(user).then(async value => {
      const current = await getSessionUserOrThrow();
      if (current.id !== user.id) throw new Error('Session changed while loading profile. Please try again.');
      if (epoch === profileEpoch) profileCache = { accountId: user.id, value, expiresAt: Date.now() + 30_000 };
      return value;
    });
    pendingProfiles.set(user.id, pending);
  }
  try {
    return await pending;
  } finally {
    if (pendingProfiles.get(user.id) === pending) pendingProfiles.delete(user.id);
  }
}

export async function getPublicProfileById(profileId: string): Promise<PublicProfileView | null> {
  const normalizedProfileId = normalizeOptionalId(profileId);

  if (!normalizedProfileId) {
    throw new Error('Profile id is required.');
  }

  const { data, error } = await supabase
    .from('profile_cards')
    .select('id, username, full_name, avatar_url, visibility')
    .eq('id', normalizedProfileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const { bio } = await getProfileDetails(data.id);
  return { ...data, bio };
}

export type AccountDeletionFailure = 'avatar-cleanup-failed' | 'account-changed';

export class AccountDeletionError extends Error {
  constructor(readonly reason: AccountDeletionFailure) {
    super(reason === 'avatar-cleanup-failed'
      ? 'Unable to remove stored avatars. The account was not deleted. Please try again.'
      : 'Account changed while deleting. Please try again.');
    this.name = 'AccountDeletionError';
  }
}

async function assertDeletionAccount(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== userId) {
    throw new AccountDeletionError('account-changed');
  }
}

/** List every page before removing files; folders are virtual Storage prefixes. */
async function deleteStoredAvatars(userId: string): Promise<void> {
  try {
    const folders = [userId];
    const visited = new Set<string>();
    const paths = new Set<string>();
    const bucket = supabase.storage.from('avatars');

    for (let index = 0; index < folders.length; index++) {
      const folder = folders[index];
      if (visited.has(folder)) continue;
      visited.add(folder);

      for (let offset = 0; ; offset += 100) {
        await assertDeletionAccount(userId);
        const { data, error } = await bucket.list(folder, {
          limit: 100,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        });
        if (error) throw error;

        const entries = data ?? [];
        for (const file of entries) {
          if (!file.name || file.name === '.' || file.name === '..' || /[/\\]/.test(file.name)) {
            throw new Error('Invalid avatar object name');
          }
          const objectPath = `${folder}/${file.name}`;
          if (file.id === null) folders.push(objectPath);
          else paths.add(objectPath);
        }
        if (entries.length < 100) break;
      }
    }

    const files = Array.from(paths);
    for (let offset = 0; offset < files.length; offset += 1000) {
      await assertDeletionAccount(userId);
      const { error } = await bucket.remove(files.slice(offset, offset + 1000));
      if (error) throw error;
    }
  } catch (error) {
    if (error instanceof AccountDeletionError) throw error;
    throw new AccountDeletionError('avatar-cleanup-failed');
  }
}

/**
 * Remove avatars through Storage, then let the database remove account data.
 * The server checks the account ID and refuses deletion if any avatar remains.
 * An issued JWT can outlive the auth row, so uploads also check the live owner.
 */
export async function deleteOwnAccount(expectedUserId: string): Promise<void> {
  // The server validates the JWT. A local session also permits a safe retry if
  // the deletion committed but its response was lost and Auth no longer has it.
  await assertDeletionAccount(expectedUserId);
  await deleteStoredAvatars(expectedUserId);
  await assertDeletionAccount(expectedUserId);

  const { error, accountChanged } = await deleteAccountForCurrentSession(expectedUserId);
  if (accountChanged) throw new AccountDeletionError('account-changed');
  if (error) {
    if (error.hint === 'account_avatar_cleanup_required') {
      throw new AccountDeletionError('avatar-cleanup-failed');
    }
    if (error.code === '42501' && error.message === 'Account changed while deleting. Please try again.') {
      throw new AccountDeletionError('account-changed');
    }
    throw new Error(`Unable to delete account: ${error.message}`);
  }
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const normalizedUsername = normalizeUsername(username);

  if (!isValidUsername(normalizedUsername)) {
    return false;
  }

  const { data, error } = await (supabase.rpc as any)('check_username_available', {
    target_username: normalizedUsername,
  });

  if (error) {
    console.warn('[profileService] Error checking username availability:', error);
    return false;
  }

  return data === true;
}

export async function updateProfile(input: UpdateProfileInput): Promise<ProfileRow> {
  const user = await getAuthenticatedUserOrThrow();
  const existingProfile = await getProfile();

  const updateRow: TablesUpdate<'profiles'> = {};

  if (input.username !== undefined) {
    const normalizedUsername = normalizeUsername(input.username);

    if (!isValidUsername(normalizedUsername)) {
      throw new Error('Username must contain 3 to 24 letters, digits, periods or underscores.');
    }

    updateRow.username = normalizedUsername;
  }

  if (input.fullName !== undefined) {
    updateRow.full_name = normalizeOptionalText(input.fullName, INPUT_LIMITS.nameMax);
  }

  if (input.bio !== undefined) {
    updateRow.bio = normalizeOptionalText(input.bio, INPUT_LIMITS.bioMax);
  }

  if (input.avatarUrl !== undefined) {
    updateRow.avatar_url = normalizeOptionalText(input.avatarUrl, 500, false);
  }

  if (input.heightCm !== undefined) {
    updateRow.height_cm = input.heightCm;
  }

  if (input.visibility !== undefined) {
    updateRow.visibility = input.visibility;
  }

  if (Object.keys(updateRow).length === 0) {
    return existingProfile;
  }

  const { data: card, error } = await supabase
    .from('profiles')
    .update(updateRow)
    .eq('id', user.id)
    .select(PROFILE_CARD_COLUMNS)
    .single();

  if (error || !card) {
    throw new Error(`Unable to update profile: ${error?.message ?? 'Unknown error'}`);
  }

  const data = await withProfileDetails(card);

  invalidateProfileCache();
  const current = await getSessionUserOrThrow();
  if (current.id !== user.id) throw new Error('Session changed while updating profile. Please try again.');
  // A later avatar/profile mutation may have completed while details loaded.
  // Let the next read fetch current state instead of caching this older card.

  try {
    await syncAuthMetadataFromProfile(user, data);
  } catch (syncError) {
    console.warn('[profileService] Metadata sync skipped after profile update', syncError);
  }

  return data;
}

export async function uploadAvatar(input: UploadAvatarInput): Promise<ProfileRow> {
  const user = await getAuthenticatedUserOrThrow();

  const normalizedUri = input.fileUri.trim();
  if (!normalizedUri) {
    throw new Error('Avatar file URI is required.');
  }

  let fileData: ArrayBuffer;

  try {
    const response = await fetch(normalizedUri);

    if (!response.ok) {
      throw new Error('Unable to read avatar file for upload.');
    }

    fileData = await response.arrayBuffer();
  } catch {
    if (!input.base64Data) {
      throw new Error('Unable to read avatar file for upload.');
    }

    fileData = decodeBase64(input.base64Data);
  }

  inferContentType(inferExtension(normalizedUri, input.fileName), input.contentType);

  if (fileData.byteLength > AVATAR_MAX_BYTES) {
    throw new AvatarValidationError('too-large');
  }

  const bytes = new Uint8Array(fileData);
  let contentType: string;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    contentType = 'image/jpeg';
  } else if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) {
    contentType = 'image/png';
  } else if ([82, 73, 70, 70].every((byte, index) => bytes[index] === byte)
    && [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte)) {
    contentType = 'image/webp';
  } else {
    throw new AvatarValidationError('unsupported-type');
  }

  const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${AVATAR_EXTENSION_BY_TYPE[contentType]}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, fileData, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Unable to upload avatar: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', user.id)
    .select(PROFILE_CARD_COLUMNS)
    .single();

  if (updateError || !updatedProfile || updatedProfile.id !== user.id) {
    throw new Error(`Unable to update profile: ${updateError?.message ?? 'Unknown error'}`);
  }

  invalidateProfileCache();
  return withProfileDetails(updatedProfile);
}
