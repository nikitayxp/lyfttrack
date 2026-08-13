import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { AuthFeedback, type AuthFeedbackValue } from '@/components/auth/AuthFeedback';
import { AppButton } from '@/components/ui/AppButton';
import {
  markUsernameConfirmed,
  suggestDisplayNameFromGoogle,
  suggestUsernameFromGoogle,
} from '@/services/authSetup';
import { checkUsernameAvailability, getProfile, updateProfile } from '@/services/profileService';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;
const USERNAME_MAX_LENGTH = 24;
const DISPLAY_NAME_MAX_LENGTH = 60;

function sanitizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '');
}

export default function CompleteProfileScreen() {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [feedback, setFeedback] = useState<AuthFeedbackValue | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        if (!user) {
          router.replace('/(auth)/sign-in' as any);
          return;
        }

        const profile = await getProfile();
        if (!mounted) {
          return;
        }

        setCurrentUsername(profile.username);
        setDisplayName(
          (profile.full_name?.trim() || suggestDisplayNameFromGoogle(user)).slice(0, DISPLAY_NAME_MAX_LENGTH)
        );
        setUsername(
          (profile.username || suggestUsernameFromGoogle(user)).slice(0, USERNAME_MAX_LENGTH)
        );
      } catch (error) {
        console.warn('[complete-profile] bootstrap failed', error);
        if (mounted) {
          setFeedback({ message: t('auth.completeProfile.loadError'), type: 'error' });
        }
      } finally {
        if (mounted) {
          setBooting(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    const normalizedUsername = sanitizeUsername(username).slice(0, USERNAME_MAX_LENGTH);

    if (normalizedUsername.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    if (normalizedUsername === currentUsername) {
      setUsernameAvailable(true);
      setUsernameChecking(false);
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
  }, [username, currentUsername]);

  async function handleContinue() {
    setFeedback(null);

    const normalizedDisplayName = displayName.replace(/\s+/g, ' ').trim();
    const normalizedUsername = sanitizeUsername(username).slice(0, USERNAME_MAX_LENGTH);

    if (normalizedDisplayName.length < 2) {
      setFeedback({ message: t('auth.signUp.displayNameTooShort'), type: 'error' });
      return;
    }

    if (normalizedUsername.length < 3) {
      setFeedback({ message: t('auth.signUp.usernameTooShort'), type: 'error' });
      return;
    }

    if (usernameAvailable === false) {
      setFeedback({ message: t('auth.signUp.usernameTakenStatus'), type: 'error' });
      return;
    }

    setLoading(true);

    try {
      await updateProfile({
        username: normalizedUsername,
        fullName: normalizedDisplayName,
      });
      await markUsernameConfirmed();
      router.replace('/(auth)/onboarding' as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.completeProfile.saveError');
      setFeedback({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return (
      <AuthAmbientGlow>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </AuthAmbientGlow>
    );
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
              <Text style={styles.title}>{t('auth.completeProfile.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.completeProfile.subtitle')}</Text>
            </View>

            <View style={styles.formCard}>
              {feedback ? <AuthFeedback feedback={feedback} /> : null}

              <Text style={styles.label}>{t('auth.signUp.displayNameLabel')}</Text>
              <View style={styles.inputLine}>
                <TextInput
                  accessibilityLabel={t('auth.signUp.displayNameLabel')}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t('auth.signUp.displayNamePlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="words"
                  maxLength={DISPLAY_NAME_MAX_LENGTH}
                  style={styles.inputField}
                />
              </View>

              <Text style={styles.label}>{t('auth.signUp.usernameLabel')}</Text>
              <View style={[styles.inputLine, usernameAvailable === false && styles.inputLineError]}>
                <Text style={styles.usernamePrefix}>@</Text>
                <TextInput
                  accessibilityLabel={t('auth.signUp.usernameLabel')}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t('auth.signUp.usernamePlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={USERNAME_MAX_LENGTH}
                  style={styles.inputField}
                />
                <View style={styles.usernameStatus}>
                  {usernameChecking ? (
                    <ActivityIndicator size="small" color={palette.accent} />
                  ) : usernameAvailable === true ? (
                    <Text style={styles.usernameAvailableText}>{t('auth.signUp.usernameAvailable')}</Text>
                  ) : usernameAvailable === false ? (
                    <Text style={styles.usernameTakenText}>{t('auth.signUp.usernameTaken')}</Text>
                  ) : null}
                </View>
              </View>

              <AppButton
                label={t('auth.completeProfile.continueAction')}
                onPress={() => void handleContinue()}
                disabled={usernameChecking}
                loading={loading}
                style={styles.submitButton}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthAmbientGlow>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.xl },
  container: { paddingHorizontal: Spacing.xxl, rowGap: Spacing.lg },
  header: { rowGap: Spacing.sm },
  logoRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: 2 },
  logoLyft: { color: palette.textPrimary, fontSize: 28, fontWeight: '900' },
  logoTrack: { color: palette.accent, fontSize: 28, fontWeight: '900' },
  title: { color: palette.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: palette.textSecondary, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  formCard: {
    backgroundColor: 'rgba(17, 17, 17, 0.72)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    rowGap: Spacing.md,
  },
  label: { color: palette.textSecondary, fontSize: 12, fontWeight: '700' },
  inputLine: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.xs,
  },
  inputLineError: { borderBottomColor: palette.error },
  inputField: { flex: 1, color: palette.textPrimary, fontSize: 16, fontWeight: '600', paddingVertical: Spacing.sm },
  usernamePrefix: { color: palette.textMuted, fontSize: 16, fontWeight: '700' },
  usernameStatus: { minWidth: 64, alignItems: 'flex-end' },
  usernameAvailableText: { color: palette.success, fontSize: 12, fontWeight: '700' },
  usernameTakenText: { color: palette.error, fontSize: 12, fontWeight: '700' },
  submitButton: {
    marginTop: Spacing.sm,
  },
});
