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
import { BackButton } from '@/components/common/BackButton';
import { ExerciseThumbnail } from '@/components/common/ExerciseThumbnail';
import { DismissibleBottomSheet } from '@/components/common/DismissibleBottomSheet';
import { ShareWorkoutSheet } from '@/components/workout/ShareWorkoutSheet';
import { WorkoutActionsMenu, type WorkoutMenuAction } from '@/components/workout/WorkoutActionsMenu';
import { usePreferences } from '@/context/PreferencesContext';
import { useAppToast } from '@/context/ToastContext';
import { useWorkoutDelete } from '@/hooks/useWorkoutDelete';
import { useWorkoutShare } from '@/hooks/useWorkoutShare';
import {
  getAuthenticatedUserOrThrow,
  getErrorMessage,
  getWorkoutDetails,
  type WorkoutDetails,
  type WorkoutSetType,
} from '@/services/workoutService';
import {
  getEquipmentTranslationKey,
  getExerciseMuscleTranslationKey,
} from '@/constants/exerciseCatalog';
import { formatRelativeTime } from '@/utils/dateUtils';
import { getLocalizedExerciseMuscle, getLocalizedExerciseName } from '@/utils/exerciseLocalization';

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
  const { language, countWorkingSetsOnly } = usePreferences();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const workoutId = useMemo(() => resolveRouteWorkoutId(params.id), [params.id]);

  const [details, setDetails] = useState<WorkoutDetails | null>(null);
  const recordSetIds = useMemo(() => new Set(details?.recordSetIds ?? []), [details]);
  const hasRecords = (details?.prCount ?? 0) > 0;
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<'closed' | 'menu' | 'share'>('closed');
  const share = useWorkoutShare();
  const { confirmAndDelete } = useWorkoutDelete();
  const { showToast } = useAppToast();

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

  const closeSheet = useCallback(() => {
    setSheetMode('closed');
    share.resetShare();
  }, [share]);

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

  const handleDeleteWorkout = useCallback(async () => {
    if (!workoutId) {
      return;
    }

    if (!(await confirmAndDelete(workoutId))) {
      return;
    }

    // Opening this screen from a link leaves nothing to go back to, and the
    // deleted workout would stay on screen.
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/profile' as any);
  }, [confirmAndDelete, workoutId]);

  const handleMenuSelect = useCallback(
    (action: WorkoutMenuAction) => {
      if (action === 'edit') {
        closeSheet();
        handleEditWorkout();
        return;
      }

      if (action === 'copy') {
        closeSheet();
        handleCopyWorkout();
        return;
      }

      if (action === 'delete') {
        closeSheet();
        void handleDeleteWorkout();
        return;
      }

      if (!details) {
        return;
      }

      share.prepareShare({
        workoutId: details.id,
        ownerId: details.user_id,
        title: details.name,
        summary: t('feed.shareSummary', {
          sets: countWorkingSetsOnly ? details.workingSets : details.totalSets,
          exercises: details.exercises.length,
        }),
      });
      setSheetMode('share');
    },
    [
      closeSheet,
      countWorkingSetsOnly,
      details,
      handleCopyWorkout,
      handleDeleteWorkout,
      handleEditWorkout,
      share,
      t,
    ]
  );

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
        <BackButton fallback="/(tabs)/profile" />

        <Text style={styles.headerTitle}>{t('workoutDetails.headerTitle')}</Text>

        <TouchableOpacity
          style={styles.headerButton}
          activeOpacity={ACTIVE_OPACITY}
          onPress={() => setSheetMode('menu')}
          disabled={!details}
          accessibilityRole="button"
          accessibilityLabel={t('feed.workoutActions', { defaultValue: 'Workout actions' })}
        >
          <Ionicons name="ellipsis-horizontal" size={21} color={details ? palette.textPrimary : palette.textMuted} />
        </TouchableOpacity>
      </View>

      <DismissibleBottomSheet visible={sheetMode !== 'closed'} onClose={closeSheet}>
        {sheetMode === 'share' ? (
          <ShareWorkoutSheet
            input={share.shareInput}
            ownerVisibility={share.ownerVisibility}
            notice={share.notice}
            onCancel={closeSheet}
            onChoose={(choice) => {
              void share.chooseShare(choice).then((result) => {
                if (result.status === 'copied') {
                  closeSheet();
                  setTimeout(() => {
                    showToast({ message: result.message, tone: 'info' });
                  }, 220);
                }
              });
            }}
          />
        ) : (
          <WorkoutActionsMenu
            canManage={isOwnWorkout}
            canDelete={isOwnWorkout}
            onSelect={handleMenuSelect}
            onCancel={closeSheet}
          />
        )}
      </DismissibleBottomSheet>

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
                <Text style={styles.statValue}>
                  {countWorkingSetsOnly ? details.workingSets : details.totalSets}
                </Text>
              </View>

              <View style={styles.statCard}>
                {/* The trophy replaces the word: it is the same thing the set
                    rows are marked with, so the card and the rows read as one
                    idea instead of two. */}
                <Ionicons
                  name="trophy"
                  size={13}
                  color={hasRecords ? palette.warningText : palette.textMuted}
                  accessibilityLabel={t('workoutDetails.recordsLabel')}
                />
                <Text style={[styles.statValue, hasRecords && styles.statValueRecord]}>{details.prCount}</Text>
              </View>
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
                },
                language
              );
              const muscleKey = getExerciseMuscleTranslationKey({
                muscleGroup: exercise.muscle_group,
                name: exercise.exercise_name,
                nameEn: exercise.name_en,
                namePt: exercise.name_pt,
              });
              const muscleLabel = muscleKey
                ? t(muscleKey)
                : getLocalizedExerciseMuscle(
                    {
                      muscle_group: exercise.muscle_group,
                      muscle_en: null,
                      muscle_pt: null,
                    },
                    language
                  ) ?? t('exercise.general');
              const equipmentKey = getEquipmentTranslationKey(exercise.equipment);
              const equipmentLabel = equipmentKey
                ? t(equipmentKey)
                : exercise.equipment ?? t('exercise.equipment.bodyweight');

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
                      {muscleLabel} - {equipmentLabel}
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

                {exercise.sets.map((setItem) => {
                  const isRecord = recordSetIds.has(setItem.id);

                  return (
                    <View key={setItem.id} style={[styles.tableRow, isRecord && styles.recordRow]}>
                      {/* Hevy puts the trophy where the set number is. Marking
                          the row itself is the only place the answer to "which
                          record did I beat" can actually live. */}
                      <View style={[styles.cellSet, styles.setNumberCell]}>
                        {isRecord ? (
                          <Ionicons name="trophy" size={12} color={palette.warningText} />
                        ) : null}
                        <Text
                          style={[styles.valueCell, styles.setNumberText, isRecord && styles.valueCellRecord]}
                          accessibilityLabel={
                            isRecord
                              ? t('workoutDetails.recordSetAccessibility', { set: setItem.set_number ?? 0 })
                              : undefined
                          }
                        >
                          {setItem.set_number ?? '—'}
                        </Text>
                      </View>
                      <Text style={[styles.valueCell, styles.cellKg, isRecord && styles.valueCellRecord]}>
                        {formatNumericValue(setItem.weight, 'decimal')}
                      </Text>
                      <Text style={[styles.valueCell, styles.cellReps, isRecord && styles.valueCellRecord]}>
                        {formatNumericValue(setItem.reps, 'integer')}
                      </Text>
                      <Text style={[styles.valueCell, styles.cellRir]}>{formatRirValue(setItem.rir, setItem.set_type)}</Text>
                      <Text style={[styles.valueCell, styles.cellType]}>{formatSetType(setItem.set_type, t)}</Text>
                    </View>
                  );
                })}
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
  headerButton: {
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
    alignItems: 'stretch',
    columnGap: 8,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 2,
  },
  statValueRecord: {
    color: palette.warningText,
  },
  statLabel: {
    color: palette.labelMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
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
  setNumberCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  setNumberText: {
    flex: 0,
  },
  recordRow: {
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderRadius: Radius.sm,
  },
  valueCellRecord: {
    color: palette.warningText,
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
