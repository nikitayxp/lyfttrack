import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';

const palette = Colors.dark;

export type WorkoutMenuAction = 'edit' | 'copy' | 'share';

type WorkoutActionsMenuProps = {
  visible: boolean;
  /**
   * Someone else's workout offers sharing and nothing else: editing or copying
   * a session that is not yours is either impossible or confusing, and showing
   * disabled rows would just raise the question.
   */
  canManage: boolean;
  onClose: () => void;
  onSelect: (action: WorkoutMenuAction) => void;
};

const ACTION_ICONS: Record<WorkoutMenuAction, keyof typeof Ionicons.glyphMap> = {
  edit: 'create-outline',
  copy: 'copy-outline',
  share: 'share-social-outline',
};

const ACTION_LABEL_KEYS: Record<WorkoutMenuAction, string> = {
  edit: 'workoutDetails.editWorkout',
  copy: 'workoutDetails.copyWorkout',
  share: 'workoutDetails.shareWorkout',
};

export function WorkoutActionsMenu({ visible, canManage, onClose, onSelect }: WorkoutActionsMenuProps) {
  const { t } = useTranslation();
  const isWeb = Platform.OS === 'web';
  const actions: WorkoutMenuAction[] = canManage ? ['edit', 'copy', 'share'] : ['share'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.closeModal', { defaultValue: 'Close modal' })}
        />

        <View style={[styles.sheet, isWeb && styles.sheetWeb]}>
          <View style={styles.handle} />

          {actions.map((action) => (
            <TouchableOpacity
              key={action}
              style={styles.row}
              activeOpacity={ACTIVE_OPACITY}
              onPress={() => onSelect(action)}
              accessibilityRole="button"
              accessibilityLabel={t(ACTION_LABEL_KEYS[action])}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={ACTION_ICONS[action]} size={18} color={palette.accent} />
              </View>
              <Text style={styles.rowLabel}>{t(ACTION_LABEL_KEYS[action])}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.cancelRow}
            activeOpacity={ACTIVE_OPACITY}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.overlay,
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderTopWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  sheetWeb: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: palette.border,
    marginBottom: Spacing.md,
  },
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
  rowLabel: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
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
