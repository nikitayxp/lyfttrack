import { useEffect, useMemo, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing, Typography } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;
const VERIFY_EMAIL_KEY = 'lyfttrack_verify_email';

function readRouteValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

export default function VerifyScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const routeEmail = useMemo(() => readRouteValue(params.email), [params.email]);

  const [email, setEmail] = useState(routeEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Persist email so user can return after closing the app
  useEffect(() => {
    if (routeEmail) {
      setEmail(routeEmail);
      void AsyncStorage.setItem(VERIFY_EMAIL_KEY, routeEmail);
      return;
    }

    // No route param → try to recover from storage
    void AsyncStorage.getItem(VERIFY_EMAIL_KEY).then((stored) => {
      if (stored && !email) {
        setEmail(stored);
      }
    });
  }, [routeEmail]);

  // Clear stored email on successful verification
  async function clearStoredEmail() {
    try {
      await AsyncStorage.removeItem(VERIFY_EMAIL_KEY);
    } catch {
      // noop
    }
  }

  async function handleVerify() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail || !normalizedCode) {
      Alert.alert(t('auth.verify.missingDataTitle'), t('auth.verify.missingDataDescription'));
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
        Alert.alert(t('auth.verify.invalidCodeTitle'), t('auth.verify.invalidCodeDescription'));
        return;
      }

      await clearStoredEmail();
      Alert.alert(t('auth.verify.verifiedTitle'), t('auth.verify.verifiedDescription'));
      router.replace('/(tabs)/workout' as any);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthAmbientGlow>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logoLyft}>Lyft</Text>
              <Text style={styles.logoTrack}>Track</Text>
            </View>
            <Text style={styles.title}>{t('auth.verify.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.verify.subtitle')}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>{t('auth.verify.emailLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                accessibilityLabel={t('auth.verify.emailLabel')}
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

            <Text style={styles.label}>{t('auth.verify.codeLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                accessibilityLabel={t('auth.verify.codeLabel')}
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
              onPress={() => void handleVerify()} 
              disabled={loading}
              activeOpacity={ACTIVE_OPACITY}
              accessibilityRole="button"
              accessibilityLabel={t('auth.verify.confirmAction')}
            >
              {loading ? (
                <ActivityIndicator color={palette.textPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('auth.verify.confirmAction')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchAction}
              onPress={() => router.back()}
              disabled={loading}
              activeOpacity={ACTIVE_OPACITY}
              accessibilityRole="button"
              accessibilityLabel={t('auth.verify.backToRegisterAction')}
            >
              <Text style={styles.switchActionText}>{t('auth.verify.backToRegisterAction')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AuthAmbientGlow>
  );
}

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
