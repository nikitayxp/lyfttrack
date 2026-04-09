import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { getProfile, updateProfile } from '@/services/profileService';
import { getPasswordResetRedirectTo, supabase } from '@/services/supabase';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';

const palette = Colors.dark;

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const [usernameInput, setUsernameInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [pendingEmailInput, setPendingEmailInput] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'error' | 'success' | 'info';
    message: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const profile = await getProfile();
      setUsernameInput(profile.username ?? '');
      setFullNameInput(profile.full_name ?? '');
      setBioInput(profile.bio ?? '');

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      const email = user?.email?.trim() ?? '';
      setCurrentEmail(email);
      setPendingEmailInput(email);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, t('common.unknownError')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setActionFeedback(null);

    const normalizedUsername = sanitizeText(usernameInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });
    const normalizedFullName = sanitizeText(fullNameInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: true,
    });
    const normalizedBio = sanitizeText(bioInput, {
      maxLength: INPUT_LIMITS.bioMax,
      allowEmpty: true,
    });

    if (!normalizedUsername) {
      Alert.alert(t('validation.title'), t('validation.usernameRequired'));
      return;
    }

    setIsSaving(true);

    try {
      await updateProfile({
        username: normalizedUsername,
        fullName: normalizedFullName,
        bio: normalizedBio,
      });

      const successMessage = t('profileEdit.alerts.updatedDescription');
      setActionFeedback({
        type: 'success',
        message: successMessage,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.updatedTitle'), successMessage);
      }
    } catch (error) {
      const message = toErrorMessage(error, t('common.unknownError'));
      setActionFeedback({
        type: 'error',
        message,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.updateProfileError'), message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [bioInput, fullNameInput, isSaving, t, usernameInput]);

  const handleUpdateEmail = useCallback(async () => {
    if (isUpdatingEmail) {
      return;
    }

    const normalizedEmail = pendingEmailInput.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert(t('validation.title'), t('validation.emailRequired'));
      return;
    }

    if (normalizedEmail === currentEmail.trim().toLowerCase()) {
      Alert.alert(t('profileEdit.alerts.noEmailChangeTitle'), t('profileEdit.alerts.noEmailChangeDescription'));
      return;
    }

    setActionFeedback(null);
    setIsUpdatingEmail(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail,
      });

      if (error) {
        throw error;
      }

      const successMessage = t('profileEdit.alerts.emailUpdateRequestedDescription');

      setActionFeedback({
        type: 'success',
        message: successMessage,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.emailUpdateRequestedTitle'), successMessage);
      }
    } catch (error) {
      const message = toErrorMessage(error, t('common.unknownError'));
      setActionFeedback({
        type: 'error',
        message,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.updateEmailError'), message);
      }
    } finally {
      setIsUpdatingEmail(false);
    }
  }, [currentEmail, isUpdatingEmail, pendingEmailInput, t]);

  const handlePasswordReset = useCallback(async () => {
    if (isSendingPasswordReset) {
      return;
    }

    const targetEmail = currentEmail.trim() || pendingEmailInput.trim();

    if (!targetEmail) {
      Alert.alert(t('profileEdit.alerts.passwordResetMissingEmailTitle'), t('profileEdit.alerts.passwordResetMissingEmailDescription'));
      return;
    }

    setActionFeedback(null);
    setIsSendingPasswordReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: getPasswordResetRedirectTo(),
      });

      if (error) {
        throw error;
      }

      const successMessage = t('profileEdit.alerts.passwordResetSentDescription', { email: targetEmail });

      setActionFeedback({
        type: 'success',
        message: successMessage,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.passwordResetSentTitle'), successMessage);
      }
    } catch (error) {
      const message = toErrorMessage(error, t('common.unknownError'));
      setActionFeedback({
        type: 'error',
        message,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.passwordResetError'), message);
      }
    } finally {
      setIsSendingPasswordReset(false);
    }
  }, [currentEmail, isSendingPasswordReset, pendingEmailInput, t]);

  const confirmLogout = useCallback(async (): Promise<boolean> => {
    const confirmDescription = t('profileEdit.alerts.logoutConfirmDescription');

    if (Platform.OS === 'web') {
      const confirmFn = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
      return confirmFn ? confirmFn(confirmDescription) : true;
    }

    return await new Promise((resolve) => {
      Alert.alert(t('profileEdit.alerts.logoutConfirmTitle'), confirmDescription, [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: t('profileEdit.logoutAction'),
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]);
    });
  }, [t]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) {
      return;
    }

    const shouldSignOut = await confirmLogout();

    if (!shouldSignOut) {
      return;
    }

    setActionFeedback({
      type: 'info',
      message: t('profileEdit.alerts.logoutInProgress'),
    });

    setIsLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace('/(auth)' as any);
    } catch (error) {
      const message = toErrorMessage(error, t('common.unknownError'));

      setActionFeedback({
        type: 'error',
        message,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.logoutError'), message);
      }
    } finally {
      setIsLoggingOut(false);
    }
  }, [confirmLogout, isLoggingOut, t]);

  const feedbackStyles = actionFeedback?.type === 'success'
    ? [styles.feedbackBanner, styles.feedbackBannerSuccess]
    : actionFeedback?.type === 'error'
      ? [styles.feedbackBanner, styles.feedbackBannerError]
      : [styles.feedbackBanner, styles.feedbackBannerInfo];

  const feedbackTextStyle = actionFeedback?.type === 'success'
    ? styles.feedbackBannerTextSuccess
    : actionFeedback?.type === 'error'
      ? styles.feedbackBannerTextError
      : styles.feedbackBannerTextInfo;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.88}
            onPress={() => router.replace('/(tabs)/profile' as any)}
          >
            <Ionicons name="chevron-back" size={18} color={palette.textPrimary} />
            <Text style={styles.backButtonText}>{t('profileEdit.back')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{t('profileEdit.title')}</Text>
        <Text style={styles.subtitle}>{t('profileEdit.subtitle')}</Text>

        {actionFeedback ? (
          <View style={feedbackStyles}>
            <Text style={[styles.feedbackBannerText, feedbackTextStyle]}>{actionFeedback.message}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.statusCard}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.statusText}>{t('profileEdit.loadingProfile')}</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>{t('profileEdit.loadProfileErrorTitle')}</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={() => void loadProfile()}>
              <Text style={styles.retryButtonText}>{t('profileEdit.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>{t('profileEdit.usernameLabel')}</Text>
              <TextInput
                value={usernameInput}
                onChangeText={(value) => setUsernameInput(value.substring(0, INPUT_LIMITS.nameMax))}
                style={styles.input}
                placeholder="username"
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={INPUT_LIMITS.nameMax}
              />

              <Text style={styles.inputLabel}>{t('profileEdit.fullNameLabel')}</Text>
              <TextInput
                value={fullNameInput}
                onChangeText={(value) => setFullNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
                style={styles.input}
                placeholder={t('profileEdit.placeholders.fullName')}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="words"
                maxLength={INPUT_LIMITS.nameMax}
              />

              <Text style={styles.inputLabel}>{t('profileEdit.bioLabel')}</Text>
              <TextInput
                value={bioInput}
                onChangeText={(value) => setBioInput(value.substring(0, INPUT_LIMITS.bioMax))}
                style={[styles.input, styles.bioInput]}
                placeholder={t('profileEdit.placeholders.bio')}
                placeholderTextColor={palette.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={INPUT_LIMITS.bioMax}
              />

              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                activeOpacity={0.9}
                onPress={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('profileEdit.saveChanges')}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.accountCard}>
              <Text style={styles.accountTitle}>{t('profileEdit.accountSecurity')}</Text>
              <Text style={styles.accountHint}>{`${t('profileEdit.currentEmail')}: ${currentEmail || t('profileEdit.unavailable')}`}</Text>

              <Text style={styles.inputLabel}>{t('profileEdit.newEmailLabel')}</Text>
              <TextInput
                value={pendingEmailInput}
                onChangeText={setPendingEmailInput}
                style={styles.input}
                placeholder={t('profileEdit.placeholders.email')}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              <TouchableOpacity
                style={[styles.accountPrimaryButton, isUpdatingEmail && styles.accountActionDisabled]}
                activeOpacity={0.9}
                onPress={() => void handleUpdateEmail()}
                disabled={isUpdatingEmail}
              >
                {isUpdatingEmail ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.accountPrimaryButtonText}>{t('profileEdit.updateEmail')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.accountSecondaryButton, isSendingPasswordReset && styles.accountActionDisabled]}
                activeOpacity={0.9}
                onPress={() => void handlePasswordReset()}
                disabled={isSendingPasswordReset}
              >
                {isSendingPasswordReset ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="key-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.accountSecondaryButtonText}>{t('profileEdit.sendPasswordReset')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.logoutCard}>
              <TouchableOpacity
                style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
                activeOpacity={0.85}
                onPress={() => void handleLogout()}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#FECACA" />
                ) : (
                  <>
                    <Ionicons name="log-out-outline" size={18} color="#FECACA" />
                    <Text style={styles.logoutButtonText}>{t('profileEdit.logoutAction')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  headerRow: {
    marginBottom: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
  },
  backButtonText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 10,
  },
  statusText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#2A1118',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorTitle: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 12,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  feedbackBanner: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  feedbackBannerSuccess: {
    borderWidth: 1,
    borderColor: '#10B98155',
    backgroundColor: '#10B98120',
  },
  feedbackBannerError: {
    borderWidth: 1,
    borderColor: '#EF444455',
    backgroundColor: '#EF444420',
  },
  feedbackBannerInfo: {
    borderWidth: 1,
    borderColor: '#3B82F655',
    backgroundColor: '#3B82F620',
  },
  feedbackBannerText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  feedbackBannerTextSuccess: {
    color: '#6EE7B7',
  },
  feedbackBannerTextError: {
    color: '#FCA5A5',
  },
  feedbackBannerTextInfo: {
    color: '#BFDBFE',
  },
  inputLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    color: palette.textPrimary,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  bioInput: {
    minHeight: 90,
    paddingTop: 10,
  },
  saveButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.75,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  accountCard: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
    paddingHorizontal: 12,
    paddingVertical: 12,
    rowGap: 8,
  },
  accountTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  accountHint: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  accountPrimaryButton: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  accountPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  accountSecondaryButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  accountSecondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  accountActionDisabled: {
    opacity: 0.75,
  },
  logoutCard: {
    marginTop: 24,
    marginBottom: 20,
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#1C0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 10,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#FECACA',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
