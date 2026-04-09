import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
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
const METRIC_FILTERS: readonly {
  key: ProgressMetric;
  labelKey: string;
  unitKey: string;
  descriptionKey: string;
}[] = [
  {
    key: 'duration',
    labelKey: 'stats.metricDurationLabel',
    unitKey: 'stats.unitMin',
    descriptionKey: 'stats.metricDurationDescription',
  },
  {
    key: 'volume',
    labelKey: 'stats.metricVolumeLabel',
    unitKey: 'stats.unitKg',
    descriptionKey: 'stats.metricVolumeDescription',
  },
  {
    key: 'reps',
    labelKey: 'stats.metricRepsLabel',
    unitKey: 'stats.unitReps',
    descriptionKey: 'stats.metricRepsDescription',
  },
];

function muscleColor(muscle: string): string {
  const normalized = muscle.trim().toLowerCase();

  if (normalized.includes('chest')) return '#3B82F6';
  if (normalized.includes('back')) return '#06B6D4';
  if (normalized.includes('should')) return '#F59E0B';
  if (normalized.includes('bicep')) return '#A855F7';
  if (normalized.includes('tricep')) return '#C084FC';
  if (normalized.includes('forearm')) return '#8B5CF6';
  if (normalized.includes('quadricep')) return '#22C55E';
  if (normalized.includes('hamstring')) return '#16A34A';
  if (normalized.includes('glute')) return '#14B8A6';
  if (normalized.includes('calf')) return '#10B981';
  if (normalized.includes('leg')) return '#22C55E';
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

function formatCompactAxisNumber(value: number | string): string {
  const parsedValue =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9+-.]/g, ''));
  const safeValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;

  if (safeValue >= 1_000_000) {
    const scaled = safeValue / 1_000_000;
    const rounded = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
    return `${rounded.replace(/\.0$/, '')}m`;
  }

  if (safeValue >= 1_000) {
    const scaled = safeValue / 1_000;
    const rounded = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
    return `${rounded.replace(/\.0$/, '')}k`;
  }

  if (safeValue >= 100) {
    return `${Math.round(safeValue)}`;
  }

  return Number.isInteger(safeValue) ? `${safeValue}` : safeValue.toFixed(1);
}

function formatMetricAxisLabel(value: number | string, metric: ProgressMetric): string {
  const compact = formatCompactAxisNumber(value);

  if (metric === 'volume') {
    return `${compact} kg`;
  }

  if (metric === 'duration') {
    return `${compact}m`;
  }

  return compact;
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
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
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
  const [selectedProgressPointIndex, setSelectedProgressPointIndex] = useState<number | null>(null);

  const chartWidth = useMemo(() => {
    const availableWidth = Math.max(280, windowWidth - 40);
    return Math.min(availableWidth, 360);
  }, [windowWidth]);
  const weeklyChartWidth = useMemo(() => {
    const availableWidth = Math.max(250, windowWidth - 40);
    return Math.min(availableWidth, 340);
  }, [windowWidth]);

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
      const message = error instanceof Error ? error.message : t('common.unknownError');
      setErrorMessage(message);
      setExercises([]);
      setSelectedExerciseId(null);
    } finally {
      setIsLoadingExercises(false);
    }
  }, [t]);

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
      const message = error instanceof Error ? error.message : t('common.unknownError');
      setErrorMessage(message);
      setProgress([]);
      setRecords(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [metric, selectedExerciseId, t]);

  const loadWeeklyVolume = useCallback(async () => {
    setIsLoadingWeeklyVolume(true);
    setWeeklyVolumeError(null);

    try {
      const [weeklyRows, hallRows] = await Promise.all([getWeeklyVolumeByMuscle(), getAllTimePRs()]);

      setWeeklyVolume(weeklyRows);
      setAllTimePrs(hallRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      setWeeklyVolumeError(message);
      setWeeklyVolume([]);
      setAllTimePrs([]);
    } finally {
      setIsLoadingWeeklyVolume(false);
    }
  }, [t]);

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
      progress.map((point, index) => ({
        value: Math.max(0, point.value),
        label: point.label,
        dataPointColor: index === selectedProgressPointIndex ? '#FFFFFF' : CHART_NEON,
        dataPointRadius: index === selectedProgressPointIndex ? 5.5 : 4,
        onPress: () => setSelectedProgressPointIndex(index),
      })),
    [progress, selectedProgressPointIndex]
  );

  const selectedMetric = useMemo(
    () => METRIC_FILTERS.find((option) => option.key === metric) ?? METRIC_FILTERS[1],
    [metric]
  );

  useEffect(() => {
    if (lineData.length === 0) {
      setSelectedProgressPointIndex(null);
      return;
    }

    setSelectedProgressPointIndex((currentValue) => {
      if (currentValue === null || currentValue >= lineData.length) {
        return lineData.length - 1;
      }

      return currentValue;
    });
  }, [lineData.length]);

  const chartMaxValue = useMemo(() => {
    if (lineData.length === 0) {
      return 4;
    }

    const highestValue = lineData.reduce((currentMax, point) => Math.max(currentMax, point.value), 0);

    if (highestValue <= 0) {
      return 4;
    }

    const paddedValue = highestValue * 1.25;

    if (metric === 'duration') {
      return Math.max(8, Math.ceil(paddedValue));
    }

    if (metric === 'reps') {
      return Math.max(10, Math.ceil(paddedValue));
    }

    return Math.max(20, Math.ceil(paddedValue));
  }, [lineData, metric]);

  const weeklyBarData = useMemo(
    () =>
      weeklyVolume.map((item) => ({
        value: item.sets,
        label: item.muscle,
        frontColor: CHART_NEON,
      })),
    [weeklyVolume]
  );

  const weeklyVolumeMaxValue = useMemo(() => {
    const maxValue = weeklyVolume.reduce((currentMax, entry) => Math.max(currentMax, entry.sets), 0);

    if (maxValue <= 0) {
      return 4;
    }

    return Math.max(4, Math.ceil(maxValue * 1.25));
  }, [weeklyVolume]);

  const selectedExerciseName = useMemo(() => {
    if (!selectedExerciseId) {
      return null;
    }

    return exercises.find((exercise) => exercise.id === selectedExerciseId)?.name ?? null;
  }, [exercises, selectedExerciseId]);

  const selectedProgressPoint = useMemo(() => {
    if (selectedProgressPointIndex === null) {
      return null;
    }

    return progress[selectedProgressPointIndex] ?? null;
  }, [progress, selectedProgressPointIndex]);

  const selectedProgressValueText = useMemo(() => {
    if (!selectedProgressPoint) {
      return null;
    }

    const formattedValue =
      metric === 'volume'
        ? formatCompactAxisNumber(selectedProgressPoint.value)
        : formatNumericValue(selectedProgressPoint.value);

    if (metric === 'volume') {
      return `${formattedValue} ${t('stats.unitKg')}`;
    }

    if (metric === 'duration') {
      return `${formattedValue} ${t('stats.unitMin')}`;
    }

    return `${formattedValue} ${t('stats.unitReps')}`;
  }, [metric, selectedProgressPoint, t]);

  const selectedProgressMetaText = useMemo(() => {
    if (!selectedProgressPoint) {
      return null;
    }

    return `${formatCompactAxisNumber(selectedProgressPoint.volumeTotal)} ${t('stats.unitKg')} • ${formatNumericValue(selectedProgressPoint.repsTotal)} ${t('stats.unitReps')} • ${formatNumericValue(selectedProgressPoint.durationMinutes)} ${t('stats.unitMin')}`;
  }, [selectedProgressPoint, t]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.88}
          onPress={() => router.replace('/(tabs)/profile' as any)}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t('stats.title')}</Text>
      <Text style={styles.subtitle}>{t('stats.subtitle')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('stats.weeklyVolumeTitle')}</Text>
        <Text style={styles.cardSubtitle}>{t('stats.weeklyVolumeSubtitle')}</Text>

        {isLoadingWeeklyVolume ? (
          <SkeletonPanel lines={4} minHeight={190} />
        ) : weeklyVolumeError ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.errorText}>{weeklyVolumeError}</Text>
          </View>
        ) : weeklyBarData.length === 0 ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.placeholderText}>{t('stats.noWeeklySets')}</Text>
          </View>
        ) : (
          <View style={styles.weeklyVolumeWrap}>
            <View style={styles.weeklyVolumeChartWrap}>
              <BarChart
                data={weeklyBarData}
                width={weeklyChartWidth}
                height={232}
                horizontal
                barWidth={18}
                spacing={12}
                initialSpacing={6}
                endSpacing={0}
                yAxisLabelWidth={52}
                xAxisLabelsHeight={22}
                labelsExtraHeight={8}
                overflowTop={20}
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
                formatYLabel={(label) => formatCompactAxisNumber(label)}
                hideOrigin
                isAnimated
                adjustToWidth={true}
              />
            </View>

            <View style={styles.weeklyVolumeLegendWrap}>
              {weeklyVolume.map((entry) => (
                <View key={entry.muscle} style={styles.weeklyVolumeLegendRow}>
                  <View style={[styles.weeklyVolumeLegendDot, { backgroundColor: muscleColor(entry.muscle) }]} />
                  <Text style={styles.weeklyVolumeLegendMuscle}>{entry.muscle}</Text>
                  <Text style={styles.weeklyVolumeLegendSets}>{`${entry.sets} ${t('stats.weeklySetsSuffix')}`}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('stats.focusByExerciseTitle')}</Text>

        {isLoadingExercises ? (
          <SkeletonPanel lines={2} minHeight={60} />
        ) : exercises.length === 0 ? (
          <Text style={styles.placeholderText}>{t('stats.focusEmpty')}</Text>
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
          {METRIC_FILTERS.map((option) => {
            const isActive = metric === option.key;

            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.metricToggleButton, isActive && styles.metricToggleButtonActive]}
                activeOpacity={0.88}
                onPress={() => setMetric(option.key)}
              >
                <Text style={[styles.metricToggleText, isActive && styles.metricToggleTextActive]}>{t(option.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.metricHint}>{t(selectedMetric.descriptionKey)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('stats.evolutionTitle')}</Text>
        <Text style={styles.cardSubtitle}>{`${selectedExerciseName ?? t('stats.selectExercisePrompt')} • ${t(selectedMetric.unitKey)}`}</Text>

        {isLoadingStats ? (
          <SkeletonPanel lines={4} minHeight={190} />
        ) : errorMessage ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : lineData.length === 0 ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.placeholderText}>{t('stats.noCompletedSets')}</Text>
          </View>
        ) : (
          <View style={styles.chartWrap}>
            <LineChart
              data={lineData}
              width={chartWidth}
              height={258}
              maxValue={chartMaxValue}
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
              yAxisLabelWidth={74}
              xAxisLabelsHeight={40}
              labelsExtraHeight={12}
              overflowTop={24}
              overflowBottom={16}
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.axisText}
              formatYLabel={(label) => formatMetricAxisLabel(label, metric)}
              rulesColor="#1F2937"
              noOfSections={4}
              initialSpacing={10}
              endSpacing={0}
              onBackgroundPress={() => setSelectedProgressPointIndex(null)}
              adjustToWidth={true}
            />

            {selectedProgressPoint && selectedProgressValueText ? (
              <View style={styles.selectedPointCard}>
                <Text style={styles.selectedPointLabel}>{selectedProgressPoint.label}</Text>
                <Text style={styles.selectedPointValue}>{selectedProgressValueText}</Text>
                {selectedProgressMetaText ? <Text style={styles.selectedPointMeta}>{selectedProgressMetaText}</Text> : null}
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('stats.allTimePrsTitle')}</Text>

        {records ? (
          <View style={styles.prGrid}>
            <View style={styles.prCard}>
              <Text style={styles.prLabel}>{t('stats.prHeaviestSet')}</Text>
              <Text style={styles.prValue}>{`${formatNumericValue(records.heaviestWeight)} ${t('stats.unitKg')}`}</Text>
            </View>

            <View style={styles.prCard}>
              <Text style={styles.prLabel}>{t('stats.prBest1rm')}</Text>
              <Text style={styles.prValue}>{`${formatNumericValue(records.bestEstimated1RM)} ${t('stats.unitKg')}`}</Text>
            </View>

            <View style={styles.prCard}>
              <Text style={styles.prLabel}>{t('stats.prBestDayVolume')}</Text>
              <Text style={styles.prValue}>{`${formatNumericValue(records.bestDayVolume)} ${t('stats.unitKg')}`}</Text>
            </View>

            <View style={styles.prCard}>
              <Text style={styles.prLabel}>{t('stats.prHallOfFameEntries')}</Text>
              <Text style={styles.prValue}>{allTimePrs.length}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.placeholderText}>{t('stats.unlockPrCards')}</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  backButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: '#0D1624',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '700',
  },
  metricToggleTextActive: {
    color: '#E5EDFF',
  },
  metricHint: {
    marginTop: 8,
    color: '#8FA2BA',
    fontSize: 12,
    lineHeight: 18,
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
    minHeight: 304,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 8,
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
    minHeight: 236,
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
  selectedPointCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#233247',
    backgroundColor: '#0B1320',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedPointLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  selectedPointValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  selectedPointMeta: {
    color: '#8FA2BA',
    fontSize: 11,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
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
