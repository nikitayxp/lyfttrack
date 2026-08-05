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
  formatExerciseAxisDate,
  formatExerciseHistoryDate,
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
import { usableScreenWidth } from '@/utils/screenWidth';
import type { ActiveExercise } from '@/hooks/useActiveWorkoutState';

const palette = Colors.dark;

const Y_AXIS_LABEL_WIDTH = 52;
const CHART_EDGE_SPACING = 20;
/** Keep points tappable; if they cannot fit, the chart scrolls instead of clipping. */
const MIN_POINT_SPACING = 48;
const CHART_PAGE_RATIO = 0.75;
/** Same pace as a deliberate click while holding Anteriores / Recentes. */
const CHART_HOLD_INTERVAL_MS = 380;

type ChartRange = '3m' | '1y' | 'all';
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
/**
 * The chart clamps the label against the plot edges using this number, so the
 * card has to actually be this wide. Letting it size to its text made it wider
 * than the chart believed, and the extra hung off the right edge, cut in half.
 */
const POINTER_LABEL_WIDTH = 150;
/** Must match `styles.activeDataPoint` — gifted-charts centres custom points with dataPointWidth/Height (default 4). */
const ACTIVE_POINT_SIZE = 12;

/** Must match `styles.chartWrap` — the plot gets what is left after it. */
const CHART_WRAP_PADDING = 8;
/** Must match `styles.content` and `styles.card`, which sit between screen and chart. */
const SCREEN_PADDING = 18;
const CARD_PADDING = 12;
const CHART_HORIZONTAL_INSETS = (SCREEN_PADDING + CARD_PADDING + CHART_WRAP_PADDING) * 2;
/** Starting point for the axis step; the count grows from here to leave headroom. */
const CHART_SECTIONS = 4;
/** More lines than this and the axis turns into noise. */
const MAX_CHART_SECTIONS = 6;

/**
 * Rounds a step up to something a person reads without thinking: 1, 2, 2.5 or 5
 * times a power of ten. Dividing the raw spread by the number of sections gives
 * axis labels like 24, 62, 101 — correct, and useless at a glance.
 */
function niceAxisStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  for (const candidate of [1, 2, 2.5, 5]) {
    if (normalized <= candidate) {
      return candidate * magnitude;
    }
  }

  return 10 * magnitude;
}

/** At most ~one date label every ~80px so PT dates stay readable while scrolling. */
function shouldLabelPoint(
  index: number,
  total: number,
  pointSpacing: number,
  options?: { hideFirst?: boolean }
): boolean {
  if (total <= 1) {
    return true;
  }

  // First label often clips under the Y-axis when the chart is paged.
  if (options?.hideFirst && index === 0) {
    return false;
  }

  if (index === total - 1) {
    return true;
  }

  if (index === 0) {
    return true;
  }

  const minLabelGapPx = 80;
  const step = Math.max(1, Math.ceil(minLabelGapPx / Math.max(1, pointSpacing)));
  return index % step === 0;
}

type ChartScrollAnchor =
  | { kind: 'end' }
  | { kind: 'start' }
  | { kind: 'date'; date: string };

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Null means no cut-off: every session the exercise has. */
function rangeStartDate(range: ChartRange): string | null {
  if (range === 'all') {
    return null;
  }

  const date = new Date();
  if (range === '3m') {
    date.setMonth(date.getMonth() - 3);
  } else {
    date.setFullYear(date.getFullYear() - 1);
  }
  return localDateKey(date);
}

function nextChartScrollX(
  current: number,
  max: number,
  plotWidth: number,
  direction: -1 | 1
): number {
  const page = Math.max(120, plotWidth * CHART_PAGE_RATIO);
  return Math.min(max, Math.max(0, current + direction * page));
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.assert(nextChartScrollX(900, 900, 300, -1) === 675, 'older chart page');
  console.assert(nextChartScrollX(0, 900, 300, -1) === 0, 'chart start clamp');
  console.assert(nextChartScrollX(800, 900, 300, 1) === 900, 'chart end clamp');
}

function formatProgressDateLabel(dateIso: string, language: string): string {
  return formatExerciseAxisDate(dateIso, language);
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
        { key: 'all' as const, label: t('exercise.detail.rangeAll') },
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
  const [chartScrollPosition, setChartScrollPosition] = useState({ x: 0, max: 0 });
  /** First open pins to newest; filter changes keep how far back you had scrolled. */
  const [pinChartToEnd, setPinChartToEnd] = useState(true);

  const chartScrollRef = useRef<ScrollView | null>(null);
  const lastScrollXRef = useRef(0);
  const chartScrollMaxRef = useRef(0);
  const chartHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingAnchorRef = useRef<ChartScrollAnchor | null>(null);
  const focusedDateRef = useRef<string | null>(null);
  const chartProgressRef = useRef<ExerciseProgressPoint[]>([]);
  const lineSpacingRef = useRef(MIN_POINT_SPACING);
  const needsHorizontalScrollRef = useRef(false);

  // What is left for the chart after the screen's own padding. It used to be
  // measured against the window, which on a desktop browser is the whole page
  // while the app draws inside a phone-sized frame — so the chart was built
  // ~60px wider than the card and the newest point was drawn past its edge,
  // present but never visible.
  const chartWidth = useMemo(
    () => Math.min(Math.max(200, usableScreenWidth(windowWidth) - CHART_HORIZONTAL_INSETS), 360),
    [windowWidth]
  );

  // What gifted-charts calls `width` is the plot only — the y-axis labels are
  // drawn outside it and added on top, and the spacing at each end on top of
  // that. Counting only one end is what still let the last point sit past the
  // right edge once the width itself was right.
  const plotWidth = useMemo(
    () => Math.max(160, chartWidth - Y_AXIS_LABEL_WIDTH - CHART_EDGE_SPACING * 2),
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
    const since = rangeStartDate(range);
    const inRange = (since ? progress.filter((point) => point.date >= since) : progress)
      .map((point) => ({
        ...point,
        value: metric === 'e1rm' ? point.estimated1RMMax : point.maxWeight,
      }));

    const finished = activeProgressPoint
      ? inRange.filter((point) => point.date !== activeProgressPoint.date)
      : inRange;

    return activeProgressPoint ? [...finished, activeProgressPoint] : finished;
  }, [activeProgressPoint, metric, progress, range]);

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

  chartProgressRef.current = chartProgress;
  lineSpacingRef.current = lineSpacing;
  needsHorizontalScrollRef.current = needsHorizontalScroll;

  // Fitted charts do not fire onScroll — clear stale x/max so a range change cannot drift left.
  useEffect(() => {
    if (needsHorizontalScroll) {
      return;
    }

    lastScrollXRef.current = 0;
    chartScrollMaxRef.current = 0;
    setChartScrollPosition({ x: 0, max: 0 });
  }, [needsHorizontalScroll, chartProgress.length]);

  const handleChartScroll = useCallback((event: {
    nativeEvent: {
      contentOffset: { x: number };
      contentSize: { width: number };
      layoutMeasurement: { width: number };
    };
  }) => {
    const x = Math.max(0, event.nativeEvent.contentOffset.x);
    const max = Math.max(
      0,
      event.nativeEvent.contentSize.width - event.nativeEvent.layoutMeasurement.width
    );
    lastScrollXRef.current = x;
    chartScrollMaxRef.current = max;
    setChartScrollPosition({ x, max });
  }, []);

  const moveChart = useCallback(
    (direction: -1 | 1) => {
      const next = nextChartScrollX(
        lastScrollXRef.current,
        chartScrollMaxRef.current,
        plotWidth,
        direction
      );

      lastScrollXRef.current = next;
      chartScrollRef.current?.scrollTo({ x: next, animated: true });
      setChartScrollPosition((current) => ({ ...current, x: next, max: chartScrollMaxRef.current }));
    },
    [plotWidth]
  );

  const stopChartHold = useCallback(() => {
    if (chartHoldIntervalRef.current) {
      clearInterval(chartHoldIntervalRef.current);
      chartHoldIntervalRef.current = null;
    }
  }, []);

  const startChartHold = useCallback(
    (direction: -1 | 1) => {
      stopChartHold();

      const step = () => {
        const x = lastScrollXRef.current;
        const max = chartScrollMaxRef.current;
        if (direction < 0 && x <= 1) {
          stopChartHold();
          return;
        }
        if (direction > 0 && x >= max - 1) {
          stopChartHold();
          return;
        }
        moveChart(direction);
      };

      step();
      chartHoldIntervalRef.current = setInterval(step, CHART_HOLD_INTERVAL_MS);
    },
    [moveChart, stopChartHold]
  );

  useEffect(() => () => stopChartHold(), [stopChartHold]);

  const rememberChartScrollAnchor = useCallback(() => {
    const max = chartScrollMaxRef.current;
    const x = lastScrollXRef.current;
    const points = chartProgressRef.current;
    const spacing = lineSpacingRef.current;

    // No overflow (or already on Recentes): stay pinned to the newest end.
    if (!needsHorizontalScrollRef.current || max <= 1 || x >= max - 2) {
      pendingAnchorRef.current = { kind: 'end' };
      setPinChartToEnd(true);
      return;
    }

    if (x <= 2) {
      pendingAnchorRef.current = { kind: 'start' };
      setPinChartToEnd(false);
      return;
    }

    const leftIndex = Math.min(
      points.length - 1,
      Math.max(0, Math.round(x / Math.max(1, spacing)))
    );
    const date = points[leftIndex]?.date;
    pendingAnchorRef.current = date ? { kind: 'date', date } : { kind: 'end' };
    setPinChartToEnd(!date);
  }, []);

  const selectMetric = useCallback((next: ChartMetric) => {
    if (next === metric) return;
    setMetric(next);
  }, [metric]);

  const selectRange = useCallback(
    (next: ChartRange) => {
      if (next === range) return;
      rememberChartScrollAnchor();
      setRange(next);
    },
    [range, rememberChartScrollAnchor]
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
      // Load the whole history once; metric and range switch client-side so the
      // chart does not remount and flash when toggling the filter buttons. The
      // service reads every set for the exercise either way, so dropping the
      // cut-off costs nothing and is what makes "all time" possible.
      const [pts, prs, hist] = await Promise.all([
        getExerciseProgress(exerciseId, 'weight', language),
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
  }, [exerciseId, language]);

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
        label: shouldLabelPoint(index, chartProgress.length, lineSpacing, {
          hideFirst: needsHorizontalScroll,
        })
          ? point.label
          : '',
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
  }, [chartProgress, lineSpacing, needsHorizontalScroll]);

  // Restore viewport after a range change using an explicit anchor (end/start/date).
  useEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor) {
      return;
    }

    pendingAnchorRef.current = null;

    const max = Math.max(0, chartContentWidth - plotWidth);
    let x = max;

    if (anchor.kind === 'start') {
      x = 0;
    } else if (anchor.kind === 'date') {
      const index = chartProgress.findIndex((point) => point.date === anchor.date);
      if (index >= 0) {
        x = Math.min(max, Math.max(0, index * lineSpacing));
      }
    }

    setPinChartToEnd(anchor.kind === 'end');

    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      chartScrollRef.current?.scrollTo({ x, animated: false });
      lastScrollXRef.current = x;
      chartScrollMaxRef.current = max;
      setChartScrollPosition({ x, max });
    };

    const frame = requestAnimationFrame(apply);
    const timeout = setTimeout(apply, 50);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [chartContentWidth, plotWidth, chartProgress, lineSpacing, range]);

  const initialPointerIndex = useMemo(() => {
    if (lineData.length === 0) {
      return -1;
    }

    const focusedDate = focusedDateRef.current;
    if (focusedDate) {
      const focusedIndex = chartProgress.findIndex((point) => point.date === focusedDate);
      if (focusedIndex >= 0) {
        return focusedIndex;
      }
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
      return { min: 0, max: CHART_SECTIONS, sections: CHART_SECTIONS };
    }

    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    const spread = highest - lowest;
    const padding = spread === 0 ? Math.max(1, highest * 0.1) : spread * 0.15;

    // Snap the bottom to a multiple of the step so every label lands on a round
    // number, then count whole steps up until the top clears the highest point.
    // The count has to be free to grow: fixing it at four put the top of the
    // axis exactly on the best set, which drew it on the ceiling with its
    // marker cut off by the edge.
    const step = niceAxisStep((spread + padding * 2) / CHART_SECTIONS);
    const min = Math.max(0, Math.floor((lowest - padding) / step) * step);

    let sections = Math.ceil((highest + padding - min) / step);
    sections = Math.min(MAX_CHART_SECTIONS, Math.max(2, sections));

    if (min + step * sections <= highest) {
      sections += 1;
    }

    return { min, max: min + step * sections, sections };
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
          <Text style={styles.cardSubtitle}>{t(`exercise.detail.progressSubtitle_${metric}`)}</Text>

          <View style={styles.metricToggleRow}>
            {metricFilters.map((opt) => {
              const isActive = metric === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.metricToggle, isActive && styles.metricToggleActive]}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => selectMetric(opt.key)}
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
                  onPress={() => selectRange(opt.key)}
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
                <View style={styles.chartNavigation}>
                  <TouchableOpacity
                    style={[
                      styles.chartNavigationButton,
                      chartScrollPosition.x <= 1 && styles.chartNavigationButtonDisabled,
                    ]}
                    activeOpacity={ACTIVE_OPACITY}
                    disabled={chartScrollPosition.x <= 1}
                    onPressIn={() => startChartHold(-1)}
                    onPressOut={stopChartHold}
                    accessibilityRole="button"
                    accessibilityLabel={t('exercise.detail.chartOlder')}
                  >
                    <Ionicons name="chevron-back" size={16} color={palette.textPrimary} />
                    <Text style={styles.chartNavigationText}>{t('exercise.detail.chartOlder')}</Text>
                  </TouchableOpacity>

                  <Text style={styles.chartScrollHint}>{t('exercise.detail.chartScrollHint')}</Text>

                  <TouchableOpacity
                    style={[
                      styles.chartNavigationButton,
                      chartScrollPosition.x >= chartScrollPosition.max - 1 &&
                        styles.chartNavigationButtonDisabled,
                    ]}
                    activeOpacity={ACTIVE_OPACITY}
                    disabled={chartScrollPosition.x >= chartScrollPosition.max - 1}
                    onPressIn={() => startChartHold(1)}
                    onPressOut={stopChartHold}
                    accessibilityRole="button"
                    accessibilityLabel={t('exercise.detail.chartNewer')}
                  >
                    <Text style={styles.chartNavigationText}>{t('exercise.detail.chartNewer')}</Text>
                    <Ionicons name="chevron-forward" size={16} color={palette.textPrimary} />
                  </TouchableOpacity>
                </View>
              ) : null}
              <LineChart
                key={`${exerciseId}-${needsHorizontalScroll ? 'paged' : 'fit'}`}
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
                noOfSections={chartRange.sections}
                yAxisColor={palette.borderStrong}
                xAxisColor={palette.borderStrong}
                yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.xAxisLabelText}
                rulesColor={palette.inputFill}
                formatYLabel={(label) => `${formatCompactNumber(label)} kg`}
                // Keep mounted across metric/range toggles — animation remounts feel like a refresh.
                isAnimated={false}
                scrollRef={chartScrollRef}
                disableScroll
                scrollToEnd={needsHorizontalScroll && pinChartToEnd}
                scrollAnimation={false}
                showScrollIndicator={false}
                onScroll={handleChartScroll}
                // The chart owns horizontal drag only for point inspection.
                // Paging history is kept on explicit buttons above, so it never
                // steals the page's vertical scroll gesture.
                pointerConfig={{
                  pointerStripHeight: 200,
                  pointerStripColor: palette.borderStrong,
                  pointerStripWidth: 1,
                  pointerColor: palette.textPrimary,
                  radius: 5,
                  pointerLabelWidth: POINTER_LABEL_WIDTH,
                  pointerLabelHeight: 84,
                  activatePointersOnLongPress: false,
                  activatePointersInstantlyOnTouch: true,
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

                    focusedDateRef.current = point.date;

                    return (
                      <View style={styles.pointerCard}>
                        <Text style={styles.pointerDate}>
                          {formatExerciseHistoryDate(point.date, language)}
                        </Text>
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
                      {formatExerciseHistoryDate(entry.date, language)}{' \u2022 '}
                      {t('exercise.detail.workingSets', { count: entry.workingSetCount })}
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
    paddingHorizontal: CHART_WRAP_PADDING,
    // Was 'visible', which let the plot spill past the card edge.
    overflow: 'hidden',
  },
  chartNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 6,
    marginBottom: 8,
  },
  chartNavigationButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surface,
    paddingHorizontal: 7,
  },
  chartNavigationButtonDisabled: {
    opacity: 0.35,
  },
  chartNavigationText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  chartScrollHint: {
    flex: 1,
    color: palette.labelMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  pointerCard: {
    width: POINTER_LABEL_WIDTH,
    transform: [{ translateX: POINTER_X_CORRECTION }],
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    rowGap: 2,
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
    color: '#C5D0DE',
    fontSize: 11,
    fontWeight: '600',
  },
  xAxisLabelText: {
    color: '#C5D0DE',
    fontSize: 9,
    fontWeight: '600',
    width: 64,
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
