import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getGoogleOAuthRedirectTo, supabase } from '@/services/supabase';

/**
 * OAuth leaves the app before a session exists, so the acceptance recorded on
 * the sign-up screen cannot be written to user metadata at the moment it is
 * given. It is parked here and applied once the callback establishes a session.
 */
const PENDING_TERMS_ACCEPTANCE_KEY = 'lyfttrack.auth.pendingTermsAcceptedAt';

export async function markTermsAcceptedForOAuth(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_TERMS_ACCEPTANCE_KEY, new Date().toISOString());
  } catch (error) {
    console.warn('[authService] Unable to park terms acceptance before OAuth', error);
  }
}

/**
 * Applies a parked acceptance after the OAuth callback. Only writes when the
 * user does not already have one, so signing in again never overwrites the
 * original acceptance date.
 */
export async function applyPendingTermsAcceptance(): Promise<void> {
  let pendingAcceptedAt: string | null = null;

  try {
    pendingAcceptedAt = await AsyncStorage.getItem(PENDING_TERMS_ACCEPTANCE_KEY);
  } catch (error) {
    console.warn('[authService] Unable to read parked terms acceptance', error);
    return;
  }

  if (!pendingAcceptedAt) {
    return;
  }

  try {
    const { data } = await supabase.auth.getUser();
    const existingAcceptedAt = (data.user?.user_metadata as { terms_accepted_at?: unknown } | undefined)
      ?.terms_accepted_at;

    if (typeof existingAcceptedAt !== 'string' || existingAcceptedAt.trim().length === 0) {
      const { error } = await supabase.auth.updateUser({
        data: { terms_accepted_at: pendingAcceptedAt },
      });

      if (error) {
        throw error;
      }
    }
  } catch (error) {
    // Not fatal to the login itself; the gate in the UI already blocked
    // account creation without acceptance.
    console.warn('[authService] Unable to persist terms acceptance after OAuth', error);
    return;
  }

  try {
    await AsyncStorage.removeItem(PENDING_TERMS_ACCEPTANCE_KEY);
  } catch (error) {
    console.warn('[authService] Unable to clear parked terms acceptance', error);
  }
}

export async function startGoogleOAuth(): Promise<void> {
  const redirectTo = getGoogleOAuthRedirectTo();

  if (__DEV__) {
    console.info('[oauth] startGoogleOAuth redirectTo', redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    throw new Error('oauth-start-failed');
  }

  if (__DEV__) {
    try {
      const authorizeUrl = new URL(data.url);
      const asked = authorizeUrl.searchParams.get('redirect_to');
      console.info('[oauth] authorize redirect_to', asked);

      // Production bounce with ?lan_return= is intentional for Tailscale/Wi-Fi IPs.
      const isLanBounce = Boolean(asked && /[?&]lan_return=/.test(asked));

      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        asked &&
        /vercel\.app|lyfttrack\.app/i.test(asked) &&
        !isLanBounce
      ) {
        window.alert(`ERRO: redirect_to ainda e producao:\n${asked}`);
        throw new Error('oauth-start-failed');
      }
    } catch (probeError) {
      if (probeError instanceof Error && probeError.message === 'oauth-start-failed') {
        throw probeError;
      }

      console.info('[oauth] authorize url', data.url);
    }
  }

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      throw new Error('oauth-start-failed');
    }

    window.location.assign(data.url);
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    throw new Error('oauth-cancelled');
  }
}
