import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import {
  getWeeklyTrainingHours,
  getWeeklyVolumeByMuscle,
  type WeeklyVolumeByMuscle,
} from '@/services/statsService';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';

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

export default function StatsScreen() {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const localeTag = i18n.language;

  const [weeklyHours, setWeeklyHours] = useState<{ weekLabel: string; hours: number; workouts: number }[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<WeeklyVolumeByMuscle[]>([]);
  const [isLoadingHours, setIsLoadingHours] = useState(true);
  const [isLoadingVolume, setIsLoadingVolume] = useState(true);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const [selectedHoursIndex, setSelectedHoursIndex] = useState<number | null>(null);
  const [selectedVolumeIndex, setSelectedVolumeIndex] = useState<number | null>(null);

  const chartWidth = useMemo(() => Math.min(Math.max(280, windowWidth - 40), 360), [windowWidth]);
  const volumeViewportWidth = useMemo(() => Math.max(280, windowWidth - 40), [windowWidth]);

  const loadHours = useCallback(async () => {
    setIsLoadingHours(true);
    setHoursError(null);
    try {
      const rows = await getWeeklyTrainingHours(localeTag);
      setWeeklyHours(rows);
    } catch (err) {
      setHoursError(err instanceof Error ? err.message : t('common.unknownError'));
      setWeeklyHours([]);
    } finally {
      setIsLoadingHours(false);
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

  useEffect(() => { void loadHours(); }, [loadHours]);
  useEffect(() => { void loadVolume(); }, [loadVolume]);

  const hoursBarData = useMemo(
    () =>
      weeklyHours.map((item, i) => ({
        value: Math.max(0, item.hours),
        label: item.weekLabel,
        frontColor: i === selectedHoursIndex ? palette.accentLight : CHART_NEON,
        onPress: () => setSelectedHoursIndex(i),
      })),
    [weeklyHours, selectedHoursIndex]
  );

  const hoursMaxValue = useMemo(() => {
    const max = weeklyHours.reduce((m, e) => Math.max(m, e.hours), 0);
    return max <= 0 ? 4 : Math.max(4, Math.ceil(max * 1.25));
  }, [weeklyHours]);

  const selectedHoursPoint = selectedHoursIndex !== null ? weeklyHours[selectedHoursIndex] ?? null : null;

  useEffect(() => {
    if (hoursBarData.length === 0) { setSelectedHoursIndex(null); return; }
    setSelectedHoursIndex((cur) => (cur === null || cur >= hoursBarData.length) ? hoursBarData.length - 1 : cur);
  }, [hoursBarData.length]);

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
    const w = volumeBarData.length * 92 + 36;
    return Math.max(volumeViewportWidth, w);
  }, [volumeBarData.length, volumeViewportWidth]);

  const volumeMaxValue = useMemo(() => {
    const max = weeklyVolume.reduce((m, e) => Math.max(m, e.sets), 0);
    return max <= 0 ? 4 : Math.max(4, Math.ceil(max * 1.25));
  }, [weeklyVolume]);

  const selectedVolumePoint = selectedVolumeIndex !== null ? weeklyVolume[selectedVolumeIndex] ?? null : null;

  useEffect(() => {
    if (volumeBarData.length === 0) { setSelectedVolumeIndex(null); return; }
    setSelectedVolumeIndex((cur) => (cur === null || cur >= volumeBarData.length) ? volumeBarData.length - 1 : cur);
  }, [volumeBarData.length]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} activeOpacity={ACTIVE_OPACITY} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={palette.textPrimary} />
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t('stats.title')}</Text>
      <Text style={styles.subtitle}>{t('stats.subtitle')}</Text>

      {/* Weekly Training Hours */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('stats.weeklyHoursTitle')}</Text>
        <Text style={styles.cardSubtitle}>{t('stats.weeklyHoursSubtitle')}</Text>

        {isLoadingHours ? (
          <SkeletonPanel lines={4} minHeight={190} />
        ) : hoursError ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.errorText}>{hoursError}</Text>
          </View>
        ) : hoursBarData.length === 0 ? (
          <View style={styles.chartStatusWrap}>
            <Text style={styles.placeholderText}>{t('stats.noWeeklyHours')}</Text>
          </View>
        ) : (
          <View style={styles.chartWrap}>
            <BarChart
              data={hoursBarData}
              width={chartWidth}
              height={220}
              maxValue={hoursMaxValue}
              barWidth={Math.max(14, Math.min(28, Math.floor(chartWidth / Math.max(hoursBarData.length, 1)) - 8))}
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
              xAxisLabelsHeight={56}
              xAxisLabelsVerticalShift={26}
              labelsExtraHeight={32}
              overflowTop={24}
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.xAxisLabelText}
              formatYLabel={(label) => `${formatCompactAxisNumber(label)}${t('stats.hoursUnit')}`}
              rulesColor={palette.inputFill}
              noOfSections={4}
              isAnimated
              adjustToWidth
            />

            {selectedHoursPoint ? (
              <View style={styles.selectedPointCard}>
                <Text style={styles.selectedPointLabel}>{selectedHoursPoint.weekLabel}</Text>
                <Text style={styles.selectedPointValue}>{`${selectedHoursPoint.hours} ${t('stats.hoursUnit')}`}</Text>
                <Text style={styles.selectedPointMeta}>{`${selectedHoursPoint.workouts} ${t('stats.workoutsUnit')}`}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Weekly Volume by Muscle */}
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
          <View style={styles.chartWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weeklyChartScrollContent}
            >
              <BarChart
                data={volumeBarData}
                width={volumeChartWidth}
                height={220}
                maxValue={volumeMaxValue}
                barWidth={Math.max(22, Math.min(34, Math.floor(volumeChartWidth / Math.max(volumeBarData.length, 1)) - 26))}
                spacing={14}
                initialSpacing={12}
                endSpacing={10}
                roundedTop
                frontColor={CHART_NEON}
                gradientColor="#60A5FA"
                showGradient
              yAxisColor={palette.borderStrong}
              xAxisColor={palette.borderStrong}
              yAxisLabelWidth={64}
                xAxisLabelsHeight={56}
                xAxisLabelsVerticalShift={26}
                labelsExtraHeight={32}
                overflowTop={24}
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
                <Text style={styles.selectedPointValue}>{`${selectedVolumePoint.sets} ${t('stats.weeklySetsSuffix')}`}</Text>
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
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
  },
  backButtonText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 2,
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
  cardSubtitle: {
    color: palette.labelMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  skeletonPanel: {
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    justifyContent: 'center',
    paddingHorizontal: 12,
    rowGap: 10,
  },
  skeletonLine: {
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: palette.inputStroke,
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
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    minHeight: 304,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  weeklyChartScrollContent: {
    paddingRight: 8,
  },
  chartStatusWrap: {
    minHeight: 190,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputFill,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  axisText: {
    color: palette.textTertiary,
    fontSize: 11,
  },
  xAxisLabelText: {
    color: palette.textTertiary,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  selectedPointCard: {
    marginTop: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.exerciseRowBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedPointLabel: {
    color: palette.labelMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  selectedPointValue: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  selectedPointMeta: {
    color: palette.textTertiary,
    fontSize: 11,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  placeholderText: {
    color: palette.labelMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorText: {
    color: palette.errorText,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
