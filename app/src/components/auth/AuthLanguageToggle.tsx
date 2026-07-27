import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import { usePreferences } from '@/context/PreferencesContext';
import type { AppLanguage } from '@/i18n/resources';

const palette = Colors.dark;

const LANGUAGE_OPTIONS: readonly {
  key: AppLanguage;
  shortLabel: string;
  labelKey: 'language.english' | 'language.portuguese';
}[] = [
  { key: 'en', shortLabel: 'EN', labelKey: 'language.english' },
  { key: 'pt', shortLabel: 'PT', labelKey: 'language.portuguese' },
];

export function AuthLanguageToggle() {
  const { t } = useTranslation();
  const { language, setLanguage } = usePreferences();

  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('language.title')}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const isSelected = option.key === language;

        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.option, isSelected && styles.optionSelected]}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => void setLanguage(option.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={t(option.labelKey)}
          >
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
              {option.shortLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(17, 17, 17, 0.64)',
  },
  option: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: palette.accent,
  },
  optionText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  optionTextSelected: {
    color: palette.textPrimary,
  },
});
