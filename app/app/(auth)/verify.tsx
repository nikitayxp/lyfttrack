import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
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

function readRouteValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = useMemo(() => readRouteValue(params.email), [params.email]);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail || !normalizedCode) {
      Alert.alert('Dados em falta', 'Preenche o email e o codigo de verificacao.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedCode,
        type: 'signup',
      });

      if (error) {
        Alert.alert('Codigo invalido', 'O codigo e invalido ou expirou.');
        return;
      }

      Alert.alert('Conta verificada', 'Conta confirmada com sucesso.');
      router.replace('/(tabs)/workout' as any);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>LYFTTRACK</Text>
          <Text style={styles.title}>VALIDAR CONTA</Text>
          <Text style={styles.subtitle}>Confirma o email para desbloquear a app.</Text>
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

          <Text style={styles.label}>Codigo de verificacao</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={palette.textMuted}
            keyboardType="number-pad"
            autoCapitalize="none"
            maxLength={8}
            style={styles.input}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleVerify()} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>CONFIRMAR</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchAction}
            onPress={() => router.push('/(auth)/sign-up' as any)}
            disabled={loading}
          >
            <Text style={styles.switchActionText}>Voltar ao registo</Text>
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
