import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trainingColors } from '@/constants/trainingColors';
import { useWorkoutElapsedSeconds } from '@/context/WorkoutContext';

type SessionExercise = {
  id: string;
  sets: readonly { completed: boolean }[];
};

type ActiveWorkoutHeaderProps = {
  title: string;
  exercises: readonly SessionExercise[];
  isTimerPaused: boolean;
  isSubmitting: boolean;
  isDiscarding: boolean;
  onMinimize: () => void;
  onDiscard: () => void;
  onToggleTimer: () => void;
  onFinish: () => void;
};

const color = trainingColors;
const titleFont = Platform.select({
  android: 'sans-serif-condensed',
  web: '"Arial Narrow", "Segoe UI", system-ui, sans-serif',
  default: undefined,
});

function formatElapsedTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const parts = [Math.floor((seconds % 3600) / 60), seconds % 60];
  if (hours > 0) parts.unshift(hours);
  return parts.map(part => String(part).padStart(2, '0')).join(':');
}

function WorkoutClock({ isPaused, onPress }: { isPaused: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const elapsedSeconds = useWorkoutElapsedSeconds();
  const elapsedTime = formatElapsedTime(elapsedSeconds);
  const label = isPaused ? t('workout.resumeTimer') : t('workout.pauseTimer');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: elapsedTime }}
      onPress={onPress}
      style={({ pressed }) => [styles.clock, pressed && styles.pressed]}
    >
      <Text style={styles.metricLabel}>{t('workout.sessionElapsed')}</Text>
      <View style={styles.clockReadout}>
        <Text style={[styles.clockValue, isPaused && styles.clockPaused]}>{elapsedTime}</Text>
        <Ionicons name={isPaused ? 'play' : 'pause'} size={13} color={isPaused ? color.accent : color.textMuted} />
      </View>
    </Pressable>
  );
}

export function ActiveWorkoutHeader({
  title,
  exercises,
  isTimerPaused,
  isSubmitting,
  isDiscarding,
  onMinimize,
  onDiscard,
  onToggleTimer,
  onFinish,
}: ActiveWorkoutHeaderProps) {
  const { t } = useTranslation();
  const progress = exercises.flatMap(exercise => exercise.sets.length > 0 ? [{
    id: exercise.id,
    total: exercise.sets.length,
    completed: exercise.sets.filter(set => set.completed).length,
  }] : []);
  const total = progress.reduce((sum, exercise) => sum + exercise.total, 0);
  const completed = progress.reduce((sum, exercise) => sum + exercise.completed, 0);
  const progressLabel = t('workout.sessionSetProgress', { completed, count: total });
  const busy = isSubmitting || isDiscarding;

  return (
    <View style={styles.header}>
      <View style={styles.headingRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.minimizeA11y')}
          onPress={onMinimize}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-down" size={21} color={color.textPrimary} />
        </Pressable>

        <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>{title}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.finish')}
          accessibilityState={{ busy: isSubmitting, disabled: busy }}
          disabled={busy}
          onPress={onFinish}
          style={({ pressed }) => [styles.finishButton, (pressed || busy) && styles.pressed]}
        >
          {isSubmitting
            ? <ActivityIndicator size="small" color={color.bgPrimary} />
            : <Text style={styles.finishText}>{t('workout.finish')}</Text>}
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        <WorkoutClock isPaused={isTimerPaused} onPress={onToggleTimer} />

        {total > 0 ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('workout.sessionProgressLabel')}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completed}
            aria-valuetext={progressLabel}
            style={styles.progress}
          >
            <Text style={styles.progressLabel} numberOfLines={2}>{progressLabel}</Text>
            <View style={styles.rail}>
              {progress.map(exercise => (
                <View key={exercise.id} style={[styles.segment, { flexGrow: exercise.total }]}>
                  <View style={[styles.segmentFill, { width: `${exercise.completed / exercise.total * 100}%` }]} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.discardA11y')}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onDiscard}
          style={({ pressed }) => [styles.iconButton, styles.discardButton, (pressed || busy) && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={18} color={color.errorText} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
    backgroundColor: color.bgAlt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.borderStrong,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: color.textPrimary,
    fontFamily: titleFont,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pressed: {
    opacity: 0.62,
  },
  finishButton: {
    minHeight: 44,
    minWidth: 74,
    paddingHorizontal: 12,
    maxWidth: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: color.accent,
  },
  finishText: {
    color: color.bgPrimary,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    flexWrap: 'wrap',
  },
  clock: {
    minHeight: 44,
    minWidth: 88,
    justifyContent: 'center',
  },
  metricLabel: {
    color: color.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  clockReadout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  clockValue: {
    color: color.textPrimary,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  clockPaused: {
    color: color.accent,
  },
  progress: {
    flex: 1,
    minWidth: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: color.borderStrong,
    gap: 5,
  },
  progressLabel: {
    color: color.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rail: {
    flexDirection: 'row',
    columnGap: 2,
  },
  segment: {
    height: 5,
    flexBasis: 0,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: color.borderStrong,
  },
  segmentFill: {
    height: '100%',
    backgroundColor: color.successLight,
  },
  discardButton: {
    marginLeft: 'auto',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
});
