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
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { startGoogleOAuth } from '@/services/authService';
import { getPasswordResetRedirectTo, supabase } from '@/services/supabase';

const palette = Colors.dark;

export default function SignInScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  async function handleSignIn() {
    setFeedback(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      setFeedback({ message: t('auth.signIn.missingCredentials'), type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setFeedback({ message: error.message, type: 'error' });
        return;
      }

      router.replace('/(tabs)/workout' as any);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setFeedback(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setFeedback({ message: t('auth.signIn.missingEmail'), type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getPasswordResetRedirectTo(),
      });

      if (error) {
        setFeedback({ message: error.message, type: 'error' });
        return;
      }

      setFeedback({ message: t('auth.signIn.resetSent'), type: 'success' });
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
        ? t('auth.signIn.googleCancelled')
        : t('auth.signIn.googleError');

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
            <Text style={styles.title}>{t('auth.signIn.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.signIn.subtitle')}</Text>
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

            <Text style={styles.label}>{t('auth.signIn.emailLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.signIn.emailPlaceholder')}
                placeholderTextColor={palette.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputField}
              />
            </View>

            <Text style={styles.label}>{t('auth.signIn.passwordLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.signIn.passwordPlaceholder')}
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

            <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSignIn()} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={palette.textPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('auth.signIn.signInAction')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.signIn.dividerText')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGooglePress} disabled={loading}>
              <AntDesign name="google" size={16} color={palette.textPrimary} />
              <Text style={styles.googleButtonText}>{t('auth.signIn.continueWithGoogle')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={() => void handleForgotPassword()} disabled={loading}>
              <Text style={styles.secondaryActionText}>{t('auth.signIn.forgotPassword')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchAction}
              onPress={() => router.push('/(auth)/sign-up' as any)}
              disabled={loading}
            >
              <Text style={styles.switchActionText}>{t('auth.signIn.createAccountPrompt')}</Text>
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
  secondaryAction: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryActionText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '700',
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
