import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

/** Accounts created before this ship window are not forced through the new setup screens. */
export const AUTH_SETUP_LEGACY_BEFORE = '2026-07-27T00:00:00.000Z';

export function isGoogleAuthUser(user: User): boolean {
  const providers = user.app_metadata?.providers;

  if (Array.isArray(providers) && providers.includes('google')) {
    return true;
  }

  return user.app_metadata?.provider === 'google';
}

function hasMetadataTimestamp(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isLegacyAccount(user: User): boolean {
  if (!user.created_at) {
    return false;
  }

  return Date.parse(user.created_at) < Date.parse(AUTH_SETUP_LEGACY_BEFORE);
}

/** Google users must confirm username/name once; email signup already collected them. */
export function needsUsernameReview(user: User): boolean {
  const metadata = user.user_metadata ?? {};

  if (hasMetadataTimestamp(metadata.username_confirmed_at)) {
    return false;
  }

  if (!isGoogleAuthUser(user)) {
    return false;
  }

  if (isLegacyAccount(user)) {
    return false;
  }

  return true;
}

/** Optional photo / weight / height screen — one Continuar, fields may be empty. */
export function needsOptionalOnboarding(user: User): boolean {
  const metadata = user.user_metadata ?? {};

  if (hasMetadataTimestamp(metadata.onboarding_completed_at)) {
    return false;
  }

  if (isLegacyAccount(user)) {
    return false;
  }

  return true;
}

export async function markUsernameConfirmed(): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { username_confirmed_at: new Date().toISOString() },
  });

  if (error) {
    throw error;
  }
}

export async function markOnboardingCompleted(): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { onboarding_completed_at: new Date().toISOString() },
  });

  if (error) {
    throw error;
  }
}

export function suggestUsernameFromGoogle(user: User): string {
  const metadata = (user.user_metadata ?? {}) as {
    preferred_username?: string;
    user_name?: string;
    full_name?: string;
    name?: string;
  };

  const raw =
    metadata.preferred_username ||
    metadata.user_name ||
    metadata.full_name ||
    metadata.name ||
    user.email?.split('@')[0] ||
    `user_${user.id.replace(/-/g, '').slice(0, 8)}`;

  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '')
    .slice(0, 24);
}

export function suggestDisplayNameFromGoogle(user: User): string {
  const metadata = (user.user_metadata ?? {}) as { full_name?: string; name?: string };

  const fromMeta = (metadata.full_name || metadata.name || '').trim();
  if (fromMeta) {
    return fromMeta.slice(0, 60);
  }

  const emailPrefix = user.email?.split('@')[0]?.trim();
  return emailPrefix ? emailPrefix.slice(0, 60) : '';
}
