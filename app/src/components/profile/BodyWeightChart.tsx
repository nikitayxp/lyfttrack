import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/theme';
import { Radius } from '@/constants/Styles';
import { formatExerciseAxisDate, formatExerciseHistoryDate } from '@/services/statsService';
import { usableScreenWidth } from '@/utils/screenWidth';
import {
  resolvePointerCardEdge,
  resolvePointerCardShiftX,
} from '@/utils/chartViewport';
import {
  BODY_WEIGHT_CHART_EDGE_SPACING,
  resolveBodyWeightChartRange,
  resolveBodyWeightLineSpacing,
  shouldLabelBodyWeightPoint,
  toBodyWeightChartPoints,
  type BodyWeightChartEntry,
} from '@/utils/bodyWeightChart';

const palette = Colors.dark;
const CHART_NEON = palette.accent;
const Y_AXIS_LABEL_WIDTH = 52;
const POINTER_LABEL_WIDTH = 120;
const POINTER_X_CORRECTION = -BODY_WEIGHT_CHART_EDGE_SPACING;
const LIST_PADDING = 16;
const CARD_PADDING = 14;

type BodyWeightChartProps = {
  entries: BodyWeightChartEntry[];
  language: string;
};

function formatAxisKg(label: string): string {
  const parsed = Number(label);
  if (!Number.isFinite(parsed)) {
    return label;
  }

  return Number.isInteger(parsed) ? `${parsed}` : parsed.toFixed(1);
}

export function BodyWeightChart({ entries, language }: BodyWeightChartProps) {
  const { width: windowWidth } = useWindowDimensions();

  const points = useMemo(() => toBodyWeightChartPoints(entries), [entries]);

  const plotWidth = useMemo(() => {
    const innerWidth = Math.max(
      200,
      usableScreenWidth(windowWidth) - LIST_PADDING * 2 - CARD_PADDING * 2
    );
    return Math.max(140, innerWidth - Y_AXIS_LABEL_WIDTH - BODY_WEIGHT_CHART_EDGE_SPACING * 2);
  }, [windowWidth]);

  const lineSpacing = useMemo(
    () => resolveBodyWeightLineSpacing(plotWidth, points.length),
    [plotWidth, points.length]
  );

  const chartRange = useMemo(
    () => resolveBodyWeightChartRange(points.map((point) => point.value)),
    [points]
  );

  const lineData = useMemo(() => {
    const lastIndex = points.length - 1;

    return points.map((point, index) => ({
      value: point.value,
      label: shouldLabelBodyWeightPoint(index, points.length, lineSpacing)
        ? formatExerciseAxisDate(point.recordedAt, language)
        : '',
      dataPointColor: index === lastIndex ? palette.textPrimary : CHART_NEON,
      dataPointRadius: index === lastIndex ? 6 : 4,
      point,
    }));
  }, [language, lineSpacing, points]);

  const initialPointerIndex = lineData.length - 1;

  if (points.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <LineChart
        data={lineData}
        width={plotWidth}
        height={168}
        initialSpacing={BODY_WEIGHT_CHART_EDGE_SPACING}
        endSpacing={BODY_WEIGHT_CHART_EDGE_SPACING}
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
        formatYLabel={formatAxisKg}
        isAnimated={false}
        disableScroll
        showScrollIndicator={false}
        pointerConfig={{
          showPointerStrip: false,
          pointerColor: palette.textPrimary,
          radius: 5,
          pointerLabelWidth: POINTER_LABEL_WIDTH,
          pointerLabelHeight: 56,
          activatePointersOnLongPress: false,
          activatePointersInstantlyOnTouch: true,
          autoAdjustPointerLabelPosition: true,
          persistPointer: true,
          resetPointerOnDataChange: true,
          initialPointerIndex,
          pointerComponent: () => <View style={styles.pointerDot} />,
          pointerLabelComponent: (
            items: { point?: (typeof points)[number] }[],
            _secondary: unknown,
            pointerIndex: number
          ) => {
            const point = items?.[0]?.point;
            if (!point) {
              return null;
            }

            const shiftX = resolvePointerCardShiftX(
              resolvePointerCardEdge(pointerIndex, lineData.length),
              POINTER_X_CORRECTION
            );

            return (
              <View style={[styles.pointerCard, { transform: [{ translateX: shiftX }] }]}>
                <Text style={styles.pointerDate}>
                  {formatExerciseHistoryDate(point.recordedAt, language)}
                </Text>
                <Text style={styles.pointerValue}>{`${formatAxisKg(String(point.value))} kg`}</Text>
              </View>
            );
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
  },
  pointerCard: {
    width: POINTER_LABEL_WIDTH,
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
});
