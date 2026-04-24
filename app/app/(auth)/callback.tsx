import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
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

export default function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const [message, setMessage] = useState(t('auth.callback.loading'));
  const [isError, setIsError] = useState(false);

  const callbackUrl = useMemo(() => buildCallbackUrl(params), [params]);

  useEffect(() => {
    let cancelled = false;

    const exchangeSession = async () => {
      const errorDescription = readRouteValue(params.error_description) || readRouteValue(params.error);

      if (errorDescription) {
        if (!cancelled) {
          setIsError(true);
          setMessage(t('auth.callback.errorDescription'));
        }
        return;
      }

      const code = readRouteValue(params.code);

      if (!code) {
        if (!cancelled) {
          setIsError(true);
          setMessage(t('auth.callback.missingCode'));
        }
        return;
      }

      try {
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

        router.replace('/(tabs)/workout' as any);
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
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88} onPress={() => router.replace('/(auth)/sign-in' as any)}>
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
    borderColor: '#1C1C1E',
    borderRadius: 14,
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
    borderColor: '#2A2A2E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  title: {
    color: '#FFFFFF',
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
    borderRadius: 10,
    backgroundColor: palette.accent,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
