import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import type { WorkoutFeedItem } from '@/services/workoutService';
import { formatRelativeTime } from '@/utils/dateUtils';

const palette = Colors.dark;
const CARD_BG = '#0A0A0A';

type WorkoutFeedCardProps = {
  workout: WorkoutFeedItem;
  likeCount?: number;
  commentsCount?: number;
  hasLiked?: boolean;
  isLikePending?: boolean;
  onToggleLike?: () => void;
  onOpenComments?: () => void;
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
  if (value === null || value === undefined) return '--';
  return `${value}`;
}

function profileDisplayName(workout: WorkoutFeedItem): string {
  const fullName = workout.profile?.full_name?.trim();
  const username = workout.profile?.username?.trim();

  return fullName || username || 'Atleta';
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
  disableInteractions = false,
}: WorkoutFeedCardProps) {
  const displayName = profileDisplayName(workout);

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
      <TouchableOpacity style={styles.mainTouchArea} activeOpacity={0.9} onPress={openWorkoutDetails}>
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
            <Text style={styles.metricLabel}>Series</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{formatRecords(workout.prCount)}</Text>
            <Text style={styles.metricLabel}>Recordes</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{workout.exerciseNames.length}</Text>
            <Text style={styles.metricLabel}>Exercicios</Text>
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
          activeOpacity={0.85}
          onPress={onToggleLike}
          disabled={interactionsDisabled || resolvedIsLikePending}
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
          activeOpacity={0.85}
          onPress={onOpenComments}
          disabled={!onOpenComments}
        >
          <Ionicons name="chatbubble-outline" size={17} color={palette.textMuted} />
          <Text style={styles.interactionText}>{resolvedCommentsCount}</Text>
        </TouchableOpacity>
      </View>

      {('latest_comment' in workout && (workout as any).latest_comment) ? (
        <TouchableOpacity style={styles.latestCommentWrap} activeOpacity={0.85} onPress={onOpenComments}>
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1C1C1E',
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
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1C1C1E',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
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
    borderColor: '#1C1C1E',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  workoutName: {
    color: '#FFFFFF',
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
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1C1C1E',
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginBottom: 4,
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: '#FFFFFF',
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
    backgroundColor: '#1C1C1E',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
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
    borderBottomColor: '#1C1C1E',
    paddingVertical: 0,
  },
  setCellNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  setCellWeight: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  setCellReps: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  setCellRir: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  noSetsWrap: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#1C1C1E',
    backgroundColor: '#0A0A0A',
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
    borderTopColor: '#1C1C1E',
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  interactionButton: {
    minHeight: 26,
    borderRadius: 0,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1C1C1E',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  interactionButtonStatic: {
    minHeight: 26,
    borderRadius: 0,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1C1C1E',
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
    borderTopColor: '#1C1C1E',
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
