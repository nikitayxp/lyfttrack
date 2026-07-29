import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import { getExerciseMuscleTranslationKey, getEquipmentTranslationKey } from '@/constants/exerciseCatalog';
import { usePreferences } from '@/context/PreferencesContext';
import { useWorkoutContext } from '@/context/WorkoutContext';
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
import { estimateOneRepMax } from '@/utils/estimateOneRepMax';
import { getLocalizedExerciseMuscle, getLocalizedExerciseName } from '@/utils/exerciseLocalization';
import { getExerciseImageUrl } from '@/utils/exerciseImage';
import type { ActiveExercise } from '@/hooks/useActiveWorkoutState';

const palette = Colors.dark;

const Y_AXIS_LABEL_WIDTH = 44;
const CHART_EDGE_SPACING = 20;
/** Keep points tappable; if they cannot fit, the chart scrolls instead of clipping. */
const MIN_POINT_SPACING = 48;
const EDGE_SCROLL_ZONE = 44;
const EDGE_SCROLL_STEP = 24;

type ChartRange = '3m' | '1y';
type ChartMetric = Extract<ProgressMetric, 'weight' | 'e1rm'>;

// gifted-charts places the pointer overlay one `initialSpacing` to the right of
// the point it is reporting: `getX` already includes `initialSpacing`, and the
// overlay's own origin adds it a second time. Measured at exactly 20px with
// `initialSpacing={20}` — the strip, the dot and the card all landed beside the
// data point instead of on it, which is what the review flagged.
//
// The library gives no way to shift the overlay as a whole, so each of the three
// pieces is pulled back by hand: the strip through `pointerShiftX` on the data,
// the dot through `pointerComponent`, and the card through its own style.
// `shiftPointerLabelX` is not one of them — it is ignored outright while
// `autoAdjustPointerLabelPosition` is on, which we want for the edge clamping.
const POINTER_X_CORRECTION = -CHART_EDGE_SPACING;
/** Must match `styles.activeDataPoint` — gifted-charts centres custom points with dataPointWidth/Height (default 4). */
const ACTIVE_POINT_SIZE = 12;

/** At most six date labels, evenly spread: one per session overlaps into a smear. */
function shouldLabelPoint(index: number, total: number): boolean {
  if (total <= 6) {
    return true;
  }

  const step = Math.ceil(total / 6);
  return index === total - 1 || index % step === 0;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rangeStartDate(range: ChartRange): string {
  const date = new Date();
  if (range === '3m') {
    date.setMonth(date.getMonth() - 3);
  } else {
    date.setFullYear(date.getFullYear() - 1);
  }
  return localDateKey(date);
}

function formatProgressDateLabel(dateIso: string, language: string): string {
  const d = new Date(`${dateIso}T12:00:00.000Z`);
  const locale = language.startsWith('pt') ? 'pt-PT' : 'en-US';
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function buildActiveProgressPoint(
  activeExercise: ActiveExercise | undefined,
  metric: ChartMetric,
  language: string
): ExerciseProgressPoint | null {
  if (!activeExercise) {
    return null;
  }

  const completedSets = activeExercise.sets.filter(
    (setItem) =>
      setItem.completed &&
      setItem.set_type !== 'warmup' &&
      (setItem.weight ?? 0) > 0 &&
      (metric === 'weight' || (setItem.reps ?? 0) > 0)
  );

  if (completedSets.length === 0) {
    return null;
  }

  let maxWeight = 0;
  let maxWeightReps = 0;
  let estimated1RMMax = 0;
  let volumeTotal = 0;
  let repsTotal = 0;

  for (const setItem of completedSets) {
    const weight = setItem.weight ?? 0;
    const reps = setItem.reps ?? 0;
    volumeTotal += weight * reps;
    repsTotal += reps;
    estimated1RMMax = Math.max(estimated1RMMax, estimateOneRepMax(weight, reps, setItem.rir));

    if (weight > maxWeight || (weight === maxWeight && reps > maxWeightReps)) {
      maxWeight = weight;
      maxWeightReps = reps;
    }
  }

  const date = localDateKey();
  const estimated = Number(estimated1RMMax.toFixed(1));
  const heaviest = Number(maxWeight.toFixed(1));

  return {
    date,
    label: formatProgressDateLabel(date, language),
    value: metric === 'e1rm' ? estimated : heaviest,
    volumeTotal: Math.round(volumeTotal),
    repsTotal: Math.round(repsTotal),
    durationMinutes: 0,
    estimated1RMMax: estimated,
    maxWeight: heaviest,
    maxWeightReps: Math.round(maxWeightReps),
    isActive: true,
  };
}

const SCREEN_BG = palette.bgPrimary;
const CARD_BG = palette.cardBg;
const CHART_NEON = '#3B82F6';

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
  const { activeExercises, hasActiveWorkout } = useWorkoutContext();

  const metricFilters = useMemo(
    () =>
      [
        { key: 'weight' as const, label: t('exercise.detail.metricHeaviest') },
        { key: 'e1rm' as const, label: t('exercise.detail.metricE1rm') },
      ] as const,
    [t]
  );

  const rangeFilters = useMemo(
    () =>
      [
        { key: '3m' as const, label: t('exercise.detail.range3m') },
        { key: '1y' as const, label: t('exercise.detail.range1y') },
      ] as const,
    [t]
  );

  const exerciseId = useMemo(() => {
    const raw = params.id;
    if (!raw) return null;
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;
  }, [params.id]);

  const [exercise, setExercise] = useState<Tables<'exercises'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metric, setMetric] = useState<ChartMetric>('weight');
  const [range, setRange] = useState<ChartRange>('3m');
  const [progress, setProgress] = useState<ExerciseProgressPoint[]>([]);
  const [records, setRecords] = useState<ExercisePersonalRecords | null>(null);
  const [history, setHistory] = useState<ExerciseWorkoutHistoryEntry[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [parentScrollEnabled, setParentScrollEnabled] = useState(true);

  const chartScrollRef = useRef<ScrollView | null>(null);
  const lastScrollXRef = useRef(0);
  const edgeDirectionRef = useRef(0);
  const edgeRafRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Total space the chart may occupy inside the card, minus its padding.
  //
  // The old floor of 280 was larger than the room available on a 320px phone,
  // so the card overflowed the screen there regardless of the chart. Capped at
  // what the window actually offers instead.
  const chartWidth = useMemo(
    () => Math.min(Math.max(240, windowWidth - 72), 360),
    [windowWidth]
  );

  // What gifted-charts calls `width` is the plot only — the y-axis labels are
  // drawn outside it and added on top. Passing the full width here is what made
  // the chart run past the card and clip the last point.
  const plotWidth = useMemo(
    () => Math.max(180, chartWidth - Y_AXIS_LABEL_WIDTH - CHART_EDGE_SPACING),
    [chartWidth]
  );

  const activeProgressPoint = useMemo(() => {
    if (!exerciseId || !hasActiveWorkout) {
      return null;
    }

    const activeExercise = activeExercises.find((item) => item.exercise.id === exerciseId);
    return buildActiveProgressPoint(activeExercise, metric, language);
  }, [activeExercises, exerciseId, hasActiveWorkout, language, metric]);

  const chartProgress = useMemo(() => {
    const finished = activeProgressPoint
      ? progress.filter((point) => point.date !== activeProgressPoint.date)
      : progress;

    return activeProgressPoint ? [...finished, activeProgressPoint] : finished;
  }, [activeProgressPoint, progress]);

  // Reserves the axis gutter and both end margins before dividing, otherwise
  // the final point is drawn half outside the plot.
  //
  // Floor at MIN_POINT_SPACING so a long history never compresses into a smear
  // that clips the newest sessions — the chart grows and scrolls instead.
  const lineSpacing = useMemo(() => {
    if (chartProgress.length <= 1) {
      return MIN_POINT_SPACING;
    }

    const usable = plotWidth - CHART_EDGE_SPACING * 2;
    const fitted = Math.floor(usable / (chartProgress.length - 1));
    return Math.max(MIN_POINT_SPACING, fitted);
  }, [plotWidth, chartProgress.length]);

  const chartContentWidth = useMemo(() => {
    if (chartProgress.length <= 1) {
      return plotWidth;
    }

    return CHART_EDGE_SPACING * 2 + lineSpacing * (chartProgress.length - 1);
  }, [chartProgress.length, lineSpacing, plotWidth]);

  const needsHorizontalScroll = chartContentWidth > plotWidth + 1;

  const stopEdgeScroll = useCallback(() => {
    edgeDirectionRef.current = 0;
    if (edgeRafRef.current != null) {
      clearInterval(edgeRafRef.current);
      edgeRafRef.current = null;
    }
  }, []);

  const startEdgeScroll = useCallback(
    (direction: -1 | 1) => {
      if (!needsHorizontalScroll) {
        stopEdgeScroll();
        return;
      }

      edgeDirectionRef.current = direction;

      if (edgeRafRef.current != null) {
        return;
      }

      edgeRafRef.current = setInterval(() => {
        const scrollView = chartScrollRef.current as (ScrollView & {
          scrollTo?: (options: { x: number; animated?: boolean }) => void;
        }) | null;

        if (!scrollView?.scrollTo || edgeDirectionRef.current === 0) {
          return;
        }

        const maxX = Math.max(0, chartContentWidth - plotWidth);
        const next = Math.min(
          maxX,
          Math.max(0, lastScrollXRef.current + edgeDirectionRef.current * EDGE_SCROLL_STEP)
        );

        if (next === lastScrollXRef.current) {
          return;
        }

        lastScrollXRef.current = next;
        scrollView.scrollTo({ x: next, animated: false });
      }, 32);
    },
    [chartContentWidth, needsHorizontalScroll, plotWidth, stopEdgeScroll]
  );

  useEffect(() => () => stopEdgeScroll(), [stopEdgeScroll]);

  const handleChartScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastScrollXRef.current = event.nativeEvent.contentOffset.x;
  }, []);

  const handlePointerProps = useCallback(
    ({ pointerX }: { pointerX: number; pointerY: number; pointerIndex: number }) => {
      // pointerX === 0 means the finger is up (or idle). Persist still shows the
      // last card, but the chart can scroll again and the page can scroll too.
      if (!pointerX) {
        setParentScrollEnabled(true);
        stopEdgeScroll();
        return;
      }

      setParentScrollEnabled(false);

      if (!needsHorizontalScroll) {
        stopEdgeScroll();
        return;
      }

      // pointerX is in the visible plot; when the finger sits on either edge,
      // pan so older / newer sessions come into view without lifting.
      if (pointerX <= EDGE_SCROLL_ZONE) {
        startEdgeScroll(-1);
      } else if (pointerX >= plotWidth - EDGE_SCROLL_ZONE) {
        startEdgeScroll(1);
      } else {
        stopEdgeScroll();
      }
    },
    [needsHorizontalScroll, plotWidth, startEdgeScroll, stopEdgeScroll]
  );

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
        getExerciseProgress(exerciseId, metric, language, { sinceDate: rangeStartDate(range) }),
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
  }, [exerciseId, metric, language, range]);

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

  const lineData = useMemo(() => {
    let lastFinishedIndex = -1;
    for (let i = chartProgress.length - 1; i >= 0; i -= 1) {
      if (!chartProgress[i]?.isActive) {
        lastFinishedIndex = i;
        break;
      }
    }

    return chartProgress.map((point, index) => {
      const isLatestFinished = !point.isActive && index === lastFinishedIndex;
      const isActive = Boolean(point.isActive);

      return {
        value: Math.max(0, point.value),
        // Only some labels are drawn: one per session turns into a smear of
        // overlapping dates as soon as there is any history.
        label: shouldLabelPoint(index, chartProgress.length) ? point.label : '',
        // The session you just did is the one you are looking for.
        dataPointColor: isActive ? 'transparent' : isLatestFinished ? palette.textPrimary : CHART_NEON,
        dataPointRadius: isActive || isLatestFinished ? 6 : 4,
        // Pulls the pointer strip back onto the point. See POINTER_X_CORRECTION.
        pointerShiftX: POINTER_X_CORRECTION,
        ...(isActive
          ? {
              // Library anchors customDataPoint at getX/getY minus half of these.
              // Defaults are 4×4; our hollow ring is 12×12, so without this the
              // ring sat a few pixels down-right of the line tip (review note).
              dataPointWidth: ACTIVE_POINT_SIZE,
              dataPointHeight: ACTIVE_POINT_SIZE,
              customDataPoint: () => <View style={styles.activeDataPoint} />,
            }
          : null),
        point,
      };
    });
  }, [chartProgress]);

  const initialPointerIndex = useMemo(() => {
    if (lineData.length === 0) {
      return -1;
    }

    for (let i = chartProgress.length - 1; i >= 0; i -= 1) {
      if (!chartProgress[i]?.isActive) {
        return i;
      }
    }

    return lineData.length - 1;
  }, [chartProgress, lineData.length]);

  // Scaled to the data, not to zero. A progression chart anchored at zero turns
  // 100 kg to 110 kg into a step you cannot see; the interesting range is
  // between the values.
  const chartRange = useMemo(() => {
    const values = lineData.map((item) => item.value).filter((value) => Number.isFinite(value));

    if (values.length === 0) {
      return { min: 0, max: 4 };
    }

    const highest = Math.max(...values);
    const lowest = Math.min(...values);

    if (highest === lowest) {
      const pad = Math.max(1, Math.round(highest * 0.1));
      return { min: Math.max(0, highest - pad), max: highest + pad };
    }

    const padding = Math.max(1, (highest - lowest) * 0.15);

    return {
      min: Math.max(0, Math.floor(lowest - padding)),
      max: Math.ceil(highest + padding),
    };
  }, [lineData]);

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
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={parentScrollEnabled}
        nestedScrollEnabled
      >
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
          <Text style={styles.cardSubtitle}>{t(`exercise.detail.progressSubtitle_${metric}`)}</Text>

          <View style={styles.metricToggleRow}>
            {metricFilters.map((opt) => {
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

          <View style={styles.metricToggleRow}>
            {rangeFilters.map((opt) => {
              const isActive = range === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.metricToggle, isActive && styles.metricToggleActive]}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => setRange(opt.key)}
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
          ) : lineData.length === 0 ? (
            <View style={styles.chartStatusWrap}>
              <Text style={styles.placeholderText}>{t('exercise.detail.noProgress')}</Text>
            </View>
          ) : (
            <View style={styles.chartWrap}>
              {needsHorizontalScroll ? (
                <Text style={styles.chartScrollHint}>{t('exercise.detail.chartScrollHint')}</Text>
              ) : null}
              <LineChart
                key={`${metric}-${range}-${lineData.length}-${initialPointerIndex}-${needsHorizontalScroll ? 'scroll' : 'fit'}`}
                data={lineData}
                width={plotWidth}
                height={220}
                initialSpacing={CHART_EDGE_SPACING}
                endSpacing={CHART_EDGE_SPACING}
                spacing={lineSpacing}
                curved
                thickness={2.5}
                color={CHART_NEON}
                hideDataPoints={false}
                dataPointsColor={CHART_NEON}
                yAxisOffset={chartRange.min}
                maxValue={chartRange.max - chartRange.min}
                noOfSections={4}
                yAxisColor={palette.borderStrong}
                xAxisColor={palette.borderStrong}
                yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.xAxisLabelText}
                rulesColor={palette.inputFill}
                formatYLabel={(label) => formatCompactNumber(label)}
                // Long histories animate poorly and fight scrollToEnd on mount.
                isAnimated={lineData.length <= 12}
                scrollRef={chartScrollRef}
                disableScroll={false}
                scrollToEnd={needsHorizontalScroll}
                scrollAnimation={false}
                showScrollIndicator={needsHorizontalScroll}
                nestedScrollEnabled
                onScroll={handleChartScroll}
                getPointerProps={handlePointerProps}
                // Drag / long-press to read a session. Swipe pans when the
                // history is wider than the card; press-and-hold scrubs.
                pointerConfig={{
                  pointerStripHeight: 200,
                  pointerStripColor: palette.borderStrong,
                  pointerStripWidth: 1,
                  pointerColor: palette.textPrimary,
                  radius: 5,
                  pointerLabelWidth: 140,
                  pointerLabelHeight: 84,
                  // Required so pointerConfig does not swallow horizontal scroll.
                  activatePointersOnLongPress: needsHorizontalScroll,
                  activatePointersDelay: 160,
                  activatePointersInstantlyOnTouch: !needsHorizontalScroll,
                  autoAdjustPointerLabelPosition: true,
                  persistPointer: true,
                  resetPointerOnDataChange: true,
                  initialPointerIndex,
                  pointerComponent: () => <View style={styles.pointerDot} />,
                  pointerLabelComponent: (items: { point?: ExerciseProgressPoint }[]) => {
                    const point = items?.[0]?.point;

                    if (!point) {
                      return null;
                    }

                    return (
                      <View style={styles.pointerCard}>
                        <Text style={styles.pointerDate}>{point.label}</Text>
                        {point.isActive ? (
                          <Text style={styles.pointerMeta}>{t('exercise.detail.pointerInProgress')}</Text>
                        ) : null}
                        <Text style={styles.pointerValue}>
                          {`${formatNumericValue(point.maxWeight)} kg x ${point.maxWeightReps}`}
                        </Text>
                        {metric === 'e1rm' ? (
                          <Text style={styles.pointerMeta}>
                            {t('exercise.detail.pointerE1rm', {
                              value: formatNumericValue(point.estimated1RMMax),
                            })}
                          </Text>
                        ) : null}
                      </View>
                    );
                  },
                }}
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
                style={styles.historyCard}
                activeOpacity={ACTIVE_OPACITY}
                onPress={() => router.push(`/workout/${entry.workoutId}` as any)}
              >
                <View style={styles.historyHeaderRow}>
                  <View style={styles.historyTextWrap}>
                    <Text style={styles.historyName}>{entry.workoutName}</Text>
                    <Text style={styles.historyMeta}>
                      {entry.date} {' \u2022 '} {t('exercise.detail.workingSets', { count: entry.workingSetCount })}
                    </Text>
                  </View>
                  {entry.bestSet ? (
                    <Text style={styles.historyBest}>
                      {t('exercise.detail.bestSet', {
                        weight: formatNumericValue(entry.bestSet.weight),
                        reps: entry.bestSet.reps,
                      })}
                    </Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color="#475569" />
                </View>

                {entry.sets.length > 0 ? (
                  <View style={styles.historySetsWrap}>
                    {entry.sets.map((setItem, setIndex) => (
                      <View key={`${entry.workoutId}-${setItem.setNumber ?? setIndex}`} style={styles.historySetRow}>
                        <Text style={styles.historySetNumber}>{setItem.setNumber ?? setIndex + 1}</Text>

                        {setItem.setType === 'warmup' ? (
                          <View style={styles.historySetTypeChip}>
                            <Text style={styles.historySetTypeChipText}>{t('workoutDetails.setTypeWarmup')}</Text>
                          </View>
                        ) : null}

                        <Text style={styles.historySetLoad}>
                          {`${formatNumericValue(setItem.weight)} kg \u00d7 ${setItem.reps}`}
                        </Text>

                        <Text style={styles.historySetRir}>
                          {`${t('workoutDetails.tableRir')} ${
                            setItem.setType === 'warmup' || setItem.rir === null
                              ? '\u2014'
                              : formatNumericValue(setItem.rir)
                          }`}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
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
    marginBottom: 4,
  },
  cardSubtitle: {
    color: palette.labelMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
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
    minHeight: 300,
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 8,
    // Was 'visible', which let the plot spill past the card edge.
    overflow: 'hidden',
  },
  chartScrollHint: {
    color: palette.labelMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  pointerCard: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    rowGap: 2,
    transform: [{ translateX: POINTER_X_CORRECTION }],
  },
  pointerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.textPrimary,
    transform: [{ translateX: POINTER_X_CORRECTION }],
  },
  activeDataPoint: {
    width: ACTIVE_POINT_SIZE,
    height: ACTIVE_POINT_SIZE,
    borderRadius: ACTIVE_POINT_SIZE / 2,
    borderWidth: 2,
    borderColor: palette.textPrimary,
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  pointerDate: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pointerValue: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  pointerMeta: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  axisText: {
    color: '#8FA2BA',
    fontSize: 11,
  },
  xAxisLabelText: {
    color: '#94A3B8',
    fontSize: 10,
    width: 48,
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
  historyCard: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  historySetsWrap: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.inputFill,
    paddingTop: 6,
    rowGap: 2,
  },
  historySetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    minHeight: 22,
  },
  historySetNumber: {
    width: 18,
    color: '#8FA2BA',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  historySetTypeChip: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  historySetTypeChipText: {
    color: '#8FA2BA',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  historySetLoad: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  historySetRir: {
    color: '#8FA2BA',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
