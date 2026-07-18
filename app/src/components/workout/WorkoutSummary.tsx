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
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';

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
  const { t } = useTranslation();
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
              <Text style={styles.heroTitle}>{t('workout.summaryTitle')}</Text>
              <Text style={styles.heroSubtitle}>{t('workout.summarySubtitle')}</Text>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>{t('workout.summaryDurationLabel')}</Text>
                <Text style={styles.metricValue}>{formatDuration(durationSeconds)}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>{t('workout.summarySetsLabel')}</Text>
                <Text style={styles.metricValue}>{completedSetCount}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>{t('workout.summaryPrsLabel')}</Text>
                <Text style={styles.metricValue}>{prCount}</Text>
              </View>
            </View>

            <View style={styles.exercisesCard}>
              <Text style={styles.exercisesTitle}>{t('workout.summaryExercisesTitle')}</Text>

              {exerciseNames.length === 0 ? (
                <Text style={styles.emptyText}>{t('workout.summaryNoExercises')}</Text>
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
            <TouchableOpacity 
              style={styles.ctaButton} 
              activeOpacity={ACTIVE_OPACITY} 
              onPress={onShareAndFinish}
              accessibilityRole="button"
              accessibilityLabel={t('workout.summaryShareAction')}
            >
              <Ionicons name="share-social-outline" size={16} color={palette.textPrimary} />
              <Text style={styles.ctaText}>{t('workout.summaryShareAction')}</Text>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    backgroundColor: 'rgba(59,130,246,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    columnGap: 10,
    marginBottom: 14,
    marginTop: 4,
  },
  metricCard: {
    flex: 1,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 94,
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  exercisesCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  exercisesTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#0B1220',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  exerciseName: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 14.5,
    fontWeight: '700',
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
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
    backgroundColor: palette.accent,
  },
  ctaText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
