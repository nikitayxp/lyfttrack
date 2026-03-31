import { useState } from 'react';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  async function handleSignIn() {
    setFeedback(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      setFeedback({ message: 'Introduz email e palavra-passe para continuar.', type: 'error' });
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
      setFeedback({ message: 'Indica primeiro o teu email.', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

      if (error) {
        setFeedback({ message: error.message, type: 'error' });
        return;
      }

      setFeedback({ message: 'Email de recuperação enviado! Verifica a tua caixa.', type: 'success' });
    } finally {
      setLoading(false);
    }
  }

  function handleGooglePress() {
    setFeedback({ message: 'Login via Google em desenvolvimento.', type: 'info' });
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
            <Text style={styles.title}>ENTRA. TREINA. EVOLUI.</Text>
            <Text style={styles.subtitle}>Foco total. Sem distracoes.</Text>
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

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputLine}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="teu@email.com"
                placeholderTextColor={palette.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputField}
              />
            </View>

            <Text style={styles.label}>Palavra-passe</Text>
            <View style={styles.inputLine}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="********"
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>INICIAR SESSAO</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Ou continuar com</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGooglePress} disabled={loading}>
              <AntDesign name="google" size={16} color="#FFFFFF" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={() => void handleForgotPassword()} disabled={loading}>
              <Text style={styles.secondaryActionText}>Esqueci-me da palavra-passe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchAction}
              onPress={() => router.push('/(auth)/sign-up' as any)}
              disabled={loading}
            >
              <Text style={styles.switchActionText}>Nao tens conta? Criar conta</Text>
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
