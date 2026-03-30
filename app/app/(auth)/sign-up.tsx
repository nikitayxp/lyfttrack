import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing, Typography } from '@/constants/Styles';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSignUp() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Dados em falta', 'Preenche todos os campos para criares a conta.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Palavra-passe invalida', 'A palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Palavras-passe diferentes', 'A confirmacao nao corresponde a palavra-passe.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        Alert.alert('Nao foi possivel criar conta', error.message);
        return;
      }

      if (data.session) {
        router.replace('/(tabs)/workout' as any);
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>LYFTTRACK</Text>
          <Text style={styles.title}>CRIAR CONTA</Text>
          <Text style={styles.subtitle}>Comeca forte e acompanha toda a tua evolucao.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="teu@email.com"
            placeholderTextColor={palette.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={styles.label}>Palavra-passe</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="********"
              placeholderTextColor={palette.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={styles.passwordInput}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((current) => !current)}
              style={styles.eyeButton}
              disabled={loading}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={palette.icon} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirmar palavra-passe</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="********"
            placeholderTextColor={palette.textMuted}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            style={styles.input}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSignUp()} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>CRIAR CONTA</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchAction}
            onPress={() => router.push('/(auth)/sign-in' as any)}
            disabled={loading}
          >
            <Text style={styles.switchActionText}>Ja tens conta? Iniciar sessao</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    rowGap: Spacing.xxl,
  },
  header: {
    rowGap: Spacing.sm,
  },
  kicker: {
    ...Typography.label,
    color: palette.accent,
  },
  title: {
    ...Typography.h1,
    color: palette.textPrimary,
  },
  subtitle: {
    ...Typography.body,
    color: palette.textSecondary,
  },
  formCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    rowGap: Spacing.md,
  },
  label: {
    ...Typography.caption,
    color: palette.textSecondary,
  },
  input: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: Radius.md,
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: Radius.md,
  },
  passwordInput: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  eyeButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: Spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: Radius.md,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  switchAction: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  switchActionText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
