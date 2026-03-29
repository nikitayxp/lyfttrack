import type { User } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/workoutService';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type ProfileRow = Tables<'profiles'>;
export type PublicProfileView = Pick<ProfileRow, 'id' | 'username' | 'full_name' | 'avatar_url' | 'bio'>;

export type UpdateProfileInput = {
  username?: string;
  fullName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
};

export type UploadAvatarInput = {
  fileUri: string;
  fileName?: string;
  contentType?: string;
  base64Data?: string | null;
};

export function withAvatarCacheBuster(url: string | null | undefined, versionToken: number): string | null {
  if (!url) {
    return null;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${versionToken}`;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '');
}

function buildBaseUsername(user: User): string {
  const metadata = (user.user_metadata ?? {}) as { username?: string };

  const fromMetadata = sanitizeUsername(metadata.username ?? '');
  if (fromMetadata.length >= 3) {
    return fromMetadata;
  }

  const emailPrefix = user.email?.split('@')[0] ?? '';
  const fromEmail = sanitizeUsername(emailPrefix);
  if (fromEmail.length >= 3) {
    return fromEmail;
  }

  return `user_${user.id.replace(/-/g, '').slice(0, 8)}`;
}

function buildCreateProfileRow(user: User, username: string): TablesInsert<'profiles'> {
  const metadata = (user.user_metadata ?? {}) as { full_name?: string };

  return {
    id: user.id,
    username,
    full_name: normalizeOptionalText(metadata.full_name),
    avatar_url: null,
    bio: null,
  };
}

function inferExtension(fileUri: string, fileName?: string): string {
  const source = (fileName ?? fileUri).toLowerCase();
  const match = source.match(/\.([a-z0-9]+)(?:\?|$)/);

  if (!match) {
    return 'jpg';
  }

  return match[1];
}

function inferContentType(extension: string, providedType?: string): string {
  if (providedType) {
    return providedType;
  }

  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'svg') return 'image/svg+xml';
  return 'image/jpeg';
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

  return {
    fileUri: asset.uri,
    fileName: asset.fileName ?? `avatar-${Date.now()}.${inferExtension(asset.uri)}`,
    contentType: asset.mimeType ?? undefined,
    base64Data: asset.base64,
  };
}

async function createProfileForExistingUser(user: User): Promise<ProfileRow> {
  const baseUsername = buildBaseUsername(user);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = attempt === 0 ? baseUsername : `${baseUsername}_${Math.floor(Math.random() * 9000) + 1000}`;
    const insertRow = buildCreateProfileRow(user, username);

    const { data, error } = await supabase
      .from('profiles')
      .upsert(insertRow, { onConflict: 'id' })
      .select('*')
      .single();

    if (!error && data) {
      return data;
    }

    if (error?.code === '23505') {
      continue;
    }

    throw new Error(`Unable to initialize profile: ${error?.message ?? 'Unknown error'}`);
  }

  throw new Error('Unable to initialize profile: could not generate a unique username.');
}

export async function getProfile(): Promise<ProfileRow> {
  const user = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load profile: ${error.message}`);
  }

  if (data) {
    return data;
  }

  return createProfileForExistingUser(user);
}

export async function getPublicProfileById(profileId: string): Promise<PublicProfileView | null> {
  const normalizedProfileId = normalizeOptionalId(profileId);

  if (!normalizedProfileId) {
    throw new Error('Profile id is required.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio')
    .eq('id', normalizedProfileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load profile: ${error.message}`);
  }

  return data;
}

export async function updateProfile(input: UpdateProfileInput): Promise<ProfileRow> {
  const user = await getAuthenticatedUserOrThrow();
  const existingProfile = await getProfile();

  const updateRow: TablesUpdate<'profiles'> = {};

  if (input.username !== undefined) {
    const normalizedUsername = sanitizeUsername(input.username);

    if (normalizedUsername.length < 3) {
      throw new Error('Username must have at least 3 valid characters.');
    }

    updateRow.username = normalizedUsername;
  }

  if (input.fullName !== undefined) {
    updateRow.full_name = normalizeOptionalText(input.fullName);
  }

  if (input.bio !== undefined) {
    updateRow.bio = normalizeOptionalText(input.bio);
  }

  if (input.avatarUrl !== undefined) {
    updateRow.avatar_url = normalizeOptionalText(input.avatarUrl);
  }

  if (Object.keys(updateRow).length === 0) {
    return existingProfile;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateRow)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Unable to update profile: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

export async function uploadAvatar(input: UploadAvatarInput): Promise<ProfileRow> {
  const user = await getAuthenticatedUserOrThrow();
  await getProfile();

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

  const extension = inferExtension(normalizedUri, input.fileName);
  const contentType = inferContentType(extension, input.contentType);
  const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, fileData, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Unable to upload avatar: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return updateProfile({ avatarUrl: data.publicUrl });
}
