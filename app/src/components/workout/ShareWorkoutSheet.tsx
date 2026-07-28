import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import {
  buildShareMessage,
  canOpenShareSheet,
  type ShareWorkoutInput,
} from '@/utils/shareWorkout';

const palette = Colors.dark;

export type ProfileVisibility = 'public' | 'friends' | 'private';

export type ShareChoice = 'link' | 'text' | 'sheet';

type ShareWorkoutSheetProps = {
  visible: boolean;
  input: ShareWorkoutInput | null;
  /**
   * The owner's profile visibility, which is what actually decides whether the
   * person receiving the link can open it. Null while it is still loading.
   */
  ownerVisibility: ProfileVisibility | null;
  onClose: () => void;
  onChoose: (choice: ShareChoice) => void;
};

export function ShareWorkoutSheet({
  visible,
  input,
  ownerVisibility,
  onClose,
  onChoose,
}: ShareWorkoutSheetProps) {
  const { t } = useTranslation();
  const isWeb = Platform.OS === 'web';

  // Nobody outside can open a private profile's workout, so a link is a dead
  // link. Better to say so than to hand over something that quietly fails.
  const isPrivate = ownerVisibility === 'private';
  const isFriendsOnly = ownerVisibility === 'friends';

  return (
    <Modal visible={visible} transparent animationType={isWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.closeModal', { defaultValue: 'Close modal' })}
        />

        <View style={[styles.sheet, isWeb && styles.sheetWeb]}>
          <View style={styles.handle} />

          <Text style={styles.title}>{t('workoutDetails.shareWorkout')}</Text>

          {input ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewText}>{buildShareMessage(input)}</Text>
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

          {/* Only offered where a share sheet actually exists, so the option is
              never a button that does nothing. */}
          {canOpenShareSheet() ? (
            <TouchableOpacity
              style={[styles.row, isPrivate && styles.rowDisabled]}
              activeOpacity={ACTIVE_OPACITY}
              onPress={() => onChoose('sheet')}
              disabled={isPrivate}
              accessibilityRole="button"
              accessibilityLabel={t('feed.shareOpenSheet')}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="share-social-outline" size={18} color={palette.accent} />
              </View>
              <Text style={styles.rowLabel}>{t('feed.shareOpenSheet')}</Text>
            </TouchableOpacity>
          ) : null}

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
  title: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  previewCard: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  previewText: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
