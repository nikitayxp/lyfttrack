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
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/theme';
import { usePreferences } from '@/context/PreferencesContext';
import { supabase } from '@/services/supabase';

const palette = Colors.dark;

const LANGUAGE_OPTIONS: readonly { key: 'pt'; labelKey: 'language.portuguese' }[] = [
  { key: 'pt', labelKey: 'language.portuguese' },
];

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Erro desconhecido.';
}

export default function ProfileSettingsScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const { t } = useTranslation();
  const { language, setLanguage } = usePreferences();

  const confirmSignOut = useCallback(async (): Promise<boolean> => {
    const confirmDescription = t('settings.signOutConfirmDescription');

    if (Platform.OS === 'web') {
      const confirmFn = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
      return confirmFn ? confirmFn(confirmDescription) : true;
    }

    return await new Promise((resolve) => {
      Alert.alert(t('settings.signOutConfirmTitle'), confirmDescription, [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: t('settings.signOut'),
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]);
    });
  }, [t]);

  const handleLanguageChange = useCallback(async (nextLanguage: 'pt') => {
    if (isUpdatingLanguage || nextLanguage === language) {
      return;
    }

    setIsUpdatingLanguage(true);

    try {
      await setLanguage(nextLanguage);
    } catch (error) {
      Alert.alert(t('settings.title'), toErrorMessage(error));
    } finally {
      setIsUpdatingLanguage(false);
    }
  }, [isUpdatingLanguage, language, setLanguage, t]);

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
      Alert.alert(t('settings.signOutError'), toErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  }, [confirmSignOut, isSigningOut, t]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.88} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={palette.textPrimary} />
          <Text style={styles.backButtonText}>{t('settings.back')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t('settings.title')}</Text>
      <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.account')}</Text>

        <TouchableOpacity style={styles.rowButton} activeOpacity={0.88} onPress={() => router.push('/(tabs)/profile/edit' as any)}>
          <View style={styles.rowIconWrap}>
            <Ionicons name="create-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{t('settings.editProfile')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.editProfileSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowButton} activeOpacity={0.88} onPress={() => router.push('/(tabs)/stats' as any)}>
          <View style={styles.rowIconWrap}>
            <Ionicons name="stats-chart-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{t('settings.stats')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.statsSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowButton} activeOpacity={0.88} onPress={() => router.push('/(tabs)/social' as any)}>
          <View style={styles.rowIconWrap}>
            <Ionicons name="people-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{t('settings.friends')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.friendsSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.preferences')}</Text>

        <View style={styles.languageSection}>
          <View style={styles.languageSectionHeader}>
            <Text style={styles.languageSectionTitle}>{t('language.title')}</Text>
            {isUpdatingLanguage ? <ActivityIndicator size="small" color={palette.accent} /> : null}
          </View>

          <View style={styles.languageSegmentedControl}>
            {LANGUAGE_OPTIONS.map((option) => {
              const isSelected = option.key === language;

              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.languageSegmentButton, isSelected && styles.languageSegmentButtonSelected]}
                  activeOpacity={0.88}
                  onPress={() => void handleLanguageChange(option.key)}
                  disabled={isUpdatingLanguage}
                >
                  <Text style={[styles.languageSegmentText, isSelected && styles.languageSegmentTextSelected]}>
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
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
            <Text style={styles.logoutButtonText}>{t('settings.signOut')}</Text>
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
  languageSection: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#060C15',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  languageSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  languageSectionTitle: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  languageSegmentedControl: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#223247',
    backgroundColor: '#0B1422',
    padding: 4,
  },
  languageSegmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  languageSegmentButtonSelected: {
    backgroundColor: '#163153',
  },
  languageSegmentText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  languageSegmentTextSelected: {
    color: '#E2ECFF',
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
