import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Radius } from '@/constants/Styles';
import { usePreferences } from '@/context/PreferencesContext';
import type { WorkoutFeedItem } from '@/services/workoutService';
import { summarizeExercisePreview } from '@/utils/workoutPreview';

const palette = Colors.dark;

export function WorkoutSessionPreview({ workout }: { workout: WorkoutFeedItem }) {
  const { t } = useTranslation();
  const { language, countWorkingSetsOnly } = usePreferences();
  const locale = language === 'pt' ? 'pt-PT' : 'en-GB';
  const date = new Date(workout.start_time);
  const validDate = Number.isFinite(date.getTime());
  const minutes = workout.end_time
    ? Math.max(0, Math.round((new Date(workout.end_time).getTime() - date.getTime()) / 60000))
    : null;
  const duration =
    minutes !== null && Number.isFinite(minutes)
      ? minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
      : '—';
  const exercises = workout.exerciseGroups
    .slice(0, 3)
    .map((group) => summarizeExercisePreview(group, language, countWorkingSetsOnly));
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 });
  return (
    <View>
      <View style={styles.heading}>
        <View style={styles.dateBadge}>
          <Text style={styles.day}>{validDate ? date.getDate() : '—'}</Text>
          <Text style={styles.month}>
            {validDate ? date.toLocaleDateString(locale, { month: 'short' }).replace('.', '') : ''}
          </Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.date}>
            {validDate
              ? `${date.toLocaleDateString(locale, { weekday: 'long' })} · ${date.getFullYear()}`
              : ''}
          </Text>
          <Text style={styles.title}>{workout.name}</Text>
          <View style={styles.duration}>
            <Ionicons name="time-outline" size={13} color={palette.textMuted} />
            <Text style={styles.meta}>{duration}</Text>
            {(workout.prCount ?? 0) > 0 ? (
              <Text style={styles.record}>
                {t('historyJump.recordCount', { count: workout.prCount ?? 0 })}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      {workout.notes ? (
        <Text style={styles.notes} numberOfLines={2}>
          {workout.notes}
        </Text>
      ) : null}
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.value}>
            {number(workout.totalVolume)} <Text style={styles.unit}>kg</Text>
          </Text>
          <Text style={styles.meta}>{t('historyJump.volume')}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.value}>{countWorkingSetsOnly ? workout.workingSets : workout.totalSets}</Text>
          <Text style={styles.meta}>{t('feed.metrics.sets')}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.value}>{workout.exerciseNames.length}</Text>
          <Text style={styles.meta}>{t('feed.metrics.exercises')}</Text>
        </View>
      </View>
      <View style={styles.exercises}>
        {exercises.map((exercise, index) => (
          <View key={index} style={styles.exercise}>
            <View style={styles.dot} />
            <View style={styles.exerciseText}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.meta}>
                {t('historyJump.setCount', { count: exercise.setCount })}
                {exercise.reps !== null
                  ? ` · ${t('historyJump.heaviest')}: ${exercise.weight ? `${number(exercise.weight)} kg × ` : ''}${exercise.reps} ${t('stats.unitReps')}`
                  : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.openRow}>
        <Text style={styles.openText}>
          {workout.exerciseNames.length > 3
            ? t('historyJump.moreExercises', { count: workout.exerciseNames.length - 3 })
            : t('historyJump.viewSession')}
        </Text>
        <Ionicons name="arrow-forward" size={15} color={palette.accentLight} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  dateBadge: {
    width: 50,
    minHeight: 62,
    backgroundColor: palette.accentSoft,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
  day: {
    color: palette.textPrimary,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  month: { color: palette.accentLight, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  titleWrap: { flex: 1, minWidth: 0, gap: 4 },
  date: { color: palette.textMuted, fontSize: 11, textTransform: 'capitalize' },
  title: { color: palette.textPrimary, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  duration: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  meta: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
  record: { color: palette.accentLight, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  notes: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  metrics: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
    marginBottom: 14,
  },
  metric: { flex: 1, minWidth: 0, gap: 2 },
  value: { color: palette.textPrimary, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 11, color: palette.textMuted },
  exercises: { gap: 10 },
  exercise: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.accent, marginTop: 7 },
  exerciseText: { flex: 1, minWidth: 0, gap: 1 },
  exerciseName: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    minHeight: 28,
  },
  openText: { color: palette.accentLight, fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
