import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import type { WorkoutCommentWithProfile } from '@/services/interactionService';
import { formatRelativeTime } from '@/utils/dateUtils';

const palette = Colors.dark;
const HEADER_BG = palette.bgPrimary;
const SHEET_BG = palette.bgPrimary;

type FeedCommentsModalProps = {
  visible: boolean;
  workoutName: string;
  comments: WorkoutCommentWithProfile[];
  isLoading: boolean;
  isSending: boolean;
  errorMessage: string | null;
  inputValue: string;
  onChangeInput: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
  onRetry: () => void;
};

function displayNameOf(comment: WorkoutCommentWithProfile, fallbackLabel: string): string {
  return comment.profile?.full_name?.trim() || comment.profile?.username || fallbackLabel;
}

function initialsOf(comment: WorkoutCommentWithProfile, fallbackLabel: string): string {
  return displayNameOf(comment, fallbackLabel)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function FeedCommentsModal({
  visible,
  workoutName,
  comments,
  isLoading,
  isSending,
  errorMessage,
  inputValue,
  onChangeInput,
  onClose,
  onSend,
  onRetry,
}: FeedCommentsModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const athleteFallback = t('publicProfile.athleteFallback');

  const listEmptyState = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.statusWrap}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>{t('feed.comments.loading')}</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.statusWrap}>
          <Text style={styles.errorTitle}>{t('feed.comments.loadErrorTitle')}</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            activeOpacity={ACTIVE_OPACITY} 
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('feed.comments.retry')}
          >
            <Text style={styles.retryButtonText}>{t('feed.comments.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.statusWrap}>
        <Text style={styles.statusText}>{t('feed.comments.empty')}</Text>
      </View>
    );
  }, [errorMessage, isLoading, onRetry, t]);

  if (!visible && isWeb) {
    return null;
  }

  const ModalWrapper = isWeb ? View : Modal;
  const wrapperProps = isWeb 
    ? { style: [StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: SHEET_BG }] }
    : { visible, animationType: 'slide' as const, presentationStyle: 'fullScreen' as const, onRequestClose: onClose };

  return (
    <ModalWrapper {...wrapperProps}>
      <KeyboardAvoidingView
        style={[styles.screen, isWeb && styles.screenWeb]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={[styles.screenFrame, isWeb && styles.screenFrameWeb]}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}> 
            <TouchableOpacity 
              style={styles.closeButton} 
              activeOpacity={ACTIVE_OPACITY} 
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.close', { defaultValue: 'Close' })}
            >
              <Ionicons name="close" size={22} color={palette.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>{t('feed.comments.title')}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {workoutName}
              </Text>
            </View>
            <View style={styles.headerRightSpacer} />
          </View>

          <View style={styles.content}>
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  {item.profile?.avatar_url ? (
                    <Image source={{ uri: item.profile.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{initialsOf(item, athleteFallback)}</Text>
                    </View>
                  )}

                  <View style={styles.commentTextWrap}>
                    <View style={styles.commentHeaderRow}>
                      <Text style={styles.commentAuthor}>{displayNameOf(item, athleteFallback)}</Text>
                      <Text style={styles.commentTime}>{formatRelativeTime(item.created_at)}</Text>
                    </View>
                    <Text style={styles.commentBody}>{item.content}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={listEmptyState}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />

            <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}> 
              <TextInput
                accessibilityLabel={t('feed.comments.inputPlaceholder')}
                value={inputValue}
                onChangeText={onChangeInput}
                style={styles.input}
                placeholder={t('feed.comments.inputPlaceholder')}
                placeholderTextColor={palette.textMuted}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, (isSending || inputValue.trim().length === 0) && styles.sendButtonDisabled]}
                activeOpacity={ACTIVE_OPACITY}
                onPress={onSend}
                disabled={isSending || inputValue.trim().length === 0}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.send', { defaultValue: 'Send' })}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Ionicons name="send" size={16} color={palette.textPrimary} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ModalWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SHEET_BG,
  },
  screenWeb: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  screenFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: SHEET_BG,
  },
  screenFrameWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    left: 0,
    right: 0,
    backgroundColor: SHEET_BG,
  },
  header: {
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerTextWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 1,
  },
  headerSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  headerRightSpacer: {
    width: 34,
    height: 34,
  },
  content: {
    flex: 1,
    backgroundColor: SHEET_BG,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    flexGrow: 1,
  },
  statusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  errorTitle: {
    color: palette.error,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    color: palette.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 12,
    borderRadius: Radius.sm,
    minHeight: 36,
    paddingHorizontal: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  commentItem: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 9,
    paddingVertical: 9,
    flexDirection: 'row',
    marginBottom: 7,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
  },
  avatarFallbackText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  commentTextWrap: {
    flex: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10,
  },
  commentTime: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  commentBody: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  inputRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
    paddingTop: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 8,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    color: palette.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
