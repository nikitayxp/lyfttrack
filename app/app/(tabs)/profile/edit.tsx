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
import { Colors } from '@/constants/theme';
import { getProfile, updateProfile } from '@/services/profileService';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

export default function EditProfileScreen() {
  const [usernameInput, setUsernameInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [pendingEmailInput, setPendingEmailInput] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
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
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    const normalizedUsername = usernameInput.trim();

    if (!normalizedUsername) {
      Alert.alert('Validation', 'Username is required.');
      return;
    }

    setIsSaving(true);

    try {
      await updateProfile({
        username: normalizedUsername,
        fullName: fullNameInput,
        bio: bioInput,
      });

      Alert.alert('Profile Updated', 'Your profile changes were saved.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Unable to update profile', toErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [bioInput, fullNameInput, isSaving, usernameInput]);

  const runSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    } catch (error) {
      Alert.alert('Unable to logout', toErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut]);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Do you want to sign out from your account?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => void runSignOut(),
      },
    ]);
  }, [runSignOut]);

  const handleUpdateEmail = useCallback(async () => {
    if (isUpdatingEmail) {
      return;
    }

    const normalizedEmail = pendingEmailInput.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('Validation', 'Email is required.');
      return;
    }

    if (normalizedEmail === currentEmail.trim().toLowerCase()) {
      Alert.alert('No changes', 'Use a different email to request an update.');
      return;
    }

    setIsUpdatingEmail(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail,
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Email update requested',
        'Check your inbox to confirm the new email address before it becomes active.'
      );
    } catch (error) {
      Alert.alert('Unable to update email', toErrorMessage(error));
    } finally {
      setIsUpdatingEmail(false);
    }
  }, [currentEmail, isUpdatingEmail, pendingEmailInput]);

  const handlePasswordReset = useCallback(async () => {
    if (isSendingPasswordReset) {
      return;
    }

    const targetEmail = currentEmail.trim() || pendingEmailInput.trim();

    if (!targetEmail) {
      Alert.alert('Missing email', 'Set an email first to receive password reset instructions.');
      return;
    }

    setIsSendingPasswordReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail);

      if (error) {
        throw error;
      }

      Alert.alert('Reset email sent', `Password reset instructions were sent to ${targetEmail}.`);
    } catch (error) {
      Alert.alert('Unable to send reset email', toErrorMessage(error));
    } finally {
      setIsSendingPasswordReset(false);
    }
  }, [currentEmail, isSendingPasswordReset, pendingEmailInput]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.88} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={palette.textPrimary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Editar Perfil</Text>
        <Text style={styles.subtitle}>Atualiza teus dados publicos e controla a sessao.</Text>

        {isLoading ? (
          <View style={styles.statusCard}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.statusText}>Loading profile...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load profile</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={() => void loadProfile()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                value={usernameInput}
                onChangeText={setUsernameInput}
                style={styles.input}
                placeholder="username"
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                value={fullNameInput}
                onChangeText={setFullNameInput}
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor={palette.textMuted}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                value={bioInput}
                onChangeText={setBioInput}
                style={[styles.input, styles.bioInput]}
                placeholder="Tell people about your training focus"
                placeholderTextColor={palette.textMuted}
                multiline
                textAlignVertical="top"
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
                  <Text style={styles.saveButtonText}>Salvar Alteracoes</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.accountCard}>
              <Text style={styles.accountTitle}>Account Security</Text>
              <Text style={styles.accountHint}>Current email: {currentEmail || 'Not available'}</Text>

              <Text style={styles.inputLabel}>New Email</Text>
              <TextInput
                value={pendingEmailInput}
                onChangeText={setPendingEmailInput}
                style={styles.input}
                placeholder="you@example.com"
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
                    <Text style={styles.accountPrimaryButtonText}>Update Email</Text>
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
                  <ActivityIndicator size="small" color="#BFDBFE" />
                ) : (
                  <>
                    <Ionicons name="key-outline" size={16} color="#BFDBFE" />
                    <Text style={styles.accountSecondaryButtonText}>Send Password Reset</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.logoutButton, isSigningOut && styles.logoutButtonDisabled]}
              activeOpacity={0.9}
              onPress={handleLogout}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <ActivityIndicator size="small" color="#FECACA" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color="#FECACA" />
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </>
              )}
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
  },
  headerRow: {
    marginBottom: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
  },
  backButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 30,
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
    borderRadius: 16,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#2A1118',
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    minHeight: 40,
    borderRadius: 12,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#273247',
    backgroundColor: '#0E1726',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  bioInput: {
    minHeight: 94,
    paddingTop: 10,
  },
  saveButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#1D4ED8',
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    backgroundColor: '#0B1734',
    paddingHorizontal: 14,
    paddingVertical: 14,
    rowGap: 8,
  },
  accountTitle: {
    color: '#E0EAFF',
    fontSize: 15,
    fontWeight: '800',
  },
  accountHint: {
    color: '#BBD3FF',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  accountPrimaryButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#1D4ED8',
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
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E40AF',
    backgroundColor: '#10234A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  accountSecondaryButtonText: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '800',
  },
  accountActionDisabled: {
    opacity: 0.75,
  },
  logoutButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#2A1118',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  logoutButtonDisabled: {
    opacity: 0.75,
  },
  logoutButtonText: {
    color: '#FECACA',
    fontSize: 15,
    fontWeight: '800',
  },
});
