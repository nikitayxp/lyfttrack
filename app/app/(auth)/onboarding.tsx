import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { addWeight, parseBodyWeightInput } from '@/services/measurementService';
import { updateProfile } from '@/services/profileService';
import { sanitizeDecimalText } from '@/utils/inputValidation';

const palette = Colors.dark;

function createWeightUiTraceId(scope: 'onboarding'): string {
  return `${scope}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  async function handleComplete() {
    const traceId = createWeightUiTraceId('onboarding');
    setFeedback(null);
    const submittedWeightInput = weight;
    const safeName = name.trim();

    console.info('[weight-save-trace] onboarding_submit_start', {
      traceId,
      submittedWeightInput,
      hasName: Boolean(safeName),
    });

    if (!safeName) {
      setFeedback({ message: t('auth.onboarding.missingNameWeight'), type: 'error' });
      return;
    }

    let parsedWeight: number;

    try {
      parsedWeight = parseBodyWeightInput(weight);

      console.info('[weight-save-trace] onboarding_validation_ok', {
        traceId,
        parsedWeight,
      });
    } catch (e: any) {
      console.warn('[weight-save-trace] onboarding_validation_failed', {
        traceId,
        message: e?.message ?? 'unknown',
      });

      setFeedback({ message: e?.message || t('auth.onboarding.invalidWeight'), type: 'error' });
      return;
    }

    const normalizedWeightLabel = Number.isInteger(parsedWeight)
      ? `${parsedWeight}`
      : parsedWeight.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    setWeight(normalizedWeightLabel);
    setFeedback({ message: t('auth.onboarding.savingWeight'), type: 'success' });

    setLoading(true);
    let profileUpdated = false;

    try {
      console.info('[weight-save-trace] onboarding_profile_update_start', {
        traceId,
      });

      await updateProfile({ fullName: safeName });
      profileUpdated = true;

      console.info('[weight-save-trace] onboarding_profile_update_ok', {
        traceId,
      });

      console.info('[weight-save-trace] onboarding_weight_save_start', {
        traceId,
        parsedWeight,
      });
      await addWeight(parsedWeight);

      console.info('[weight-save-trace] onboarding_weight_save_ok', {
        traceId,
      });

      router.replace('/(tabs)/workout' as any);
    } catch (e: any) {
      setWeight(submittedWeightInput);

      const message = e?.message || '';
      const isRlsFailure = message.includes('42501') || message.toLowerCase().includes('row-level security');

      console.error('[weight-save-trace] onboarding_submit_failed', {
        traceId,
        profileUpdated,
        message,
      });

      const fallbackMessage = profileUpdated
        ? t('auth.onboarding.saveErrorWeightOnly')
        : t('auth.onboarding.saveErrorProfile');

      setFeedback({
        message: isRlsFailure
          ? `${message}\n${t('auth.onboarding.migrationHint')}`
          : e?.message || fallbackMessage,
        type: 'error',
      });
    } finally {
      console.info('[weight-save-trace] onboarding_submit_end', {
        traceId,
      });

      setLoading(false);
    }
  }

  function handleSkip() {
    router.replace('/(tabs)/workout' as any);
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
            <Text style={styles.title}>{t('auth.onboarding.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.onboarding.subtitle')}</Text>
          </View>

          <View style={styles.formCard}>
            {feedback ? (
              <View style={[styles.feedbackBanner, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
                <Ionicons 
                  name={feedback.type === 'error' ? 'alert-circle' : 'checkmark-circle'} 
                  size={16} 
                  color={feedback.type === 'error' ? '#EF4444' : '#10B981'} 
                />
                <Text style={styles.feedbackText}>{feedback.message}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t('auth.onboarding.nameLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('auth.onboarding.namePlaceholder')}
                placeholderTextColor={palette.textMuted}
                autoCorrect={false}
                style={styles.inputField}
              />
            </View>

            <Text style={styles.label}>{t('auth.onboarding.weightLabel')}</Text>
            <View style={styles.inputLine}>
              <TextInput
                value={weight}
                onChangeText={(value) => setWeight(sanitizeDecimalText(value).slice(0, 8))}
                placeholder={t('auth.onboarding.weightPlaceholder')}
                placeholderTextColor={palette.textMuted}
                keyboardType="decimal-pad"
                style={styles.inputField}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('auth.onboarding.completeSetup')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipAction} onPress={handleSkip} disabled={loading}>
               <Text style={styles.skipActionText}>{t('auth.onboarding.skipAction')}</Text>
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
    marginTop: 6,
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
  primaryButton: {
    marginTop: Spacing.lg,
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
  skipAction: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  skipActionText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
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
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
