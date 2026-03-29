import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import type { WorkoutFeedItem } from '@/services/workoutService';
import { formatRelativeTime } from '@/utils/dateUtils';

const palette = Colors.dark;
const CARD_BG = '#111827';

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

function formatVolume(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}t`;
  }

  return `${value.toLocaleString()} kg`;
}

function profileDisplayName(workout: WorkoutFeedItem): string {
  const fullName = workout.profile?.full_name?.trim();
  const username = workout.profile?.username?.trim();

  return fullName || username || 'Athlete';
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
  const exercisePreview = workout.exerciseNames.slice(0, 4);
  const remainingExercises = Math.max(0, workout.exerciseNames.length - exercisePreview.length);

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
        {workout.notes ? <Text style={styles.workoutNotes}>{workout.notes}</Text> : null}

        <View style={styles.metricsRow}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{workout.totalSets}</Text>
            <Text style={styles.metricLabel}>Sets</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{formatVolume(workout.totalVolume)}</Text>
            <Text style={styles.metricLabel}>Volume</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{workout.exerciseNames.length}</Text>
            <Text style={styles.metricLabel}>Exercises</Text>
          </View>
        </View>

        <View style={styles.exerciseRow}>
          {exercisePreview.map((exerciseName, index) => (
            <View key={`${workout.id}-${exerciseName}-${index}`} style={styles.exerciseChip}>
              <Text style={styles.exerciseChipText} numberOfLines={1}>
                {exerciseName}
              </Text>
            </View>
          ))}
          {remainingExercises > 0 ? (
            <View style={[styles.exerciseChip, styles.moreChip]}>
              <Text style={styles.moreChipText}>+{remainingExercises}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.interactionRow}>
        <TouchableOpacity
          style={[styles.interactionButton, resolvedHasLiked && styles.likeButtonActive]}
          activeOpacity={0.85}
          onPress={onToggleLike}
          disabled={interactionsDisabled || resolvedIsLikePending}
        >
          {resolvedIsLikePending ? (
            <ActivityIndicator size="small" color={resolvedHasLiked ? '#EF4444' : palette.textMuted} />
          ) : (
            <Ionicons
              name={resolvedHasLiked ? 'heart' : 'heart-outline'}
              size={17}
              color={resolvedHasLiked ? '#EF4444' : palette.textMuted}
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
          <Ionicons name="chatbubble-ellipses-outline" size={17} color={palette.textMuted} />
          <Text style={styles.interactionText}>{resolvedCommentsCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  mainTouchArea: {
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  authorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
  },
  avatarFallbackText: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  authorTextWrap: {
    flex: 1,
  },
  authorName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  authorMeta: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  durationText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  workoutName: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  workoutNotes: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#253041',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#253041',
    marginHorizontal: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 6,
  },
  exerciseChip: {
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#253041',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '80%',
  },
  exerciseChipText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  moreChip: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  moreChipText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  interactionRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#253041',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  interactionButton: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#253041',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
  },
  interactionButtonStatic: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#253041',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
  },
  likeButtonActive: {
    borderColor: '#EF4444',
    backgroundColor: '#2A1118',
  },
  interactionText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  likeTextActive: {
    color: '#EF4444',
  },
});
