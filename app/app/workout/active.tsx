import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/theme';
import { ACTIVE_OPACITY, HIT_SLOP, Radius, Spacing } from '@/constants/Styles';
import {
  EXERCISE_EQUIPMENT_OPTIONS,
  EXERCISE_EQUIPMENT_TRANSLATION_KEY,
  EXERCISE_MUSCLE_OPTIONS,
  EXERCISE_MUSCLE_TRANSLATION_KEY,
  type ExerciseEquipmentKey,
  type ExerciseMuscleKey,
  getExerciseMuscleTranslationKey,
  getEquipmentTranslationKey,
} from '@/constants/exerciseCatalog';
import { usePreferences } from '@/context/PreferencesContext';
import {
  createExercise,
  type ExerciseCatalogFilters,
  type ExerciseLibraryEquipmentFilter,
  type ExerciseLibraryMuscleFilter,
  getErrorMessage,
  getExercisesByIds,
  getExercisesCatalog,
  getLastExerciseRestTimes,
  getRecentExerciseIds,
  getRoutineById,
  getWorkoutDetails,
} from '@/services/workoutService';
import { finishWorkout } from '@/services/sessionRepository';
import { getTemplateById } from '@/services/templateService';
import {
  WorkoutSaveValidationError,
  type FinishWorkoutResult,
  type WorkoutSetProgressDraft,
} from '@/services/workoutSession.types';
import {
  createExerciseBlock,
  createExerciseBlockFromSets,
  normalizeSetTypeOption,
  getCompletedExerciseNames,
  type ActiveExercise,
  type CopySetSeed,
  type ExerciseRow,
} from '@/hooks/useActiveWorkoutState';
import { useWorkoutContext } from '@/context/WorkoutContext';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WorkoutSummary } from '@/components/workout/WorkoutSummary';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { ExerciseThumbnail } from '@/components/common/ExerciseThumbnail';
import {
  INPUT_LIMITS,
  sanitizeText,
  toSafeInteger,
  toSafeNumber,
} from '@/utils/inputValidation';
import { getLocalizedExerciseMuscle, getLocalizedExerciseName } from '@/utils/exerciseLocalization';
import { matchesExerciseSearch } from '@/utils/exerciseSearch';

const palette = Colors.dark;
const DESKTOP_WEB_MIN_WIDTH = 768;
const ROOT_SCREEN_BG = palette.bgPrimary;
const MUSCLE_FILTER_CHIP_KEYS: readonly (ExerciseLibraryMuscleFilter | 'recent')[] = [
  'all',
  'recent',
  ...EXERCISE_MUSCLE_OPTIONS,
];
const EQUIPMENT_FILTER_CHIP_KEYS: readonly ExerciseLibraryEquipmentFilter[] = [
  'all',
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
];

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
      side: setItem.side ?? 'both',
    }))
  );
}

function buildExerciseNotesMap(exercises: ActiveExercise[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const exercise of exercises) {
    const id = exercise.exercise.id?.trim();
    if (!id) continue;
    const trimmed = (exercise.notes ?? '').trim();
    result[id] = trimmed.length > 0 ? trimmed : null;
  }
  return result;
}

function buildCatalogCacheKey(filters: ExerciseCatalogFilters): string {
  const muscle = filters.muscle ?? 'all';
  const equipment = filters.equipment ?? 'all';

  return `${muscle}::${equipment}`;
}

export default function ActiveWorkout() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && windowWidth > DESKTOP_WEB_MIN_WIDTH;
  const modalAnimationType: 'fade' | 'slide' = isWeb ? 'fade' : 'slide';
  const searchParams = useLocalSearchParams<{
    routineId?: string | string[];
    templateId?: string | string[];
    copyFromWorkoutId?: string | string[];
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

  const routeCopyFromWorkoutId = useMemo(() => {
    const rawWorkoutId = searchParams.copyFromWorkoutId;

    if (Array.isArray(rawWorkoutId)) {
      return rawWorkoutId[0];
    }

    return rawWorkoutId;
  }, [searchParams.copyFromWorkoutId]);

  const {
    workoutStartedAtMs,
    elapsedSeconds,
    safeDeactivateKeepAwake,
    ensureWorkoutStarted,
    activeTemplateId,
    setActiveTemplateId,
    activeExercises,
    activeExercisesRef,
    setActiveExercisesWithRef,
    handleSetCompletionToggle,
    updateSetInput,
    updateSetSide,
    updateExerciseNotes,
    addSet,
    removeSet,
    addExercise,
    clearExercises,
    getExerciseCompletionGlowValue,
    recoveredDraft,
    clearDraft,
    acceptRecoveredDraft,
    discardRecoveredDraft,
    isExerciseStopwatchRunning,
    getExerciseStopwatchSeconds,
    getExerciseRestSecondsByExerciseId,
    toggleExerciseStopwatch,
    removeExercise,
    moveExercise,
    updateSetType,
    isTimerPaused,
    toggleTimerPause,
  } = useWorkoutContext();

  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [exercisePickerQuery, setExercisePickerQuery] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<ExerciseLibraryMuscleFilter | 'recent'>('all');
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState<ExerciseLibraryEquipmentFilter>('all');
  const [createExerciseVisible, setCreateExerciseVisible] = useState(false);
  const [catalogExercises, setCatalogExercises] = useState<ExerciseRow[]>([]);
  const [preloadedRoutineId, setPreloadedRoutineId] = useState<string | null>(null);
  const [preloadedTemplateId, setPreloadedTemplateId] = useState<string | null>(null);
  const [preloadedCopyWorkoutId, setPreloadedCopyWorkoutId] = useState<string | null>(null);
  const [isPreloadingRoutine, setIsPreloadingRoutine] = useState(false);
  const [isPreloadingTemplate, setIsPreloadingTemplate] = useState(false);
  const [isPreloadingCopyWorkout, setIsPreloadingCopyWorkout] = useState(false);
  const [routinePreloadError, setRoutinePreloadError] = useState<string | null>(null);
  const [templatePreloadError, setTemplatePreloadError] = useState<string | null>(null);
  const [copyWorkoutPreloadError, setCopyWorkoutPreloadError] = useState<string | null>(null);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [exerciseLoadError, setExerciseLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishModalVisible, setIsFinishModalVisible] = useState(false);
  const [hasManualWorkoutTitle, setHasManualWorkoutTitle] = useState(false);
  const [workoutTitleInput, setWorkoutTitleInput] = useState(() => t('workout.defaultActiveWorkoutName'));
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscleGroup, setNewExerciseMuscleGroup] = useState<ExerciseMuscleKey | null>(null);
  const [newExerciseEquipment, setNewExerciseEquipment] = useState<ExerciseEquipmentKey | null>(null);
  const [finishSummary, setFinishSummary] = useState<FinishWorkoutResult | null>(null);
  const [summaryExerciseNames, setSummaryExerciseNames] = useState<string[]>([]);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const [pendingDeleteSet, setPendingDeleteSet] = useState<{ exerciseId: string; setId: string; setNumber: number } | null>(null);
  const exerciseCatalogByFilterRef = useRef<Map<string, ExerciseRow[]>>(new Map());

  const timerLabel = useMemo(() => formatElapsedTime(elapsedSeconds), [elapsedSeconds]);

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

  const applySuggestedWorkoutTitle = useCallback((value: string | null | undefined) => {
    if (hasManualWorkoutTitle) {
      return;
    }

    const normalizedValue = sanitizeText(value, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: true,
    });

    setWorkoutTitleInput(normalizedValue ?? t('workout.defaultActiveWorkoutName'));
  }, [hasManualWorkoutTitle, t]);

  const loadRecentExercises = useCallback(async () => {
    setIsLoadingExercises(true);
    setExerciseLoadError(null);

    try {
      const [catalog, ids] = await Promise.all([
        getExercisesCatalog({ equipment: selectedEquipmentFilter }),
        getRecentExerciseIds(),
      ]);
      const idSet = new Set(ids);
      setCatalogExercises(catalog.filter((exercise) => idSet.has(exercise.id)));
    } catch (err) {
      setExerciseLoadError(getErrorMessage(err));
    } finally {
      setIsLoadingExercises(false);
    }
  }, [selectedEquipmentFilter]);

  useEffect(() => {
    if (!exercisePickerVisible) {
      return;
    }

    if (selectedMuscleFilter === 'recent') {
      void loadRecentExercises();
      return;
    }

    void loadExercises({ muscle: selectedMuscleFilter, equipment: selectedEquipmentFilter });
  }, [exercisePickerVisible, loadExercises, loadRecentExercises, selectedEquipmentFilter, selectedMuscleFilter]);

  const closeExercisePicker = useCallback(() => {
    setExercisePickerVisible(false);
    setExercisePickerQuery('');
  }, []);

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
      setActiveTemplateId(null);

      try {
        const routine = await getRoutineById(normalizedRoutineId);

        setActiveExercisesWithRef(routine.exercises.map((entry) => createExerciseBlock(entry.exercise)));
        setPreloadedRoutineId(routine.id);
        applySuggestedWorkoutTitle(routine.name);
      } catch (error) {
        setRoutinePreloadError(getErrorMessage(error));
      } finally {
        setIsPreloadingRoutine(false);
      }
    },
    [applySuggestedWorkoutTitle, preloadedRoutineId, setActiveExercisesWithRef, setActiveTemplateId]
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
      setActiveTemplateId(normalizedTemplateId);

      try {
        const template = await getTemplateById(normalizedTemplateId);
        let restSeedByExerciseId: Record<string, number> = {};

        try {
          restSeedByExerciseId = await getLastExerciseRestTimes(
            template.exercises.map((entry) => entry.exercise.id)
          );
        } catch (error) {
          console.warn('Unable to load rest history for template preload:', error);
        }

        setActiveExercisesWithRef(
          template.exercises.map((entry) =>
            createExerciseBlock(entry.exercise, restSeedByExerciseId[entry.exercise.id] ?? 0)
          )
        );
        setPreloadedTemplateId(template.id);
        applySuggestedWorkoutTitle(template.name);
      } catch (error) {
        setTemplatePreloadError(getErrorMessage(error));
      } finally {
        setIsPreloadingTemplate(false);
      }
    },
    [applySuggestedWorkoutTitle, preloadedTemplateId, setActiveExercisesWithRef, setActiveTemplateId]
  );

  const preloadFromPastWorkout = useCallback(
    async (workoutId: string, force = false) => {
      const normalizedWorkoutId = workoutId.trim();

      if (!normalizedWorkoutId) {
        return;
      }

      if (!force && preloadedCopyWorkoutId === normalizedWorkoutId) {
        return;
      }

      setIsPreloadingCopyWorkout(true);
      setCopyWorkoutPreloadError(null);

      try {
        const details = await getWorkoutDetails(normalizedWorkoutId);

        const uniqueExerciseIds = [...new Set(details.exercises.map((entry) => entry.exercise_id).filter(Boolean))];
        const catalogRows = uniqueExerciseIds.length > 0 ? await getExercisesByIds(uniqueExerciseIds) : [];
        const catalogById = new Map(catalogRows.map((row) => [row.id, row] as const));

        const blocks = details.exercises
          .filter((entry) => catalogById.has(entry.exercise_id))
          .map((entry) => {
            const exerciseRow = catalogById.get(entry.exercise_id)!;
            const seeds: CopySetSeed[] = entry.sets.map((setItem) => ({
              setType: setItem.set_type,
              weight: setItem.weight,
              reps: setItem.reps,
              rir: setItem.rir,
              side: setItem.side,
            }));

            return createExerciseBlockFromSets(exerciseRow, seeds, {
              defaultRestSeconds: entry.rest_time ?? undefined,
              // Keep notes from that past session (equipment settings, unilateral notes, etc.).
              notes: entry.notes ?? exerciseRow.description ?? null,
            });
          });

        setActiveExercisesWithRef(blocks);
        setPreloadedCopyWorkoutId(normalizedWorkoutId);
        applySuggestedWorkoutTitle(details.name);
      } catch (error) {
        setCopyWorkoutPreloadError(getErrorMessage(error));
      } finally {
        setIsPreloadingCopyWorkout(false);
      }
    },
    [applySuggestedWorkoutTitle, preloadedCopyWorkoutId, setActiveExercisesWithRef]
  );

  useEffect(() => {
    if (routeCopyFromWorkoutId) {
      void preloadFromPastWorkout(routeCopyFromWorkoutId);
      return;
    }

    if (routeTemplateId) {
      void preloadTemplate(routeTemplateId);
      return;
    }

    if (routeRoutineId) {
      void preloadRoutine(routeRoutineId);
    }
  }, [preloadFromPastWorkout, preloadRoutine, preloadTemplate, routeCopyFromWorkoutId, routeRoutineId, routeTemplateId]);

  const openExerciseStatsModal = useCallback(
    (exercise: ExerciseRow) => {
      router.push(`/exercise/${exercise.id}` as any);
    },
    []
  );

  async function handleCreateExercise() {
    const normalizedName = sanitizeText(newExerciseName, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });

    if (!normalizedName) {
      Alert.alert(t('validation.title'), t('validation.exerciseNameRequired'));
      return;
    }

    if (!newExerciseMuscleGroup) {
      Alert.alert(t('validation.title'), t('validation.selectMuscleGroup'));
      return;
    }

    if (!newExerciseEquipment) {
      Alert.alert(t('validation.title'), t('validation.selectEquipment'));
      return;
    }

    setIsCreatingExercise(true);

    try {
      const createdExercise = await createExercise({
        name: normalizedName,
        muscleGroup: newExerciseMuscleGroup,
        equipment: newExerciseEquipment,
      });

      setNewExerciseName('');
      setNewExerciseMuscleGroup(null);
      setNewExerciseEquipment(null);
      setCreateExerciseVisible(false);

      exerciseCatalogByFilterRef.current.clear();
      const muscleParam = selectedMuscleFilter === 'recent' ? 'all' : selectedMuscleFilter;
      await loadExercises({ muscle: muscleParam, equipment: selectedEquipmentFilter }, true);
      addExercise(createdExercise);
      setExercisePickerVisible(false);
    } catch (error) {
      Alert.alert(t('exercise.errors.create'), getErrorMessage(error));
    } finally {
      setIsCreatingExercise(false);
    }
  }

  const openFinishModal = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!workoutTitleInput.trim()) {
      setWorkoutTitleInput(t('workout.defaultActiveWorkoutName'));
    }

    setIsFinishModalVisible(true);
  }, [isSubmitting, t, workoutTitleInput]);

  async function handleFinishWorkout() {
    if (isSubmitting) {
      return;
    }

    const normalizedWorkoutName = sanitizeText(workoutTitleInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: true,
    }) ?? t('workout.defaultActiveWorkoutName');

    setIsFinishModalVisible(false);
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
        Alert.alert(t('workout.noCompletedSetsTitle'), t('workout.noCompletedSetsDescription'));
        return;
      }

      const startedAtMs = workoutStartedAtMs ?? ensureWorkoutStarted();
      const startTime = new Date(startedAtMs).toISOString();

      const result = await finishWorkout({
        name: normalizedWorkoutName,
        notes: null,
        templateId: activeTemplateId ?? routeTemplateId ?? null,
        exerciseRestSecondsByExerciseId: getExerciseRestSecondsByExerciseId(),
        notesByExerciseId: buildExerciseNotesMap(finishSnapshot),
        startTime,
        setDrafts,
      });

      if (result.insertedSetCount <= 0) {
        Alert.alert(t('workout.notSavedTitle'), t('workout.notSavedDescription'));
        return;
      }

      setFinishSummary(result);
      setSummaryExerciseNames(getCompletedExerciseNames(finishSnapshot));
      setIsSummaryVisible(true);
      await clearDraft();
    } catch (error) {
      if (error instanceof WorkoutSaveValidationError) {
        Alert.alert(t('workout.notSavedTitle'), error.message);
        return;
      }

      Alert.alert(t('workout.unableToFinish'), getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const confirmCancelWorkout = useCallback(async (): Promise<boolean> => {
    const title = t('workout.cancelConfirmTitle');
    const message = t('workout.cancelConfirmDescription');

    if (Platform.OS === 'web') {
      const confirmFn = (globalThis as { confirm?: (value?: string) => boolean }).confirm;
      return confirmFn ? confirmFn(`${title}\n\n${message}`) : true;
    }

    return await new Promise((resolve) => {
      Alert.alert(title, message, [
        {
          text: t('workout.cancelKeepAction'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: t('workout.cancelDiscardAction'),
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ], { cancelable: false });
    });
  }, [t]);

  const handleCancelWorkout = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    const shouldCancel = await confirmCancelWorkout();

    if (!shouldCancel) {
      return;
    }

    clearExercises();
    safeDeactivateKeepAwake();
    setExercisePickerVisible(false);
    setCreateExerciseVisible(false);

    try {
      await clearDraft();
    } catch (error) {
      console.warn('Unable to clear workout draft during cancel:', error);
    }

    router.replace('/(tabs)' as any);
  }, [clearDraft, clearExercises, confirmCancelWorkout, isSubmitting, safeDeactivateKeepAwake]);

  const handleShareAndFinish = useCallback(() => {
    safeDeactivateKeepAwake();
    setIsSummaryVisible(false);
    setFinishSummary(null);
    setSummaryExerciseNames([]);

    // Reset state defensively to avoid phantom in-memory workout state.
    clearExercises();
    setExercisePickerVisible(false);
    setCreateExerciseVisible(false);

    router.replace('/(tabs)' as any);
  }, [clearExercises, safeDeactivateKeepAwake]);

  const routePreloadLabel = routeCopyFromWorkoutId
    ? t('workout.routeCopyLabel')
    : routeTemplateId
      ? t('workout.routeTemplateLabel')
      : t('workout.routeRoutineLabel');
  const isPreloadingRoute = routeCopyFromWorkoutId
    ? isPreloadingCopyWorkout
    : routeTemplateId
      ? isPreloadingTemplate
      : isPreloadingRoutine;
  const routePreloadError = routeCopyFromWorkoutId
    ? copyWorkoutPreloadError
    : routeTemplateId
      ? templatePreloadError
      : routinePreloadError;

  const getExerciseMuscleLabel = (exercise: ExerciseRow): string => {
    const muscleKey = getExerciseMuscleTranslationKey({
      muscleGroup: exercise.muscle_group,
      muscleEn: exercise.muscle_en,
      musclePt: exercise.muscle_pt,
      name: exercise.name,
      nameEn: exercise.name_en,
      namePt: exercise.name_pt,
    });

    return muscleKey ? t(muscleKey) : getLocalizedExerciseMuscle(exercise, language) ?? t('exercise.general');
  };

  const getExerciseEquipmentLabel = (exercise: ExerciseRow): string => {
    const equipmentKey = getEquipmentTranslationKey(exercise.equipment);
    return equipmentKey ? t(equipmentKey) : exercise.equipment ?? t('exercise.equipment.bodyweight');
  };

  const filteredCatalogExercises = useMemo(() => {
    return catalogExercises.filter((exercise) =>
      matchesExerciseSearch(
        exercise,
        exercisePickerQuery,
        getLocalizedExerciseName(exercise, language),
        getExerciseMuscleLabel(exercise)
      )
    );
  }, [catalogExercises, exercisePickerQuery, language, t]);

  const getMuscleFilterLabel = (filterKey: ExerciseLibraryMuscleFilter | 'recent'): string => {
    if (filterKey === 'all') {
      return language === 'pt' ? 'Todos' : 'All';
    }
    if (filterKey === 'recent') {
      return language === 'pt' ? 'Recentes' : 'Recent';
    }

    return t(EXERCISE_MUSCLE_TRANSLATION_KEY[filterKey]);
  };

  const getEquipmentFilterLabel = (filterKey: ExerciseLibraryEquipmentFilter): string => {
    if (filterKey === 'all') {
      return language === 'pt' ? 'Todo equipamento' : 'All equipment';
    }

    return t(EXERCISE_EQUIPMENT_TRANSLATION_KEY[filterKey]);
  };

  // Show recovery dialog as soon as a draft is detected
  useEffect(() => {
    if (!recoveredDraft) return;

    const savedAt = new Date(recoveredDraft.draft.savedAt).toLocaleTimeString();
    Alert.alert(
      t('workout.recoverTitle'),
      t('workout.recoverDescription', { savedAt }),
      [
        {
          text: t('workout.recoverDiscard'),
          style: 'destructive',
          onPress: () => { void discardRecoveredDraft(); },
        },
        {
          text: t('workout.recoverAction'),
          style: 'default',
          onPress: () => { acceptRecoveredDraft(recoveredDraft); },
        },
      ],
      { cancelable: false }
    );
  }, [recoveredDraft, acceptRecoveredDraft, discardRecoveredDraft, t]);

  return (
    <SafeAreaView style={[styles.safeArea, isWeb && styles.safeAreaWeb]} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={[styles.container, isWeb && styles.containerWeb]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              // Minimize must work even when history is empty (web refresh / direct URL / Tailscale).
              // router.back() is often a no-op in those cases.
              router.replace('/(tabs)/workout' as any);
            }}
            activeOpacity={ACTIVE_OPACITY}
            accessibilityRole="button"
            accessibilityLabel={t('workout.minimizeA11y', { defaultValue: 'Minimize workout' })}
            hitSlop={HIT_SLOP}
          >
            <Ionicons name="chevron-down" size={26} color={palette.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleTimerPause}
            activeOpacity={ACTIVE_OPACITY}
            style={styles.timerWrap}
            accessibilityRole="button"
            accessibilityLabel={isTimerPaused ? t('workout.resumeTimer') : t('workout.pauseTimer')}
          >
            <Ionicons name={isTimerPaused ? 'play' : 'pause'} size={16} color={isTimerPaused ? palette.warningText : palette.textSecondary} />
            <Text style={[styles.timerText, isTimerPaused && styles.timerTextPaused]}>{timerLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.finishButton, isSubmitting && styles.finishButtonDisabled]}
            activeOpacity={ACTIVE_OPACITY}
            onPress={openFinishModal}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={t('workout.finish')}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={palette.textPrimary} />
            ) : (
              <Text style={styles.finishButtonText}>{t('workout.finish')}</Text>
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
              <Text style={styles.statusTitle}>{t('workout.loadingRoute', { label: routePreloadLabel })}</Text>
              <Text style={styles.statusSubtitle}>{t('workout.loadingRouteDescription')}</Text>
            </View>
          ) : routePreloadError && activeExercises.length === 0 ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>{t('workout.unableToLoadRoute', { label: routePreloadLabel })}</Text>
              <Text style={styles.statusSubtitle}>{routePreloadError}</Text>
              {(routeTemplateId || routeRoutineId) ? (
                <TouchableOpacity
                  style={styles.statusRetryButton}
                  activeOpacity={ACTIVE_OPACITY}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.retry')}
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
                  <Text style={styles.statusRetryButtonText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : activeExercises.length === 0 ? (
            <View style={styles.emptyWorkoutCard}>
              <Text style={styles.emptyWorkoutTitle}>{t('workout.emptyWorkoutTitle')}</Text>
              <Text style={styles.emptyWorkoutSubtitle}>{t('workout.emptyWorkoutSubtitle')}</Text>
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
                    <TouchableOpacity
                      style={styles.exerciseHeaderTextWrap}
                      activeOpacity={ACTIVE_OPACITY}
                      onPress={() => router.push(`/exercise/${exercise.exercise.id}` as any)}
                      accessibilityRole="link"
                      accessibilityLabel={t('accessibility.viewExerciseDetails', { defaultValue: 'View exercise details' })}
                    >
                      <ExerciseThumbnail exercise={exercise.exercise} size={34} />
                      <Text style={styles.exerciseTitle}>{getLocalizedExerciseName(exercise.exercise, language)}</Text>
                    </TouchableOpacity>

                    <View style={styles.exerciseHeaderActions}>
                      <TouchableOpacity
                        style={[styles.exerciseActionButton, exerciseIndex === 0 && styles.exerciseActionButtonDisabled]}
                        activeOpacity={ACTIVE_OPACITY}
                        onPress={() => moveExercise(exerciseIndex, 'up')}
                        disabled={exerciseIndex === 0}
                        accessibilityRole="button"
                        accessibilityLabel={t('accessibility.moveExerciseUp', { defaultValue: 'Move exercise up' })}
                        hitSlop={HIT_SLOP}
                      >
                        <Ionicons name="arrow-up" size={16} color={palette.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.exerciseActionButton,
                          exerciseIndex === activeExercises.length - 1 && styles.exerciseActionButtonDisabled,
                        ]}
                        activeOpacity={ACTIVE_OPACITY}
                        onPress={() => moveExercise(exerciseIndex, 'down')}
                        disabled={exerciseIndex === activeExercises.length - 1}
                        accessibilityRole="button"
                        accessibilityLabel={t('accessibility.moveExerciseDown', { defaultValue: 'Move exercise down' })}
                        hitSlop={HIT_SLOP}
                      >
                        <Ionicons name="arrow-down" size={16} color={palette.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.exerciseActionButton, styles.exerciseActionButtonDanger]}
                        activeOpacity={ACTIVE_OPACITY}
                        accessibilityRole="button"
                        accessibilityLabel={t('accessibility.removeExercise', { defaultValue: 'Remove exercise' })}
                        hitSlop={HIT_SLOP}
                        onPress={() => {
                          const name = getLocalizedExerciseName(exercise.exercise, language);
                          if (Platform.OS === 'web') {
                            if (globalThis.confirm(t('exercise.removeConfirmDescription', { name }))) {
                              removeExercise(exerciseIndex);
                            }
                          } else {
                            Alert.alert(
                              t('exercise.removeConfirmTitle'),
                              t('exercise.removeConfirmDescription', { name }),
                              [
                                { text: t('exercise.removeConfirmKeep'), style: 'cancel' },
                                { text: t('exercise.removeConfirmRemove'), style: 'destructive', onPress: () => removeExercise(exerciseIndex) },
                              ]
                            );
                          }
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FCA5A5" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.exerciseStatsButton}
                        activeOpacity={ACTIVE_OPACITY}
                        onPress={() => openExerciseStatsModal(exercise.exercise)}
                        accessibilityRole="button"
                        accessibilityLabel={t('accessibility.viewExerciseStats', { defaultValue: 'View exercise stats' })}
                        hitSlop={HIT_SLOP}
                      >
                        <Ionicons name="stats-chart-outline" size={18} color={palette.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TextInput
                    accessibilityLabel={t('accessibility.exerciseNotes', { defaultValue: 'Exercise notes' })}
                    value={exercise.notes ?? ''}
                    onChangeText={(value) => updateExerciseNotes(exercise.id, value)}
                    style={styles.exerciseNotesInput}
                    placeholder={t('workout.exerciseNotesPlaceholder')}
                    placeholderTextColor={palette.textMuted}
                    multiline
                    maxLength={1000}
                  />

                  <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    <Text style={[styles.headerLabel, styles.cellSet]}>{t('workout.setHeader')}</Text>
                    <Text style={[styles.headerLabel, styles.cellKg]}>kg</Text>
                    <Text style={[styles.headerLabel, styles.cellReps]}>{t('workout.repsHeader')}</Text>
                    <Text style={[styles.headerLabel, styles.cellRir]}>{t('workout.rirHeader')}</Text>
                    <View style={styles.cellCheck}>
                      <Ionicons name="checkmark" size={15} color={palette.textMuted} />
                    </View>
                  </View>

                  {exercise.sets.map((setItem) => {
                    const setTypeLabel =
                      setItem.set_type === 'warmup' ? 'W'
                      : setItem.set_type === 'drop' ? 'D'
                      : setItem.set_type === 'failure' ? 'F'
                      : '';
                    const setTypeColor =
                      setItem.set_type === 'warmup' ? palette.setTypeWarmup
                      : setItem.set_type === 'drop' ? palette.setTypeDrop
                      : setItem.set_type === 'failure' ? palette.setTypeFailure
                      : palette.textMuted;
                    const nextSetType: 'normal' | 'warmup' | 'drop' | 'failure' =
                      setItem.set_type === 'normal' ? 'warmup'
                      : setItem.set_type === 'warmup' ? 'drop'
                      : setItem.set_type === 'drop' ? 'failure'
                      : 'normal';

                    return (
                      <View key={setItem.id} style={styles.setRowWrapper}>
                        <Pressable
                          style={[styles.tableRow, setItem.completed && styles.completedRow]}
                          onLongPress={() => {
                            if (exercise.sets.length <= 1) {
                              Alert.alert(t('workout.deleteSetTitle'), t('workout.deleteSetKeepOne'));
                              return;
                            }
                            setPendingDeleteSet({
                              exerciseId: exercise.id,
                              setId: setItem.id,
                              setNumber: setItem.set_number ?? 0,
                            });
                          }}
                          delayLongPress={280}
                          accessibilityHint={t('workout.deleteSetHint')}
                        >
                          <TouchableOpacity
                            style={styles.cellSet}
                            activeOpacity={ACTIVE_OPACITY}
                            onPress={() => updateSetType(exercise.id, setItem.id, nextSetType)}
                            onLongPress={() => {
                              if (exercise.sets.length <= 1) {
                                Alert.alert(t('workout.deleteSetTitle'), t('workout.deleteSetKeepOne'));
                                return;
                              }
                              setPendingDeleteSet({
                                exerciseId: exercise.id,
                                setId: setItem.id,
                                setNumber: setItem.set_number ?? 0,
                              });
                            }}
                            delayLongPress={280}
                            accessibilityRole="button"
                            accessibilityLabel={t('accessibility.changeSetType', { defaultValue: 'Change set type' })}
                            hitSlop={HIT_SLOP}
                          >
                            <Text style={styles.setNumberText}>{setItem.set_number ?? '-'}</Text>
                            {setTypeLabel ? (
                              <Text style={[styles.setSideBadge, { color: setTypeColor }]}>{setTypeLabel}</Text>
                            ) : null}
                          </TouchableOpacity>

                          <TextInput
                            accessibilityLabel={t('accessibility.weightInput', { defaultValue: 'Weight' })}
                            value={setItem.weightInput}
                            onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'weightInput', value)}
                            style={[styles.numericInput, styles.kgInput, setItem.completed && styles.numericInputCompleted]}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={palette.textMuted}
                          />

                          <TextInput
                            accessibilityLabel={t('accessibility.repsInput', { defaultValue: 'Reps' })}
                            value={setItem.repsInput}
                            onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'repsInput', value)}
                            style={[styles.numericInput, styles.cellReps, setItem.completed && styles.numericInputCompleted]}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={palette.textMuted}
                          />

                          <TextInput
                            accessibilityLabel={t('accessibility.rirInput', { defaultValue: 'RIR' })}
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
                              activeOpacity={ACTIVE_OPACITY}
                              onPress={() => handleSetCompletionToggle(exercise.id, setItem.id)}
                              accessibilityRole="button"
                              accessibilityLabel={setItem.completed ? t('accessibility.markSetIncomplete', { defaultValue: 'Mark set incomplete' }) : t('accessibility.markSetComplete', { defaultValue: 'Mark set complete' })}
                              hitSlop={HIT_SLOP}
                            >
                              <Ionicons
                                name={setItem.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                size={22}
                                color={setItem.completed ? palette.accent : palette.textMuted}
                              />
                            </TouchableOpacity>
                          </View>
                        </Pressable>

                        <View style={styles.sideToggleRow}>
                          {([
                            { key: 'both' as const, label: t('workout.sideBoth') },
                            { key: 'left' as const, label: t('workout.sideLeft') },
                            { key: 'right' as const, label: t('workout.sideRight') },
                          ]).map((option) => {
                            const isActive = setItem.side === option.key;
                            return (
                              <TouchableOpacity
                                key={`${setItem.id}-${option.key}`}
                                style={[styles.sideToggleChip, isActive && styles.sideToggleChipActive]}
                                activeOpacity={ACTIVE_OPACITY}
                                onPress={() => updateSetSide(exercise.id, setItem.id, option.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isActive }}
                              >
                                <Text style={[styles.sideToggleText, isActive && styles.sideToggleTextActive]}>
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}

                  <TouchableOpacity 
                    style={styles.addSetButton} 
                    activeOpacity={ACTIVE_OPACITY} 
                    onPress={() => addSet(exercise.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('accessibility.addSet', { defaultValue: 'Add set' })}
                  >
                    <Ionicons name="add" size={16} color={palette.textSecondary} />
                    <Text style={styles.addSetText}>{t('workout.addSetAction')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.bottomActionArea, { bottom: insets.bottom + 12 }]}> 
          <TouchableOpacity
            style={styles.addExerciseTrigger}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => setExercisePickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.openExercisePicker', { defaultValue: 'Open exercise picker' })}
          >
            <View style={styles.addExerciseTriggerIconWrap}>
              <Ionicons name="search-outline" size={16} color={palette.accent} />
            </View>
            <View style={styles.addExerciseTriggerTextWrap}>
              <Text style={styles.addExerciseTriggerLabel}>{t('workout.addExercise')}</Text>
              <Text style={styles.addExerciseTriggerHint}>{t('workout.addExerciseHint')}</Text>
            </View>
            <Ionicons name="chevron-up" size={18} color={palette.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isFinishModalVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={() => setIsFinishModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable 
            style={styles.modalDismissArea} 
            onPress={() => setIsFinishModalVisible(false)} 
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.closeModal', { defaultValue: 'Close modal' })}
          />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('workout.finishModalTitle')}</Text>
            <Text style={styles.finishModalSubtitle}>{t('workout.finishModalSubtitle')}</Text>

            <Text style={styles.modalOptionLabel}>{t('workout.finishWorkoutTitleLabel')}</Text>
            <TextInput
              accessibilityLabel={t('accessibility.workoutTitle', { defaultValue: 'Workout title' })}
              value={workoutTitleInput}
              onChangeText={(value) => {
                setHasManualWorkoutTitle(true);
                setWorkoutTitleInput(value.substring(0, INPUT_LIMITS.nameMax));
              }}
              style={styles.modalInput}
              placeholder={t('workout.finishWorkoutTitlePlaceholder')}
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsFinishModalVisible(false)}
                activeOpacity={ACTIVE_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isSubmitting && styles.modalCreateButtonDisabled]}
                onPress={() => void handleFinishWorkout()}
                activeOpacity={ACTIVE_OPACITY}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={t('workout.finish')}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>{t('workout.finish')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={exercisePickerVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={closeExercisePicker}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable 
            style={styles.modalDismissArea} 
            onPress={closeExercisePicker} 
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.closeModal', { defaultValue: 'Close modal' })}
          />

          <View style={[styles.modalSheet, styles.pickerModalSheet, isWeb && styles.modalSheetWeb]}>
            <SafeAreaView edges={['bottom']} style={styles.modalSheetSafeArea}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{t('workout.selectExercise')}</Text>
                <TouchableOpacity
                  style={styles.modalCustomButton}
                  activeOpacity={ACTIVE_OPACITY}
                  accessibilityRole="button"
                  accessibilityLabel={t('workout.customLabel')}
                  onPress={() => {
                    closeExercisePicker();
                    setCreateExerciseVisible(true);
                  }}
                >
                  <Text style={styles.modalCustomButtonText}>{t('workout.customLabel')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalHandle} />

              <View style={styles.pickerSearchBar}>
                <Ionicons name="search" size={18} color={palette.textMuted} />
                <TextInput
                  accessibilityLabel={t('accessibility.searchExercises', { defaultValue: 'Search exercises' })}
                  value={exercisePickerQuery}
                  onChangeText={setExercisePickerQuery}
                  placeholder={t('workout.searchExercisesPlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  style={styles.pickerSearchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.filterChipsSectionLabel}>{t('workout.muscleGroup')}</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={[styles.filterChipsScroll, isWeb && styles.filterChipsScrollWeb]}
                contentContainerStyle={styles.filterChipsContent}
              >
                {MUSCLE_FILTER_CHIP_KEYS.map((filterKey) => {
                  const isSelected = filterKey === selectedMuscleFilter;

                  return (
                    <TouchableOpacity
                      key={filterKey}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      activeOpacity={ACTIVE_OPACITY}
                      onPress={() => setSelectedMuscleFilter(filterKey)}
                      accessibilityRole="button"
                      accessibilityLabel={getMuscleFilterLabel(filterKey)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                        {getMuscleFilterLabel(filterKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.filterChipsSectionLabel}>{t('workout.equipment')}</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={[styles.filterChipsScroll, isWeb && styles.filterChipsScrollWeb]}
                contentContainerStyle={styles.filterChipsContent}
              >
                {EQUIPMENT_FILTER_CHIP_KEYS.map((filterKey) => {
                  const isSelected = filterKey === selectedEquipmentFilter;

                  return (
                    <TouchableOpacity
                      key={filterKey}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      activeOpacity={ACTIVE_OPACITY}
                      onPress={() => setSelectedEquipmentFilter(filterKey)}
                      accessibilityRole="button"
                      accessibilityLabel={getEquipmentFilterLabel(filterKey)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                        {getEquipmentFilterLabel(filterKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <ScrollView
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                showsVerticalScrollIndicator={false}
              >
                {isLoadingExercises ? (
                  <View style={styles.modalStatusContainer}>
                    <ActivityIndicator size="small" color={palette.accent} />
                    <Text style={styles.modalStatusText}>{t('workout.loadingExerciseCatalog')}</Text>
                  </View>
                ) : exerciseLoadError ? (
                  <View style={styles.modalStatusContainer}>
                    <Text style={styles.modalStatusTitle}>{t('workout.unableToLoadExercises')}</Text>
                    <Text style={styles.modalStatusText}>{exerciseLoadError}</Text>
                    <TouchableOpacity
                      style={styles.modalRetryButton}
                      onPress={() => {
                        if (selectedMuscleFilter === 'recent') {
                          void loadRecentExercises();
                          return;
                        }

                        void loadExercises(
                          { muscle: selectedMuscleFilter, equipment: selectedEquipmentFilter },
                          true
                        );
                      }}
                      activeOpacity={ACTIVE_OPACITY}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.retry')}
                    >
                      <Text style={styles.modalRetryButtonText}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : catalogExercises.length === 0 ? (
                  <View style={styles.modalStatusContainer}>
                    <Text style={styles.modalStatusTitle}>
                      {selectedMuscleFilter === 'recent'
                        ? t('workout.noRecentExercises')
                        : t('workout.noExercisesAvailable')}
                    </Text>
                    <Text style={styles.modalStatusText}>
                      {selectedMuscleFilter === 'recent'
                        ? t('workout.noRecentExercisesHint')
                        : t('workout.createExercisesHint')}
                    </Text>
                  </View>
                ) : filteredCatalogExercises.length === 0 ? (
                  <View style={styles.modalStatusContainer}>
                    <Text style={styles.modalStatusTitle}>{t('exercise.emptySearchTitle')}</Text>
                    <Text style={styles.modalStatusText}>{t('exercise.emptySearchSubtitle')}</Text>
                  </View>
                ) : (
                  filteredCatalogExercises.map((exercise) => {
                    return (
                      <TouchableOpacity
                        key={exercise.id}
                        style={styles.modalExerciseRow}
                        activeOpacity={ACTIVE_OPACITY}
                        accessibilityRole="button"
                        accessibilityLabel={t('accessibility.addSpecificExercise', { name: getLocalizedExerciseName(exercise, language), defaultValue: 'Add exercise' })}
                        onPress={() => {
                          addExercise(exercise);
                          closeExercisePicker();
                        }}
                      >
                        <ExerciseThumbnail exercise={exercise} size={34} />
                        <View style={styles.modalExerciseTextWrap}>
                          <Text style={styles.modalExerciseName}>{getLocalizedExerciseName(exercise, language)}</Text>
                          <Text style={styles.modalExerciseMeta}>
                            {getExerciseMuscleLabel(exercise)} - {getExerciseEquipmentLabel(exercise)}
                          </Text>
                        </View>
                        <Ionicons name="add-circle-outline" size={22} color={palette.accent} />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </SafeAreaView>
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
          <Pressable 
            style={styles.modalDismissArea} 
            onPress={() => setCreateExerciseVisible(false)} 
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.closeModal', { defaultValue: 'Close modal' })}
          />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('workout.createExercise')}</Text>

            <TextInput
              accessibilityLabel={t('accessibility.newExerciseName', { defaultValue: 'New exercise name' })}
              value={newExerciseName}
              onChangeText={(value) => setNewExerciseName(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder={t('workout.name')}
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <Text style={styles.modalOptionLabel}>{t('workout.muscleGroup')}</Text>
            <View style={styles.modalOptionGrid}>
              {EXERCISE_MUSCLE_OPTIONS.map((muscleKey) => {
                const isSelected = newExerciseMuscleGroup === muscleKey;

                return (
                  <TouchableOpacity
                    key={muscleKey}
                    style={[styles.modalOptionChip, isSelected && styles.modalOptionChipSelected]}
                    activeOpacity={ACTIVE_OPACITY}
                    onPress={() => setNewExerciseMuscleGroup(muscleKey)}
                    accessibilityRole="button"
                    accessibilityLabel={t(EXERCISE_MUSCLE_TRANSLATION_KEY[muscleKey])}
                  >
                    <Text style={[styles.modalOptionChipText, isSelected && styles.modalOptionChipTextSelected]}>
                      {t(EXERCISE_MUSCLE_TRANSLATION_KEY[muscleKey])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalOptionLabel}>{t('workout.equipment')}</Text>
            <View style={styles.modalOptionGrid}>
              {EXERCISE_EQUIPMENT_OPTIONS.map((equipmentKey) => {
                const isSelected = newExerciseEquipment === equipmentKey;

                return (
                  <TouchableOpacity
                    key={equipmentKey}
                    style={[styles.modalOptionChip, isSelected && styles.modalOptionChipSelected]}
                    activeOpacity={ACTIVE_OPACITY}
                    onPress={() => setNewExerciseEquipment(equipmentKey)}
                    accessibilityRole="button"
                    accessibilityLabel={t(EXERCISE_EQUIPMENT_TRANSLATION_KEY[equipmentKey])}
                  >
                    <Text style={[styles.modalOptionChipText, isSelected && styles.modalOptionChipTextSelected]}>
                      {t(EXERCISE_EQUIPMENT_TRANSLATION_KEY[equipmentKey])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setCreateExerciseVisible(false)}
                activeOpacity={ACTIVE_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isCreatingExercise && styles.modalCreateButtonDisabled]}
                onPress={() => void handleCreateExercise()}
                activeOpacity={ACTIVE_OPACITY}
                disabled={isCreatingExercise}
                accessibilityRole="button"
                accessibilityLabel={t('common.create')}
              >
                {isCreatingExercise ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>{t('common.create')}</Text>
                )}
              </TouchableOpacity>
            </View>
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

      <ConfirmModal
        visible={pendingDeleteSet !== null}
        title={t('workout.deleteSetTitle')}
        description={
          pendingDeleteSet
            ? t('workout.deleteSetDescription', { number: pendingDeleteSet.setNumber })
            : undefined
        }
        confirmLabel={t('workout.deleteSetConfirm')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        icon="trash-outline"
        onCancel={() => setPendingDeleteSet(null)}
        onConfirm={() => {
          if (pendingDeleteSet) {
            removeSet(pendingDeleteSet.exerciseId, pendingDeleteSet.setId);
          }
          setPendingDeleteSet(null);
        }}
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
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  timerText: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  timerTextPaused: {
    color: palette.warningText,
  },
  finishButton: {
    backgroundColor: palette.accent,
    minHeight: 38,
    minWidth: 78,
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  statusRetryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 12,
  },
  exerciseCompletionGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.glowCyan,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseThumbnail: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    marginRight: 10,
    backgroundColor: palette.surfaceAlt,
  },
  exerciseThumbnailPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    marginRight: 10,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.rowSeparator,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.stopwatchBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 4,
    paddingHorizontal: 8,
  },
  exerciseStopwatchButtonActive: {
    borderColor: palette.stopwatchBorderActive,
    backgroundColor: palette.stopwatchBgActive,
  },
  exerciseStopwatchText: {
    color: palette.stopwatchText,
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  exerciseStopwatchTextActive: {
    color: palette.stopwatchTextActive,
  },
  exerciseActionButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.inputFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseActionButtonDisabled: {
    opacity: 0.36,
  },
  exerciseActionButtonDanger: {
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerBg,
  },
  exerciseTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  exerciseStatsButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.inputFill,
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
    borderBottomColor: palette.rowSeparator,
    minWidth: 0,
    overflow: 'hidden',
  },
  setRowWrapper: {
    marginBottom: 2,
  },
  sideToggleRow: {
    flexDirection: 'row',
    columnGap: 6,
    paddingLeft: 38,
    paddingBottom: 6,
    paddingTop: 2,
  },
  sideToggleChip: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideToggleChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.chipFillSelected,
  },
  sideToggleText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  sideToggleTextActive: {
    color: palette.textPrimary,
  },
  tableHeaderRow: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: Radius.button,
    borderBottomWidth: 1,
    borderColor: palette.rowSeparator,
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
    backgroundColor: palette.completedRowBg,
    borderRadius: Radius.md,
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
  setSideBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  exerciseNotesInput: {
    minHeight: 40,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    color: palette.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 13,
    lineHeight: 18,
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.inputFill,
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
    borderColor: palette.accent,
    backgroundColor: palette.completedFill,
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.inputFill,
  },
  checkButtonCompleted: {
    backgroundColor: palette.completedFill,
  },
  addSetButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: Radius.card,
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
  addExerciseTrigger: {
    minHeight: 62,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    columnGap: 10,
  },
  addExerciseTriggerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.accentSoft,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseTriggerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  addExerciseTriggerLabel: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  addExerciseTriggerHint: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
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
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  pickerModalSheet: {
    minHeight: '62%',
    maxHeight: '88%',
  },
  modalSheetSafeArea: {
    flex: 1,
    minHeight: 0,
  },
  modalSheetWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: palette.surface,
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
    borderRadius: Radius.pill,
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
    borderRadius: Radius.md,
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
    flex: 1,
    minHeight: 180,
    marginTop: 2,
  },
  modalListContent: {
    paddingBottom: 6,
  },
  pickerSearchBar: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 12,
  },
  pickerSearchInput: {
    flex: 1,
    marginLeft: 8,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  filterChipsSectionLabel: {
    color: palette.labelMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 4,
  },
  filterChipsScroll: {
    flexGrow: 0,
    marginBottom: 10,
  },
  filterChipsScrollWeb: {
    // Hide desktop-style scrollbar; users swipe/drag chips like on mobile.
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  } as object,
  filterChipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingRight: 16,
    paddingVertical: 2,
  },
  filterChip: {
    flexShrink: 0,
    minHeight: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.chipBorder,
    backgroundColor: palette.inputFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  filterChipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.chipFillSelected,
  },
  filterChipText: {
    color: palette.chipText,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: palette.chipTextSelected,
  },
  modalStatusContainer: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  modalOptionLabel: {
    color: palette.labelMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 6,
    marginLeft: 2,
  },
  modalOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    marginBottom: 12,
  },
  modalOptionChip: {
    minHeight: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.chipBorder,
    backgroundColor: palette.inputFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalOptionChipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.chipFillSelected,
  },
  modalOptionChipText: {
    color: palette.chipText,
    fontSize: 12,
    fontWeight: '700',
  },
  modalOptionChipTextSelected: {
    color: palette.chipTextSelected,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
  finishModalSubtitle: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
});
