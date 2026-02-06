import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
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

const AUTH_WEB_APP_URL_FALLBACK = 'https://lyfttrack-app.vercel.app';
const PASSWORD_RESET_PATH = '/reset-password';
const SIGN_IN_PATH = '/sign-in';
const GOOGLE_OAUTH_CALLBACK_PATH = '/callback';

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

function resolveAuthWebBaseUrl(): string {
  const explicitAuthWebUrl = normalizeUrlValue(process.env.EXPO_PUBLIC_AUTH_WEB_URL);

  if (explicitAuthWebUrl && !isLocalhostUrl(explicitAuthWebUrl)) {
    return removeTrailingSlashes(explicitAuthWebUrl);
  }

  const siteUrl = normalizeUrlValue(process.env.EXPO_PUBLIC_SITE_URL);

  if (siteUrl && !isLocalhostUrl(siteUrl)) {
    return removeTrailingSlashes(siteUrl);
  }

  return AUTH_WEB_APP_URL_FALLBACK;
}

export function getPasswordResetRedirectTo(): string {
  if (__DEV__ && Platform.OS === 'web') {
    return `http://localhost:8081${PASSWORD_RESET_PATH}`;
  }
  
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${removeTrailingSlashes(window.location.origin)}${PASSWORD_RESET_PATH}`;
  }

  const explicitRedirect = normalizeUrlValue(process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT);

  if (explicitRedirect && !isLocalhostUrl(explicitRedirect)) {
    return explicitRedirect;
  }

  return `${resolveAuthWebBaseUrl()}${PASSWORD_RESET_PATH}`;
}

export function getEmailChangeRedirectTo(): string {
  const explicitRedirect = normalizeUrlValue(process.env.EXPO_PUBLIC_EMAIL_CHANGE_REDIRECT);

  if (explicitRedirect && !isLocalhostUrl(explicitRedirect)) {
    return explicitRedirect;
  }

  return `${resolveAuthWebBaseUrl()}${SIGN_IN_PATH}`;
}

export function getGoogleOAuthRedirectTo(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${removeTrailingSlashes(window.location.origin)}${GOOGLE_OAUTH_CALLBACK_PATH}`;
    }

    return `${resolveAuthWebBaseUrl()}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  }

  return Linking.createURL('callback');
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