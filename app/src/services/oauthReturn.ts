import { supabase } from '@/services/supabase';

const pendingExchanges = new Map<string, Promise<string>>();
const completedCodes = new Map<string, string>();
const returnCredentialKeys = ['code', 'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token', 'id_token', 'token_hash', 'type', 'token_type', 'expires_in', 'expires_at', 'lan_return', 'error', 'error_description'];

export const clearedAuthReturnParams: Record<string, string | undefined> = {
  ...Object.fromEntries(returnCredentialKeys.map(key => [key, undefined])),
  '#': '',
};

export function authReturnParamsKey(params: Record<string, string | string[] | undefined>): string {
  const values = new URLSearchParams();
  for (const key of Object.keys(clearedAuthReturnParams)) {
    const value = Array.isArray(params[key]) ? params[key][0] : params[key];
    if (value?.trim()) values.set(key, value.trim());
  }
  return values.toString();
}

export function readAuthReturnUrl(routeParamsKey: string, fallback: string): URL {
  const url = new URL(typeof window !== 'undefined' && window.location ? window.location.href : fallback);
  for (const [key, value] of new URLSearchParams(routeParamsKey)) {
    if (key === '#') url.hash = value;
    else if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url;
}

async function requireSession(expectedUserId?: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const userId = data.session?.user.id;
  if (!userId) throw new Error('oauth-missing-code');
  if (expectedUserId && userId !== expectedUserId) throw new Error('auth-return-session-changed');
  return userId;
}

function scrubBrowserReturn(returnUrl: URL): void {
  if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
  const current = new URL(window.location.href);
  if (current.origin !== returnUrl.origin || current.pathname !== returnUrl.pathname) return;
  for (const key of returnCredentialKeys) {
    current.searchParams.delete(key);
  }
  current.hash = '';
  window.history.replaceState(null, '', current.toString());
}

export async function completeGoogleOAuthReturn(returnUrl: string): Promise<string> {
  const url = new URL(returnUrl);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  scrubBrowserReturn(url);

  const providerError = url.searchParams.get('error_description') || url.searchParams.get('error')
    || hash.get('error_description') || hash.get('error');
  if (providerError) throw new Error('oauth-provider-error');
  if (['access_token', 'refresh_token', 'id_token', 'token_hash'].some(key => url.searchParams.has(key) || hash.has(key))) {
    throw new Error('oauth-unexpected-credentials');
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return requireSession();
  }

  return completeReturnOnce(`oauth:${code}`, async () => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('oauth-missing-code');
    return data.session.user.id;
  });
}

async function completeReturnOnce(key: string, verify: () => Promise<string>): Promise<string> {
  const completedUserId = completedCodes.get(key);
  if (completedUserId) {
    return requireSession(completedUserId);
  }
  let exchange = pendingExchanges.get(key);
  if (!exchange) {
    exchange = verify();
    pendingExchanges.set(key, exchange);
  }

  try {
    const userId = await exchange;
    await requireSession(userId);
    completedCodes.set(key, userId);
    if (completedCodes.size > 16) completedCodes.delete(completedCodes.keys().next().value!);
    return userId;
  } finally {
    if (pendingExchanges.get(key) === exchange) pendingExchanges.delete(key);
  }
}

export async function completePasswordRecoveryReturn(returnUrl: string): Promise<string | null> {
  const url = new URL(returnUrl);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  scrubBrowserReturn(url);
  if (['access_token', 'refresh_token', 'id_token', 'error', 'error_description'].some(key => url.searchParams.has(key) || hash.has(key))) {
    throw new Error('recovery-invalid-link');
  }
  const tokenHash = url.searchParams.get('token_hash');
  if (!tokenHash) {
    if (!url.searchParams.get('code')) return null;
    return completeGoogleOAuthReturn(returnUrl);
  }

  if (url.searchParams.get('type') !== 'recovery') throw new Error('recovery-invalid-link');
  return completeReturnOnce(`recovery:${tokenHash}`, async () => {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('recovery-invalid-link');
    return data.session.user.id;
  });
}
