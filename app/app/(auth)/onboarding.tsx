import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { AuthFeedback, type AuthFeedbackValue } from '@/components/auth/AuthFeedback';
import { markOnboardingCompleted } from '@/services/authSetup';
import { addWeight, parseBodyWeightInput } from '@/services/measurementService';
import {
  getProfile,
  pickAvatarFromLibrary,
  updateProfile,
  uploadAvatar,
  withAvatarCacheBuster,
} from '@/services/profileService';
import { sanitizeDecimalText } from '@/utils/inputValidation';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;

/** Metric defaults most apps/users expect globally (kg / cm), not imperial. */
const DEFAULT_WEIGHT_KG = '70';
const DEFAULT_HEIGHT_CM = '170';

function initialsFromName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function parseOptionalHeightCm(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 50 || parsed > 300) {
    throw new Error('invalid-height');
  }

  return Math.round(parsed * 10) / 10;
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [weight, setWeight] = useState(DEFAULT_WEIGHT_KG);
  const [height, setHeight] = useState(DEFAULT_HEIGHT_CM);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const [pendingAvatar, setPendingAvatar] = useState<Awaited<ReturnType<typeof pickAvatarFromLibrary>>>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedbackValue | null>(null);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const [{ data }, profile] = await Promise.all([
          supabase.auth.getUser(),
          getProfile(),
        ]);

        if (!mounted) {
          return;
        }

        const picture =
          typeof data.user?.user_metadata?.picture === 'string'
            ? data.user.user_metadata.picture
            : typeof data.user?.user_metadata?.avatar_url === 'string'
              ? data.user.user_metadata.avatar_url
              : null;

        const name =
          profile.full_name?.trim() ||
          (typeof data.user?.user_metadata?.full_name === 'string'
            ? data.user.user_metadata.full_name
            : '') ||
          profile.username ||
          '';

        setDisplayName(name);
        setAvatarUrl(profile.avatar_url ?? picture);
        if (profile.height_cm != null) {
          setHeight(String(profile.height_cm));
        }
      } catch (error) {
        console.warn('[onboarding] bootstrap failed', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function handlePickAvatar() {
    try {
      const picked = await pickAvatarFromLibrary();
      if (!picked) {
        return;
      }

      setPendingAvatar(picked);
      setAvatarUrl(picked.fileUri);
      setAvatarVersion(Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.onboarding.avatarError');
      setFeedback({ message, type: 'error' });
    }
  }

  async function handleContinue() {
    setFeedback(null);
    setLoading(true);

    try {
      if (pendingAvatar) {
        const updated = await uploadAvatar(pendingAvatar);
        setAvatarUrl(updated.avatar_url);
        setPendingAvatar(null);
      } else if (avatarUrl && /^https?:\/\//i.test(avatarUrl)) {
        // Keep Google (or other remote) picture if the user did not replace it.
        const profile = await getProfile();
        if (!profile.avatar_url) {
          await updateProfile({ avatarUrl });
        }
      }

      const trimmedWeight = weight.trim();
      if (trimmedWeight) {
        await addWeight(parseBodyWeightInput(trimmedWeight));
      }

      let heightCm: number | null = null;
      try {
        heightCm = parseOptionalHeightCm(height);
      } catch {
        setFeedback({ message: t('auth.onboarding.invalidHeight'), type: 'error' });
        setLoading(false);
        return;
      }

      if (heightCm != null) {
        await updateProfile({ heightCm });
      }

      await markOnboardingCompleted();
      router.replace('/(tabs)/workout' as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.onboarding.saveErrorProfile');
      setFeedback({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const previewUrl = pendingAvatar?.fileUri ?? withAvatarCacheBuster(avatarUrl, avatarVersion);

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
              <Text style={styles.title}>{t('auth.onboarding.title')}</Text>
              <Text style={styles.subtitle}>{t('auth.onboarding.subtitle')}</Text>
            </View>

            <View style={styles.formCard}>
              {feedback ? <AuthFeedback feedback={feedback} /> : null}

              <Text style={styles.label}>{t('auth.onboarding.photoLabel')}</Text>
              <TouchableOpacity
                style={styles.avatarButton}
                activeOpacity={ACTIVE_OPACITY}
                onPress={() => void handlePickAvatar()}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={t('auth.onboarding.photoLabel')}
              >
                {previewUrl ? (
                  <Image source={{ uri: previewUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initialsFromName(displayName)}</Text>
                    <View style={styles.avatarCameraBadge}>
                      <Ionicons name="camera" size={14} color={palette.textPrimary} />
                    </View>
                  </View>
                )}
                <Text style={styles.avatarHint}>{t('auth.onboarding.photoHint')}</Text>
              </TouchableOpacity>

              <Text style={styles.label}>{t('auth.onboarding.weightLabel')}</Text>
              <View style={styles.inputLine}>
                <TextInput
                  accessibilityLabel={t('auth.onboarding.weightLabel')}
                  value={weight}
                  onChangeText={(value) => setWeight(sanitizeDecimalText(value))}
                  placeholder={t('auth.onboarding.weightPlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  keyboardType="decimal-pad"
                  style={styles.inputField}
                />
                <Text style={styles.unitSuffix}>kg</Text>
              </View>

              <Text style={styles.label}>{t('auth.onboarding.heightLabel')}</Text>
              <View style={styles.inputLine}>
                <TextInput
                  accessibilityLabel={t('auth.onboarding.heightLabel')}
                  value={height}
                  onChangeText={(value) => setHeight(sanitizeDecimalText(value))}
                  placeholder={t('auth.onboarding.heightPlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  keyboardType="decimal-pad"
                  style={styles.inputField}
                />
                <Text style={styles.unitSuffix}>cm</Text>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={ACTIVE_OPACITY}
                onPress={() => void handleContinue()}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={t('auth.onboarding.continueAction')}
              >
                {loading ? (
                  <ActivityIndicator color={palette.textPrimary} />
                ) : (
                  <Text style={styles.primaryButtonText}>{t('auth.onboarding.continueAction')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthAmbientGlow>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  },
  inputField: { flex: 1, color: palette.textPrimary, fontSize: 16, fontWeight: '600', paddingVertical: Spacing.sm },
  avatarButton: { alignItems: 'center', rowGap: Spacing.sm, paddingVertical: Spacing.sm },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.16)',
    position: 'relative',
  },
  avatarInitials: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.bgPrimary,
  },
  avatarHint: { color: palette.textMuted, fontSize: 13, fontWeight: '600' },
  unitSuffix: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '700',
    paddingRight: Spacing.xs,
  },
  primaryButton: {
    marginTop: Spacing.sm,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: palette.accent,
  },
  primaryButtonText: { color: palette.textPrimary, fontSize: 15, fontWeight: '900' },
});
