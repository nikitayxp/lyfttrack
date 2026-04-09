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
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/theme';
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
  getExercisesCatalog,
  getLastExerciseRestTimes,
  getRoutineById,
} from '@/services/workoutService';
import { finishWorkout } from '@/services/sessionRepository';
import { getTemplateById } from '@/services/templateService';
import { getExerciseProgress, type ExerciseProgressPoint } from '@/services/statsService';
import {
  WorkoutSaveValidationError,
  type FinishWorkoutResult,
  type WorkoutSetProgressDraft,
} from '@/services/workoutSession.types';
import {
  createExerciseBlock,
  normalizeSetTypeOption,
  getCompletedExerciseNames,
  type ActiveExercise,
  type ExerciseRow,
} from '@/hooks/useActiveWorkoutState';
import { useWorkoutContext } from '@/context/WorkoutContext';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WorkoutSummary } from '@/components/workout/WorkoutSummary';
import {
  INPUT_LIMITS,
  sanitizeText,
  toSafeInteger,
  toSafeNumber,
} from '@/utils/inputValidation';
import { getLocalizedExerciseMuscle, getLocalizedExerciseName } from '@/utils/exerciseLocalization';

const palette = Colors.dark;
const DESKTOP_WEB_MIN_WIDTH = 768;
const LIVE_CHART_COLOR = '#3B82F6';
const ROOT_SCREEN_BG = palette.bgPrimary;
const LIVE_CHART_DEFAULT_WINDOW = 12;
const MUSCLE_FILTER_CHIP_KEYS: readonly ExerciseLibraryMuscleFilter[] = [
  'all',
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
    }))
  );
}

function buildCatalogCacheKey(filters: ExerciseCatalogFilters): string {
  const muscle = filters.muscle ?? 'all';
  const equipment = filters.equipment ?? 'all';

  return `${muscle}::${equipment}`;
}

function formatCompactAxisNumber(value: number | string): string {
  const parsedValue =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9+-.]/g, ''));
  const safeValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;

  if (safeValue >= 1_000_000) {
    const scaled = safeValue / 1_000_000;
    const rounded = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
    return `${rounded.replace(/\.0$/, '')}m`;
  }

  if (safeValue >= 1_000) {
    const scaled = safeValue / 1_000;
    const rounded = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
    return `${rounded.replace(/\.0$/, '')}k`;
  }

  if (safeValue >= 100) {
    return `${Math.round(safeValue)}`;
  }

  return Number.isInteger(safeValue) ? `${safeValue}` : safeValue.toFixed(1);
}

function formatVolumeAxisLabel(value: number | string): string {
  return `${formatCompactAxisNumber(value)} kg`;
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
    ensureWorkoutStarted,
    activeTemplateId,
    setActiveTemplateId,
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
    isExerciseStopwatchRunning,
    getExerciseStopwatchSeconds,
    getExerciseRestSecondsByExerciseId,
    toggleExerciseStopwatch,
    removeExercise,
    moveExercise,
  } = useWorkoutContext();

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
  const [isExerciseStatsVisible, setIsExerciseStatsVisible] = useState(false);
  const [statsExercise, setStatsExercise] = useState<ExerciseRow | null>(null);
  const [statsExerciseProgress, setStatsExerciseProgress] = useState<ExerciseProgressPoint[]>([]);
  const [showAllLivePoints, setShowAllLivePoints] = useState(false);
  const [selectedLivePointIndex, setSelectedLivePointIndex] = useState<number | null>(null);
  const [isLoadingExerciseStats, setIsLoadingExerciseStats] = useState(false);
  const [exerciseStatsError, setExerciseStatsError] = useState<string | null>(null);
  const exerciseCatalogByFilterRef = useRef<Map<string, ExerciseRow[]>>(new Map());
  const exerciseProgressCacheRef = useRef<Map<string, ExerciseProgressPoint[]>>(new Map());
  const requestedProgressExerciseIdsRef = useRef<Set<string>>(new Set());
  const statsRequestVersionRef = useRef(0);

  const timerLabel = useMemo(() => formatElapsedTime(elapsedSeconds), [elapsedSeconds]);
  const visibleLivePoints = useMemo(
    () =>
      showAllLivePoints
        ? statsExerciseProgress
        : statsExerciseProgress.slice(-LIVE_CHART_DEFAULT_WINDOW),
    [showAllLivePoints, statsExerciseProgress]
  );

  const liveStatsChartData = useMemo(
    () =>
      visibleLivePoints.map((point, index) => ({
        value: Math.max(0, Number(point.value.toFixed(1))),
        label: point.label,
        dataPointColor: index === selectedLivePointIndex ? '#FFFFFF' : LIVE_CHART_COLOR,
        dataPointRadius: index === selectedLivePointIndex ? 5.5 : 4,
        onPress: () => setSelectedLivePointIndex(index),
      })),
    [selectedLivePointIndex, visibleLivePoints]
  );

  const liveChartWidth = useMemo(() => {
    const availableWidth = Math.max(260, windowWidth - 40);
    if (!isDesktopWeb) {
      return availableWidth;
    }

    return Math.min(availableWidth, 332);
  }, [isDesktopWeb, windowWidth]);
  const liveChartMaxValue = useMemo(() => {
    if (liveStatsChartData.length === 0) {
      return 20;
    }

    const highestValue = liveStatsChartData.reduce((currentMax, point) => Math.max(currentMax, point.value), 0);

    if (highestValue <= 0) {
      return 20;
    }

    return Math.max(20, Math.ceil(highestValue * 1.25));
  }, [liveStatsChartData]);

  useEffect(() => {
    if (liveStatsChartData.length === 0) {
      setSelectedLivePointIndex(null);
      return;
    }

    setSelectedLivePointIndex((currentValue) => {
      if (currentValue === null || currentValue >= liveStatsChartData.length) {
        return liveStatsChartData.length - 1;
      }

      return currentValue;
    });
  }, [liveStatsChartData.length]);

  const selectedLivePoint = useMemo(() => {
    if (selectedLivePointIndex === null) {
      return null;
    }

    return visibleLivePoints[selectedLivePointIndex] ?? null;
  }, [selectedLivePointIndex, visibleLivePoints]);

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
    setShowAllLivePoints(false);
    setSelectedLivePointIndex(null);
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
      await loadExercises({ muscle: selectedMuscleFilter, equipment: selectedEquipmentFilter }, true);
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

  const routePreloadLabel = routeTemplateId ? 'template' : 'routine';
  const isPreloadingRoute = routeTemplateId ? isPreloadingTemplate : isPreloadingRoutine;
  const routePreloadError = routeTemplateId ? templatePreloadError : routinePreloadError;

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

  const getMuscleFilterLabel = (filterKey: ExerciseLibraryMuscleFilter): string => {
    if (filterKey === 'all') {
      return language === 'pt' ? 'Todos' : 'All';
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
          <TouchableOpacity style={styles.iconButton} onPress={() => void handleCancelWorkout()} activeOpacity={0.85}>
            <Ionicons name="close" size={26} color={palette.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.timerText}>{timerLabel}</Text>

          <TouchableOpacity
            style={[styles.finishButton, isSubmitting && styles.finishButtonDisabled]}
            activeOpacity={0.85}
            onPress={openFinishModal}
            disabled={isSubmitting}
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
                      <Text style={styles.exerciseTitle}>{getLocalizedExerciseName(exercise.exercise, language)}</Text>
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
            style={styles.addExerciseTrigger}
            activeOpacity={0.9}
            onPress={() => setExercisePickerVisible(true)}
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
          <Pressable style={styles.modalDismissArea} onPress={() => setIsFinishModalVisible(false)} />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('workout.finishModalTitle')}</Text>
            <Text style={styles.finishModalSubtitle}>{t('workout.finishModalSubtitle')}</Text>

            <Text style={styles.modalOptionLabel}>{t('workout.finishWorkoutTitleLabel')}</Text>
            <TextInput
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
                activeOpacity={0.88}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isSubmitting && styles.modalCreateButtonDisabled]}
                onPress={() => void handleFinishWorkout()}
                activeOpacity={0.88}
                disabled={isSubmitting}
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
        onRequestClose={() => setExercisePickerVisible(false)}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={() => setExercisePickerVisible(false)} />

          <View style={[styles.modalSheet, styles.pickerModalSheet, isWeb && styles.modalSheetWeb]}>
            <SafeAreaView edges={['bottom']} style={styles.modalSheetSafeArea}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{t('workout.selectExercise')}</Text>
                <TouchableOpacity
                  style={styles.modalCustomButton}
                  activeOpacity={0.88}
                  onPress={() => {
                    setExercisePickerVisible(false);
                    setCreateExerciseVisible(true);
                  }}
                >
                  <Text style={styles.modalCustomButtonText}>{t('workout.customLabel')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalHandle} />

              <Text style={styles.filterChipsSectionLabel}>{t('workout.muscleGroup')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterChipsScroll}
                contentContainerStyle={styles.filterChipsContent}
              >
                {MUSCLE_FILTER_CHIP_KEYS.map((filterKey) => {
                  const isSelected = filterKey === selectedMuscleFilter;

                  return (
                    <TouchableOpacity
                      key={filterKey}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      activeOpacity={0.88}
                      onPress={() => setSelectedMuscleFilter(filterKey)}
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
                showsHorizontalScrollIndicator={false}
                style={styles.filterChipsScroll}
                contentContainerStyle={styles.filterChipsContent}
              >
                {EQUIPMENT_FILTER_CHIP_KEYS.map((filterKey) => {
                  const isSelected = filterKey === selectedEquipmentFilter;

                  return (
                    <TouchableOpacity
                      key={filterKey}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      activeOpacity={0.88}
                      onPress={() => setSelectedEquipmentFilter(filterKey)}
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
                      onPress={() =>
                        void loadExercises({ muscle: selectedMuscleFilter, equipment: selectedEquipmentFilter }, true)
                      }
                      activeOpacity={0.88}
                    >
                      <Text style={styles.modalRetryButtonText}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : catalogExercises.length === 0 ? (
                  <View style={styles.modalStatusContainer}>
                    <Text style={styles.modalStatusTitle}>{t('workout.noExercisesAvailable')}</Text>
                    <Text style={styles.modalStatusText}>{t('workout.createExercisesHint')}</Text>
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
                        <Text style={styles.modalExerciseName}>{getLocalizedExerciseName(exercise, language)}</Text>
                        <Text style={styles.modalExerciseMeta}>
                          {getExerciseMuscleLabel(exercise)} - {getExerciseEquipmentLabel(exercise)}
                        </Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={22} color={palette.accent} />
                    </TouchableOpacity>
                  ))
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
          <Pressable style={styles.modalDismissArea} onPress={() => setCreateExerciseVisible(false)} />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('workout.createExercise')}</Text>

            <TextInput
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
                    activeOpacity={0.88}
                    onPress={() => setNewExerciseMuscleGroup(muscleKey)}
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
                    activeOpacity={0.88}
                    onPress={() => setNewExerciseEquipment(equipmentKey)}
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
                activeOpacity={0.88}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
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
                  <Text style={styles.modalCreateButtonText}>{t('common.create')}</Text>
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
                <Text style={styles.liveStatsTitle}>
                  {statsExercise ? getLocalizedExerciseName(statsExercise, language) : 'Live Stats'}
                </Text>
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
                {statsExerciseProgress.length > LIVE_CHART_DEFAULT_WINDOW ? (
                  <TouchableOpacity
                    style={styles.liveStatsWindowToggle}
                    activeOpacity={0.88}
                    onPress={() => setShowAllLivePoints((currentValue) => !currentValue)}
                  >
                    <Text style={styles.liveStatsWindowToggleText}>
                      {showAllLivePoints
                        ? `Show last ${LIVE_CHART_DEFAULT_WINDOW}`
                        : `Show all sessions (${statsExerciseProgress.length})`}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <LineChart
                  data={liveStatsChartData}
                  width={liveChartWidth}
                  height={252}
                  maxValue={liveChartMaxValue}
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
                  yAxisLabelWidth={74}
                  xAxisLabelsHeight={40}
                  labelsExtraHeight={12}
                  overflowTop={24}
                  overflowBottom={16}
                  yAxisTextStyle={styles.liveStatsAxisText}
                  xAxisLabelTextStyle={styles.liveStatsAxisText}
                  formatYLabel={(label) => formatVolumeAxisLabel(label)}
                  rulesColor="#1F2937"
                  noOfSections={4}
                  initialSpacing={10}
                  endSpacing={0}
                  onBackgroundPress={() => setSelectedLivePointIndex(null)}
                  adjustToWidth={true}
                />

                {selectedLivePoint ? (
                  <View style={styles.liveStatsSelectedPointCard}>
                    <Text style={styles.liveStatsSelectedPointLabel}>{selectedLivePoint.label}</Text>
                    <Text style={styles.liveStatsSelectedPointValue}>{formatVolumeAxisLabel(selectedLivePoint.value)}</Text>
                    <Text style={styles.liveStatsSelectedPointMeta}>Tap points to inspect session evolution.</Text>
                  </View>
                ) : null}

                <Text style={styles.liveStatsFootnote}>{`Showing ${liveStatsChartData.length} of ${statsExerciseProgress.length} sessions`}</Text>
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
  addExerciseTrigger: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0D1624',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    columnGap: 10,
  },
  addExerciseTriggerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    backgroundColor: '#0A1A2D',
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    minHeight: 318,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  liveStatsWindowToggle: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#122744',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  liveStatsWindowToggleText: {
    color: '#DCE8FF',
    fontSize: 11,
    fontWeight: '700',
  },
  liveStatsAxisText: {
    color: '#8FA2BA',
    fontSize: 11,
  },
  liveStatsSelectedPointCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#233247',
    backgroundColor: '#0B1320',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  liveStatsSelectedPointLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  liveStatsSelectedPointValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  liveStatsSelectedPointMeta: {
    color: '#8FA2BA',
    fontSize: 11,
    lineHeight: 16,
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
    flex: 1,
    minHeight: 180,
    marginTop: 2,
  },
  modalListContent: {
    paddingBottom: 6,
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
    minHeight: 40,
    maxHeight: 52,
    marginBottom: 10,
  },
  filterChipsContent: {
    columnGap: 8,
    paddingRight: 4,
    paddingVertical: 2,
    alignItems: 'center',
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
  modalOptionLabel: {
    color: '#94A3B8',
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalOptionChipSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#122744',
  },
  modalOptionChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOptionChipTextSelected: {
    color: '#EAF1FF',
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
  finishModalSubtitle: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
});
