import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing required public environment variable: EXPO_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing required public environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

type SupabaseStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

const PASSWORD_RESET_REDIRECT_FALLBACK = 'lyfttrack://reset-password';

function normalizeUrlValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isLocalhostUrl(value: string): boolean {
  return /(^|[/:])(localhost|127\.0\.0\.1)([:/]|$)/i.test(value);
}

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getPasswordResetRedirectTo(): string {
  const explicitRedirect = normalizeUrlValue(process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT);

  if (explicitRedirect && !isLocalhostUrl(explicitRedirect)) {
    return explicitRedirect;
  }

  const siteUrl = normalizeUrlValue(process.env.EXPO_PUBLIC_SITE_URL);

  if (siteUrl && !isLocalhostUrl(siteUrl)) {
    return `${removeTrailingSlashes(siteUrl)}/reset-password`;
  }

  return PASSWORD_RESET_REDIRECT_FALLBACK;
}

function createAuthStorage(): SupabaseStorage | undefined {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) {
      return undefined;
    }

    return {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        window.localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        window.localStorage.removeItem(key);
      },
    };
  }

  return AsyncStorage;
}

const authStorage = createAuthStorage();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(authStorage ? { storage: authStorage } : {}),
    autoRefreshToken: authStorage !== undefined,
    persistSession: authStorage !== undefined,
    detectSessionInUrl: false,
  },
});