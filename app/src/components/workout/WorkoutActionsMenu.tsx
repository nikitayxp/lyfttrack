import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';

const palette = Colors.dark;

export type WorkoutMenuAction = 'edit' | 'copy' | 'share' | 'delete';

type WorkoutActionsMenuProps = {
  /**
   * Someone else's workout offers sharing and nothing else: editing, copying or
   * deleting a session that is not yours is either impossible or confusing, and
   * showing disabled rows would just raise the question.
   */
  canManage: boolean;
  /**
   * Deleting only shows up where the screen actually handles it. Without this
   * the row would appear everywhere the menu does and fall through to sharing.
   */
  canDelete?: boolean;
  onSelect: (action: WorkoutMenuAction) => void;
  onCancel: () => void;
};

const ACTION_ICONS: Record<WorkoutMenuAction, keyof typeof Ionicons.glyphMap> = {
  edit: 'create-outline',
  copy: 'copy-outline',
  share: 'share-social-outline',
  delete: 'trash-outline',
};

const ACTION_LABEL_KEYS: Record<WorkoutMenuAction, string> = {
  edit: 'workoutDetails.editWorkout',
  copy: 'workoutDetails.copyWorkout',
  share: 'workoutDetails.shareWorkout',
  delete: 'workoutDetails.deleteWorkout',
};

/** Content only — parent owns the bottom sheet so menu → share keeps the backdrop. */
export function WorkoutActionsMenu({
  canManage,
  canDelete = false,
  onSelect,
  onCancel,
}: WorkoutActionsMenuProps) {
  const { t } = useTranslation();
  const ownerActions: WorkoutMenuAction[] = ['edit', 'copy', 'share'];
  const actions: WorkoutMenuAction[] = canManage
    ? canDelete
      ? [...ownerActions, 'delete']
      : ownerActions
    : ['share'];

  return (
    <View>
      {actions.map((action) => {
        const isDestructive = action === 'delete';

        return (
          <TouchableOpacity
            key={action}
            style={styles.row}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => onSelect(action)}
            accessibilityRole="button"
            accessibilityLabel={t(ACTION_LABEL_KEYS[action])}
          >
            <View style={[styles.rowIcon, isDestructive && styles.rowIconDanger]}>
              <Ionicons
                name={ACTION_ICONS[action]}
                size={18}
                color={isDestructive ? palette.error : palette.accent}
              />
            </View>
            <Text style={[styles.rowLabel, isDestructive && styles.rowLabelDanger]}>
              {t(ACTION_LABEL_KEYS[action])}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={styles.cancelRow}
        activeOpacity={ACTIVE_OPACITY}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: {
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerBg,
  },
  rowLabel: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  rowLabelDanger: {
    color: palette.error,
  },
  cancelRow: {
    marginTop: Spacing.sm,
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
