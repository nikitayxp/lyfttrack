import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import type { WorkoutFeedItem } from '@/services/workoutService';
import { formatRelativeTime } from '@/utils/dateUtils';

const palette = Colors.dark;
const CARD_BG = palette.surface;

type WorkoutFeedCardProps = {
  workout: WorkoutFeedItem;
  likeCount?: number;
  commentsCount?: number;
  hasLiked?: boolean;
  isLikePending?: boolean;
  onToggleLike?: () => void;
  onOpenComments?: () => void;
  onCopyWorkout?: () => void;
  disableInteractions?: boolean;
};

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) {
    return '--';
  }

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const totalMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function formatRecords(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return `${value}`;
}

function profileDisplayName(workout: WorkoutFeedItem, fallbackLabel: string): string {
  const fullName = workout.profile?.full_name?.trim();
  const username = workout.profile?.username?.trim();

  return fullName || username || fallbackLabel;
}

function initialsFromName(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function WorkoutFeedCard({
  workout,
  likeCount,
  commentsCount,
  hasLiked,
  isLikePending,
  onToggleLike,
  onOpenComments,
  onCopyWorkout,
  disableInteractions = false,
}: WorkoutFeedCardProps) {
  const { t } = useTranslation();
  const displayName = profileDisplayName(workout, t('publicProfile.athleteFallback'));

  const resolvedLikeCount = likeCount ?? workout.likes_count;
  const resolvedCommentsCount = commentsCount ?? workout.comments_count;
  const resolvedHasLiked = hasLiked ?? workout.has_liked;
  const resolvedIsLikePending = isLikePending ?? false;
  const interactionsDisabled = disableInteractions || !onToggleLike;

  function openWorkoutDetails() {
    router.push(`/workout/${workout.id}` as any);
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.mainTouchArea} 
        activeOpacity={ACTIVE_OPACITY} 
        onPress={openWorkoutDetails}
        accessibilityRole="button"
        accessibilityLabel={t('feed.openWorkout', { defaultValue: 'Open workout' })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.authorWrap}>
            {workout.profile?.avatar_url ? (
              <Image source={{ uri: workout.profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initialsFromName(displayName)}</Text>
              </View>
            )}

            <View style={styles.authorTextWrap}>
              <Text style={styles.authorName}>{displayName}</Text>
              <Text style={styles.authorMeta}>{formatRelativeTime(workout.start_time)}</Text>
            </View>
          </View>

          <View style={styles.durationChip}>
            <Ionicons name="time-outline" size={13} color={palette.accent} />
            <Text style={styles.durationText}>{formatDuration(workout.start_time, workout.end_time)}</Text>
          </View>
        </View>

        <Text style={styles.workoutName}>{workout.name}</Text>
        {workout.notes ? <Text style={styles.workoutNotes} numberOfLines={2}>{workout.notes}</Text> : null}

        <View style={styles.metricsRow}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{workout.totalSets}</Text>
            <Text style={styles.metricLabel}>{t('feed.metrics.sets')}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{formatRecords(workout.prCount)}</Text>
            <Text style={styles.metricLabel}>{t('feed.metrics.records')}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{workout.exerciseNames.length}</Text>
            <Text style={styles.metricLabel}>{t('feed.metrics.exercises')}</Text>
          </View>
        </View>

        {workout.exerciseNames.length > 0 ? (
          <View style={styles.exercisePreviewWrap}>
            <Text style={styles.exercisePreviewText} numberOfLines={2}>
              {workout.exerciseNames.join(' • ')}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.interactionRow}>
        <TouchableOpacity
          style={[styles.interactionButton, resolvedHasLiked && styles.likeButtonActive]}
          activeOpacity={ACTIVE_OPACITY}
          onPress={onToggleLike}
          disabled={interactionsDisabled || resolvedIsLikePending}
          accessibilityRole="button"
          accessibilityLabel={resolvedHasLiked ? t('feed.unlikeWorkout', { defaultValue: 'Unlike workout' }) : t('feed.likeWorkout', { defaultValue: 'Like workout' })}
        >
          {resolvedIsLikePending ? (
            <ActivityIndicator size="small" color={resolvedHasLiked ? palette.accent : palette.textMuted} />
          ) : (
            <Ionicons
              name={resolvedHasLiked ? 'heart' : 'heart-outline'}
              size={17}
              color={resolvedHasLiked ? palette.accent : palette.textMuted}
            />
          )}
          <Text style={[styles.interactionText, resolvedHasLiked && styles.likeTextActive]}>{resolvedLikeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.interactionButtonStatic}
          activeOpacity={ACTIVE_OPACITY}
          onPress={onOpenComments}
          disabled={!onOpenComments}
          accessibilityRole="button"
          accessibilityLabel={t('feed.openComments', { defaultValue: 'Open comments' })}
        >
          <Ionicons name="chatbubble-outline" size={17} color={palette.textMuted} />
          <Text style={styles.interactionText}>{resolvedCommentsCount}</Text>
        </TouchableOpacity>

        {onCopyWorkout ? (
          <TouchableOpacity
            style={styles.interactionButtonStatic}
            activeOpacity={ACTIVE_OPACITY}
            onPress={onCopyWorkout}
            accessibilityRole="button"
            accessibilityLabel={t('feed.copyWorkout', { defaultValue: 'Copy workout' })}
          >
            <Ionicons name="copy-outline" size={17} color={palette.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {('latest_comment' in workout && (workout as any).latest_comment) ? (
        <TouchableOpacity 
          style={styles.latestCommentWrap} 
          activeOpacity={ACTIVE_OPACITY} 
          onPress={onOpenComments}
          accessibilityRole="button"
          accessibilityLabel={t('feed.openComments', { defaultValue: 'Open comments' })}
        >
          <Text style={styles.latestCommentAuthor}>{(workout as any).latest_comment.author}</Text>
          <Text style={styles.latestCommentContent} numberOfLines={1}>{(workout as any).latest_comment.content}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 6,
  },
  mainTouchArea: {
    borderRadius: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  authorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 6,
    marginRight: 8,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bgPrimary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  avatarFallbackText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  authorTextWrap: {
    flex: 1,
  },
  authorName: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 0,
  },
  authorMeta: {
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 3,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: palette.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  workoutName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  workoutNotes: {
    color: palette.textSecondary,
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 0,
    backgroundColor: palette.bgPrimary,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginBottom: 4,
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 1,
  },
  metricLabel: {
    color: palette.textSecondary,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: palette.border,
    marginHorizontal: 4,
  },
  exerciseGroupsWrap: {
    rowGap: 4,
  },
  exerciseGroupCard: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  exerciseGroupName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    minHeight: 24,
  },
  setHeaderText: {
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  setColumnNumber: {
    width: 44,
    textAlign: 'center',
  },
  setColumnWeight: {
    width: 72,
    textAlign: 'center',
  },
  setColumnReps: {
    width: 72,
    textAlign: 'center',
  },
  setColumnRir: {
    width: 52,
    textAlign: 'center',
  },
  setRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: 0,
  },
  setCellNumber: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  setCellWeight: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  setCellReps: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  setCellRir: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  noSetsWrap: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  noSetsText: {
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  interactionRow: {
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  interactionButton: {
    minHeight: 26,
    borderRadius: 0,
    backgroundColor: palette.bgPrimary,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  interactionButtonStatic: {
    minHeight: 26,
    borderRadius: 0,
    backgroundColor: palette.bgPrimary,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  likeButtonActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  interactionText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  likeTextActive: {
    color: palette.accent,
  },
  exercisePreviewWrap: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  exercisePreviewText: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  latestCommentWrap: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  latestCommentAuthor: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  latestCommentContent: {
    color: palette.textSecondary,
    fontSize: 12,
    flex: 1,
  },
});
