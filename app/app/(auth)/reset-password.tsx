import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;

type RecoveryParams = {
  accessToken: string;
  refreshToken: string;
  type: string;
};

type LocalSearchParams = {
  access_token?: string | string[];
  refresh_token?: string | string[];
  type?: string | string[];
};

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

function readFromUrlSegment(segment: string): Record<string, string> {
  const normalized = segment.replace(/^[?#]/, '');

  if (!normalized) {
    return {};
  }

  const params = new URLSearchParams(normalized);
  const result: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    if (value) {
      result[key] = value;
    }
  }

  return result;
}

function extractRecoveryParamsFromUrl(url: string | null): Partial<{
  access_token: string;
  refresh_token: string;
  type: string;
}> {
  if (!url) {
    return {};
  }

  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');

  const queryPart = queryIndex >= 0
    ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
    : '';
  const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';

  return {
    ...readFromUrlSegment(queryPart),
    ...readFromUrlSegment(hashPart),
  };
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<LocalSearchParams>();
  const deepLinkUrl = Linking.useURL();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);
  const [isDone, setIsDone] = useState(false);

  const recoveryParams = useMemo<RecoveryParams | null>(() => {
    const fromQuery = {
      accessToken: readParam(params.access_token),
      refreshToken: readParam(params.refresh_token),
      type: readParam(params.type),
    };

    const fromUrl = extractRecoveryParamsFromUrl(deepLinkUrl);

    const accessToken = fromQuery.accessToken || fromUrl.access_token || '';
    const refreshToken = fromQuery.refreshToken || fromUrl.refresh_token || '';
    const type = fromQuery.type || fromUrl.type || '';

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      type,
    };
  }, [deepLinkUrl, params.access_token, params.refresh_token, params.type]);

  const recoveryKey = useMemo(() => {
    if (!recoveryParams) {
      return null;
    }

    return `${recoveryParams.accessToken.slice(0, 12)}:${recoveryParams.refreshToken.slice(0, 12)}:${recoveryParams.type}`;
  }, [recoveryParams]);

  const [processedRecoveryKey, setProcessedRecoveryKey] = useState<string | null>(null);

  useEffect(() => {
    if (!recoveryParams || !recoveryKey || processedRecoveryKey === recoveryKey) {
      return;
    }

    let cancelled = false;

    const prepareRecoverySession = async () => {
      setIsPreparingSession(true);
      setPrepareError(null);

      if (recoveryParams.type && recoveryParams.type !== 'recovery') {
        setPrepareError(t('auth.resetPassword.invalidLink'));
        setIsRecoveryReady(false);
        setIsPreparingSession(false);
        setProcessedRecoveryKey(recoveryKey);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: recoveryParams.accessToken,
        refresh_token: recoveryParams.refreshToken,
      });

      if (cancelled) {
        return;
      }

      if (error) {
        setPrepareError(error.message || t('auth.resetPassword.unableToPrepareSession'));
        setIsRecoveryReady(false);
      } else {
        setPrepareError(null);
        setIsRecoveryReady(true);
      }

      setIsPreparingSession(false);
      setProcessedRecoveryKey(recoveryKey);
    };

    void prepareRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [processedRecoveryKey, recoveryKey, recoveryParams, t]);

  useEffect(() => {
    if (recoveryParams || isPreparingSession || isRecoveryReady || prepareError) {
      return;
    }

    setPrepareError(t('auth.resetPassword.openEmailLink'));
  }, [isPreparingSession, isRecoveryReady, prepareError, recoveryParams, t]);

  const handleUpdatePassword = async () => {
    if (isSubmitting || !isRecoveryReady) {
      return;
    }

    setActionFeedback(null);
    const passwordValue = newPassword.trim();
    const confirmValue = confirmPassword.trim();

    if (!passwordValue || !confirmValue) {
      setActionFeedback({ type: 'error', message: t('auth.resetPassword.missingFields') });
      return;
    }

    if (passwordValue.length < 6) {
      setActionFeedback({ type: 'error', message: t('auth.resetPassword.passwordTooShort') });
      return;
    }

    if (passwordValue !== confirmValue) {
      setActionFeedback({ type: 'error', message: t('auth.resetPassword.passwordMismatch') });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordValue,
      });

      if (error) {
        throw error;
      }

      setActionFeedback({ type: 'success', message: t('auth.resetPassword.passwordUpdated') });
      setIsDone(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      setActionFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackStyles = actionFeedback?.type === 'success'
    ? [styles.feedbackBanner, styles.feedbackSuccess]
    : actionFeedback?.type === 'error'
      ? [styles.feedbackBanner, styles.feedbackError]
      : [styles.feedbackBanner, styles.feedbackInfo];

  return (
    <AuthAmbientGlow>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <Text style={styles.logoLyft}>Lyft</Text>
                <Text style={styles.logoTrack}>Track</Text>
              </View>
              <Text style={styles.title}>{t('auth.resetPassword.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.resetPassword.subtitle')}</Text>
            </View>

            <View style={styles.formCard}>
              {actionFeedback ? (
                <View style={feedbackStyles}>
                  <Text style={styles.feedbackText}>{actionFeedback.message}</Text>
                </View>
              ) : null}

              {isPreparingSession ? (
                <View style={styles.statusWrap}>
                  <ActivityIndicator size="small" color={palette.accent} />
                  <Text style={styles.statusText}>{t('auth.resetPassword.preparingSession')}</Text>
                </View>
              ) : prepareError ? (
                <View style={styles.statusWrap}>
                  <Text style={styles.errorText}>{prepareError}</Text>
                  <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.88} onPress={() => router.replace('/(auth)/sign-in' as any)}>
                    <Text style={styles.secondaryButtonText}>{t('auth.resetPassword.backToSignIn')}</Text>
                  </TouchableOpacity>
                </View>
              ) : isDone ? (
                <View style={styles.statusWrap}>
                  <Text style={styles.successText}>{t('auth.resetPassword.passwordUpdated')}</Text>
                  <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88} onPress={() => router.replace('/(auth)/sign-in' as any)}>
                    <Text style={styles.primaryButtonText}>{t('auth.resetPassword.backToSignIn')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>{t('auth.resetPassword.newPasswordLabel')}</Text>
                  <View style={styles.inputLine}>
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                      placeholderTextColor={palette.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      style={styles.inputField}
                    />
                  </View>

                  <Text style={styles.label}>{t('auth.resetPassword.confirmPasswordLabel')}</Text>
                  <View style={styles.inputLine}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                      placeholderTextColor={palette.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      style={styles.inputField}
                    />
                  </View>

                  <TouchableOpacity style={styles.primaryButton} onPress={() => void handleUpdatePassword()} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>{t('auth.resetPassword.updateAction')}</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthAmbientGlow>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xl,
    rowGap: Spacing.xl,
  },
  header: {
    rowGap: Spacing.xs,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoLyft: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  logoTrack: {
    color: palette.accent,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: 'rgba(17, 17, 17, 0.64)',
    borderWidth: 1,
    borderColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    rowGap: Spacing.sm,
  },
  label: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  feedbackError: {
    backgroundColor: '#EF444415',
    borderColor: '#EF444430',
  },
  feedbackSuccess: {
    backgroundColor: '#10B98115',
    borderColor: '#10B98130',
  },
  feedbackInfo: {
    backgroundColor: '#3B82F615',
    borderColor: '#3B82F630',
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  inputLine: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
    backgroundColor: 'rgba(17, 17, 17, 0.55)',
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Spacing.md,
  },
  primaryButton: {
    marginTop: Spacing.md,
    backgroundColor: palette.accent,
    borderRadius: 10,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  secondaryButton: {
    marginTop: Spacing.sm,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 10,
    paddingVertical: 8,
  },
  statusText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  successText: {
    color: '#6EE7B7',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '700',
  },
});
