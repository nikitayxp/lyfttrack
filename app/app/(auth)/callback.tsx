import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { AppButton } from '@/components/ui/AppButton';
import { isAllowedLanReturn } from '@/services/oauthLanReturn';
import * as Linking from 'expo-linking';
import { completeGoogleOAuthReturn } from '@/services/oauthReturn';

const palette = Colors.dark;

function readRouteValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

export default function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const routeCode = readRouteValue(params.code);
  const routeError = readRouteValue(params.error);
  const routeErrorDescription = readRouteValue(params.error_description);
  const [messageKey, setMessageKey] = useState('auth.callback.loading');
  const [isError, setIsError] = useState(false);

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

      try {
        let returnUrl: string;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
          const url = new URL(window.location.href);
          if (routeCode && !url.searchParams.has('code')) url.searchParams.set('code', routeCode);
          if (routeError && !url.searchParams.has('error')) url.searchParams.set('error', routeError);
          if (routeErrorDescription && !url.searchParams.has('error_description')) url.searchParams.set('error_description', routeErrorDescription);
          returnUrl = url.toString();
        } else {
          const initialUrl = routeCode || routeError || routeErrorDescription
            ? null
            : await Linking.getInitialURL();
          const url = new URL(initialUrl || 'lyfttrack://callback');
          if (routeCode) url.searchParams.set('code', routeCode);
          if (routeError) url.searchParams.set('error', routeError);
          if (routeErrorDescription) url.searchParams.set('error_description', routeErrorDescription);
          returnUrl = url.toString();
        }
        await completeGoogleOAuthReturn(returnUrl);
        if (!cancelled && Platform.OS !== 'web') {
          router.setParams({ code: undefined, access_token: undefined, refresh_token: undefined, provider_token: undefined, provider_refresh_token: undefined, id_token: undefined, token_hash: undefined });
        }
      } catch (error) {
        if (!cancelled) {
          setIsError(true);
          setMessageKey(error && typeof error === 'object' && 'message' in error && error.message === 'oauth-missing-code'
            ? 'auth.callback.missingCode'
            : 'auth.callback.errorDescription');
        }
      }
    };

    void exchangeSession();

    return () => {
      cancelled = true;
    };
  }, [routeCode, routeError, routeErrorDescription]);

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
          <Text style={styles.subtitle}>{t(messageKey)}</Text>

          {isError ? (
            <AppButton
              label={t('auth.callback.backAction')}
              onPress={() => router.replace('/(auth)/sign-in' as any)}
              style={styles.submitButton}
            />
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
  submitButton: {
    marginTop: Spacing.sm,
  },
});
