import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import type { UserRelation } from '@/services/socialService';

const palette = Colors.dark;

type FriendActionsProps = {
  relation: UserRelation['relation'];
  isBusy: boolean;
  onAdd: () => void;
  onAccept: () => void;
  onReject: () => void;
  onRemove: () => void;
};

export function FriendActions({
  relation,
  isBusy,
  onAdd,
  onAccept,
  onReject,
  onRemove,
}: FriendActionsProps) {
  const { t } = useTranslation();

  if (relation === 'self') {
    return null;
  }

  if (isBusy) {
    return (
      <View style={styles.busyRow}>
        <ActivityIndicator size="small" color={palette.accent} />
      </View>
    );
  }

  if (relation === 'request_sent') {
    return (
      <View style={styles.chip}>
        <Ionicons name="time-outline" size={14} color={palette.textMuted} />
        <Text style={styles.chipLabel}>{t('social.actions.requestSent')}</Text>
      </View>
    );
  }

  if (relation === 'request_received') {
    return (
      <View style={styles.stack}>
        <Text style={styles.prompt}>{t('social.actions.respondPrompt')}</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            activeOpacity={ACTIVE_OPACITY}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel={t('social.pending.accept')}
          >
            <Text style={styles.buttonPrimaryLabel}>{t('social.pending.accept')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            activeOpacity={ACTIVE_OPACITY}
            onPress={onReject}
            accessibilityRole="button"
            accessibilityLabel={t('social.pending.reject')}
          >
            <Text style={styles.buttonDangerLabel}>{t('social.pending.reject')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (relation === 'friends') {
    return (
      <View style={styles.row}>
        <View style={styles.chip}>
          <Ionicons name="people" size={14} color={palette.accent} />
          <Text style={[styles.chipLabel, styles.chipLabelActive]}>{t('social.actions.friends')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          activeOpacity={ACTIVE_OPACITY}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('social.actions.removeFriend')}
        >
          <Text style={styles.buttonDangerLabel}>{t('social.actions.removeFriend')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, styles.buttonPrimary, styles.buttonWide]}
      activeOpacity={ACTIVE_OPACITY}
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={t('social.actions.addFriend')}
    >
      <Ionicons name="person-add-outline" size={15} color={palette.textPrimary} />
      <Text style={styles.buttonPrimaryLabel}>{t('social.actions.addFriend')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    rowGap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.sm,
  },
  busyRow: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
  },
  chipLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: palette.accent,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: Radius.button,
    borderWidth: 1,
  },
  buttonWide: {
    alignSelf: 'stretch',
  },
  buttonPrimary: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  buttonPrimaryLabel: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  buttonDanger: {
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerBg,
  },
  buttonDangerLabel: {
    color: palette.error,
    fontSize: 13,
    fontWeight: '800',
  },
});
