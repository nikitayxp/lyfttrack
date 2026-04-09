import { useState } from 'react';
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
import { Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
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

  function handleGooglePress() {
    setFeedback({ message: t('auth.signUp.googleSoon'), type: 'info' });
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
                  color={feedback.type === 'error' ? '#EF4444' : feedback.type === 'success' ? '#10B981' : '#3B82F6'} 
                />
                <Text style={styles.feedbackText}>{feedback.message}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t('auth.signUp.displayNameLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
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

            <Text style={styles.label}>{t('auth.signUp.usernameLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
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
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={19} color={palette.icon} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('auth.signUp.confirmPasswordLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
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
              activeOpacity={0.7}
              disabled={loading}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
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
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('auth.signUp.createAccountAction')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.signUp.dividerText')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGooglePress} disabled={loading}>
              <AntDesign name="google" size={16} color="#FFFFFF" />
              <Text style={styles.googleButtonText}>{t('auth.signUp.continueWithGoogle')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchAction}
              onPress={() => router.push('/(auth)/sign-in' as any)}
              disabled={loading}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    columnGap: 8,
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
    flex: 1,
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
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  dividerRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272A',
  },
  dividerText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  googleButton: {
    marginTop: Spacing.sm,
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
  },
  googleButtonText: {
    color: '#FFFFFF',
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
    borderColor: '#27272A',
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
    borderColor: '#FFFFFF',
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
});
