import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import {
  getAllTimePRs,
  getExercisePersonalRecords,
  getExerciseProgress,
  getTrackedExercises,
  getWeeklyVolumeByMuscle,
  type AllTimePR,
  type ExercisePersonalRecords,
  type ExerciseProgressPoint,
  type ProgressMetric,
  type StatsExerciseOption,
  type WeeklyVolumeByMuscle,
} from '@/services/statsService';

const SCREEN_BG = '#050A12';
const CARD_BG = '#111827';
const CHART_NEON = '#3B82F6';

function muscleColor(muscle: string): string {
  const normalized = muscle.trim().toLowerCase();

  if (normalized.includes('chest')) return '#3B82F6';
  if (normalized.includes('back')) return '#06B6D4';
  if (normalized.includes('leg')) return '#22C55E';
  if (normalized.includes('should')) return '#F59E0B';
  if (normalized.includes('arm')) return '#A855F7';
  if (normalized.includes('core')) return '#F97316';

  return '#94A3B8';
}

function formatNumericValue(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  if (safeValue >= 1000) {
    return `${safeValue.toLocaleString()}`;
  }

  return Number.isInteger(safeValue) ? `${safeValue}` : safeValue.toFixed(1);
}

type SkeletonPanelProps = {
  lines?: number;
  minHeight?: number;
};

function SkeletonPanel({ lines = 3, minHeight = 190 }: SkeletonPanelProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.72,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <View style={[styles.skeletonPanel, { minHeight }]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Animated.View
          key={`skeleton-line-${index}`}
          style={[
            styles.skeletonLine,
            index === 0 ? styles.skeletonLineWide : styles.skeletonLineNarrow,
            { opacity },
          ]}
        />
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const [exercises, setExercises] = useState<StatsExerciseOption[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [metric, setMetric] = useState<ProgressMetric>('volume');

  const [progress, setProgress] = useState<ExerciseProgressPoint[]>([]);
  const [records, setRecords] = useState<ExercisePersonalRecords | null>(null);
  const [weeklyVolume, setWeeklyVolume] = useState<WeeklyVolumeByMuscle[]>([]);
  const [allTimePrs, setAllTimePrs] = useState<AllTimePR[]>([]);

  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingWeeklyVolume, setIsLoadingWeeklyVolume] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [weeklyVolumeError, setWeeklyVolumeError] = useState<string | null>(null);

  const chartWidth = useMemo(() => Math.max(280, Dimensions.get('window').width - 72), []);
  const weeklyChartWidth = useMemo(() => Math.max(250, Dimensions.get('window').width - 106), []);

  const loadTrackedExercises = useCallback(async () => {
    setIsLoadingExercises(true);
    setErrorMessage(null);

    try {
      const options = await getTrackedExercises();
      setExercises(options);

      setSelectedExerciseId((currentValue) => {
        if (currentValue && options.some((option) => option.id === currentValue)) {
          return currentValue;
        }

        return options[0]?.id ?? null;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      setExercises([]);
      setSelectedExerciseId(null);
    } finally {
      setIsLoadingExercises(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!selectedExerciseId) {
      setProgress([]);
      setRecords(null);
      return;
    }

    setIsLoadingStats(true);
    setErrorMessage(null);

    try {
      const [points, personalRecords] = await Promise.all([
        getExerciseProgress(selectedExerciseId, metric),
        getExercisePersonalRecords(selectedExerciseId),
      ]);

      setProgress(points);
      setRecords(personalRecords);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      setProgress([]);
      setRecords(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [metric, selectedExerciseId]);

  const loadWeeklyVolume = useCallback(async () => {
    setIsLoadingWeeklyVolume(true);
    setWeeklyVolumeError(null);

    try {
      const [weeklyRows, hallRows] = await Promise.all([getWeeklyVolumeByMuscle(), getAllTimePRs()]);

      setWeeklyVolume(weeklyRows);
      setAllTimePrs(hallRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setWeeklyVolumeError(message);
      setWeeklyVolume([]);
      setAllTimePrs([]);
    } finally {
      setIsLoadingWeeklyVolume(false);
    }
  }, []);

  useEffect(() => {
    void loadTrackedExercises();
  }, [loadTrackedExercises]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadWeeklyVolume();
  }, [loadWeeklyVolume]);

  const lineData = useMemo(
    () =>
      progress.map((point) => ({
        value: point.value,
        label: point.label,
      })),
    [progress]
  );

  const weeklyBarData = useMemo(
    () =>
      weeklyVolume.map((item) => ({
        value: item.sets,
        label: item.muscle,
        frontColor: muscleColor(item.muscle),
      })),
    [weeklyVolume]
  );

  const weeklyVolumeMaxValue = useMemo(() => {
    const maxValue = weeklyVolume.reduce((currentMax, entry) => Math.max(currentMax, entry.sets), 0);
    return Math.max(4, maxValue);
  }, [weeklyVolume]);

  const selectedExerciseName = useMemo(() => {
    if (!selectedExerciseId) {
      return null;
    }

    return exercises.find((exercise) => exercise.id === selectedExerciseId)?.name ?? null;
  }, [exercises, selectedExerciseId]);

  const metricUnitLabel = metric === 'estimated1rm' ? 'kg (1RM)' : 'kg';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progress Stats</Text>
      <Text style={styles.subtitle}>Track volume trends, estimated strength and all-time PRs.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Muscle Volume</Text>
        <Text style={styles.cardSubtitle}>Completed sets in the last 7 days by muscle group.</Text>

        {isLoadingWeeklyVolume ? (
          <SkeletonPanel lines={4} minHeight={190} />
        ) : weeklyVolumeError ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.errorText}>{weeklyVolumeError}</Text>
          </View>
        ) : weeklyBarData.length === 0 ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.placeholderText}>No completed sets in the last 7 days yet.</Text>
          </View>
        ) : (
          <View style={styles.weeklyVolumeWrap}>
            <View style={styles.weeklyVolumeChartWrap}>
              <BarChart
                data={weeklyBarData}
                width={weeklyChartWidth}
                horizontal
                barWidth={14}
                spacing={16}
                initialSpacing={8}
                endSpacing={8}
                roundedTop
                roundedBottom
                noOfSections={4}
                maxValue={weeklyVolumeMaxValue}
                rulesColor="#1F2937"
                xAxisColor="#253041"
                yAxisColor="#253041"
                xAxisThickness={1}
                yAxisThickness={1}
                xAxisLabelTextStyle={styles.axisText}
                yAxisTextStyle={styles.axisText}
                hideOrigin
                isAnimated
              />
            </View>

            <View style={styles.weeklyVolumeLegendWrap}>
              {weeklyVolume.map((entry) => (
                <View key={entry.muscle} style={styles.weeklyVolumeLegendRow}>
                  <View style={[styles.weeklyVolumeLegendDot, { backgroundColor: muscleColor(entry.muscle) }]} />
                  <Text style={styles.weeklyVolumeLegendMuscle}>{entry.muscle}</Text>
                  <Text style={styles.weeklyVolumeLegendSets}>{`${entry.sets} sets`}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exercise Focus</Text>

        {isLoadingExercises ? (
          <SkeletonPanel lines={2} minHeight={60} />
        ) : exercises.length === 0 ? (
          <Text style={styles.placeholderText}>Complete a few workouts to unlock stats insights.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {exercises.map((exercise) => {
              const isActive = exercise.id === selectedExerciseId;

              return (
                <TouchableOpacity
                  key={exercise.id}
                  style={[styles.exerciseChip, isActive && styles.exerciseChipActive]}
                  activeOpacity={0.88}
                  onPress={() => setSelectedExerciseId(exercise.id)}
                >
                  <Text style={[styles.exerciseChipText, isActive && styles.exerciseChipTextActive]}>{exercise.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.metricToggleRow}>
          <TouchableOpacity
            style={[styles.metricToggleButton, metric === 'volume' && styles.metricToggleButtonActive]}
            activeOpacity={0.88}
            onPress={() => setMetric('volume')}
          >
            <Text style={[styles.metricToggleText, metric === 'volume' && styles.metricToggleTextActive]}>Volume</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.metricToggleButton, metric === 'estimated1rm' && styles.metricToggleButtonActive]}
            activeOpacity={0.88}
            onPress={() => setMetric('estimated1rm')}
          >
            <Text style={[styles.metricToggleText, metric === 'estimated1rm' && styles.metricToggleTextActive]}>Estimated 1RM</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Evolution Chart</Text>
        <Text style={styles.cardSubtitle}>{selectedExerciseName ?? 'Select an exercise'} • {metricUnitLabel}</Text>

        {isLoadingStats ? (
          <SkeletonPanel lines={4} minHeight={190} />
        ) : errorMessage ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : lineData.length === 0 ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.placeholderText}>No completed sets yet for this exercise.</Text>
          </View>
        ) : (
          <View style={styles.chartWrap}>
            <LineChart
              data={lineData}
              width={chartWidth}
              color={CHART_NEON}
              thickness={3}
              hideDataPoints={false}
              dataPointsColor={CHART_NEON}
              dataPointsRadius={4}
              areaChart
              startFillColor={CHART_NEON}
              startOpacity={0.24}
              endFillColor={CHART_NEON}
              endOpacity={0.02}
              yAxisColor="#253041"
              xAxisColor="#253041"
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.axisText}
              rulesColor="#1F2937"
              noOfSections={4}
              initialSpacing={14}
              endSpacing={14}
              adjustToWidth
            />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All-Time PRs</Text>

        {records ? (
          <View style={styles.prGrid}>
            <View style={styles.prCard}>
              <Text style={styles.prLabel}>Heaviest Set</Text>
              <Text style={styles.prValue}>{formatNumericValue(records.heaviestWeight)} kg</Text>
            </View>

            <View style={styles.prCard}>
              <Text style={styles.prLabel}>Best 1RM</Text>
              <Text style={styles.prValue}>{formatNumericValue(records.bestEstimated1RM)} kg</Text>
            </View>

            <View style={styles.prCard}>
              <Text style={styles.prLabel}>Best Day Volume</Text>
              <Text style={styles.prValue}>{formatNumericValue(records.bestDayVolume)} kg</Text>
            </View>

            <View style={styles.prCard}>
              <Text style={styles.prLabel}>Hall of Fame Entries</Text>
              <Text style={styles.prValue}>{allTimePrs.length}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.placeholderText}>Finish a workout to unlock your PR cards.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 34,
    rowGap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtitle: {
    color: '#B7C4D8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  chipsRow: {
    columnGap: 8,
    paddingBottom: 2,
  },
  exerciseChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0D1624',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exerciseChipActive: {
    borderColor: CHART_NEON,
    backgroundColor: '#122744',
  },
  exerciseChipText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  exerciseChipTextActive: {
    color: '#DCE8FF',
  },
  metricToggleRow: {
    marginTop: 10,
    flexDirection: 'row',
    columnGap: 8,
  },
  metricToggleButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0D1624',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricToggleButtonActive: {
    borderColor: CHART_NEON,
    backgroundColor: '#122744',
  },
  metricToggleText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  metricToggleTextActive: {
    color: '#E5EDFF',
  },
  inlineStatus: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0D1624',
    justifyContent: 'center',
    paddingHorizontal: 12,
    rowGap: 10,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#334155',
  },
  skeletonLineWide: {
    width: '88%',
    alignSelf: 'center',
  },
  skeletonLineNarrow: {
    width: '64%',
    alignSelf: 'center',
  },
  chartWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0D1624',
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 6,
  },
  weeklyVolumeWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0D1624',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  weeklyVolumeChartWrap: {
    marginBottom: 8,
  },
  weeklyVolumeLegendWrap: {
    rowGap: 6,
  },
  weeklyVolumeLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1320',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  weeklyVolumeLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  weeklyVolumeLegendMuscle: {
    flex: 1,
    color: '#D7E1F0',
    fontSize: 12,
    fontWeight: '700',
  },
  weeklyVolumeLegendSets: {
    color: '#8FA2BA',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chartStatusWrap: {
    minHeight: 190,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0D1624',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  axisText: {
    color: '#8FA2BA',
    fontSize: 11,
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  prGrid: {
    rowGap: 8,
  },
  prCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0D1624',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  prLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  prValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
