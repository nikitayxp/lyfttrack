import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { useAppToast } from '@/context/ToastContext';
import { supabase } from '@/services/supabase';
import { goBack } from '@/utils/navigation';
import {
  resetPasswordCameFromKnownOrigin,
  resolveResetPasswordBackRoute,
} from '@/utils/resetPasswordOrigin';
import { showAlert } from '@/utils/showAlert';

const palette = Colors.dark;

function readRouteValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { showToast } = useAppToast();
  const params = useLocalSearchParams<{ email?: string | string[]; from?: string | string[] }>();
  const routeEmail = readRouteValue(params.email);
  const origin = readRouteValue(params.from);
  const backRoute = resolveResetPasswordBackRoute(origin);
  const backLabel = resetPasswordCameFromKnownOrigin(origin)
    ? t('auth.resetPassword.backToEditProfile')
    : t('auth.resetPassword.backToSignIn');

  function handleBack() {
    goBack(backRoute);
  }

  const [email, setEmail] = useState(routeEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Sync email from route params
  useEffect(() => {
    if (routeEmail) {
      setEmail(routeEmail);
    }
  }, [routeEmail]);

  async function handleVerifyCode() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail || !normalizedCode) {
      showAlert(showToast, t('auth.resetPassword.title'), t('auth.resetPassword.missingCodeFields'), 'error');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedCode,
        type: 'recovery',
      });

      if (error) {
        showAlert(showToast, t('auth.resetPassword.invalidCodeTitle'), t('auth.resetPassword.invalidCodeDescription'), 'error');
        return;
      }

      setIsCodeVerified(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword() {
    const passwordValue = newPassword.trim();
    const confirmValue = confirmPassword.trim();

    if (!passwordValue || !confirmValue) {
      showAlert(showToast, t('auth.resetPassword.title'), t('auth.resetPassword.missingFields'), 'error');
      return;
    }

    if (passwordValue.length < 6) {
      showAlert(showToast, t('auth.resetPassword.title'), t('auth.resetPassword.passwordTooShort'), 'error');
      return;
    }

    if (passwordValue !== confirmValue) {
      showAlert(showToast, t('auth.resetPassword.title'), t('auth.resetPassword.passwordMismatch'), 'error');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordValue,
      });

      if (error) {
        throw error;
      }

      setIsDone(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      showAlert(showToast, t('auth.resetPassword.title'), message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Done ──
  if (isDone) {
    return (
      <AuthAmbientGlow>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logoLyft}>Lyft</Text>
              <Text style={styles.logoTrack}>Track</Text>
            </View>
            <Text style={styles.title}>{t('auth.resetPassword.successTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.resetPassword.passwordUpdated')}</Text>
          </View>

          <View style={styles.formCard}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleBack}
              activeOpacity={ACTIVE_OPACITY}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Text style={styles.primaryButtonText}>{backLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AuthAmbientGlow>
    );
  }

  // ── Step 2: New password ──
  if (isCodeVerified) {
    return (
      <AuthAmbientGlow>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <Text style={styles.logoLyft}>Lyft</Text>
                <Text style={styles.logoTrack}>Track</Text>
              </View>
              <Text style={styles.title}>{t('auth.resetPassword.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.resetPassword.newPasswordSubtitle')}</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>{t('auth.resetPassword.newPasswordLabel')}</Text>
              <View style={styles.inputLine}>
                <TextInput
                  accessibilityLabel={t('auth.resetPassword.newPasswordLabel')}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={styles.inputField}
                />
              </View>

              <Text style={styles.label}>{t('auth.resetPassword.confirmPasswordLabel')}</Text>
              <View style={styles.inputLine}>
                <TextInput
                  accessibilityLabel={t('auth.resetPassword.confirmPasswordLabel')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={styles.inputField}
                />
              </View>

              <Text style={styles.codeHint}>{t('auth.resetPassword.passwordHint')}</Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => void handleUpdatePassword()}
                disabled={loading}
                activeOpacity={ACTIVE_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={t('auth.resetPassword.updateAction')}
              >
                {loading ? (
                  <ActivityIndicator color={palette.textPrimary} />
                ) : (
                  <Text style={styles.primaryButtonText}>{t('auth.resetPassword.updateAction')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchAction}
                onPress={handleBack}
                disabled={loading}
                activeOpacity={ACTIVE_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={backLabel}
              >
                <Text style={styles.switchActionText}>{backLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </AuthAmbientGlow>
    );
  }

  // ── Step 1: Email + Code ──
  return (
    <AuthAmbientGlow>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
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
            <Text style={styles.label}>{t('auth.resetPassword.emailLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                accessibilityLabel={t('auth.resetPassword.emailLabel')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.verify.emailPlaceholder')}
                placeholderTextColor={palette.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputField}
              />
            </View>

            <Text style={styles.label}>{t('auth.resetPassword.codeLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                accessibilityLabel={t('auth.resetPassword.codeLabel')}
                value={code}
                onChangeText={setCode}
                placeholder={t('auth.verify.codePlaceholder')}
                placeholderTextColor={palette.textMuted}
                keyboardType="number-pad"
                autoCapitalize="none"
                maxLength={6}
                style={[styles.inputField, styles.codeInput]}
              />
            </View>
            <Text style={styles.codeHint}>{t('auth.verify.codeHint')}</Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void handleVerifyCode()}
              disabled={loading}
              activeOpacity={ACTIVE_OPACITY}
              accessibilityRole="button"
              accessibilityLabel={t('auth.resetPassword.verifyCodeAction')}
            >
              {loading ? (
                <ActivityIndicator color={palette.textPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('auth.resetPassword.verifyCodeAction')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchAction}
              onPress={handleBack}
              disabled={loading}
              activeOpacity={ACTIVE_OPACITY}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Text style={styles.switchActionText}>{backLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AuthAmbientGlow>
  );
}

// ─── Styles ────────────────────────────────────────────
// Mirrors verify.tsx exactly for visual consistency
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
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
    color: palette.textPrimary,
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
    color: palette.textPrimary,
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
    borderColor: palette.border,
    borderRadius: Radius.button,
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
  inputLine: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: 'rgba(17, 17, 17, 0.55)',
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputField: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Spacing.md,
  },
  codeInput: {
    letterSpacing: 6,
    fontSize: 20,
    fontWeight: '800',
  },
  codeHint: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: -2,
  },
  primaryButton: {
    marginTop: Spacing.md,
    backgroundColor: palette.accent,
    borderRadius: Radius.md,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  switchAction: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  switchActionText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
