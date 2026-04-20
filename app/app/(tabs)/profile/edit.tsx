import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
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
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import {
  getProfile,
  pickAvatarFromLibrary,
  updateProfile,
  uploadAvatar,
  withAvatarCacheBuster,
} from '@/services/profileService';
import { getEmailChangeRedirectTo, getPasswordResetRedirectTo, supabase } from '@/services/supabase';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';
import { ConfirmModal } from '@/components/common/ConfirmModal';

const palette = Colors.dark;

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

function initialsFromName(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return 'LT';
  }

  return normalized
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const [usernameInput, setUsernameInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const [currentEmail, setCurrentEmail] = useState('');
  const [pendingEmailInput, setPendingEmailInput] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'error' | 'success' | 'info';
    message: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const profile = await getProfile();
      setUsernameInput(profile.username ?? '');
      setFullNameInput(profile.full_name ?? '');
      setBioInput(profile.bio ?? '');
      setAvatarUrl(profile.avatar_url ?? null);
      setAvatarVersion(Date.now());

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

  const handleChangeAvatar = useCallback(async () => {
    if (isUploadingAvatar || isRemovingAvatar) {
      return;
    }

    setActionFeedback(null);
    setIsUploadingAvatar(true);

    try {
      const selectedAvatar = await pickAvatarFromLibrary();

      if (!selectedAvatar) {
        return;
      }

      const updatedProfile = await uploadAvatar(selectedAvatar);
      setAvatarUrl(updatedProfile.avatar_url ?? null);
      setAvatarVersion(Date.now());

      const successMessage = t('profileEdit.alerts.avatarUpdatedDescription');
      setActionFeedback({
        type: 'success',
        message: successMessage,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.avatarUpdatedTitle'), successMessage);
      }
    } catch (error) {
      const message = toErrorMessage(error, t('common.unknownError'));
      setActionFeedback({
        type: 'error',
        message,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.avatarUploadError'), message);
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [isRemovingAvatar, isUploadingAvatar, t]);

  const handleRemoveAvatar = useCallback(async () => {
    if (isRemovingAvatar || isUploadingAvatar || !avatarUrl) {
      return;
    }

    setActionFeedback(null);
    setIsRemovingAvatar(true);

    try {
      await updateProfile({ avatarUrl: null });
      setAvatarUrl(null);
      setAvatarVersion(Date.now());

      const successMessage = t('profileEdit.alerts.avatarRemovedDescription');
      setActionFeedback({
        type: 'success',
        message: successMessage,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.avatarUpdatedTitle'), successMessage);
      }
    } catch (error) {
      const message = toErrorMessage(error, t('common.unknownError'));
      setActionFeedback({
        type: 'error',
        message,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.avatarRemoveError'), message);
      }
    } finally {
      setIsRemovingAvatar(false);
    }
  }, [avatarUrl, isRemovingAvatar, isUploadingAvatar, t]);

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
      }, {
        emailRedirectTo: getEmailChangeRedirectTo(),
      });

      if (error) {
        throw error;
      }

      const successMessage = t('profileEdit.alerts.emailUpdateRequestedDescription');

      setActionFeedback({
        type: 'success',
        message: successMessage,
      });

      // Navigate to verify screen so user can enter the 6-digit code
      router.push({
        pathname: '/(auth)/verify-email-change',
        params: { newEmail: normalizedEmail },
      });
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

      // Navigate to reset-password screen with email pre-filled
      router.push({
        pathname: '/(auth)/reset-password',
        params: { email: targetEmail },
      });
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

  const handleLogoutRequest = useCallback(() => {
    if (isLoggingOut) {
      return;
    }
    setIsLogoutModalVisible(true);
  }, [isLoggingOut]);

  const handleLogoutConfirmed = useCallback(async () => {
    if (isLoggingOut) {
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

      setIsLogoutModalVisible(false);
      router.replace('/(auth)' as any);
    } catch (error) {
      const message = toErrorMessage(error, t('common.unknownError'));

      setActionFeedback({
        type: 'error',
        message,
      });
      setIsLogoutModalVisible(false);

      if (Platform.OS !== 'web') {
        Alert.alert(t('profileEdit.alerts.logoutError'), message);
      }
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, t]);

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

  const avatarPreviewUrl = withAvatarCacheBuster(avatarUrl, avatarVersion);
  const displayName = fullNameInput.trim() || usernameInput.trim() || t('profileEdit.unavailable');
  const avatarInitials = initialsFromName(displayName);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => router.replace('/(tabs)/profile' as any)}
            accessibilityRole="button"
            accessibilityLabel={t('profileEdit.back')}
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
            <TouchableOpacity 
              style={styles.retryButton} 
              activeOpacity={ACTIVE_OPACITY} 
              onPress={() => void loadProfile()}
              accessibilityRole="button"
              accessibilityLabel={t('profileEdit.retry')}
            >
              <Text style={styles.retryButtonText}>{t('profileEdit.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.avatarCard}>
              <Text style={styles.accountTitle}>{t('profileEdit.profilePhotoTitle')}</Text>
              <Text style={styles.accountHint}>{t('profileEdit.profilePhotoHint')}</Text>

              <View style={styles.avatarRow}>
                <View style={styles.avatarFrame}>
                  {avatarPreviewUrl ? (
                    <Image source={{ uri: avatarPreviewUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{avatarInitials}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.avatarActionsColumn}>
                  <TouchableOpacity
                    style={[styles.avatarActionPrimary, isUploadingAvatar && styles.accountActionDisabled]}
                    activeOpacity={ACTIVE_OPACITY}
                    onPress={() => void handleChangeAvatar()}
                    disabled={isUploadingAvatar || isRemovingAvatar}
                    accessibilityRole="button"
                    accessibilityLabel={t('profileEdit.changePhoto')}
                  >
                    {isUploadingAvatar ? (
                      <ActivityIndicator size="small" color={palette.textPrimary} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={16} color={palette.textPrimary} />
                        <Text style={styles.avatarActionPrimaryText}>{t('profileEdit.changePhoto')}</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.avatarActionSecondary,
                      (!avatarUrl || isRemovingAvatar) && styles.accountActionDisabled,
                    ]}
                    activeOpacity={ACTIVE_OPACITY}
                    onPress={() => void handleRemoveAvatar()}
                    disabled={!avatarUrl || isRemovingAvatar || isUploadingAvatar}
                    accessibilityRole="button"
                    accessibilityLabel={t('profileEdit.removePhoto')}
                  >
                    {isRemovingAvatar ? (
                      <ActivityIndicator size="small" color={palette.textPrimary} />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color={palette.textPrimary} />
                        <Text style={styles.avatarActionSecondaryText}>{t('profileEdit.removePhoto')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>{t('profileEdit.usernameLabel')}</Text>
              <TextInput
                accessibilityLabel={t('profileEdit.usernameLabel')}
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
                accessibilityLabel={t('profileEdit.fullNameLabel')}
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
                accessibilityLabel={t('profileEdit.bioLabel')}
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
                activeOpacity={ACTIVE_OPACITY}
                onPress={() => void handleSave()}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel={t('profileEdit.saveChanges')}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
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
                accessibilityLabel={t('profileEdit.newEmailLabel')}
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
                activeOpacity={ACTIVE_OPACITY}
                onPress={() => void handleUpdateEmail()}
                disabled={isUpdatingEmail}
                accessibilityRole="button"
                accessibilityLabel={t('profileEdit.updateEmail')}
              >
                {isUpdatingEmail ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={16} color={palette.textPrimary} />
                    <Text style={styles.accountPrimaryButtonText}>{t('profileEdit.updateEmail')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.accountSecondaryButton, isSendingPasswordReset && styles.accountActionDisabled]}
                activeOpacity={ACTIVE_OPACITY}
                onPress={() => void handlePasswordReset()}
                disabled={isSendingPasswordReset}
                accessibilityRole="button"
                accessibilityLabel={t('profileEdit.sendPasswordReset')}
              >
                {isSendingPasswordReset ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <>
                    <Ionicons name="key-outline" size={16} color={palette.textPrimary} />
                    <Text style={styles.accountSecondaryButtonText}>{t('profileEdit.sendPasswordReset')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.logoutCard}>
              <TouchableOpacity
                style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
                activeOpacity={ACTIVE_OPACITY}
                onPress={handleLogoutRequest}
                disabled={isLoggingOut}
                accessibilityRole="button"
                accessibilityLabel={t('profileEdit.logoutAction')}
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

      <ConfirmModal
        visible={isLogoutModalVisible}
        title={t('profileEdit.alerts.logoutConfirmTitle')}
        description={t('profileEdit.alerts.logoutConfirmDescription')}
        confirmLabel={t('profileEdit.logoutAction')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void handleLogoutConfirmed()}
        onCancel={() => setIsLogoutModalVisible(false)}
        busy={isLoggingOut}
        tone="danger"
        icon="log-out-outline"
      />
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorTitle: {
    color: palette.errorText,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorText: {
    color: palette.errorText,
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 12,
    minHeight: 38,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.error,
    backgroundColor: palette.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    marginTop: 14,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  feedbackBanner: {
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  feedbackBannerSuccess: {
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.33)',
    backgroundColor: 'rgba(16,185,129,0.13)',
  },
  feedbackBannerError: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.33)',
    backgroundColor: 'rgba(239,68,68,0.13)',
  },
  feedbackBannerInfo: {
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.33)',
    backgroundColor: 'rgba(59,130,246,0.13)',
  },
  feedbackBannerText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  feedbackBannerTextSuccess: {
    color: palette.successLight,
  },
  feedbackBannerTextError: {
    color: palette.errorText,
  },
  feedbackBannerTextInfo: {
    color: palette.accentLight,
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
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
    borderRadius: Radius.button,
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
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  accountCard: {
    marginTop: 14,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
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
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  accountPrimaryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  accountSecondaryButton: {
    minHeight: 42,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  accountSecondaryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  accountActionDisabled: {
    opacity: 0.75,
  },
  avatarCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    rowGap: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  avatarFrame: {
    width: 88,
    height: 88,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.exerciseRowBorder,
    backgroundColor: palette.exerciseRowBg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
  },
  avatarFallbackText: {
    color: palette.chipTextSelected,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  avatarActionsColumn: {
    flex: 1,
    rowGap: 8,
  },
  avatarActionPrimary: {
    minHeight: 40,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  avatarActionPrimaryText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  avatarActionSecondary: {
    minHeight: 40,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.bgPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  avatarActionSecondaryText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  logoutCard: {
    marginTop: 24,
    marginBottom: 20,
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 10,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: palette.errorText,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
