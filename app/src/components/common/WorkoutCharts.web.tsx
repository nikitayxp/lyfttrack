import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { Colors } from '@/constants/Colors';

type ChartLibrary = typeof import('react-native-gifted-charts');

let loadedCharts: ChartLibrary | undefined;
let pendingCharts: Promise<ChartLibrary> | undefined;

function loadCharts(): Promise<ChartLibrary> {
  pendingCharts ??= import('react-native-gifted-charts').then(charts => {
    loadedCharts = charts;
    return charts;
  }, error => {
    pendingCharts = undefined;
    throw error;
  });
  return pendingCharts;
}

function DeferredChart({ height = 160, render }: { height?: number; render: (charts: ChartLibrary) => ReactNode }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<ChartLibrary | 'error' | undefined>(() => loadedCharts);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void loadCharts().then(
      charts => { if (active) setResult(charts); },
      () => { if (active) setResult('error'); },
    );
    return () => { active = false; };
  }, [attempt]);

  if (result && result !== 'error') return render(result);

  return (
    <View style={[styles.status, { minHeight: height }]}>
      {result === 'error' ? (
        <AppButton label={t('common.retry')} onPress={() => {
          setResult(undefined);
          setAttempt(current => current + 1);
        }} />
      ) : (
        <ActivityIndicator color={Colors.dark.accent} accessibilityLabel={t('common.loading')} />
      )}
    </View>
  );
}

export function BarChart(props: ComponentProps<ChartLibrary['BarChart']>) {
  return <DeferredChart height={props.height} render={charts => <charts.BarChart {...props} />} />;
}

export function LineChart(props: ComponentProps<ChartLibrary['LineChart']>) {
  return <DeferredChart height={props.height} render={charts => <charts.LineChart {...props} />} />;
}

const styles = StyleSheet.create({
  status: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
