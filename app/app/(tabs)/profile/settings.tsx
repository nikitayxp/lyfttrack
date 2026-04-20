import { useCallback, useEffect, useState } from 'react';
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
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import { usePreferences } from '@/context/PreferencesContext';
import type { AppLanguage } from '@/i18n/resources';
import { supabase } from '@/services/supabase';
import { getProfile, updateProfile } from '@/services/profileService';

const palette = Colors.dark;

const LANGUAGE_OPTIONS: readonly {
  key: AppLanguage;
  labelKey: 'language.english' | 'language.portuguese';
}[] = [
  { key: 'en', labelKey: 'language.english' },
  { key: 'pt', labelKey: 'language.portuguese' },
];

const PRIVACY_OPTIONS: readonly {
  key: 'public' | 'friends' | 'private';
  labelKey: 'settings.visibilityPublic' | 'settings.visibilityFriends' | 'settings.visibilityPrivate';
}[] = [
  { key: 'public', labelKey: 'settings.visibilityPublic' },
  { key: 'friends', labelKey: 'settings.visibilityFriends' },
  { key: 'private', labelKey: 'settings.visibilityPrivate' },
];

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

export default function ProfileSettingsScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const { t } = useTranslation();
  const { language, setLanguage } = usePreferences();
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getProfile()
      .then((profile) => {
        if (isMounted) {
          setVisibility(profile.visibility ?? 'public');
          setIsLoadingProfile(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingProfile(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePrivacyChange = useCallback(async (nextVisibility: 'public' | 'friends' | 'private') => {
    if (isUpdatingPrivacy || nextVisibility === visibility) {
      return;
    }

    setIsUpdatingPrivacy(true);

    try {
      await updateProfile({ visibility: nextVisibility });
      setVisibility(nextVisibility);
    } catch (error) {
      Alert.alert(t('settings.title'), toErrorMessage(error, t('common.unknownError')));
    } finally {
      setIsUpdatingPrivacy(false);
    }
  }, [isUpdatingPrivacy, visibility, t]);

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

  const handleLanguageChange = useCallback(async (nextLanguage: AppLanguage) => {
    if (isUpdatingLanguage || nextLanguage === language) {
      return;
    }

    setIsUpdatingLanguage(true);

    try {
      await setLanguage(nextLanguage);
    } catch (error) {
      Alert.alert(t('settings.title'), toErrorMessage(error, t('common.unknownError')));
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
      Alert.alert(t('settings.signOutError'), toErrorMessage(error, t('common.unknownError')));
    } finally {
      setIsSigningOut(false);
    }
  }, [confirmSignOut, isSigningOut, t]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={ACTIVE_OPACITY}
          onPress={() => router.replace('/(tabs)/profile' as any)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.back')}
        >
          <Ionicons name="chevron-back" size={18} color={palette.textPrimary} />
          <Text style={styles.backButtonText}>{t('settings.back')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t('settings.title')}</Text>
      <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.account')}</Text>

        <TouchableOpacity 
          style={styles.rowButton} 
          activeOpacity={ACTIVE_OPACITY} 
          onPress={() => router.push('/(tabs)/profile/edit' as any)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.editProfile')}
        >
          <View style={styles.rowIconWrap}>
            <Ionicons name="create-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{t('settings.editProfile')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.editProfileSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.rowButton} 
          activeOpacity={ACTIVE_OPACITY} 
          onPress={() => router.push('/(tabs)/stats' as any)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.stats')}
        >
          <View style={styles.rowIconWrap}>
            <Ionicons name="stats-chart-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{t('settings.stats')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.statsSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.rowButton} 
          activeOpacity={ACTIVE_OPACITY} 
          onPress={() => router.push('/(tabs)/social' as any)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.friends')}
        >
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
        <Text style={styles.cardTitle}>{t('settings.privacy')}</Text>
        <View style={styles.languageSection}>
          <View style={styles.languageSectionHeader}>
            <Text style={styles.languageSectionTitle}>{t('settings.privacy')}</Text>
            {isUpdatingPrivacy || isLoadingProfile ? <ActivityIndicator size="small" color={palette.accent} /> : null}
          </View>

          <View style={styles.languageSegmentedControl}>
            {PRIVACY_OPTIONS.map((option) => {
              const isSelected = option.key === visibility;

              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.languageSegmentButton, isSelected && styles.languageSegmentButtonSelected]}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => void handlePrivacyChange(option.key)}
                  disabled={isUpdatingPrivacy || isLoadingProfile}
                  accessibilityRole="button"
                  accessibilityLabel={t(option.labelKey)}
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
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => void handleLanguageChange(option.key)}
                  disabled={isUpdatingLanguage}
                  accessibilityRole="button"
                  accessibilityLabel={t(option.labelKey)}
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
        activeOpacity={ACTIVE_OPACITY}
        onPress={() => void handleSignOut()}
        disabled={isSigningOut}
        accessibilityRole="button"
        accessibilityLabel={t('settings.signOut')}
      >
        {isSigningOut ? (
          <ActivityIndicator size="small" color={palette.textPrimary} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={18} color={palette.textPrimary} />
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
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    rowGap: 10,
    marginBottom: 24,
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  rowButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
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
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
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
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  languageSegmentedControl: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.exerciseRowBorder,
    backgroundColor: palette.exerciseRowBg,
    padding: 4,
  },
  languageSegmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  languageSegmentButtonSelected: {
    backgroundColor: palette.accentSoft,
  },
  languageSegmentText: {
    color: palette.labelMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  languageSegmentTextSelected: {
    color: palette.chipTextSelected,
  },
  footerSpacer: {
    minHeight: 26,
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.errorSoft,
    backgroundColor: palette.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  logoutButtonDisabled: {
    opacity: 0.8,
  },
  logoutButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
});
