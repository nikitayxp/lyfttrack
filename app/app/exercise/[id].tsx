import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import { getExerciseMuscleTranslationKey, getEquipmentTranslationKey } from '@/constants/exerciseCatalog';
import { usePreferences } from '@/context/PreferencesContext';
import type { Tables } from '@/types/database';
import { getExercisesByIds } from '@/services/workoutService';
import {
  getExercisePersonalRecords,
  getExerciseProgress,
  getExerciseWorkoutHistory,
  type ExercisePersonalRecords,
  type ExerciseProgressPoint,
  type ExerciseWorkoutHistoryEntry,
  type ProgressMetric,
} from '@/services/statsService';
import { getLocalizedExerciseMuscle, getLocalizedExerciseName } from '@/utils/exerciseLocalization';
import { getExerciseImageUrl } from '@/utils/exerciseImage';

const palette = Colors.dark;
const SCREEN_BG = palette.bgPrimary;
const CARD_BG = palette.cardBg;
const CHART_NEON = '#3B82F6';

const METRIC_FILTERS: readonly { key: ProgressMetric; label: string }[] = [
  { key: 'weight', label: 'kg' },
  { key: 'volume', label: 'Vol.' },
  { key: 'reps', label: 'Reps' },
];

function formatNumericValue(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe >= 1000) return safe.toLocaleString();
  return Number.isInteger(safe) ? `${safe}` : safe.toFixed(1);
}

function formatCompactNumber(value: number | string): string {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9+-.]/g, ''));
  const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  if (safe >= 100) return `${Math.round(safe)}`;
  return Number.isInteger(safe) ? `${safe}` : safe.toFixed(1);
}

export default function ExerciseDetailScreen() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const exerciseId = useMemo(() => {
    const raw = params.id;
    if (!raw) return null;
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;
  }, [params.id]);

  const [exercise, setExercise] = useState<Tables<'exercises'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metric, setMetric] = useState<ProgressMetric>('weight');
  const [progress, setProgress] = useState<ExerciseProgressPoint[]>([]);
  const [records, setRecords] = useState<ExercisePersonalRecords | null>(null);
  const [history, setHistory] = useState<ExerciseWorkoutHistoryEntry[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const chartWidth = useMemo(() => Math.min(Math.max(280, windowWidth - 56), 360), [windowWidth]);

  const loadExercise = useCallback(async () => {
    if (!exerciseId) {
      setError(t('exercise.detail.notFound'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await getExercisesByIds([exerciseId]);
      const found = results.find((e) => e.id === exerciseId) ?? null;

      if (!found) {
        setError(t('exercise.detail.notFound'));
        setExercise(null);
      } else {
        setExercise(found);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setIsLoading(false);
    }
  }, [exerciseId, t]);

  const loadStats = useCallback(async () => {
    if (!exerciseId) return;

    setIsLoadingStats(true);

    try {
      const [pts, prs, hist] = await Promise.all([
        getExerciseProgress(exerciseId, metric, language),
        getExercisePersonalRecords(exerciseId),
        getExerciseWorkoutHistory(exerciseId),
      ]);

      setProgress(pts);
      setRecords(prs);
      setHistory(hist);
    } catch {
      setProgress([]);
      setRecords(null);
      setHistory([]);
    } finally {
      setIsLoadingStats(false);
    }
  }, [exerciseId, metric, language]);

  useEffect(() => { void loadExercise(); }, [loadExercise]);
  useEffect(() => { void loadStats(); }, [loadStats]);

  const imageUrl = useMemo(() => {
    if (!exercise) return null;
    return getExerciseImageUrl(exercise);
  }, [exercise]);

  const exerciseName = exercise ? getLocalizedExerciseName(exercise, language) : '';

  const muscleLabel = useMemo(() => {
    if (!exercise) return '';
    const key = getExerciseMuscleTranslationKey({
      muscleGroup: exercise.muscle_group,
      muscleEn: exercise.muscle_en,
      musclePt: exercise.muscle_pt,
      name: exercise.name,
      nameEn: exercise.name_en,
      namePt: exercise.name_pt,
    });
    return key ? t(key) : getLocalizedExerciseMuscle(exercise, language) ?? '';
  }, [exercise, language, t]);

  const equipmentLabel = useMemo(() => {
    if (!exercise?.equipment) return '';
    const key = getEquipmentTranslationKey(exercise.equipment);
    return key ? t(key) : exercise.equipment;
  }, [exercise, t]);

  const barData = useMemo(
    () =>
      progress.map((point) => ({
        value: Math.max(0, point.value),
        label: point.label,
        frontColor: CHART_NEON,
      })),
    [progress]
  );

  const chartMaxValue = useMemo(() => {
    if (barData.length === 0) return 4;
    const highest = barData.reduce((m, p) => Math.max(m, p.value), 0);
    if (highest <= 0) return 4;
    return Math.max(4, Math.ceil(highest * 1.25));
  }, [barData]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.loadingText}>{t('exercise.detail.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !exercise) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} activeOpacity={ACTIVE_OPACITY} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={palette.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? t('exercise.detail.notFound')}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={ACTIVE_OPACITY} onPress={() => void loadExercise()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} activeOpacity={ACTIVE_OPACITY} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={palette.textPrimary} />
          </TouchableOpacity>
        </View>

        {imageUrl ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.exerciseImage} resizeMode="cover" />
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="barbell-outline" size={48} color={palette.inputStroke} />
          </View>
        )}

        <Text style={styles.title}>{exerciseName}</Text>
        <View style={styles.badgeRow}>
          {muscleLabel ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{muscleLabel}</Text>
            </View>
          ) : null}
          {equipmentLabel ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{equipmentLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Progression chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('exercise.detail.progressTitle')}</Text>

          <View style={styles.metricToggleRow}>
            {METRIC_FILTERS.map((opt) => {
              const isActive = metric === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.metricToggle, isActive && styles.metricToggleActive]}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => setMetric(opt.key)}
                >
                  <Text style={[styles.metricToggleText, isActive && styles.metricToggleTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoadingStats ? (
            <View style={styles.chartStatusWrap}>
              <ActivityIndicator size="small" color={CHART_NEON} />
            </View>
          ) : barData.length === 0 ? (
            <View style={styles.chartStatusWrap}>
              <Text style={styles.placeholderText}>{t('exercise.detail.noProgress')}</Text>
            </View>
          ) : (
            <View style={styles.chartWrap}>
              <BarChart
                data={barData}
                width={chartWidth}
                height={200}
                maxValue={chartMaxValue}
                barWidth={Math.max(14, Math.min(28, Math.floor(chartWidth / Math.max(barData.length, 1)) - 8))}
                spacing={10}
                initialSpacing={10}
                endSpacing={6}
                roundedTop
                frontColor={CHART_NEON}
                gradientColor="#60A5FA"
                showGradient
                yAxisColor={palette.borderStrong}
                xAxisColor={palette.borderStrong}
                yAxisLabelWidth={50}
                xAxisLabelsHeight={44}
                xAxisLabelsVerticalShift={20}
                labelsExtraHeight={24}
                overflowTop={16}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.xAxisLabelText}
                formatYLabel={(label) => formatCompactNumber(label)}
                rulesColor={palette.inputFill}
                noOfSections={4}
                isAnimated
                adjustToWidth
              />
            </View>
          )}
        </View>

        {/* Personal Records */}
        {records ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('exercise.detail.prsTitle')}</Text>
            <View style={styles.prGrid}>
              <View style={styles.prCard}>
                <Text style={styles.prLabel}>{t('exercise.detail.heaviestSet')}</Text>
                <Text style={styles.prValue}>{`${formatNumericValue(records.heaviestWeight)} kg`}</Text>
              </View>
              <View style={styles.prCard}>
                <Text style={styles.prLabel}>{t('exercise.detail.best1rm')}</Text>
                <Text style={styles.prValue}>{`${formatNumericValue(records.bestEstimated1RM)} kg`}</Text>
              </View>
              <View style={styles.prCard}>
                <Text style={styles.prLabel}>{t('exercise.detail.bestDayVolume')}</Text>
                <Text style={styles.prValue}>{`${formatNumericValue(records.bestDayVolume)} kg`}</Text>
              </View>
              <View style={styles.prCard}>
                <Text style={styles.prLabel}>{t('exercise.detail.totalSets')}</Text>
                <Text style={styles.prValue}>{records.completedSetCount}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Workout History */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('exercise.detail.historyTitle')}</Text>
          {history.length === 0 ? (
            <Text style={styles.placeholderText}>{t('exercise.detail.noHistory')}</Text>
          ) : (
            history.slice(0, 20).map((entry) => (
              <TouchableOpacity
                key={entry.workoutId}
                style={styles.historyRow}
                activeOpacity={ACTIVE_OPACITY}
                onPress={() => router.push(`/workout/${entry.workoutId}` as any)}
              >
                <View style={styles.historyTextWrap}>
                  <Text style={styles.historyName}>{entry.workoutName}</Text>
                  <Text style={styles.historyMeta}>
                    {entry.date} {' \u2022 '} {t('exercise.detail.sets', { count: entry.sets })}
                  </Text>
                </View>
                {entry.bestWeight > 0 ? (
                  <Text style={styles.historyBest}>
                    {t('exercise.detail.bestSet', { weight: formatNumericValue(entry.bestWeight), reps: entry.bestReps })}
                  </Text>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color="#475569" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 34,
    rowGap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    marginBottom: 4,
  },
  exerciseImage: {
    width: '100%',
    height: 200,
  },
  imagePlaceholder: {
    height: 140,
    borderRadius: Radius.card,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: palette.inputFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 4,
  },
  badge: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: palette.labelMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  metricToggleRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 10,
  },
  metricToggle: {
    flex: 1,
    minHeight: 34,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricToggleActive: {
    borderColor: CHART_NEON,
    backgroundColor: palette.chipFillSelected,
  },
  metricToggleText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  metricToggleTextActive: {
    color: '#E5EDFF',
  },
  chartStatusWrap: {
    minHeight: 160,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chartWrap: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    minHeight: 260,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  axisText: {
    color: '#8FA2BA',
    fontSize: 11,
  },
  xAxisLabelText: {
    color: '#8FA2BA',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  placeholderText: {
    color: palette.labelMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingVertical: 16,
  },
  prGrid: {
    rowGap: 8,
  },
  prCard: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  prLabel: {
    color: palette.labelMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  prValue: {
    color: palette.textPrimary,
    fontSize: 19,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  historyTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  historyName: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  historyMeta: {
    color: '#8FA2BA',
    fontSize: 12,
    fontWeight: '500',
  },
  historyBest: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 8,
  },
  loadingText: {
    color: palette.labelMuted,
    fontSize: 14,
    marginTop: 10,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: palette.accent,
    borderRadius: Radius.button,
    minHeight: 38,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
