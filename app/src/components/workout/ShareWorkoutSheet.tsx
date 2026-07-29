import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import { buildShareMessage, type ShareWorkoutInput } from '@/utils/shareWorkout';

const palette = Colors.dark;

export type ProfileVisibility = 'public' | 'friends' | 'private';

export type ShareChoice = 'link' | 'text';

type ShareWorkoutSheetProps = {
  input: ShareWorkoutInput | null;
  /**
   * The owner's profile visibility, which is what actually decides whether the
   * person receiving the link can open it. Null while it is still loading.
   */
  ownerVisibility: ProfileVisibility | null;
  notice?: { message: string; tone: 'info' | 'error' } | null;
  onCancel: () => void;
  onChoose: (choice: ShareChoice) => void;
};

/** Content only — parent owns the bottom sheet so menu → share keeps the backdrop. */
export function ShareWorkoutSheet({
  input,
  ownerVisibility,
  notice = null,
  onCancel,
  onChoose,
}: ShareWorkoutSheetProps) {
  const { t } = useTranslation();
  const preview = input ? buildShareMessage(input) : '';

  const isPrivate = ownerVisibility === 'private';
  const isFriendsOnly = ownerVisibility === 'friends';

  return (
    <View>
      <Text style={styles.title}>{t('workoutDetails.shareWorkout')}</Text>

      {input ? (
        <TextInput
          style={styles.previewInput}
          value={preview}
          editable={false}
          multiline
          selectTextOnFocus
          showSoftInputOnFocus={false}
          accessibilityLabel={t('feed.sharePreview', { defaultValue: 'Share preview' })}
        />
      ) : null}

      {notice ? (
        <View style={[styles.copyNotice, notice.tone === 'error' && styles.copyNoticeError]}>
          <Ionicons
            name={notice.tone === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={15}
            color={notice.tone === 'error' ? palette.error : palette.success}
          />
          <Text style={styles.copyNoticeText}>{notice.message}</Text>
        </View>
      ) : null}

      {isPrivate || isFriendsOnly ? (
        <View style={[styles.notice, isPrivate && styles.noticeBlocking]}>
          <Ionicons
            name={isPrivate ? 'lock-closed' : 'people'}
            size={15}
            color={isPrivate ? palette.errorText : palette.warningText}
          />
          <Text style={styles.noticeText}>
            {isPrivate ? t('feed.sharePrivateWarning') : t('feed.shareFriendsWarning')}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.row, isPrivate && styles.rowDisabled]}
        activeOpacity={ACTIVE_OPACITY}
        onPress={() => onChoose('link')}
        disabled={isPrivate}
        accessibilityRole="button"
        accessibilityLabel={t('feed.shareCopyLink')}
      >
        <View style={styles.rowIcon}>
          <Ionicons name="link-outline" size={18} color={palette.accent} />
        </View>
        <Text style={styles.rowLabel}>{t('feed.shareCopyLink')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.row, isPrivate && styles.rowDisabled]}
        activeOpacity={ACTIVE_OPACITY}
        onPress={() => onChoose('text')}
        disabled={isPrivate}
        accessibilityRole="button"
        accessibilityLabel={t('feed.shareCopyText')}
      >
        <View style={styles.rowIcon}>
          <Ionicons name="document-text-outline" size={18} color={palette.accent} />
        </View>
        <Text style={styles.rowLabel}>{t('feed.shareCopyText')}</Text>
      </TouchableOpacity>

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
  title: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  previewInput: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    minHeight: 72,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ userSelect: 'text' } as object) : null),
  },
  copyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.28)',
    backgroundColor: 'rgba(22,163,74,0.10)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  copyNoticeError: {
    borderColor: 'rgba(239,68,68,0.28)',
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  copyNoticeText: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    backgroundColor: 'rgba(251,191,36,0.10)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  noticeBlocking: {
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  noticeText: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowDisabled: {
    opacity: 0.4,
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
