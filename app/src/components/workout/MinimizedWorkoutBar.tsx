import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Radius } from '@/constants/Styles';
import { usePreferences } from '@/context/PreferencesContext';
import { useWorkoutContext } from '@/context/WorkoutContext';
import { getLocalizedExerciseName } from '@/utils/exerciseLocalization';

const palette = Colors.dark;
const WEB_MOBILE_TAB_BAR_HEIGHT = 74;

type MinimizedWorkoutBarProps = {
  visible: boolean;
};

function formatElapsedTime(totalSeconds: number): string {
  const clampedSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const seconds = clampedSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
  }

  return [minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

export function MinimizedWorkoutBar({ visible }: MinimizedWorkoutBarProps) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const insets = useSafeAreaInsets();
  const {
    hasActiveWorkout,
    elapsedSeconds,
    activeExercises,
  } = useWorkoutContext();

  const isWeb = Platform.OS === 'web';
  const nativeBottomInset = Math.max(insets.bottom, 10);
  const tabBarHeight = isWeb
    ? WEB_MOBILE_TAB_BAR_HEIGHT
    : (Platform.OS === 'ios' ? 72 : 64) + nativeBottomInset;

  const bottomOffset = useMemo(() => tabBarHeight + 10, [tabBarHeight]);
  const durationLabel = useMemo(() => formatElapsedTime(elapsedSeconds), [elapsedSeconds]);
  const sessionSummary = useMemo(() => {
    const exerciseCount = activeExercises.length;
    const latest = activeExercises[activeExercises.length - 1]?.exercise;
    const latestName = latest ? getLocalizedExerciseName(latest, language) : null;

    if (exerciseCount === 0) {
      return t('workout.minimizedInProgress');
    }

    if (exerciseCount === 1) {
      return latestName ?? t('workout.minimizedOneExercise');
    }

    if (latestName) {
      return t('workout.minimizedCountLatest', { count: exerciseCount, name: latestName });
    }

    return t('workout.minimizedCount', { count: exerciseCount });
  }, [activeExercises, language, t]);

  if (!visible || !hasActiveWorkout) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.minimizedResumeA11y')}
        style={[styles.bar, { bottom: bottomOffset }]}
        onPress={() => router.push('/workout/active' as any)}
      >
        <View style={styles.leadingIconWrap}>
          <Ionicons name="barbell-outline" size={18} color={palette.textSecondary} />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>{t('workout.minimizedTitle')}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{sessionSummary}</Text>
        </View>

        <View style={styles.rightWrap}>
          <Text style={styles.duration}>{durationLabel}</Text>
          <Ionicons name="chevron-up" size={16} color={palette.textSecondary} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
  },
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.accentSoft,
    backgroundColor: palette.surfaceAlt,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    shadowColor: palette.bgPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  leadingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  rightWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    rowGap: 2,
    flexShrink: 0,
  },
  duration: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
