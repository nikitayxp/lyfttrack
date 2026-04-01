import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

const palette = Colors.dark;

type WorkoutSummaryProps = {
  visible: boolean;
  durationSeconds: number;
  prCount: number;
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

export function WorkoutSummary({
  visible,
  durationSeconds,
  prCount,
  completedSetCount,
  exerciseNames,
  onShareAndFinish,
}: WorkoutSummaryProps) {
  const isWeb = Platform.OS === 'web';
  const modalAnimationType: 'fade' | 'slide' = isWeb ? 'fade' : 'slide';

  return (
    <Modal
      visible={visible}
      animationType={modalAnimationType}
      presentationStyle="fullScreen"
      onRequestClose={onShareAndFinish}
    >
      <SafeAreaView style={[styles.screen, isWeb && styles.screenWeb]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.screenFrame, isWeb && styles.screenFrameWeb]}>
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <View style={styles.heroWrap}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="checkmark-circle" size={18} color={palette.accent} />
              </View>
              <Text style={styles.heroTitle}>TREINO CONCLUIDO</Text>
              <Text style={styles.heroSubtitle}>Sessao guardada. Mantem o ritmo e continua consistente.</Text>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Tempo</Text>
                <Text style={styles.metricValue}>{formatDuration(durationSeconds)}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Series</Text>
                <Text style={styles.metricValue}>{completedSetCount}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Recordes</Text>
                <Text style={styles.metricValue}>{prCount}</Text>
              </View>
            </View>

            <View style={styles.exercisesCard}>
              <Text style={styles.exercisesTitle}>Exercicios</Text>

              {exerciseNames.length === 0 ? (
                <Text style={styles.emptyText}>Sem exercicios concluidos nesta sessao.</Text>
              ) : (
                exerciseNames.map((exerciseName, index) => (
                  <View key={`${exerciseName}-${index}`} style={styles.exerciseRow}>
                    <Ionicons name="barbell-outline" size={16} color={palette.textMuted} />
                    <Text style={styles.exerciseName}>{exerciseName}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          <View style={styles.ctaWrap}>
            <TouchableOpacity style={styles.ctaButton} activeOpacity={0.9} onPress={onShareAndFinish}>
              <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
              <Text style={styles.ctaText}>Partilhar e terminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  screenWeb: {
    alignItems: 'center',
    width: '100%',
    height: '100%',
    minHeight: '100%',
    backgroundColor: palette.bgPrimary,
  },
  screenFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: palette.bgPrimary,
  },
  screenFrameWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    left: 0,
    right: 0,
    backgroundColor: palette.bgPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroWrap: {
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 5,
  },
  heroSubtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    columnGap: 6,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 82,
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  metricValue: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  exercisesCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  exercisesTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 7,
  },
  exerciseName: {
    flex: 1,
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  ctaWrap: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.bgPrimary,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  ctaButton: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
    backgroundColor: palette.accent,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
