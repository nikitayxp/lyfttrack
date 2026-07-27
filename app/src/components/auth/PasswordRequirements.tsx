import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing } from '@/constants/Styles';
import {
  PASSWORD_MIN_LENGTH,
  evaluatePasswordRules,
  type PasswordRuleKey,
} from '@/utils/passwordRules';

const palette = Colors.dark;

const RULE_LABEL_KEYS: Record<PasswordRuleKey, string> = {
  length: 'auth.signUp.passwordRuleLength',
  uppercase: 'auth.signUp.passwordRuleUppercase',
  number: 'auth.signUp.passwordRuleNumber',
  symbol: 'auth.signUp.passwordRuleSymbol',
};

type PasswordRequirementsProps = {
  password: string;
};

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const { t } = useTranslation();
  const rules = evaluatePasswordRules(password);

  return (
    <View style={styles.container} accessibilityLabel={t('auth.signUp.passwordRequirementsTitle')}>
      <Text style={styles.title}>{t('auth.signUp.passwordRequirementsTitle')}</Text>

      {rules.map((rule) => (
        <View key={rule.key} style={styles.rule}>
          {/* State is carried by the icon as well as the colour, so it does not
              depend on colour perception alone. */}
          <Ionicons
            name={rule.met ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={rule.met ? palette.success : palette.textMuted}
          />
          <Text style={[styles.ruleText, rule.met && styles.ruleTextMet]}>
            {t(RULE_LABEL_KEYS[rule.key], { min: PASSWORD_MIN_LENGTH })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(17, 17, 17, 0.55)',
    rowGap: 6,
  },
  title: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  ruleText: {
    flex: 1,
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  ruleTextMet: {
    color: palette.success,
  },
});
