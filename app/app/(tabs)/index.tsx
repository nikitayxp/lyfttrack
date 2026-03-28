import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import {
  getWorkoutHistory,
  getWorkoutStats,
  type WorkoutHistoryItem,
  type WorkoutStats,
} from '@/services/workoutService';

const palette = Colors.dark;

function formatDisplayName(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ');
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '--';
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const minutes = Math.round((endMs - startMs) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg.toLocaleString()} kg`;
}

// ─── Stat Card ────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
  accentColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accentColor?: string;
}) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconWrap, { backgroundColor: (accentColor ?? palette.accent) + '18' }]}>
        <Ionicons name={icon} size={18} color={accentColor ?? palette.accent} />
      </View>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  value: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  label: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

// ─── Workout Card ────────────────────────────────────────

function WorkoutCard({ workout }: { workout: WorkoutHistoryItem }) {
  const exerciseSummary = workout.exerciseNames.slice(0, 4);
  const remaining = workout.exerciseNames.length - 4;

  return (
    <View style={cardStyles.container}>
      <View style={cardStyles.headerRow}>
        <View style={cardStyles.headerLeft}>
          <Text style={cardStyles.workoutName} numberOfLines={1}>
            {workout.name}
          </Text>
          <Text style={cardStyles.dateText}>{formatRelativeDate(workout.start_time)}</Text>
        </View>
        <View style={cardStyles.durationChip}>
          <Ionicons name="time-outline" size={13} color={palette.accent} />
          <Text style={cardStyles.durationText}>
            {formatDuration(workout.start_time, workout.end_time)}
          </Text>
        </View>
      </View>

      <View style={cardStyles.metricsRow}>
        <View style={cardStyles.metricItem}>
          <Ionicons name="barbell-outline" size={14} color={palette.textMuted} />
          <Text style={cardStyles.metricValue}>{workout.totalSets}</Text>
          <Text style={cardStyles.metricLabel}>sets</Text>
        </View>
        <View style={cardStyles.metricDivider} />
        <View style={cardStyles.metricItem}>
          <Ionicons name="fitness-outline" size={14} color={palette.textMuted} />
          <Text style={cardStyles.metricValue}>{formatVolume(workout.totalVolume)}</Text>
          <Text style={cardStyles.metricLabel}>volume</Text>
        </View>
        <View style={cardStyles.metricDivider} />
        <View style={cardStyles.metricItem}>
          <Ionicons name="list-outline" size={14} color={palette.textMuted} />
          <Text style={cardStyles.metricValue}>{workout.exerciseNames.length}</Text>
          <Text style={cardStyles.metricLabel}>exercises</Text>
        </View>
      </View>

      <View style={cardStyles.exerciseList}>
        {exerciseSummary.map((name, i) => (
          <View key={`${workout.id}-${name}-${i}`} style={cardStyles.exerciseChip}>
            <View style={cardStyles.exerciseDot} />
            <Text style={cardStyles.exerciseChipText} numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
        {remaining > 0 && (
          <View style={[cardStyles.exerciseChip, cardStyles.exerciseChipMore]}>
            <Text style={cardStyles.exerciseChipMoreText}>+{remaining}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  workoutName: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 3,
  },
  dateText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  durationText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricValue: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: palette.border,
    marginHorizontal: 8,
  },
  exerciseList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  exerciseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  exerciseChipText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 120,
  },
  exerciseChipMore: {
    backgroundColor: palette.accentSoft,
  },
  exerciseChipMoreText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});

// ─── Main Dashboard ──────────────────────────────────────

export default function ProfileDashboardScreen() {
  const [displayName, setDisplayName] = useState('Athlete');
  const [workouts, setWorkouts] = useState<WorkoutHistoryItem[]>([]);
  const [stats, setStats] = useState<WorkoutStats>({ totalWorkouts: 0, totalVolume: 0, totalSets: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    []
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data } = await supabase.auth.getUser();

      const metadata = (data.user?.user_metadata ?? {}) as {
        username?: string;
        full_name?: string;
      };

      const fromMetadata = metadata.full_name ?? metadata.username ?? '';
      const fromEmail = data.user?.email?.split('@')[0] ?? '';
      const rawName = fromMetadata || fromEmail || 'Athlete';
      setDisplayName(formatDisplayName(rawName));

      const [historyResult, statsResult] = await Promise.all([
        getWorkoutHistory(20),
        getWorkoutStats(),
      ]);

      setWorkouts(historyResult);
      setStats(statsResult);
    } catch {
      // Silently fall back to empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const renderWorkoutCard = useCallback(
    ({ item }: { item: WorkoutHistoryItem }) => <WorkoutCard workout={item} />,
    []
  );

  const keyExtractor = useCallback((item: WorkoutHistoryItem) => item.id, []);

  const ListHeader = useMemo(
    () => (
      <>
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/images/logo.jpg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
          <View style={styles.dateChip}>
            <Ionicons name="calendar-outline" size={13} color={palette.accent} />
            <Text style={styles.dateChipText}>{todayLabel}</Text>
          </View>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Your Stats</Text>
        <View style={styles.statsRow}>
          <StatCard
            icon="flame-outline"
            value={String(stats.totalWorkouts)}
            label="Workouts"
            accentColor="#F97316"
          />
          <View style={{ width: 10 }} />
          <StatCard
            icon="trending-up-outline"
            value={formatVolume(stats.totalVolume)}
            label="Volume"
            accentColor="#22C55E"
          />
          <View style={{ width: 10 }} />
          <StatCard
            icon="layers-outline"
            value={String(stats.totalSets)}
            label="Sets"
            accentColor="#8B5CF6"
          />
        </View>

        {/* Recent History Title */}
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Recent History</Text>
          <Text style={styles.historyCount}>
            {workouts.length > 0 ? `${workouts.length} sessions` : ''}
          </Text>
        </View>
      </>
    ),
    [displayName, todayLabel, stats, workouts.length]
  );

  const ListEmpty = useMemo(
    () =>
      isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.loadingText}>Loading your workouts...</Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="barbell-outline" size={28} color={palette.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No workouts yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete your first session and it will appear here.
          </Text>
        </View>
      ),
    [isLoading]
  );

  return (
    <FlatList
      data={workouts}
      renderItem={renderWorkoutCard}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ─── Main Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  logoRow: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  logoImage: {
    width: 176,
    height: 54,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  greeting: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dateChipText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 28,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyCount: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  loadingContainer: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});