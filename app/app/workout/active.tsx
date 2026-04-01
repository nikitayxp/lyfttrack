import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';
import {
  createExercise,
  type ExerciseCatalogFilters,
  type ExerciseLibraryEquipmentFilter,
  type ExerciseLibraryMuscleFilter,
  getAuthenticatedUserOrThrow,
  getErrorMessage,
  getExercisesCatalog,
  getRoutineById,
} from '@/services/workoutService';
import { finishWorkout } from '@/services/sessionRepository';
import { getTemplateById } from '@/services/templateService';
import { getExerciseProgress, type ExerciseProgressPoint } from '@/services/statsService';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import {
  WorkoutSaveValidationError,
  type FinishWorkoutResult,
  type WorkoutSetProgressDraft,
} from '@/services/workoutSession.types';
import {
  useActiveWorkoutState,
  createExerciseBlock,
  normalizeSetTypeOption,
  getCompletedExerciseNames,
  type ActiveExercise,
  type ExerciseRow,
} from '@/hooks/useActiveWorkoutState';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WorkoutSummary } from '@/components/workout/WorkoutSummary';
import {
  INPUT_LIMITS,
  sanitizeText,
  toSafeInteger,
  toSafeNumber,
} from '@/utils/inputValidation';

const palette = Colors.dark;
const DEFAULT_REST_SECONDS = 90;
const DESKTOP_WEB_MIN_WIDTH = 768;
const LIVE_CHART_COLOR = '#3B82F6';
const ROOT_SCREEN_BG = palette.bgPrimary;
const MUSCLE_FILTER_CHIP_OPTIONS: readonly { key: ExerciseLibraryMuscleFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'legs', label: 'Legs' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arms', label: 'Arms' },
];
const EQUIPMENT_FILTER_CHIP_OPTIONS: readonly { key: ExerciseLibraryEquipmentFilter; label: string }[] = [
  { key: 'all', label: 'All Equipment' },
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'machine', label: 'Machine' },
  { key: 'cable', label: 'Cable' },
];

type ExerciseStopwatchEntry = {
  startedAtMs: number;
};

function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainder].map((value) => value.toString().padStart(2, '0')).join(':');
  }

  return [minutes, remainder].map((value) => value.toString().padStart(2, '0')).join(':');
}

function buildWorkoutSetDrafts(exercises: ActiveExercise[]): WorkoutSetProgressDraft[] {
  return exercises.flatMap((exercise) =>
    exercise.sets.map((setItem) => ({
      exerciseId: exercise.exercise.id,
      setNumber: toSafeInteger(setItem.set_number, {
        min: 1,
        max: INPUT_LIMITS.setNumberMax,
      }),
      weight: toSafeNumber(setItem.weight, {
        min: 0,
        max: INPUT_LIMITS.weightMax,
        decimals: 2,
      }),
      reps: toSafeInteger(setItem.reps, {
        min: 0,
        max: INPUT_LIMITS.repsMax,
      }),
      rir: toSafeInteger(setItem.rir, {
        min: 0,
        max: INPUT_LIMITS.rirMax,
      }),
      completed: setItem.completed,
      setType: normalizeSetTypeOption(setItem.set_type),
    }))
  );
}

function buildCatalogCacheKey(filters: ExerciseCatalogFilters): string {
  const muscle = filters.muscle ?? 'all';
  const equipment = filters.equipment ?? 'all';

  return `${muscle}::${equipment}`;
}

export default function ActiveWorkout() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && windowWidth > DESKTOP_WEB_MIN_WIDTH;
  const modalAnimationType: 'fade' | 'slide' = isWeb ? 'fade' : 'slide';
  const searchParams = useLocalSearchParams<{
    routineId?: string | string[];
    templateId?: string | string[];
  }>();

  const routeRoutineId = useMemo(() => {
    const rawRoutineId = searchParams.routineId;

    if (Array.isArray(rawRoutineId)) {
      return rawRoutineId[0];
    }

    return rawRoutineId;
  }, [searchParams.routineId]);

  const routeTemplateId = useMemo(() => {
    const rawTemplateId = searchParams.templateId;

    if (Array.isArray(rawTemplateId)) {
      return rawTemplateId[0];
    }

    return rawTemplateId;
  }, [searchParams.templateId]);

  const {
    workoutStartedAtMs,
    elapsedSeconds,
    safeDeactivateKeepAwake,
  } = useWorkoutTimer();
  const workoutStartedAt = useMemo(() => new Date(workoutStartedAtMs).toISOString(), [workoutStartedAtMs]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getAuthenticatedUserOrThrow()
      .then((user) => setCurrentUserId(user.id))
      .catch(() => setCurrentUserId(null));
  }, []);

  const {
    activeExercises,
    activeExercisesRef,
    setActiveExercisesWithRef,
    handleSetCompletionToggle,
    updateSetInput,
    addSet,
    addExercise,
    clearExercises,
    getExerciseCompletionGlowValue,
    recoveredDraft,
    clearDraft,
    acceptRecoveredDraft,
    discardRecoveredDraft,
  } = useActiveWorkoutState({
    userId: currentUserId ?? undefined,
    startTime: workoutStartedAt,
    templateId: routeTemplateId ?? null,
  });

  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<ExerciseLibraryMuscleFilter>('all');
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState<ExerciseLibraryEquipmentFilter>('all');
  const [createExerciseVisible, setCreateExerciseVisible] = useState(false);
  const [catalogExercises, setCatalogExercises] = useState<ExerciseRow[]>([]);
  const [preloadedRoutineId, setPreloadedRoutineId] = useState<string | null>(null);
  const [preloadedTemplateId, setPreloadedTemplateId] = useState<string | null>(null);
  const [isPreloadingRoutine, setIsPreloadingRoutine] = useState(false);
  const [isPreloadingTemplate, setIsPreloadingTemplate] = useState(false);
  const [routinePreloadError, setRoutinePreloadError] = useState<string | null>(null);
  const [templatePreloadError, setTemplatePreloadError] = useState<string | null>(null);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [exerciseLoadError, setExerciseLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscleGroup, setNewExerciseMuscleGroup] = useState('');
  const [newExerciseEquipment, setNewExerciseEquipment] = useState('');
  const [finishSummary, setFinishSummary] = useState<FinishWorkoutResult | null>(null);
  const [summaryExerciseNames, setSummaryExerciseNames] = useState<string[]>([]);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const [isExerciseStatsVisible, setIsExerciseStatsVisible] = useState(false);
  const [statsExercise, setStatsExercise] = useState<ExerciseRow | null>(null);
  const [statsExerciseProgress, setStatsExerciseProgress] = useState<ExerciseProgressPoint[]>([]);
  const [isLoadingExerciseStats, setIsLoadingExerciseStats] = useState(false);
  const [exerciseStatsError, setExerciseStatsError] = useState<string | null>(null);
  const exerciseCatalogByFilterRef = useRef<Map<string, ExerciseRow[]>>(new Map());
  const exerciseProgressCacheRef = useRef<Map<string, ExerciseProgressPoint[]>>(new Map());
  const requestedProgressExerciseIdsRef = useRef<Set<string>>(new Set());
  const statsRequestVersionRef = useRef(0);
  const [exerciseStopwatchById, setExerciseStopwatchById] = useState<Record<string, ExerciseStopwatchEntry>>({});
  const [stopwatchNowMs, setStopwatchNowMs] = useState(() => Date.now());

  const timerLabel = useMemo(() => formatElapsedTime(elapsedSeconds), [elapsedSeconds]);
  const liveStatsChartData = useMemo(
    () =>
      statsExerciseProgress.slice(-12).map((point) => ({
        value: Math.max(0, point.value),
        label: point.label,
      })),
    [statsExerciseProgress]
  );

  const liveChartWidth = useMemo(() => Math.max(250, windowWidth - 72), [windowWidth]);

  useEffect(() => {
    if (Object.keys(exerciseStopwatchById).length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setStopwatchNowMs(Date.now());
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [exerciseStopwatchById]);

  useEffect(() => {
    setExerciseStopwatchById((currentValue) => {
      const activeExerciseIds = new Set(activeExercises.map((exercise) => exercise.id));
      let hasChanges = false;
      const nextValue: Record<string, ExerciseStopwatchEntry> = {};

      for (const [exerciseId, entry] of Object.entries(currentValue)) {
        if (!activeExerciseIds.has(exerciseId)) {
          hasChanges = true;
          continue;
        }

        nextValue[exerciseId] = entry;
      }

      return hasChanges ? nextValue : currentValue;
    });
  }, [activeExercises]);

  const isExerciseStopwatchRunning = useCallback(
    (exerciseId: string) => Boolean(exerciseStopwatchById[exerciseId]),
    [exerciseStopwatchById]
  );

  const getExerciseStopwatchSeconds = useCallback(
    (exerciseId: string) => {
      const entry = exerciseStopwatchById[exerciseId];

      if (!entry) {
        return 0;
      }

      return Math.max(0, Math.floor((stopwatchNowMs - entry.startedAtMs) / 1000));
    },
    [exerciseStopwatchById, stopwatchNowMs]
  );

  const toggleExerciseStopwatch = useCallback((exerciseId: string) => {
    setExerciseStopwatchById((currentValue) => {
      if (currentValue[exerciseId]) {
        const nextValue = { ...currentValue };
        delete nextValue[exerciseId];
        return nextValue;
      }

      return {
        ...currentValue,
        [exerciseId]: { startedAtMs: Date.now() },
      };
    });
  }, []);

  const loadExercises = useCallback(async (filters: ExerciseCatalogFilters, forceRefresh = false) => {
    const cacheKey = buildCatalogCacheKey(filters);

    if (!forceRefresh) {
      const cachedExercises = exerciseCatalogByFilterRef.current.get(cacheKey);

      if (cachedExercises) {
        setCatalogExercises(cachedExercises);
        setExerciseLoadError(null);
        setIsLoadingExercises(false);
        return;
      }
    }

    setIsLoadingExercises(true);
    setExerciseLoadError(null);

    try {
      const exercises = await getExercisesCatalog(filters);
      exerciseCatalogByFilterRef.current.set(cacheKey, exercises);
      setCatalogExercises(exercises);
    } catch (error) {
      setExerciseLoadError(getErrorMessage(error));
    } finally {
      setIsLoadingExercises(false);
    }
  }, []);

  useEffect(() => {
    if (!exercisePickerVisible) {
      return;
    }

    void loadExercises({ muscle: selectedMuscleFilter, equipment: selectedEquipmentFilter });
  }, [exercisePickerVisible, loadExercises, selectedEquipmentFilter, selectedMuscleFilter]);

  const preloadRoutine = useCallback(
    async (routineId: string, force = false) => {
      const normalizedRoutineId = routineId.trim();

      if (!normalizedRoutineId) {
        return;
      }

      if (!force && preloadedRoutineId === normalizedRoutineId) {
        return;
      }

      setIsPreloadingRoutine(true);
      setRoutinePreloadError(null);

      try {
        const routine = await getRoutineById(normalizedRoutineId);

        setActiveExercisesWithRef(routine.exercises.map((entry) => createExerciseBlock(entry.exercise)));
        setPreloadedRoutineId(routine.id);
      } catch (error) {
        setRoutinePreloadError(getErrorMessage(error));
      } finally {
        setIsPreloadingRoutine(false);
      }
    },
    [preloadedRoutineId, setActiveExercisesWithRef]
  );

  const preloadTemplate = useCallback(
    async (templateId: string, force = false) => {
      const normalizedTemplateId = templateId.trim();

      if (!normalizedTemplateId) {
        return;
      }

      if (!force && preloadedTemplateId === normalizedTemplateId) {
        return;
      }

      setIsPreloadingTemplate(true);
      setTemplatePreloadError(null);

      try {
        const template = await getTemplateById(normalizedTemplateId);

        setActiveExercisesWithRef(
          template.exercises.map((entry) => createExerciseBlock(entry.exercise, entry.rest_seconds ?? DEFAULT_REST_SECONDS))
        );
        setPreloadedTemplateId(template.id);
      } catch (error) {
        setTemplatePreloadError(getErrorMessage(error));
      } finally {
        setIsPreloadingTemplate(false);
      }
    },
    [preloadedTemplateId, setActiveExercisesWithRef]
  );

  useEffect(() => {
    if (routeTemplateId) {
      void preloadTemplate(routeTemplateId);
      return;
    }

    if (routeRoutineId) {
      void preloadRoutine(routeRoutineId);
    }
  }, [preloadRoutine, preloadTemplate, routeRoutineId, routeTemplateId]);

  const loadExerciseProgressForModal = useCallback(async (exercise: ExerciseRow, forceRefresh = false) => {
    const normalizedExerciseId = exercise.id.trim();

    if (!normalizedExerciseId) {
      setStatsExerciseProgress([]);
      setExerciseStatsError('Invalid exercise id.');
      setIsLoadingExerciseStats(false);
      return;
    }

    const cachedPoints = !forceRefresh ? exerciseProgressCacheRef.current.get(normalizedExerciseId) : null;

    if (cachedPoints) {
      setStatsExerciseProgress(cachedPoints);
      setExerciseStatsError(null);
      setIsLoadingExerciseStats(false);
      return;
    }

    const requestVersion = statsRequestVersionRef.current + 1;
    statsRequestVersionRef.current = requestVersion;

    setIsLoadingExerciseStats(true);
    setExerciseStatsError(null);

    try {
      const progressPoints = await getExerciseProgress(normalizedExerciseId, 'volume');
      exerciseProgressCacheRef.current.set(normalizedExerciseId, progressPoints);

      if (statsRequestVersionRef.current !== requestVersion) {
        return;
      }

      setStatsExerciseProgress(progressPoints);
    } catch (error) {
      if (statsRequestVersionRef.current !== requestVersion) {
        return;
      }

      setStatsExerciseProgress([]);
      setExerciseStatsError(getErrorMessage(error));
    } finally {
      if (statsRequestVersionRef.current === requestVersion) {
        setIsLoadingExerciseStats(false);
      }
    }
  }, []);

  const openExerciseStatsModal = useCallback(
    (exercise: ExerciseRow) => {
      setStatsExercise(exercise);
      setIsExerciseStatsVisible(true);
      void loadExerciseProgressForModal(exercise);
    },
    [loadExerciseProgressForModal]
  );

  const closeExerciseStatsModal = useCallback(() => {
    setIsExerciseStatsVisible(false);
    setExerciseStatsError(null);
    setIsLoadingExerciseStats(false);
  }, []);

  useEffect(() => {
    const exerciseIdsToPrefetch = [...new Set(activeExercises.map((entry) => entry.exercise.id.trim()).filter(Boolean))].filter(
      (exerciseId) =>
        !requestedProgressExerciseIdsRef.current.has(exerciseId) &&
        !exerciseProgressCacheRef.current.has(exerciseId)
    );

    if (exerciseIdsToPrefetch.length === 0) {
      return;
    }

    for (const exerciseId of exerciseIdsToPrefetch) {
      requestedProgressExerciseIdsRef.current.add(exerciseId);
    }

    void Promise.all(
      exerciseIdsToPrefetch.map(async (exerciseId) => {
        try {
          const progressPoints = await getExerciseProgress(exerciseId, 'volume');
          exerciseProgressCacheRef.current.set(exerciseId, progressPoints);
        } catch {
          // Silent prefetch failure; modal load will show actionable errors.
        }
      })
    );
  }, [activeExercises]);

  const removeExercise = useCallback(
    (exerciseIndex: number) => {
      const exerciseId = activeExercisesRef.current[exerciseIndex]?.id;

      setActiveExercisesWithRef((currentValue) => currentValue.filter((_, index) => index !== exerciseIndex));

      if (exerciseId) {
        setExerciseStopwatchById((currentValue) => {
          if (!currentValue[exerciseId]) {
            return currentValue;
          }

          const nextValue = { ...currentValue };
          delete nextValue[exerciseId];
          return nextValue;
        });
      }
    },
    [activeExercisesRef, setActiveExercisesWithRef]
  );

  const moveExercise = useCallback(
    (exerciseIndex: number, direction: 'up' | 'down') => {
      setActiveExercisesWithRef((currentValue) => {
        const targetIndex = direction === 'up' ? exerciseIndex - 1 : exerciseIndex + 1;

        if (exerciseIndex < 0 || exerciseIndex >= currentValue.length) {
          return currentValue;
        }

        if (targetIndex < 0 || targetIndex >= currentValue.length) {
          return currentValue;
        }

        const nextValue = [...currentValue];
        const currentExercise = nextValue[exerciseIndex];
        nextValue[exerciseIndex] = nextValue[targetIndex];
        nextValue[targetIndex] = currentExercise;
        return nextValue;
      });
    },
    [setActiveExercisesWithRef]
  );

  async function handleCreateExercise() {
    const normalizedName = sanitizeText(newExerciseName, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });
    const normalizedMuscleGroup = sanitizeText(newExerciseMuscleGroup, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: true,
    });
    const normalizedEquipment = sanitizeText(newExerciseEquipment, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: true,
    });

    if (!normalizedName) {
      Alert.alert('Validation', 'Exercise name is required.');
      return;
    }

    setIsCreatingExercise(true);

    try {
      const createdExercise = await createExercise({
        name: normalizedName,
        muscleGroup: normalizedMuscleGroup,
        equipment: normalizedEquipment,
      });

      setNewExerciseName('');
      setNewExerciseMuscleGroup('');
      setNewExerciseEquipment('');
      setCreateExerciseVisible(false);

      exerciseCatalogByFilterRef.current.clear();
      await loadExercises({ muscle: selectedMuscleFilter, equipment: selectedEquipmentFilter }, true);
      addExercise(createdExercise);
      setExercisePickerVisible(false);
    } catch (error) {
      Alert.alert('Unable to create exercise', getErrorMessage(error));
    } finally {
      setIsCreatingExercise(false);
    }
  }

  async function handleFinishWorkout() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const finishSnapshot = activeExercisesRef.current.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((setItem) => {
          const hasFilledData = setItem.weightInput.trim() !== '' || setItem.repsInput.trim() !== '';
          if (!setItem.completed && hasFilledData) {
            return { ...setItem, completed: true };
          }
          return { ...setItem };
        }),
      }));

      const setDrafts = buildWorkoutSetDrafts(finishSnapshot);
      const completedSetCount = setDrafts.filter((draft) => draft.completed === true).length;

      if (completedSetCount === 0) {
        Alert.alert('No completed sets', 'Mark at least one set as completed before finishing the workout.');
        return;
      }

      const result = await finishWorkout({
        name: 'Active Workout',
        notes: null,
        templateId: routeTemplateId ?? null,
        startTime: workoutStartedAt,
        setDrafts,
      });

      if (result.insertedSetCount <= 0) {
        Alert.alert('Workout not saved', 'No completed sets were saved. Please try again.');
        return;
      }

      setFinishSummary(result);
      setSummaryExerciseNames(getCompletedExerciseNames(finishSnapshot));
      setIsSummaryVisible(true);
      await clearDraft();
    } catch (error) {
      if (error instanceof WorkoutSaveValidationError) {
        Alert.alert('Workout not saved', error.message);
        return;
      }

      Alert.alert('Unable to finish workout', getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleShareAndFinish = useCallback(() => {
    safeDeactivateKeepAwake();
    setIsSummaryVisible(false);
    setFinishSummary(null);
    setSummaryExerciseNames([]);
    setExerciseStopwatchById({});

    // Reset state defensively to avoid phantom in-memory workout state.
    clearExercises();
    setExercisePickerVisible(false);
    setCreateExerciseVisible(false);

    router.replace('/(tabs)' as any);
  }, [clearExercises, safeDeactivateKeepAwake]);

  const routePreloadLabel = routeTemplateId ? 'template' : 'routine';
  const isPreloadingRoute = routeTemplateId ? isPreloadingTemplate : isPreloadingRoutine;
  const routePreloadError = routeTemplateId ? templatePreloadError : routinePreloadError;

  // Show recovery dialog as soon as a draft is detected
  useEffect(() => {
    if (!recoveredDraft) return;

    const savedAt = new Date(recoveredDraft.draft.savedAt).toLocaleTimeString();
    Alert.alert(
      'Recover Workout?',
      `An unsaved workout was found (saved at ${savedAt}). Do you want to continue where you left off?`,
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => { void discardRecoveredDraft(); },
        },
        {
          text: 'Recover',
          style: 'default',
          onPress: () => { acceptRecoveredDraft(recoveredDraft); },
        },
      ],
      { cancelable: false }
    );
  }, [recoveredDraft, acceptRecoveredDraft, discardRecoveredDraft]);

  return (
    <SafeAreaView style={[styles.safeArea, isWeb && styles.safeAreaWeb]} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={[styles.container, isWeb && styles.containerWeb]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="close" size={26} color={palette.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.timerText}>{timerLabel}</Text>

          <TouchableOpacity
            style={[styles.finishButton, isSubmitting && styles.finishButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleFinishWorkout}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={palette.textPrimary} />
            ) : (
              <Text style={styles.finishButtonText}>Finish</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={!isDesktopWeb}
        >
          {isPreloadingRoute && activeExercises.length === 0 ? (
            <View style={styles.statusCard}>
              <ActivityIndicator size="small" color={palette.accent} />
              <Text style={styles.statusTitle}>{`Loading ${routePreloadLabel}...`}</Text>
              <Text style={styles.statusSubtitle}>Preparing your exercises with default sets.</Text>
            </View>
          ) : routePreloadError && activeExercises.length === 0 ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>{`Unable to load ${routePreloadLabel}`}</Text>
              <Text style={styles.statusSubtitle}>{routePreloadError}</Text>
              {(routeTemplateId || routeRoutineId) ? (
                <TouchableOpacity
                  style={styles.statusRetryButton}
                  activeOpacity={0.88}
                  onPress={() => {
                    if (routeTemplateId) {
                      void preloadTemplate(routeTemplateId, true);
                      return;
                    }

                    if (routeRoutineId) {
                      void preloadRoutine(routeRoutineId, true);
                    }
                  }}
                >
                  <Text style={styles.statusRetryButtonText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : activeExercises.length === 0 ? (
            <View style={styles.emptyWorkoutCard}>
              <Text style={styles.emptyWorkoutTitle}>No exercises yet</Text>
              <Text style={styles.emptyWorkoutSubtitle}>Add an exercise to start logging your sets.</Text>
            </View>
          ) : (
            activeExercises.map((exercise, exerciseIndex) => {
              const exerciseStopwatchSeconds = getExerciseStopwatchSeconds(exercise.id);
              const isExerciseStopwatchActive = isExerciseStopwatchRunning(exercise.id);

              return (
                <View key={exercise.id} style={styles.exerciseCard}>
                  <Animated.View
                    style={[
                      styles.exerciseCompletionGlow,
                      styles.pointerEventsNone,
                      {
                        opacity: getExerciseCompletionGlowValue(exercise.id),
                      },
                    ]}
                  />

                  <View style={styles.exerciseHeaderRow}>
                    <View style={styles.exerciseHeaderTextWrap}>
                      <Text style={styles.exerciseTitle}>{exercise.exercise.name}</Text>
                    </View>

                    <View style={styles.exerciseHeaderActions}>
                      <TouchableOpacity
                        style={[
                          styles.exerciseStopwatchButton,
                          isExerciseStopwatchActive && styles.exerciseStopwatchButtonActive,
                        ]}
                        activeOpacity={0.86}
                        onPress={() => toggleExerciseStopwatch(exercise.id)}
                      >
                        <Ionicons
                          name={isExerciseStopwatchActive ? 'stopwatch' : 'stopwatch-outline'}
                          size={15}
                          color={isExerciseStopwatchActive ? '#7DD3FC' : palette.textSecondary}
                        />
                        <Text
                          style={[
                            styles.exerciseStopwatchText,
                            isExerciseStopwatchActive && styles.exerciseStopwatchTextActive,
                          ]}
                        >
                          {formatElapsedTime(exerciseStopwatchSeconds)}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.exerciseActionButton, exerciseIndex === 0 && styles.exerciseActionButtonDisabled]}
                        activeOpacity={0.86}
                        onPress={() => moveExercise(exerciseIndex, 'up')}
                        disabled={exerciseIndex === 0}
                      >
                        <Ionicons name="arrow-up" size={16} color={palette.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.exerciseActionButton,
                          exerciseIndex === activeExercises.length - 1 && styles.exerciseActionButtonDisabled,
                        ]}
                        activeOpacity={0.86}
                        onPress={() => moveExercise(exerciseIndex, 'down')}
                        disabled={exerciseIndex === activeExercises.length - 1}
                      >
                        <Ionicons name="arrow-down" size={16} color={palette.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.exerciseActionButton, styles.exerciseActionButtonDanger]}
                        activeOpacity={0.86}
                        onPress={() => removeExercise(exerciseIndex)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FCA5A5" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.exerciseStatsButton}
                        activeOpacity={0.86}
                        onPress={() => openExerciseStatsModal(exercise.exercise)}
                      >
                        <Ionicons name="stats-chart-outline" size={18} color={palette.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    <Text style={[styles.headerLabel, styles.cellSet]}>Set</Text>
                    <Text style={[styles.headerLabel, styles.cellKg]}>kg</Text>
                    <Text style={[styles.headerLabel, styles.cellReps]}>Reps</Text>
                    <Text style={[styles.headerLabel, styles.cellRir]}>RIR</Text>
                    <View style={styles.cellCheck}>
                      <Ionicons name="checkmark" size={15} color={palette.textMuted} />
                    </View>
                  </View>

                  {exercise.sets.map((setItem) => {
                    return (
                      <View key={setItem.id} style={styles.setRowWrapper}>
                        <View style={[styles.tableRow, setItem.completed && styles.completedRow]}>
                          <View style={styles.cellSet}>
                            <Text style={styles.setNumberText}>{setItem.set_number ?? '-'}</Text>
                          </View>

                          <TextInput
                            value={setItem.weightInput}
                            onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'weightInput', value)}
                            style={[styles.numericInput, styles.kgInput, setItem.completed && styles.numericInputCompleted]}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={palette.textMuted}
                          />

                          <TextInput
                            value={setItem.repsInput}
                            onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'repsInput', value)}
                            style={[styles.numericInput, styles.cellReps, setItem.completed && styles.numericInputCompleted]}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={palette.textMuted}
                          />

                          <TextInput
                            value={setItem.rirInput}
                            onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'rirInput', value)}
                            style={[styles.numericInput, styles.cellRir, setItem.completed && styles.numericInputCompleted]}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={palette.textMuted}
                          />

                          <View style={styles.cellCheck}>
                            <TouchableOpacity
                              style={[styles.checkButton, setItem.completed && styles.checkButtonCompleted]}
                              activeOpacity={0.85}
                              onPress={() => handleSetCompletionToggle(exercise.id, setItem.id)}
                            >
                              <Ionicons
                                name={setItem.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                size={22}
                                color={setItem.completed ? palette.accent : palette.textMuted}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  <TouchableOpacity style={styles.addSetButton} activeOpacity={0.88} onPress={() => addSet(exercise.id)}>
                    <Ionicons name="add" size={16} color={palette.textSecondary} />
                    <Text style={styles.addSetText}>Add Set</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.bottomActionArea, { bottom: insets.bottom + 12 }]}> 
          <TouchableOpacity
            style={styles.addExerciseButton}
            activeOpacity={0.9}
            onPress={() => setExercisePickerVisible(true)}
          >
            <Ionicons name="add" size={22} color={palette.textPrimary} />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={exercisePickerVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={() => setExercisePickerVisible(false)}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={() => setExercisePickerVisible(false)} />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Exercise</Text>
              <TouchableOpacity
                style={styles.modalCustomButton}
                activeOpacity={0.88}
                onPress={() => setCreateExerciseVisible(true)}
              >
                <Text style={styles.modalCustomButtonText}>+ Custom</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalHandle} />

            <Text style={styles.filterChipsSectionLabel}>Muscle</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterChipsScroll}
              contentContainerStyle={styles.filterChipsContent}
            >
              {MUSCLE_FILTER_CHIP_OPTIONS.map((option) => {
                const isSelected = option.key === selectedMuscleFilter;

                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    activeOpacity={0.88}
                    onPress={() => setSelectedMuscleFilter(option.key)}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.filterChipsSectionLabel}>Equipment</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterChipsScroll}
              contentContainerStyle={styles.filterChipsContent}
            >
              {EQUIPMENT_FILTER_CHIP_OPTIONS.map((option) => {
                const isSelected = option.key === selectedEquipmentFilter;

                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    activeOpacity={0.88}
                    onPress={() => setSelectedEquipmentFilter(option.key)}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {isLoadingExercises ? (
                <View style={styles.modalStatusContainer}>
                  <ActivityIndicator size="small" color={palette.accent} />
                  <Text style={styles.modalStatusText}>Loading exercise catalog...</Text>
                </View>
              ) : exerciseLoadError ? (
                <View style={styles.modalStatusContainer}>
                  <Text style={styles.modalStatusTitle}>Unable to load exercises</Text>
                  <Text style={styles.modalStatusText}>{exerciseLoadError}</Text>
                  <TouchableOpacity
                    style={styles.modalRetryButton}
                    onPress={() =>
                      void loadExercises({ muscle: selectedMuscleFilter, equipment: selectedEquipmentFilter }, true)
                    }
                    activeOpacity={0.88}
                  >
                    <Text style={styles.modalRetryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : catalogExercises.length === 0 ? (
                <View style={styles.modalStatusContainer}>
                  <Text style={styles.modalStatusTitle}>No exercises available</Text>
                  <Text style={styles.modalStatusText}>Create exercises to start building workouts.</Text>
                </View>
              ) : (
                catalogExercises.map((exercise) => (
                  <TouchableOpacity
                    key={exercise.id}
                    style={styles.modalExerciseRow}
                    activeOpacity={0.88}
                    onPress={() => {
                      addExercise(exercise);
                      setExercisePickerVisible(false);
                    }}
                  >
                    <View style={styles.modalExerciseTextWrap}>
                      <Text style={styles.modalExerciseName}>{exercise.name}</Text>
                      <Text style={styles.modalExerciseMeta}>
                        {exercise.muscle_group ?? 'General'} - {exercise.equipment ?? 'Bodyweight'}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={palette.accent} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createExerciseVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={() => setCreateExerciseVisible(false)}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={() => setCreateExerciseVisible(false)} />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Exercise</Text>

            <TextInput
              value={newExerciseName}
              onChangeText={(value) => setNewExerciseName(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder="Name"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />
            <TextInput
              value={newExerciseMuscleGroup}
              onChangeText={(value) => setNewExerciseMuscleGroup(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder="Muscle Group"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />
            <TextInput
              value={newExerciseEquipment}
              onChangeText={(value) => setNewExerciseEquipment(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder="Equipment"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setCreateExerciseVisible(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isCreatingExercise && styles.modalCreateButtonDisabled]}
                onPress={() => void handleCreateExercise()}
                activeOpacity={0.88}
                disabled={isCreatingExercise}
              >
                {isCreatingExercise ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isExerciseStatsVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={closeExerciseStatsModal}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={closeExerciseStatsModal} />

          <View style={[styles.liveStatsSheet, isWeb && styles.liveStatsSheetWeb]}>
            <View style={styles.modalHandle} />

            <View style={styles.liveStatsHeaderRow}>
              <View style={styles.liveStatsHeaderTextWrap}>
                <Text style={styles.liveStatsTitle}>{statsExercise ? statsExercise.name : 'Live Stats'}</Text>
                <Text style={styles.liveStatsSubtitle}>Recent volume trend while you train.</Text>
              </View>

              <TouchableOpacity style={styles.liveStatsCloseButton} activeOpacity={0.88} onPress={closeExerciseStatsModal}>
                <Ionicons name="close" size={18} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>

            {isLoadingExerciseStats ? (
              <View style={styles.liveStatsStatusWrap}>
                <ActivityIndicator size="small" color={LIVE_CHART_COLOR} />
                <Text style={styles.liveStatsStatusText}>Loading evolution chart...</Text>
              </View>
            ) : exerciseStatsError ? (
              <View style={styles.liveStatsStatusWrap}>
                <Text style={styles.liveStatsStatusTitle}>Unable to load live stats</Text>
                <Text style={styles.liveStatsStatusText}>{exerciseStatsError}</Text>
                <TouchableOpacity
                  style={styles.liveStatsRetryButton}
                  activeOpacity={0.88}
                  onPress={() => {
                    if (statsExercise) {
                      void loadExerciseProgressForModal(statsExercise, true);
                    }
                  }}
                >
                  <Text style={styles.liveStatsRetryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : liveStatsChartData.length === 0 ? (
              <View style={styles.liveStatsStatusWrap}>
                <Text style={styles.liveStatsStatusText}>No completed sessions yet for this exercise.</Text>
              </View>
            ) : (
              <View style={styles.liveChartCard}>
                <LineChart
                  data={liveStatsChartData}
                  width={liveChartWidth}
                  color={LIVE_CHART_COLOR}
                  thickness={3}
                  hideDataPoints={false}
                  dataPointsColor={LIVE_CHART_COLOR}
                  dataPointsRadius={4}
                  areaChart
                  startFillColor={LIVE_CHART_COLOR}
                  startOpacity={0.22}
                  endFillColor={LIVE_CHART_COLOR}
                  endOpacity={0.02}
                  yAxisColor="#253041"
                  xAxisColor="#253041"
                  yAxisTextStyle={styles.liveStatsAxisText}
                  xAxisLabelTextStyle={styles.liveStatsAxisText}
                  rulesColor="#1F2937"
                  noOfSections={4}
                  initialSpacing={14}
                  endSpacing={14}
                  adjustToWidth
                />
                <Text style={styles.liveStatsFootnote}>{`Showing last ${liveStatsChartData.length} sessions`}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <WorkoutSummary
        visible={isSummaryVisible && finishSummary !== null}
        durationSeconds={finishSummary?.durationSeconds ?? 0}
        prCount={finishSummary?.prCount ?? 0}
        completedSetCount={finishSummary?.completedSetCount ?? 0}
        exerciseNames={summaryExerciseNames}
        onShareAndFinish={handleShareAndFinish}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ROOT_SCREEN_BG,
  },
  safeAreaWeb: {
    alignItems: 'center',
    width: '100%',
    height: '100%',
    minHeight: '100%',
    backgroundColor: ROOT_SCREEN_BG,
  },
  container: {
    flex: 1,
    backgroundColor: ROOT_SCREEN_BG,
  },
  containerWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: ROOT_SCREEN_BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  timerText: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  finishButton: {
    backgroundColor: palette.accent,
    minHeight: 38,
    minWidth: 78,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  finishButtonDisabled: {
    opacity: 0.7,
  },
  finishButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 150,
    gap: 12,
  },
  emptyWorkoutCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 18,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWorkoutTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyWorkoutSubtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  statusSubtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  statusRetryButton: {
    marginTop: 14,
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  statusRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 12,
  },
  exerciseCompletionGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#67E8F9',
  },
  pointerEventsNone: {
    pointerEvents: 'none',
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
    columnGap: 10,
  },
  exerciseHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  exerciseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    flexShrink: 0,
  },
  exerciseStopwatchButton: {
    minWidth: 70,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0E2238',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 4,
    paddingHorizontal: 8,
  },
  exerciseStopwatchButtonActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#0D2A45',
  },
  exerciseStopwatchText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  exerciseStopwatchTextActive: {
    color: '#BAE6FD',
  },
  exerciseActionButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseActionButtonDisabled: {
    opacity: 0.36,
  },
  exerciseActionButtonDanger: {
    borderColor: '#7F1D1D',
    backgroundColor: '#2A1118',
  },
  exerciseTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  exerciseStatsButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    columnGap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    minWidth: 0,
    overflow: 'hidden',
  },
  setRowWrapper: {
    marginBottom: 2,
  },
  tableHeaderRow: {
    backgroundColor: '#0D1624',
    borderRadius: 12,
    borderBottomWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 4,
  },
  headerLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  completedRow: {
    backgroundColor: '#13273F',
    borderRadius: 10,
  },
  cellSet: {
    width: 38,
    minWidth: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  setNumberText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  cellKg: {
    flex: 1.2,
    minWidth: 58,
  },
  kgInput: {
    flex: 1.2,
    minWidth: 58,
  },
  cellReps: {
    flex: 1,
    minWidth: 44,
  },
  cellRir: {
    flex: 1,
    minWidth: 44,
  },
  numericInput: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    color: palette.textPrimary,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 4,
    fontVariant: ['tabular-nums'],
    minWidth: 0,
    flexShrink: 1,
  },
  numericInputCompleted: {
    borderColor: '#3B82F6',
    backgroundColor: '#1D3550',
  },
  cellCheck: {
    width: 36,
    minWidth: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButton: {
    width: 34,
    height: 34,
    minWidth: 34,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
  },
  checkButtonCompleted: {
    backgroundColor: '#17345C',
  },
  addSetButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 6,
  },
  addSetText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomActionArea: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  addExerciseButton: {
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  addExerciseText: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.overlay,
  },
  modalBackdropWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    left: 0,
    right: 0,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    maxHeight: '76%',
    backgroundColor: palette.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  modalSheetWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: palette.surface,
  },
  liveStatsSheet: {
    maxHeight: '72%',
    backgroundColor: palette.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  liveStatsSheetWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: palette.surface,
  },
  liveStatsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveStatsHeaderTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  liveStatsTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 3,
  },
  liveStatsSubtitle: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  liveStatsCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveStatsStatusWrap: {
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 14,
    backgroundColor: '#0D1624',
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  liveStatsStatusTitle: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  liveStatsStatusText: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  liveStatsRetryButton: {
    marginTop: 12,
    backgroundColor: palette.accent,
    borderRadius: 12,
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveStatsRetryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  liveChartCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0D1624',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  liveStatsAxisText: {
    color: '#8FA2BA',
    fontSize: 11,
  },
  liveStatsFootnote: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.borderStrong,
    marginBottom: 12,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalCustomButton: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 4,
  },
  modalCustomButtonText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalList: {
    flexGrow: 0,
  },
  filterChipsSectionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 4,
  },
  filterChipsScroll: {
    maxHeight: 44,
    marginBottom: 10,
  },
  filterChipsContent: {
    columnGap: 8,
    paddingRight: 4,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  filterChipSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#122744',
  },
  filterChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: '#EAF1FF',
  },
  modalStatusContainer: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStatusTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalStatusText: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  modalRetryButton: {
    marginTop: 12,
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalRetryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalExerciseRow: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalExerciseTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  modalExerciseName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  modalExerciseMeta: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  modalInput: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    color: palette.textPrimary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 10,
    marginTop: 6,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bgPrimary,
  },
  modalCancelButtonText: {
    color: palette.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  modalCreateButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
  },
  modalCreateButtonDisabled: {
    opacity: 0.75,
  },
  modalCreateButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
