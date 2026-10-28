import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { AppButton } from '@/components/ui/AppButton';
import { authReturnParamsKey, clearedAuthReturnParams, completeGoogleOAuthReturn, readAuthReturnUrl } from '@/services/oauthReturn';

const palette = Colors.dark;

export default function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const returnParamsKey = authReturnParamsKey(params);
  const [messageKey, setMessageKey] = useState('auth.callback.loading');
  const [isError, setIsError] = useState(false);
  const didHandleReturn = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const exchangeSession = async () => {
      try {
        const url = readAuthReturnUrl(returnParamsKey, 'lyfttrack://callback');
        if (didHandleReturn.current && !url.hash && !Object.keys(clearedAuthReturnParams).some(key => url.searchParams.has(key))) return;
        didHandleReturn.current = true;
        setIsError(false);
        setMessageKey('auth.callback.loading');
        await completeGoogleOAuthReturn(url.toString());
      } catch (exchangeError) {
        if (cancelled) return;
        setIsError(true);
        setMessageKey(exchangeError instanceof Error && exchangeError.message === 'oauth-missing-code'
          ? 'auth.callback.missingCode' : 'auth.callback.errorDescription');
      } finally {
        if (!cancelled) router.setParams(clearedAuthReturnParams);
      }
    };

    void exchangeSession();

    return () => {
      cancelled = true;
    };
  }, [returnParamsKey]);

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
