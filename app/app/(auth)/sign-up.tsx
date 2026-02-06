import { useState, useEffect } from 'react';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { startGoogleOAuth } from '@/services/authService';
import { checkUsernameAvailability } from '@/services/profileService';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;
const USERNAME_MAX_LENGTH = 24;
const DISPLAY_NAME_MAX_LENGTH = 60;

function normalizeDisplayName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '');
}

export default function SignUpScreen() {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  
  // Real-time username check
  useEffect(() => {
    const normalizedUsername = sanitizeUsername(username).slice(0, USERNAME_MAX_LENGTH);
    if (normalizedUsername.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setUsernameChecking(true);
    const timeoutId = setTimeout(async () => {
      const available = await checkUsernameAvailability(normalizedUsername);
      setUsernameAvailable(available);
      setUsernameChecking(false);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      setUsernameChecking(false);
    };
  }, [username]);

  async function handleSignUp() {
    setFeedback(null);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedDisplayName = normalizeDisplayName(displayName).slice(0, DISPLAY_NAME_MAX_LENGTH);
    const normalizedUsername = sanitizeUsername(username).slice(0, USERNAME_MAX_LENGTH);

    if (!normalizedDisplayName || !normalizedUsername || !normalizedEmail || !password.trim() || !confirmPassword.trim()) {
      setFeedback({ message: t('auth.signUp.fillAll'), type: 'error' });
      return;
    }

    if (normalizedDisplayName.length < 2) {
      setFeedback({ message: t('auth.signUp.displayNameTooShort'), type: 'error' });
      return;
    }

    if (normalizedUsername.length < 3) {
      setFeedback({ message: t('auth.signUp.usernameTooShort'), type: 'error' });
      return;
    }

    if (usernameAvailable === false) {
      setFeedback({ message: t('auth.signUp.usernameTaken', { defaultValue: 'Username is already taken' }), type: 'error' });
      return;
    }

    if (password.length < 6) {
      setFeedback({ message: t('auth.signUp.passwordTooShort'), type: 'error' });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ message: t('auth.signUp.passwordMismatch'), type: 'error' });
      return;
    }

    if (!termsAccepted) {
      setFeedback({ message: t('auth.signUp.termsRequired'), type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            username: normalizedUsername,
            full_name: normalizedDisplayName,
            display_name: normalizedDisplayName,
          },
        },
      });

      if (error) {
        setFeedback({ message: error.message, type: 'error' });
        return;
      }

      if (data.session) {
        router.replace('/(auth)/onboarding' as any);
        return;
      }

      router.push({
        pathname: '/(auth)/verify' as any,
        params: { email: normalizedEmail },
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGooglePress() {
    setFeedback(null);

    try {
      await startGoogleOAuth();
    } catch (error) {
      const message = error instanceof Error && error.message === 'oauth-cancelled'
        ? t('auth.signUp.googleCancelled')
        : t('auth.signUp.googleError');

      setFeedback({ message, type: 'error' });
    }
  }

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
            <Text style={styles.title}>{t('auth.signUp.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.signUp.subtitle')}</Text>
          </View>

          <View style={styles.formCard}>
            {feedback ? (
              <View style={[
                styles.feedbackBanner, 
                feedback.type === 'error' ? styles.feedbackError : feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackInfo
              ]}>
                <Ionicons 
                  name={feedback.type === 'error' ? 'alert-circle' : feedback.type === 'success' ? 'checkmark-circle' : 'information-circle'} 
                  size={16} 
                  color={feedback.type === 'error' ? palette.error : feedback.type === 'success' ? palette.success : palette.accent} 
                />
                <Text style={styles.feedbackText}>{feedback.message}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t('auth.signUp.displayNameLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                accessibilityLabel={t('auth.signUp.displayNameLabel')}
                value={displayName}
                onChangeText={(value) => setDisplayName(value.slice(0, DISPLAY_NAME_MAX_LENGTH))}
                placeholder={t('auth.signUp.displayNamePlaceholder')}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.inputField}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
              />
            </View>

            <View style={[styles.labelRow]}>
              <Text style={styles.label}>{t('auth.signUp.usernameLabel')}</Text>
              {usernameChecking ? (
                <ActivityIndicator size="small" color={palette.accent} style={{ transform: [{ scale: 0.6 }] }} />
              ) : usernameAvailable === true ? (
                <Text style={styles.usernameAvailableText}>{t('auth.signUp.usernameAvailable', { defaultValue: 'Available' })}</Text>
              ) : usernameAvailable === false ? (
                <Text style={styles.usernameTakenText}>{t('auth.signUp.usernameTaken', { defaultValue: 'Taken' })}</Text>
              ) : null}
            </View>
            <View style={[styles.inputLine, usernameAvailable === false && styles.inputLineError]}>
              <TextInput
                accessibilityLabel={t('auth.signUp.usernameLabel')}
                value={username}
                onChangeText={(value) => setUsername(sanitizeUsername(value).slice(0, USERNAME_MAX_LENGTH))}
                placeholder={t('auth.signUp.usernamePlaceholder')}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputField}
                maxLength={USERNAME_MAX_LENGTH}
              />
            </View>

            <Text style={styles.label}>{t('auth.signUp.emailLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                accessibilityLabel={t('auth.signUp.emailLabel')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.signUp.emailPlaceholder')}
                placeholderTextColor={palette.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputField}
              />
            </View>

            <Text style={styles.label}>{t('auth.signUp.passwordLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                accessibilityLabel={t('auth.signUp.passwordLabel')}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.signUp.passwordPlaceholder')}
                placeholderTextColor={palette.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={styles.inputField}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((current) => !current)}
                style={styles.eyeButton}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t('accessibility.hidePassword', { defaultValue: 'Hide password' }) : t('accessibility.showPassword', { defaultValue: 'Show password' })}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={19} color={palette.icon} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('auth.signUp.confirmPasswordLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                accessibilityLabel={t('auth.signUp.confirmPasswordLabel')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.signUp.passwordPlaceholder')}
                placeholderTextColor={palette.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={styles.inputField}
              />
            </View>

            {/* Terms of Service */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsAccepted((prev) => !prev)}
              activeOpacity={ACTIVE_OPACITY}
              disabled={loading}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel={t('accessibility.acceptTerms', { defaultValue: 'Accept terms and conditions' })}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && (
                  <View style={styles.checkboxTick} />
                )}
              </View>
              <Text style={styles.termsText}>
                {t('auth.signUp.termsPrefix')}
                <Text style={styles.termsLink}>{t('auth.signUp.termsOfService')}</Text>
                {t('auth.signUp.termsConjunction')}
                <Text style={styles.termsLink}>{t('auth.signUp.privacyPolicy')}</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, !termsAccepted && styles.primaryButtonDisabled]}
              onPress={() => void handleSignUp()}
              disabled={loading || !termsAccepted}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signUp.createAccountAction')}
            >
              {loading ? (
                <ActivityIndicator color={palette.textPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('auth.signUp.createAccountAction')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.signUp.dividerText')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.googleButton} 
              onPress={handleGooglePress} 
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signUp.continueWithGoogle')}
            >
              <AntDesign name="google" size={16} color={palette.textPrimary} />
              <Text style={styles.googleButtonText}>{t('auth.signUp.continueWithGoogle')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchAction}
              onPress={() => router.push('/(auth)/sign-in' as any)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signUp.signInPrompt')}
            >
              <Text style={styles.switchActionText}>{t('auth.signUp.signInPrompt')}</Text>
            </TouchableOpacity>
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
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    columnGap: 8,
    marginBottom: 4,
  },
  feedbackError: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.19)',
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.19)',
  },
  feedbackInfo: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.19)',
  },
  feedbackText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  dividerRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  googleButton: {
    marginTop: Spacing.sm,
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
  },
  googleButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  switchAction: {
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  switchActionText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 10,
    marginTop: 4,
  },
  checkbox: {
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: 'rgba(17,17,17,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  checkboxTick: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: palette.textPrimary,
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  termsText: {
    flex: 1,
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
  },
  termsLink: {
    color: palette.accent,
    fontWeight: '700',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usernameAvailableText: {
    color: palette.success,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  usernameTakenText: {
    color: palette.error,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  inputLineError: {
    borderBottomColor: palette.error,
  },
});
