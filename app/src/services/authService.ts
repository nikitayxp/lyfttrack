import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getGoogleOAuthRedirectTo, supabase } from '@/services/supabase';

export async function startGoogleOAuth(): Promise<void> {
  const redirectTo = getGoogleOAuthRedirectTo();

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
