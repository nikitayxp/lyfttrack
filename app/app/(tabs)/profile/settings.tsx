import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Erro desconhecido.';
}

export default function ProfileSettingsScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const confirmSignOut = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      const confirmFn = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
      return confirmFn ? confirmFn('Queres terminar sessao?') : true;
    }

    return await new Promise((resolve) => {
      Alert.alert('Terminar sessao', 'Queres sair da tua conta?', [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]);
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    const shouldSignOut = await confirmSignOut();

    if (!shouldSignOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace('/(auth)' as any);
    } catch (error) {
      Alert.alert('Nao foi possivel terminar sessao', toErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  }, [confirmSignOut, isSigningOut]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.88} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={palette.textPrimary} />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Definicoes</Text>
      <Text style={styles.subtitle}>Gerir conta, preferencias e seguranca da sessao.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conta</Text>

        <TouchableOpacity style={styles.rowButton} activeOpacity={0.88} onPress={() => router.push('/(tabs)/profile/edit' as any)}>
          <View style={styles.rowIconWrap}>
            <Ionicons name="create-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Editar perfil</Text>
            <Text style={styles.rowSubtitle}>Atualizar nome, bio e email</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowButton} activeOpacity={0.88} onPress={() => router.push('/(tabs)/stats' as any)}>
          <View style={styles.rowIconWrap}>
            <Ionicons name="stats-chart-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Estatisticas</Text>
            <Text style={styles.rowSubtitle}>Ver progresso e historico</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowButton} activeOpacity={0.88} onPress={() => router.push('/(tabs)/social' as any)}>
          <View style={styles.rowIconWrap}>
            <Ionicons name="people-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Amigos</Text>
            <Text style={styles.rowSubtitle}>Gerir rede e interacoes</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.footerSpacer} />

      <TouchableOpacity
        style={[styles.logoutButton, isSigningOut && styles.logoutButtonDisabled]}
        activeOpacity={0.9}
        onPress={() => void handleSignOut()}
        disabled={isSigningOut}
      >
        {isSigningOut ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.logoutButtonText}>Terminar sessao</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
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
    marginBottom: 12,
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
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
    paddingHorizontal: 12,
    paddingVertical: 12,
    rowGap: 10,
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  rowButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  rowSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  footerSpacer: {
    minHeight: 26,
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B91C1C',
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  logoutButtonDisabled: {
    opacity: 0.8,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
});
