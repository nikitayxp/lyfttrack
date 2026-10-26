import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { supabase } from '@/services/supabase';

const PENDING_RETURN_KEY = 'lyfttrack.auth.oauth.pending';
const CONSUMED_RETURN_PREFIX = 'lyfttrack.auth.oauth.used.';
const exchanges = new Map<string, Promise<void>>();
let completionQueue = Promise.resolve();

function serializeReturn(consume: () => Promise<void>): Promise<void> {
  const next = completionQueue.then(async () => {
    if (typeof window !== 'undefined' && window.navigator?.locks) {
      await window.navigator.locks.request('lyfttrack.oauth.return', consume);
      return;
    }
    await consume();
  });
  completionQueue = next.catch(() => {});
  return next;
}

export async function beginGoogleOAuthReturn(): Promise<void> {
  await AsyncStorage.setItem(PENDING_RETURN_KEY, String(Date.now()));
}

export async function cancelGoogleOAuthReturn(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_RETURN_KEY);
}

async function requireExistingSession(message = 'oauth-missing-code'): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error(message);
}

function sanitizeBrowserReturn(returnUrl: URL): void {
  if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
  const current = new URL(window.location.href);
  if (current.origin !== returnUrl.origin || current.pathname !== returnUrl.pathname) return;
  for (const key of ['code', 'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token', 'id_token', 'token_hash', 'token_type', 'expires_in', 'expires_at']) {
    current.searchParams.delete(key);
  }
  current.hash = '';
  window.history.replaceState(null, '', current.toString());
}

export async function completeGoogleOAuthReturn(returnUrl: string): Promise<void> {
  const url = new URL(returnUrl);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const providerError = url.searchParams.get('error_description') || url.searchParams.get('error') ||
    hash.get('error_description') || hash.get('error');
  if (providerError) throw new Error(providerError);

  const code = url.searchParams.get('code');
  const accessToken = hash.get('access_token') || url.searchParams.get('access_token');
  const refreshToken = hash.get('refresh_token') || url.searchParams.get('refresh_token');
  const credential = code ? ['code', code] : accessToken && refreshToken ? ['tokens', accessToken] : null;
  if (!credential) {
    await requireExistingSession();
    sanitizeBrowserReturn(url);
    return;
  }

  const fingerprint = bytesToHex(sha256(utf8ToBytes(JSON.stringify(credential))));
  const previous = exchanges.get(fingerprint);
  if (previous) {
    await previous;
    await requireExistingSession();
    sanitizeBrowserReturn(url);
    return;
  }

  const promise = serializeReturn(async () => {
    const consumedKey = `${CONSUMED_RETURN_PREFIX}${fingerprint}`;
    if (await AsyncStorage.getItem(consumedKey)) {
      await requireExistingSession();
      return;
    }
    const pending = await AsyncStorage.getItem(PENDING_RETURN_KEY);
    const startedAt = Number(pending);
    if (!pending || !Number.isFinite(startedAt) || Date.now() - startedAt > 60 * 60_000 || startedAt > Date.now()) {
      await requireExistingSession('oauth-unexpected-return');
      return;
    }
    await AsyncStorage.setItem(consumedKey, '1');
    await AsyncStorage.removeItem(PENDING_RETURN_KEY);
    try {
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
      if (error) throw new Error(error.message);
    } catch (error) {
      await AsyncStorage.removeItem(consumedKey);
      await AsyncStorage.setItem(PENDING_RETURN_KEY, pending);
      throw error;
    }
  });
  exchanges.set(fingerprint, promise);
  try {
    await promise;
    sanitizeBrowserReturn(url);
  } finally {
    if (exchanges.get(fingerprint) === promise) exchanges.delete(fingerprint);
  }
}
