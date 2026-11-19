import { createClient, processLock, type Session, type SignInWithOAuthCredentials, type SignInWithPasswordCredentials } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { Database } from '@/types/database';
import { isIpHostname, isLoopbackHostname } from '@/utils/hostname';
import '@/utils/authCrypto';
import { createSupabaseReadFetch } from '@/services/supabaseReadFetch';
import { createAccountSessionStorage, createBrowserSessionLock } from '@/services/authSessionStorage';

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

export function isNonLoopbackIpOrigin(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) {
    return false;
  }

  const hostname = window.location.hostname;
  return isIpHostname(hostname) && !isLoopbackHostname(hostname);
}

export function getGoogleOAuthRedirectTo(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const origin = removeTrailingSlashes(window.location.origin);
      const lanCallback = `${origin}${GOOGLE_OAUTH_CALLBACK_PATH}`;

      if (__DEV__) {
        console.info('[oauth] Google redirectTo (web)', lanCallback);
      }

      return lanCallback;
    }

    // Never fall back to production Site URL while developing — that is #69.
    if (__DEV__) {
      const redirectTo = `http://localhost:8081${GOOGLE_OAUTH_CALLBACK_PATH}`;
      console.info('[oauth] Google redirectTo (web fallback)', redirectTo);
      return redirectTo;
    }

    return `${resolveAuthWebBaseUrl()}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  }

  const redirectTo = Linking.createURL('callback');

  if (__DEV__) {
    console.info('[oauth] Google redirectTo (native)', redirectTo);
  }

  return redirectTo;
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
const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
const sharedLock = Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks
  ? createBrowserSessionLock(navigator.locks)
  : processLock;
let authLockName: string | null = null;
const runAuthLock: typeof processLock = (name, timeout, work) => {
  authLockName = name;
  return sharedLock(name, timeout, work);
};
const accountStorage = authStorage
  ? createAccountSessionStorage(authStorage, authStorageKey, work => sharedLock(`storage:${authStorageKey}`, 10_000, work))
  : null;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: { retry: false },
  global: { fetch: createSupabaseReadFetch(supabaseUrl) },
  auth: {
    ...(accountStorage ? { storage: accountStorage.storage } : {}),
    storageKey: authStorageKey,
    flowType: 'pkce',
    lock: runAuthLock,
    autoRefreshToken: authStorage !== undefined,
    persistSession: authStorage !== undefined,
    detectSessionInUrl: false,
  },
});

// The SDK does not acquire its session lock for these two entry points.
// Keep an older password response from clearing a verifier just issued for Google.
function serializeSignIn<T>(work: () => Promise<T>): Promise<T> {
  return runAuthLock(authLockName ?? `lock:${authStorageKey}`, 10_000, work);
}

export function signInWithPassword(credentials: SignInWithPasswordCredentials) {
  return serializeSignIn(() => supabase.auth.signInWithPassword(credentials));
}

export function beginOAuthSignIn(credentials: SignInWithOAuthCredentials) {
  return serializeSignIn(() => supabase.auth.signInWithOAuth(credentials));
}

export async function deleteAccountForCurrentSession(expectedUserId: string): Promise<{
  accountChanged: boolean;
  error: { message: string; code?: string; hint?: string } | null;
}> {
  if (!accountStorage || !authLockName) return { accountChanged: true, error: null };

  // Drain earlier refreshes; use an isolated token-bound client inside this lock.
  return runAuthLock(authLockName, 10_000, async () => {
    const session = await accountStorage.readSession();
    if (session?.user.id !== expectedUserId) return { accountChanged: true, error: null };
    await accountStorage.reserveDeletion(expectedUserId);
    const bound = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      global: { fetch: createSupabaseReadFetch(supabaseUrl!) },
      accessToken: async () => session.access_token,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    let committed = false;
    try {
      const { error } = await bound.rpc('delete_own_account', { p_expected_user_id: expectedUserId });
      if (error) {
        await accountStorage.cancelDeletion(expectedUserId);
        return { accountChanged: false, error };
      }
      committed = true;
      const cleared = await accountStorage.clearForAccount(expectedUserId);
      return { accountChanged: !cleared, error: null };
    } catch (error) {
      if (!committed) await accountStorage.cancelDeletion(expectedUserId);
      throw error;
    }
  });
}

export function isDeletedAuthAccount(userId: string): Promise<boolean> {
  return accountStorage?.isDeleted(userId) ?? Promise.resolve(false);
}

export function subscribeDeletedAuthAccounts(listener: (userId: string) => void): () => void {
  return accountStorage?.subscribe(listener) ?? (() => undefined);
}

export function observeDeletedAuthAccount(key: string | null, value: string | null): void {
  accountStorage?.observeDeletion(key, value);
}

export async function updateRecoveredPassword(session: Session, password: string): Promise<void> {
  const recoveryClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `lyfttrack.recovery.${session.user.id}.${Date.now()}`,
    },
  });
  try {
    const { data, error } = await recoveryClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw error;
    if (data.session?.user.id !== session.user.id) throw new Error('recovery-session-changed');
    const { error: updateError } = await recoveryClient.auth.updateUser({ password });
    if (updateError) throw updateError;
  } finally {
    recoveryClient.auth.stopAutoRefresh();
  }
}
