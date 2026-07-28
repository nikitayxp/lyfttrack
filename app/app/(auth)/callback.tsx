import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { isAllowedLanReturn } from '@/services/oauthLanReturn';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;

function readRouteValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

function buildCallbackUrl(params: Record<string, string | string[] | undefined>): string {
  const queryParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    const normalizedValue = readRouteValue(value);

    if (normalizedValue) {
      queryParams[key] = normalizedValue;
    }
  }

  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }

  return Linking.createURL('callback', { queryParams });
}

/** Web OAuth may return PKCE `?code=` or implicit `#access_token=` / `#refresh_token=`. */
function readBrowserOAuthParams(): {
  error: string;
  code: string;
  accessToken: string;
  refreshToken: string;
} {
  if (typeof window === 'undefined' || !window.location) {
    return { error: '', code: '', accessToken: '', refreshToken: '' };
  }

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);

  return {
    error:
      url.searchParams.get('error_description') ||
      url.searchParams.get('error') ||
      hash.get('error_description') ||
      hash.get('error') ||
      '',
    code: url.searchParams.get('code') || '',
    accessToken: hash.get('access_token') || '',
    refreshToken: hash.get('refresh_token') || '',
  };
}

export default function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const [message, setMessage] = useState(t('auth.callback.loading'));
  const [isError, setIsError] = useState(false);

  const callbackUrl = useMemo(() => buildCallbackUrl(params), [params]);

  useEffect(() => {
    let cancelled = false;

    const exchangeSession = async () => {
      // Dev LAN OAuth: production callback forwards tokens back to Metro IP (#69).
      if (typeof window !== 'undefined' && window.location) {
        const current = new URL(window.location.href);
        const lanReturn = current.searchParams.get('lan_return');

        if (lanReturn && isAllowedLanReturn(lanReturn)) {
          const dest = new URL(lanReturn);
          current.searchParams.delete('lan_return');
          current.searchParams.forEach((value, key) => {
            dest.searchParams.set(key, value);
          });
          dest.hash = current.hash;
          window.location.replace(dest.toString());
          return;
        }
      }

      const browser = readBrowserOAuthParams();
      const errorDescription =
        browser.error || readRouteValue(params.error_description) || readRouteValue(params.error);

      if (errorDescription) {
        if (!cancelled) {
          setIsError(true);
          setMessage(t('auth.callback.errorDescription'));
        }
        return;
      }

      try {
        // Production currently returns the implicit hash form.
        if (browser.accessToken && browser.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: browser.accessToken,
            refresh_token: browser.refreshToken,
          });

          if (cancelled) {
            return;
          }

          if (error) {
            console.warn('[auth-callback] setSession from hash failed', error);
            setIsError(true);
            setMessage(t('auth.callback.errorDescription'));
            return;
          }

          // Do not router.replace here: the root auth guard redirects once
          // `session` is set. Navigating early races a null session → sign-in.
          return;
        }

        const code = browser.code || readRouteValue(params.code);

        if (!code) {
          const { data } = await supabase.auth.getSession();

          if (cancelled) {
            return;
          }

          // Remount after hash clear / guard redirect — session already exists.
          if (data.session) {
            return;
          }

          setIsError(true);
          setMessage(t('auth.callback.missingCode'));
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(callbackUrl);

        if (cancelled) {
          return;
        }

        if (error) {
          console.warn('[auth-callback] exchangeCodeForSession failed', error);
          setIsError(true);
          setMessage(t('auth.callback.errorDescription'));
          return;
        }

        // Auth guard redirects on session; terms apply on SIGNED_IN in _layout.
      } catch (exchangeError) {
        if (cancelled) {
          return;
        }

        console.warn('[auth-callback] unexpected OAuth callback failure', exchangeError);
        setIsError(true);
        setMessage(t('auth.callback.errorDescription'));
      }
    };

    void exchangeSession();

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, params.code, params.error, params.error_description, t]);

  return (
    <AuthAmbientGlow>
      <View style={styles.screen}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {isError ? (
              <Ionicons name="alert-circle-outline" size={24} color="#FCA5A5" />
            ) : (
              <ActivityIndicator color={palette.accent} />
            )}
          </View>

          <Text style={styles.title}>{t('auth.callback.title')}</Text>
          <Text style={styles.subtitle}>{message}</Text>

          {isError ? (
            <TouchableOpacity 
              style={styles.primaryButton} 
              activeOpacity={ACTIVE_OPACITY} 
              onPress={() => router.replace('/(auth)/sign-in' as any)}
              accessibilityRole="button"
              accessibilityLabel={t('auth.callback.backAction')}
            >
              <Text style={styles.primaryButtonText}>{t('auth.callback.backAction')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </AuthAmbientGlow>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(17, 17, 17, 0.72)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    rowGap: Spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: Spacing.sm,
    minHeight: 50,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: palette.accent,
  },
  primaryButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
});
