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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import type { WorkoutCommentWithProfile } from '@/services/interactionService';
import { formatRelativeTime } from '@/utils/dateUtils';

const palette = Colors.dark;
const HEADER_BG = '#000000';
const SHEET_BG = '#000000';

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

function displayNameOf(comment: WorkoutCommentWithProfile): string {
  return comment.profile?.full_name?.trim() || comment.profile?.username || 'Atleta';
}

function initialsOf(comment: WorkoutCommentWithProfile): string {
  return displayNameOf(comment)
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
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const listEmptyState = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.statusWrap}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>A carregar comentarios...</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.statusWrap}>
          <Text style={styles.errorTitle}>Nao foi possivel carregar comentarios</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.statusWrap}>
        <Text style={styles.statusText}>Ainda sem comentarios. Sê o primeiro.</Text>
      </View>
    );
  }, [errorMessage, isLoading, onRetry]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.screen, isWeb && styles.screenWeb]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={[styles.screenFrame, isWeb && styles.screenFrameWeb]}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}> 
            <TouchableOpacity style={styles.closeButton} activeOpacity={0.88} onPress={onClose}>
              <Ionicons name="close" size={22} color={palette.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Comentarios</Text>
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
                      <Text style={styles.avatarFallbackText}>{initialsOf(item)}</Text>
                    </View>
                  )}

                  <View style={styles.commentTextWrap}>
                    <View style={styles.commentHeaderRow}>
                      <Text style={styles.commentAuthor}>{displayNameOf(item)}</Text>
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
                value={inputValue}
                onChangeText={onChangeInput}
                style={styles.input}
                placeholder="Escreve um comentario..."
                placeholderTextColor={palette.textMuted}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, (isSending || inputValue.trim().length === 0) && styles.sendButtonDisabled]}
                activeOpacity={0.88}
                onPress={onSend}
                disabled={isSending || inputValue.trim().length === 0}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
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
    borderRadius: 8,
    minHeight: 36,
    paddingHorizontal: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  commentItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
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
    backgroundColor: '#111111',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    color: palette.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
