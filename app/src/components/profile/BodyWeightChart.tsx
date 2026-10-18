import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/theme';
import { formatExerciseAxisDate, formatExerciseHistoryDate } from '@/services/statsService';
import {
  BODY_WEIGHT_CHART_EDGE_SPACING,
  resolveBodyWeightChartRange,
  resolveBodyWeightLineSpacing,
  toBodyWeightChartPoints,
  type BodyWeightChartEntry,
} from '@/utils/bodyWeightChart';

const palette = Colors.dark;
const CHART_NEON = palette.accent;
const Y_AXIS_LABEL_WIDTH = 52;
const POINTER_X_CORRECTION = -BODY_WEIGHT_CHART_EDGE_SPACING;

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
  const [containerWidth, setContainerWidth] = useState(0);

  const points = useMemo(() => toBodyWeightChartPoints(entries), [entries]);

  const plotWidth = Math.max(1, containerWidth - Y_AXIS_LABEL_WIDTH - 20);

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
      label: '',
      dataPointColor: index === lastIndex ? palette.textPrimary : CHART_NEON,
      dataPointRadius: index === lastIndex ? 6 : 4,
      point,
    }));
  }, [points]);

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const selectedPoint = points.find((point) => point.id === selectedPointId) ?? points[points.length - 1];
  const initialPointerIndex = lineData.length - 1;

  if (points.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
      <View style={styles.readout}>
        <Text style={styles.pointerDate}>{formatExerciseHistoryDate(selectedPoint.recordedAt, language)}</Text>
        <Text style={styles.pointerValue}>{`${formatAxisKg(String(selectedPoint.value))} kg`}</Text>
      </View>
      {containerWidth > 0 ? <LineChart
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
        rulesColor={palette.inputFill}
        formatYLabel={formatAxisKg}
        isAnimated={false}
        disableScroll
        showScrollIndicator={false}
        getPointerProps={({ pointerIndex }: { pointerIndex: number }) => {
          if (points[pointerIndex]) setSelectedPointId(points[pointerIndex].id);
        }}
        pointerConfig={{
          showPointerStrip: false,
          pointerColor: palette.textPrimary,
          radius: 5,
          activatePointersOnLongPress: false,
          activatePointersInstantlyOnTouch: true,
          persistPointer: true,
          resetPointerOnDataChange: true,
          initialPointerIndex,
          pointerComponent: () => <View style={styles.pointerDot} />,
        }}
      /> : null}
      <View style={styles.readout}>
        <Text style={styles.axisText}>{formatExerciseAxisDate(points[0].recordedAt, language)}</Text>
        <Text style={styles.axisText}>{formatExerciseAxisDate(points[points.length - 1].recordedAt, language)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
  },
  readout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
});
