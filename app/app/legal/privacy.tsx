import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY } from '@/constants/Styles';
import { PRIVACY_POLICY } from '@/content/legal/privacy-policy';
import type { LegalLang } from '@/content/legal/terms-of-service';
import { usePreferences } from '@/context/PreferencesContext';
import { goBack } from '@/utils/navigation';

const palette = Colors.dark;

function resolveLang(language: string): LegalLang {
  return language.toLowerCase().startsWith('en') ? 'en' : 'pt';
}

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const lang = resolveLang(language);
  const doc = PRIVACY_POLICY;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: doc.title[lang],
          headerStyle: { backgroundColor: palette.bgPrimary },
          headerTintColor: palette.textPrimary,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>
          {lang === 'pt' ? 'Última atualização' : 'Last updated'}: {doc.lastUpdated}
        </Text>
        <Text style={styles.intro}>{doc.intro[lang]}</Text>

        {doc.sections.map((section) => (
          <View key={section.title.pt} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title[lang]}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph.pt.slice(0, 40)} style={styles.paragraph}>
                {paragraph[lang]}
              </Text>
            ))}
          </View>
        ))}

        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={ACTIVE_OPACITY}
          onPress={() => goBack()}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  updated: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  intro: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  paragraph: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  backButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
