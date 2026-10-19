import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import {
  getWeeklyDashboardMetrics,
  getWeeklyVolumeByMuscle,
  type WeeklyDashboardMetric,
  type WeeklyDashboardPoint,
  type WeeklyVolumeByMuscle,
} from '@/services/statsService';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import { BackButton } from '@/components/common/BackButton';
import { getBarChartLayout } from '@/utils/barChartLayout';
import { useWorkoutContext } from '@/context/WorkoutContext';
import { getTabBarHeight, MINIMIZED_WORKOUT_BAR_GAP, MINIMIZED_WORKOUT_BAR_HEIGHT } from '@/constants/tabBar';

const palette = Colors.dark;
const SCREEN_BG = palette.bgPrimary;
const CARD_BG = palette.surface;
const CHART_NEON = palette.accent;

function formatCompactAxisNumber(value: number | string): string {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9+-.]/g, ''));
  const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;

  if (safe >= 1000) return `${(safe / 1000).toFixed(safe >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  if (safe >= 100) return `${Math.round(safe)}`;
  return Number.isInteger(safe) ? `${safe}` : safe.toFixed(1);
}

type SkeletonPanelProps = { lines?: number; minHeight?: number };

function SkeletonPanel({ lines = 3, minHeight = 190 }: SkeletonPanelProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.72, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => { anim.stop(); };
  }, [opacity]);

  return (
    <View style={[styles.skeletonPanel, { minHeight }]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View
          key={`skel-${i}`}
          style={[styles.skeletonLine, i === 0 ? styles.skeletonLineWide : styles.skeletonLineNarrow, { opacity }]}
        />
      ))}
    </View>
  );
}

function metricValueOf(point: WeeklyDashboardPoint, metric: WeeklyDashboardMetric): number {
  if (metric === 'duration') return point.durationMinutes;
  if (metric === 'reps') return point.repsTotal;
  return point.volumeKg;
}

export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const { hasActiveWorkout } = useWorkoutContext();
  const bottomPadding = 34
    + (Platform.OS === 'web' ? getTabBarHeight(true, 0) : 0)
    + (hasActiveWorkout ? MINIMIZED_WORKOUT_BAR_HEIGHT + MINIMIZED_WORKOUT_BAR_GAP : 0);
  const localeTag = i18n.language;

  const [dashboardMetric, setDashboardMetric] = useState<WeeklyDashboardMetric>('volume');
  const [dashboardRows, setDashboardRows] = useState<WeeklyDashboardPoint[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<WeeklyVolumeByMuscle[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isLoadingVolume, setIsLoadingVolume] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const [selectedDashboardIndex, setSelectedDashboardIndex] = useState<number | null>(null);
  const [selectedVolumeIndex, setSelectedVolumeIndex] = useState<number | null>(null);

  const [dashboardContainerWidth, setDashboardContainerWidth] = useState(0);
  const [volumeContainerWidth, setVolumeContainerWidth] = useState(0);
  const dashboardLayout = getBarChartLayout(dashboardContainerWidth, 50, dashboardRows.length);
  const volumeViewportWidth = getBarChartLayout(volumeContainerWidth, 64, 1).width;

  const loadDashboard = useCallback(async () => {
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const rows = await getWeeklyDashboardMetrics(localeTag, 12);
      setDashboardRows(rows);
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : t('common.unknownError'));
      setDashboardRows([]);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [localeTag, t]);

  const loadVolume = useCallback(async () => {
    setIsLoadingVolume(true);
    setVolumeError(null);
    try {
      const rows = await getWeeklyVolumeByMuscle(localeTag);
      setWeeklyVolume(rows);
    } catch (err) {
      setVolumeError(err instanceof Error ? err.message : t('common.unknownError'));
      setWeeklyVolume([]);
    } finally {
      setIsLoadingVolume(false);
    }
  }, [localeTag, t]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => { void loadVolume(); }, [loadVolume]);

  const dashboardBarData = useMemo(
    () =>
      dashboardRows.map((item, i) => ({
        value: Math.max(0, metricValueOf(item, dashboardMetric)),
        label: i % 4 === 0 ? item.weekLabel : '',
        frontColor: i === selectedDashboardIndex ? palette.accentLight : CHART_NEON,
        onPress: () => setSelectedDashboardIndex(i),
      })),
    [dashboardRows, dashboardMetric, selectedDashboardIndex]
  );

  const dashboardMaxValue = useMemo(() => {
    const max = dashboardRows.reduce((m, e) => Math.max(m, metricValueOf(e, dashboardMetric)), 0);
    return max <= 0 ? 4 : Math.max(4, Math.ceil(max * 1.2));
  }, [dashboardRows, dashboardMetric]);

  const selectedDashboardPoint =
    selectedDashboardIndex !== null ? dashboardRows[selectedDashboardIndex] ?? null : null;

  useEffect(() => {
    if (dashboardBarData.length === 0) {
      setSelectedDashboardIndex(null);
      return;
    }
    setSelectedDashboardIndex((cur) =>
      cur === null || cur >= dashboardBarData.length ? dashboardBarData.length - 1 : cur
    );
  }, [dashboardBarData.length]);

  const volumeBarData = useMemo(
    () =>
      weeklyVolume.map((item, i) => ({
        value: item.sets,
        label: item.muscle,
        frontColor: i === selectedVolumeIndex ? palette.accentLight : CHART_NEON,
        onPress: () => setSelectedVolumeIndex(i),
      })),
    [weeklyVolume, selectedVolumeIndex]
  );

  const volumeChartWidth = useMemo(() => {
    const w = volumeBarData.length * 92 + 24;
    return Math.max(volumeViewportWidth, w);
  }, [volumeBarData.length, volumeViewportWidth]);

  const volumeMaxValue = useMemo(() => {
    const max = weeklyVolume.reduce((m, e) => Math.max(m, e.sets), 0);
    return max <= 0 ? 4 : Math.max(4, Math.ceil(max * 1.25));
  }, [weeklyVolume]);

  const selectedVolumePoint = selectedVolumeIndex !== null ? weeklyVolume[selectedVolumeIndex] ?? null : null;

  useEffect(() => {
    if (volumeBarData.length === 0) {
      setSelectedVolumeIndex(null);
      return;
    }
    setSelectedVolumeIndex((cur) =>
      cur === null || cur >= volumeBarData.length ? volumeBarData.length - 1 : cur
    );
  }, [volumeBarData.length]);

  const selectedHeadline = useMemo(() => {
    if (!selectedDashboardPoint) return null;
    const value = metricValueOf(selectedDashboardPoint, dashboardMetric);
    if (dashboardMetric === 'duration') {
      return `${formatCompactAxisNumber(value)} ${t('stats.unitMin')}`;
    }
    if (dashboardMetric === 'reps') {
      return `${formatCompactAxisNumber(value)} ${t('stats.unitReps')}`;
    }
    return `${formatCompactAxisNumber(value)} ${t('stats.unitKg')}`;
  }, [selectedDashboardPoint, dashboardMetric, t]);

  const weeksAgoLabel = useMemo(() => {
    if (!selectedDashboardPoint) return null;
    // Use floor so a week only counts as "N weeks ago" after it has fully elapsed.
    // Math.round made Fri–Sun of the current week show "1 weeks ago".
    const weeks = Math.max(
      0,
      Math.floor((Date.now() - new Date(`${selectedDashboardPoint.weekKey}T12:00:00.000Z`).getTime()) / (7 * 24 * 60 * 60 * 1000))
    );
    return t('stats.weeksAgo', { count: weeks });
  }, [selectedDashboardPoint, t]);

  const metricTabs: { key: WeeklyDashboardMetric; label: string }[] = [
    { key: 'duration', label: t('stats.metricDuration') },
    { key: 'volume', label: t('stats.metricVolume') },
    { key: 'reps', label: t('stats.metricReps') },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
      <View style={styles.headerRow}>
        <BackButton fallback="/(tabs)/profile" />
      </View>

      <Text style={styles.title}>{t('stats.title')}</Text>
      <Text style={styles.subtitle}>{t('stats.subtitle')}</Text>

      <View style={styles.card}>
        <View style={styles.panelHeader}>
          <Text style={styles.cardTitle}>{t('stats.panelTitle')}</Text>
          <View style={styles.rangeChip}>
            <Text style={styles.rangeChipText}>{t('stats.rangeLast3Months')}</Text>
          </View>
        </View>

        {selectedHeadline ? (
          <View style={styles.headlineWrap}>
            <Text style={styles.headlineValue}>{selectedHeadline}</Text>
            {weeksAgoLabel ? <Text style={styles.headlineMeta}>{selectedDashboardPoint?.weekLabel} · {weeksAgoLabel}</Text> : null}
          </View>
        ) : null}

        {isLoadingDashboard ? (
          <SkeletonPanel lines={4} minHeight={210} />
        ) : dashboardError ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.errorText}>{dashboardError}</Text>
          </View>
        ) : dashboardBarData.length === 0 ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.placeholderText}>{t('stats.noDashboardData')}</Text>
          </View>
        ) : (
          <View style={styles.chartWrap} onLayout={(event) => setDashboardContainerWidth(event.nativeEvent.layout.width)}>
            {dashboardContainerWidth > 0 ? <BarChart
              data={dashboardBarData}
              width={dashboardLayout.width}
              height={220}
              maxValue={dashboardMaxValue}
              barWidth={dashboardLayout.barWidth}
              spacing={dashboardLayout.spacing}
              initialSpacing={6}
              endSpacing={6}
              disableScroll
              roundedTop
              frontColor={CHART_NEON}
              gradientColor="#60A5FA"
              showGradient
              yAxisColor={palette.borderStrong}
              xAxisColor={palette.borderStrong}
              yAxisLabelWidth={50}
              labelWidth={48}
              xAxisLabelsHeight={18}
              labelsExtraHeight={24}
              overflowTop={12}
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.xAxisLabelText}
              formatYLabel={(label) => formatCompactAxisNumber(label)}
              rulesColor={palette.inputFill}
              noOfSections={4}
              isAnimated
            /> : null}
          </View>
        )}

        <View style={styles.metricTabsRow}>
          {metricTabs.map((tab) => {
            const isActive = dashboardMetric === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.metricTab, isActive && styles.metricTabActive]}
                activeOpacity={ACTIVE_OPACITY}
                onPress={() => setDashboardMetric(tab.key)}
              >
                <Text style={[styles.metricTabText, isActive && styles.metricTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('stats.weeklyVolumeTitle')}</Text>
        <Text style={styles.cardSubtitle}>{t('stats.weeklyVolumeSubtitle')}</Text>

        {isLoadingVolume ? (
          <SkeletonPanel lines={4} minHeight={190} />
        ) : volumeError ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.errorText}>{volumeError}</Text>
          </View>
        ) : volumeBarData.length === 0 ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.placeholderText}>{t('stats.noWeeklySets')}</Text>
          </View>
        ) : (
          <View style={styles.chartWrap} onLayout={(event) => setVolumeContainerWidth(event.nativeEvent.layout.width)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
            >
              <BarChart
                data={volumeBarData}
                width={volumeChartWidth}
                height={220}
                maxValue={volumeMaxValue}
                barWidth={34}
                spacing={58}
                initialSpacing={12}
                endSpacing={12}
                roundedTop
                frontColor={CHART_NEON}
                gradientColor="#60A5FA"
                showGradient
                yAxisColor={palette.borderStrong}
                xAxisColor={palette.borderStrong}
                yAxisLabelWidth={64}
                labelWidth={80}
                xAxisLabelsHeight={18}
                labelsExtraHeight={24}
                overflowTop={12}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.xAxisLabelText}
                formatYLabel={(label) => formatCompactAxisNumber(label)}
                rulesColor={palette.inputFill}
                noOfSections={4}
                isAnimated
              />
            </ScrollView>

            {selectedVolumePoint ? (
              <View style={styles.selectedPointCard}>
                <Text style={styles.selectedPointLabel}>{selectedVolumePoint.muscle}</Text>
                <Text style={styles.selectedPointValue}>{`${selectedVolumePoint.sets} ${t('stats.weeklySetsSuffix', { count: selectedVolumePoint.sets })}`}</Text>
              </View>
            ) : null}
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    rowGap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
    rowGap: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  rangeChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rangeChipText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  headlineWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 10,
  },
  headlineValue: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '900',
  },
  headlineMeta: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
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
    overflow: 'hidden',
  },
  axisText: {
    color: '#8FA2BA',
    fontSize: 11,
  },
  xAxisLabelText: {
    color: '#94A3B8',
    fontSize: 10,
    textAlign: 'center',
  },
  metricTabsRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  metricTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  metricTabActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  metricTabText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  metricTabTextActive: {
    color: '#FFFFFF',
  },
  selectedPointCard: {
    marginTop: 10,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.bgPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedPointLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedPointValue: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  placeholderText: {
    color: palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  skeletonPanel: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    justifyContent: 'center',
    paddingHorizontal: 16,
    rowGap: 10,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.borderStrong,
  },
  skeletonLineWide: {
    width: '78%',
  },
  skeletonLineNarrow: {
    width: '52%',
  },
});
