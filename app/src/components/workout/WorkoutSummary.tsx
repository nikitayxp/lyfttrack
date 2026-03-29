import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_BG = '#050A12';
const CARD_BG = '#111827';
const MUTED_TEXT = '#94A3B8';

type WorkoutSummaryProps = {
  visible: boolean;
  durationSeconds: number;
  totalVolume: number;
  completedSetCount: number;
  exerciseNames: string[];
  onShareAndFinish: () => void;
};

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainder].map((value) => value.toString().padStart(2, '0')).join(':');
  }

  return [minutes, remainder].map((value) => value.toString().padStart(2, '0')).join(':');
}

function formatVolume(kg: number): string {
  const safeValue = Math.max(0, Math.round(kg));

  if (safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(1)}t`;
  }

  return `${safeValue.toLocaleString()} kg`;
}

export function WorkoutSummary({
  visible,
  durationSeconds,
  totalVolume,
  completedSetCount,
  exerciseNames,
  onShareAndFinish,
}: WorkoutSummaryProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onShareAndFinish}>
      <SafeAreaView style={styles.screen}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.heroWrap}>
            <Text style={styles.heroTitle}>Workout Complete! 🎉</Text>
            <Text style={styles.heroSubtitle}>Great consistency. Your session is now locked in.</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Time</Text>
              <Text style={styles.metricValue}>{formatDuration(durationSeconds)}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Volume</Text>
              <Text style={styles.metricValue}>{formatVolume(totalVolume)}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Sets</Text>
              <Text style={styles.metricValue}>{completedSetCount}</Text>
            </View>
          </View>

          <View style={styles.exercisesCard}>
            <Text style={styles.exercisesTitle}>Exercises</Text>

            {exerciseNames.length === 0 ? (
              <Text style={styles.emptyText}>No completed exercises in this session.</Text>
            ) : (
              exerciseNames.map((exerciseName, index) => (
                <View key={`${exerciseName}-${index}`} style={styles.exerciseRow}>
                  <Ionicons name="barbell-outline" size={16} color={MUTED_TEXT} />
                  <Text style={styles.exerciseName}>{exerciseName}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View style={styles.ctaWrap}>
          <TouchableOpacity style={styles.ctaButton} activeOpacity={0.9} onPress={onShareAndFinish}>
            <Text style={styles.ctaText}>Share & Finish</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 24,
  },
  heroWrap: {
    marginBottom: 18,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#B7C4D8',
    fontSize: 15,
    lineHeight: 22,
  },
  metricRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 92,
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: MUTED_TEXT,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  exercisesCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  exercisesTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyText: {
    color: MUTED_TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0D1624',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  exerciseName: {
    flex: 1,
    color: '#E5EDF9',
    fontSize: 14,
    fontWeight: '600',
  },
  ctaWrap: {
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
  },
  ctaButton: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
});
