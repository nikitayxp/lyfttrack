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
import { Colors } from '@/constants/Colors';
import { getProfile, updateProfile } from '@/services/profileService';
import { supabase } from '@/services/supabase';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';

const palette = Colors.dark;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Erro desconhecido.';
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
      Alert.alert('Validacao', 'O nome de utilizador e obrigatorio.');
      return;
    }

    setIsSaving(true);

    try {
      await updateProfile({
        username: normalizedUsername,
        fullName: normalizedFullName,
        bio: normalizedBio,
      });

      Alert.alert('Perfil atualizado', 'As alteracoes foram guardadas com sucesso.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Nao foi possivel atualizar o perfil', toErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [bioInput, fullNameInput, isSaving, usernameInput]);

  const handleUpdateEmail = useCallback(async () => {
    if (isUpdatingEmail) {
      return;
    }

    const normalizedEmail = pendingEmailInput.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('Validacao', 'O email e obrigatorio.');
      return;
    }

    if (normalizedEmail === currentEmail.trim().toLowerCase()) {
      Alert.alert('Sem alteracoes', 'Usa um email diferente para pedir atualizacao.');
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
        'Atualizacao de email pedida',
        'Confirma o novo email na tua caixa de entrada antes de ficar ativo.'
      );
    } catch (error) {
      Alert.alert('Nao foi possivel atualizar o email', toErrorMessage(error));
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
      Alert.alert('Email em falta', 'Define primeiro um email para receber instrucoes de recuperacao.');
      return;
    }

    setIsSendingPasswordReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail);

      if (error) {
        throw error;
      }

      Alert.alert('Email enviado', `As instrucoes de recuperacao foram enviadas para ${targetEmail}.`);
    } catch (error) {
      Alert.alert('Nao foi possivel enviar o email de recuperacao', toErrorMessage(error));
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
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Editar Perfil</Text>
        <Text style={styles.subtitle}>Atualiza os teus dados publicos e preferencias da conta.</Text>

        {isLoading ? (
          <View style={styles.statusCard}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.statusText}>A carregar perfil...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Nao foi possivel carregar o perfil</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={() => void loadProfile()}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Nome de utilizador</Text>
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

              <Text style={styles.inputLabel}>Nome completo</Text>
              <TextInput
                value={fullNameInput}
                onChangeText={(value) => setFullNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
                style={styles.input}
                placeholder="O teu nome completo"
                placeholderTextColor={palette.textMuted}
                autoCapitalize="words"
                maxLength={INPUT_LIMITS.nameMax}
              />

              <Text style={styles.inputLabel}>Biografia</Text>
              <TextInput
                value={bioInput}
                onChangeText={(value) => setBioInput(value.substring(0, INPUT_LIMITS.bioMax))}
                style={[styles.input, styles.bioInput]}
                placeholder="Partilha o teu foco de treino"
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
                  <Text style={styles.saveButtonText}>Guardar alteracoes</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.accountCard}>
              <Text style={styles.accountTitle}>Seguranca da conta</Text>
              <Text style={styles.accountHint}>Email atual: {currentEmail || 'Indisponivel'}</Text>

              <Text style={styles.inputLabel}>Novo email</Text>
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
                    <Text style={styles.accountPrimaryButtonText}>Atualizar email</Text>
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
                    <Text style={styles.accountSecondaryButtonText}>Enviar recuperacao de palavra-passe</Text>
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
});
