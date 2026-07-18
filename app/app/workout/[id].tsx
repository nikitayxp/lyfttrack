import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import { ExerciseThumbnail } from '@/components/common/ExerciseThumbnail';
import { usePreferences } from '@/context/PreferencesContext';
import {
  getAuthenticatedUserOrThrow,
  getErrorMessage,
  getWorkoutDetails,
  type WorkoutDetails,
  type WorkoutSetType,
} from '@/services/workoutService';
import { formatRelativeTime } from '@/utils/dateUtils';
import { getLocalizedExerciseName } from '@/utils/exerciseLocalization';

const palette = Colors.dark;
const SCREEN_BG = palette.bgPrimary;
const CARD_BG = palette.surface;
const ROOT_SCREEN_BG = SCREEN_BG;

function resolveRouteWorkoutId(rawValue: string | string[] | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  if (Array.isArray(rawValue)) {
    return rawValue[0]?.trim() || null;
  }

  return rawValue.trim() || null;
}

function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
  }

  return [minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

function formatNumericValue(value: number | null, mode: 'decimal' | 'integer'): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  if (mode === 'integer') {
    return `${Math.trunc(value)}`;
  }

  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toFixed(1);
}

function formatRirValue(rir: number | null, setType: WorkoutSetType): string {
  if (setType === 'warmup') {
    return '—';
  }

  return formatNumericValue(rir, 'decimal');
}

function formatSetType(setType: WorkoutSetType, t: (key: string) => unknown): string {
  if (setType === 'warmup') return String(t('workoutDetails.setTypeWarmup'));
  if (setType === 'drop') return String(t('workoutDetails.setTypeDrop'));
  if (setType === 'failure') return String(t('workoutDetails.setTypeFailure'));
  return String(t('workoutDetails.setTypeWork'));
}

function profileDisplayName(details: WorkoutDetails, fallbackLabel: string): string {
  const fullName = details.profile?.full_name?.trim();
  const username = details.profile?.username?.trim();

  return fullName || username || fallbackLabel;
}

function initialsFromName(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function WorkoutDetailsScreen() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const workoutId = useMemo(() => resolveRouteWorkoutId(params.id), [params.id]);

  const [details, setDetails] = useState<WorkoutDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAuthenticatedUserOrThrow()
      .then((user) => {
        if (!cancelled) {
          setCurrentUserId(user.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentUserId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isOwnWorkout = Boolean(details && currentUserId && details.user_id === currentUserId);

  const handleCopyWorkout = useCallback(() => {
    if (!workoutId) {
      return;
    }

    router.push(`/workout/active?copyFromWorkoutId=${encodeURIComponent(workoutId)}` as any);
  }, [workoutId]);

  const handleEditWorkout = useCallback(() => {
    if (!workoutId) {
      return;
    }

    router.push(`/workout/edit/${encodeURIComponent(workoutId)}` as any);
  }, [workoutId]);

  const loadDetails = useCallback(async () => {
    if (!workoutId) {
      setLoadError(t('workoutDetails.missingRouteId'));
      setDetails(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await getWorkoutDetails(workoutId);
      setDetails(result);
    } catch (error) {
      setDetails(null);
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [t, workoutId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const topDisplayName = useMemo(() => {
    if (!details) {
      return t('profile.athleteFallback');
    }

    return profileDisplayName(details, t('profile.athleteFallback'));
  }, [details, t]);

  const topInitials = useMemo(() => initialsFromName(topDisplayName), [topDisplayName]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} activeOpacity={ACTIVE_OPACITY} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={palette.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('workoutDetails.headerTitle')}</Text>

        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.statusWrap}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>{t('workoutDetails.loadingDetails')}</Text>
        </View>
      ) : loadError ? (
        <View style={styles.statusWrap}>
          <Text style={styles.statusTitle}>{t('workoutDetails.loadErrorTitle')}</Text>
          <Text style={styles.statusText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={ACTIVE_OPACITY} onPress={() => void loadDetails()}>
            <Text style={styles.retryButtonText}>{t('workoutDetails.retryAction')}</Text>
          </TouchableOpacity>
        </View>
      ) : !details ? (
        <View style={styles.statusWrap}>
          <Text style={styles.statusTitle}>{t('workoutDetails.unavailableTitle')}</Text>
          <Text style={styles.statusText}>{t('workoutDetails.unavailableDescription')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.profileRow}>
              {details.profile?.avatar_url ? (
                <Image source={{ uri: details.profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{topInitials}</Text>
                </View>
              )}

              <View style={styles.profileTextWrap}>
                <Text style={styles.profileName}>{topDisplayName}</Text>
                <Text style={styles.profileMeta}>{formatRelativeTime(details.start_time)}</Text>
              </View>
            </View>

            <Text style={styles.workoutName}>{details.name}</Text>
            {details.notes ? <Text style={styles.workoutNotes}>{details.notes}</Text> : null}

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('workoutDetails.durationLabel')}</Text>
                <Text style={styles.statValue}>{formatDurationFromSeconds(details.durationSeconds)}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('workoutDetails.setsLabel')}</Text>
                <Text style={styles.statValue}>{details.totalSets}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('workoutDetails.recordsLabel')}</Text>
                <Text style={styles.statValue}>{details.prCount}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('workoutDetails.pr1rmLabel')}</Text>
                <Text style={styles.statValue}>
                  {details.bestEstimated1RM !== null ? `${formatNumericValue(details.bestEstimated1RM, 'decimal')} kg` : '--'}
                </Text>
              </View>
            </View>

            {details.heaviestWeight !== null ? (
              <View style={styles.topSetPill}>
                <Ionicons name="trophy-outline" size={13} color="#F59E0B" />
                <Text style={styles.topSetPillText}>
                  {t('workoutDetails.bestSetLabel', { weight: formatNumericValue(details.heaviestWeight, 'decimal') })}
                </Text>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                activeOpacity={ACTIVE_OPACITY}
                onPress={handleCopyWorkout}
              >
                <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonTextPrimary}>{t('workoutDetails.copyWorkout')}</Text>
              </TouchableOpacity>

              {isOwnWorkout ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={handleEditWorkout}
                >
                  <Ionicons name="create-outline" size={16} color={palette.textPrimary} />
                  <Text style={styles.actionButtonTextSecondary}>{t('workoutDetails.editWorkout')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {details.exercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('workoutDetails.noSetsTitle')}</Text>
              <Text style={styles.emptyText}>{t('workoutDetails.noSetsDescription')}</Text>
            </View>
          ) : (
            details.exercises.map((exercise) => {
              const localizedName = getLocalizedExerciseName(
                {
                  name: exercise.exercise_name,
                  name_en: exercise.name_en,
                  name_pt: exercise.name_pt,
                  is_custom: exercise.is_custom,
                  muscle_group: exercise.muscle_group,
                  muscle_en: null,
                  muscle_pt: null,
                  equipment: exercise.equipment,
                },
                language
              );

              return (
              <View key={`${exercise.id ?? exercise.exercise_id}-${exercise.order}`} style={styles.exerciseCard}>
                <TouchableOpacity
                  style={styles.exerciseHeaderRow}
                  activeOpacity={ACTIVE_OPACITY}
                  onPress={() => router.push(`/exercise/${exercise.exercise_id}` as any)}
                >
                  <ExerciseThumbnail
                    exercise={{
                      name: exercise.exercise_name,
                      name_en: exercise.name_en,
                      name_pt: exercise.name_pt,
                      image_url: exercise.image_url,
                    }}
                    size={40}
                  />
                  <View style={styles.exerciseHeaderText}>
                    <Text style={styles.exerciseName}>{localizedName}</Text>
                    <Text style={styles.exerciseMeta}>
                      {(exercise.muscle_group ?? t('exercise.general')) + ' - ' + (exercise.equipment ?? t('exercise.bodyweight'))}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.headerCell, styles.cellSet]}>{t('workoutDetails.tableSet')}</Text>
                  <Text style={[styles.headerCell, styles.cellKg]}>kg</Text>
                  <Text style={[styles.headerCell, styles.cellReps]}>{t('workoutDetails.tableReps')}</Text>
                  <Text style={[styles.headerCell, styles.cellRir]}>{t('workoutDetails.tableRir')}</Text>
                  <Text style={[styles.headerCell, styles.cellType]}>{t('workoutDetails.tableType')}</Text>
                </View>

                {exercise.sets.map((setItem) => (
                  <View key={setItem.id} style={styles.tableRow}>
                    <Text style={[styles.valueCell, styles.cellSet]}>{setItem.set_number ?? '—'}</Text>
                    <Text style={[styles.valueCell, styles.cellKg]}>{formatNumericValue(setItem.weight, 'decimal')}</Text>
                    <Text style={[styles.valueCell, styles.cellReps]}>{formatNumericValue(setItem.reps, 'integer')}</Text>
                    <Text style={[styles.valueCell, styles.cellRir]}>{formatRirValue(setItem.rir, setItem.set_type)}</Text>
                    <Text style={[styles.valueCell, styles.cellType]}>{formatSetType(setItem.set_type, t)}</Text>
                  </View>
                ))}
              </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ROOT_SCREEN_BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.inputFill,
    backgroundColor: SCREEN_BG,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  scroll: {
    flex: 1,
    backgroundColor: ROOT_SCREEN_BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
  },
  statusWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  statusTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    color: palette.labelMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: Radius.button,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
  },
  retryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 10,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12335E',
  },
  avatarFallbackText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  profileTextWrap: {
    flex: 1,
  },
  profileName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileMeta: {
    color: palette.labelMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  workoutName: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  workoutNotes: {
    color: palette.chipText,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginTop: 4,
  },
  statCard: {
    width: '48.5%',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statLabel: {
    color: palette.labelMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValue: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  topSetPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#78350F',
    backgroundColor: '#2A1E10',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  topSetPillText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: Radius.button,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  actionButtonSecondary: {
    backgroundColor: palette.surface,
    borderColor: palette.inputStroke,
  },
  actionButtonTextPrimary: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonTextSecondary: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: palette.labelMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  exerciseCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  exerciseMeta: {
    color: palette.labelMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tableHeaderRow: {
    borderRadius: 11,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.inputFill,
  },
  headerCell: {
    color: palette.labelMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  valueCell: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  cellSet: {
    flex: 0.7,
    minWidth: 36,
  },
  cellKg: {
    flex: 1,
  },
  cellReps: {
    flex: 1,
  },
  cellRir: {
    flex: 0.85,
  },
  cellType: {
    flex: 1.45,
  },
});
