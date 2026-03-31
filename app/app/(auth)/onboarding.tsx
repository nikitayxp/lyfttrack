import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Styles';
import { AuthAmbientGlow } from '@/components/auth/AuthAmbientGlow';
import { addWeight } from '@/services/measurementService';
import { updateProfile } from '@/services/profileService';

const palette = Colors.dark;

export default function OnboardingScreen() {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  async function handleComplete() {
    setFeedback(null);
    const w = parseFloat(weight.replace(',', '.'));
    const safeName = name.trim();

    if (!safeName || isNaN(w) || w <= 0) {
      setFeedback({ message: 'Indica um nome e o teu peso atual em kg.', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      await updateProfile({ fullName: safeName, username: safeName.toLowerCase().replace(/\s+/g, '_') });
      await addWeight(w);
      router.replace('/(tabs)/workout' as any);
    } catch (e: any) {
      setFeedback({ message: e.message || 'Ocorreu um erro a criar o teu perfil inicial.', type: 'error' });
    } finally {
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
            <Text style={styles.title}>BEM-VINDO</Text>
            <Text style={styles.subtitle}>Vamos calibrar o teu perfil para o gráfico de progresso corporal iniciar perfeitamente.</Text>
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

            <Text style={styles.label}>O teu Nome ou Nickname</Text>
            <View style={styles.inputLine}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex: João M."
                placeholderTextColor={palette.textMuted}
                autoCorrect={false}
                style={styles.inputField}
              />
            </View>

            <Text style={styles.label}>Peso Corporal Atual (KG)</Text>
            <View style={styles.inputLine}>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="Ex: 75.5"
                placeholderTextColor={palette.textMuted}
                keyboardType="numeric"
                style={styles.inputField}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>CONCLUIR SETUP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipAction} onPress={handleSkip} disabled={loading}>
               <Text style={styles.skipActionText}>Ignorar por agora</Text>
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
