import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { deactivateKeepAwake, useKeepAwake } from 'expo-keep-awake';
import { Colors } from '@/constants/theme';
import {
  createExercise,
  type ExerciseCatalogFilters,
  type ExerciseLibraryEquipmentFilter,
  type ExerciseLibraryMuscleFilter,
  finishWorkout,
  type FinishWorkoutResult,
  getErrorMessage,
  getExercisesCatalog,
  getPreviousExercisePerformance,
  type PreviousExercisePerformanceSet,
  getRoutineById,
  type WorkoutSetProgressDraft,
} from '@/services/workoutService';
import { getTemplateById } from '@/services/templateService';
import { getExerciseProgress, type ExerciseProgressPoint } from '@/services/statsService';
import type { Tables } from '@/types/database';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlateCalculatorModal } from '@/components/workout/PlateCalculatorModal';
import { WorkoutSummary } from '@/components/workout/WorkoutSummary';
import { calculatePlateBreakdown, formatPlateWeight } from '@/utils/plateCalculator';

type ExerciseRow = Tables<'exercises'>;
type SetRow = Tables<'sets'>;

const palette = Colors.dark;
const DEFAULT_REST_SECONDS = 90;
const REST_STEP_SECONDS = 30;
const INLINE_TEMPLATE_PRELOAD_KEY = '__inline_template_payload__';
const LIVE_CHART_COLOR = '#3B82F6';
const MUSCLE_FILTER_CHIP_OPTIONS: ReadonlyArray<{ key: ExerciseLibraryMuscleFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'legs', label: 'Legs' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arms', label: 'Arms' },
];
const EQUIPMENT_FILTER_CHIP_OPTIONS: ReadonlyArray<{ key: ExerciseLibraryEquipmentFilter; label: string }> = [
  { key: 'all', label: 'All Equipment' },
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'machine', label: 'Machine' },
  { key: 'cable', label: 'Cable' },
];
type SetTypeOption = Exclude<SetRow['set_type'], null>;
const SET_TYPE_SEQUENCE: ReadonlyArray<SetTypeOption> = ['normal', 'warmup', 'drop', 'failure'];
type SetInputField = 'weightInput' | 'repsInput' | 'rirInput';

type ProgressionHint = {
  message: string;
  color: string;
};

type ActiveSet = Pick<SetRow, 'id' | 'set_number' | 'weight' | 'reps' | 'rir' | 'set_type'> & {
  completed: boolean;
  weightInput: string;
  repsInput: string;
  rirInput: string;
};

type ActiveExercise = {
  id: string;
  exercise: ExerciseRow;
  defaultRestSeconds: number;
  sets: ActiveSet[];
};

type TemplatePreloadExercise = {
  exercise: ExerciseRow;
  restSeconds: number;
};

function formatGhostNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatGhostSetLabel(previousSet: PreviousExercisePerformanceSet): string {
  return `Last: ${formatGhostNumber(previousSet.weight)}kg x ${formatGhostNumber(previousSet.reps)} @ ${formatGhostNumber(previousSet.rir)} RIR`;
}

function formatInputFromNumber(value: number | null, mode: 'decimal' | 'integer'): string {
  if (value === null || !Number.isFinite(value)) {
    return '';
  }

  const safeValue = Math.max(0, value);

  if (mode === 'integer') {
    return `${Math.trunc(safeValue)}`;
  }

  const fixed = safeValue.toFixed(2);
  return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function getGhostSetForRow(
  previousSets: PreviousExercisePerformanceSet[],
  setNumber: number | null,
  rowIndex: number
): PreviousExercisePerformanceSet | null {
  if (previousSets.length === 0) {
    return null;
  }

  if (setNumber !== null) {
    const matchedBySetNumber = previousSets.find((setItem) => setItem.setNumber === setNumber);

    if (matchedBySetNumber) {
      return matchedBySetNumber;
    }
  }

  return previousSets[rowIndex] ?? null;
}

function parseOptionalNumber(value: string): number | null {
  if (!value || value === '.') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeDecimalInput(value: string): string {
  const digitsAndDot = value.replace(/[^0-9.]/g, '');
  const [head, ...tail] = digitsAndDot.split('.');

  if (tail.length === 0) {
    return head;
  }

  return `${head}.${tail.join('')}`;
}

function sanitizeIntegerInput(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function isBarbellExerciseEquipment(equipment: string | null | undefined): boolean {
  if (!equipment) {
    return false;
  }

  return equipment.trim().toLowerCase().includes('barbell');
}

function buildSetFocusKey(exerciseId: string, setId: string): string {
  return `${exerciseId}:${setId}`;
}

function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null || !Number.isFinite(weight) || !Number.isFinite(reps)) {
    return null;
  }

  if (weight <= 0 || reps <= 0) {
    return null;
  }

  return weight * (1 + reps / 30);
}

function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainder].map((value) => value.toString().padStart(2, '0')).join(':');
  }

  return [minutes, remainder].map((value) => value.toString().padStart(2, '0')).join(':');
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (safeSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${remainder}`;
}

function getRemainingSeconds(endAtMs: number): number {
  return Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
}

function startTimerFromNow(seconds: number): number {
  const safeSeconds = Math.max(1, Math.trunc(seconds));
  return Date.now() + safeSeconds * 1000;
}

function clampRestSeconds(value: number): number {
  return Math.max(0, Math.trunc(value));
}

function ensurePositiveRestSeconds(value: number): number {
  return Math.max(1, Math.trunc(value));
}

function normalizeExerciseRestSeconds(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_REST_SECONDS;
  }

  const normalized = Math.trunc(value);
  return Math.max(15, Math.min(900, normalized));
}

function createSet(
  exerciseId: string,
  setNumber: number,
  initial?: {
    weightInput?: string;
    repsInput?: string;
    rirInput?: string;
    setType?: SetTypeOption;
  }
): ActiveSet {
  const weightInput = initial?.weightInput ?? '';
  const repsInput = initial?.repsInput ?? '';
  const rirInput = initial?.rirInput ?? '';

  return {
    id: `${exerciseId}-set-${setNumber}-${Math.random().toString(36).slice(2, 8)}`,
    set_number: setNumber,
    set_type: initial?.setType ?? 'normal',
    weight: parseOptionalNumber(weightInput),
    reps: parseOptionalNumber(repsInput),
    rir: parseOptionalNumber(rirInput),
    completed: false,
    weightInput,
    repsInput,
    rirInput,
  };
}

function createExerciseBlock(exercise: ExerciseRow, defaultRestSeconds = DEFAULT_REST_SECONDS): ActiveExercise {
  return {
    id: `active-${exercise.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    exercise,
    defaultRestSeconds: normalizeExerciseRestSeconds(defaultRestSeconds),
    sets: [
      createSet(exercise.id, 1, { setType: 'warmup' }),
      createSet(exercise.id, 2, { setType: 'normal' }),
    ],
  };
}

function normalizeSetTypeOption(current: SetRow['set_type']): SetTypeOption {
  if (!current) {
    return 'normal';
  }

  const normalized = current.toLowerCase();

  if (normalized === 'working') return 'normal';
  if (normalized === 'dropset') return 'drop';
  if (normalized === 'warmup' || normalized === 'normal' || normalized === 'drop' || normalized === 'failure') {
    return normalized;
  }

  return 'normal';
}

function getNextSetType(current: SetRow['set_type']): SetTypeOption {
  const normalizedCurrent = normalizeSetTypeOption(current);
  const currentIndex = SET_TYPE_SEQUENCE.indexOf(normalizedCurrent);

  if (currentIndex < 0) {
    return 'normal';
  }

  return SET_TYPE_SEQUENCE[(currentIndex + 1) % SET_TYPE_SEQUENCE.length];
}

function getSetTypeLabel(setType: SetRow['set_type']): string {
  const normalized = normalizeSetTypeOption(setType);

  if (normalized === 'warmup') return 'WU';
  if (normalized === 'drop') return 'DR';
  if (normalized === 'failure') return 'FL';
  return 'N';
}

function getSetTypeChipStyle(setType: SetRow['set_type']) {
  const normalized = normalizeSetTypeOption(setType);

  if (normalized === 'warmup') return styles.setTypeChipWarmup;
  if (normalized === 'drop') return styles.setTypeChipDrop;
  if (normalized === 'failure') return styles.setTypeChipFailure;

  return styles.setTypeChipNormal;
}

function getSetTypeRowStyle(setType: SetRow['set_type']) {
  const normalized = normalizeSetTypeOption(setType);

  if (normalized === 'warmup') return styles.setRowWarmup;
  if (normalized === 'drop') return styles.setRowDrop;
  if (normalized === 'failure') return styles.setRowFailure;

  return null;
}

function getCompletedExerciseNames(exercises: ActiveExercise[]): string[] {
  const names = exercises
    .filter((exercise) => exercise.sets.some((setItem) => setItem.completed))
    .map((exercise) => exercise.exercise.name.trim())
    .filter((name) => name.length > 0);

  return [...new Set(names)];
}

function isPrHunterHit(currentSet: ActiveSet, ghostSet: PreviousExercisePerformanceSet | null): boolean {
  if (!ghostSet) {
    return false;
  }

  const currentWeight = currentSet.weight;
  const currentReps = currentSet.reps;
  const ghostWeight = ghostSet.weight;
  const ghostReps = ghostSet.reps;

  if (
    currentWeight === null ||
    currentReps === null ||
    ghostWeight === null ||
    ghostReps === null ||
    !Number.isFinite(currentWeight) ||
    !Number.isFinite(currentReps) ||
    !Number.isFinite(ghostWeight) ||
    !Number.isFinite(ghostReps)
  ) {
    return false;
  }

  if (currentWeight > ghostWeight) {
    return true;
  }

  return currentWeight === ghostWeight && currentReps > ghostReps;
}

function getRirFeedbackColor(rir: number | null): string | null {
  if (rir === null || !Number.isFinite(rir)) {
    return null;
  }

  if (rir <= 0) {
    return '#EF4444';
  }

  if (rir <= 1) {
    return '#F59E0B';
  }

  if (rir <= 3) {
    return '#22C55E';
  }

  return '#22D3EE';
}

function getProgressionHint(rir: number | null): ProgressionHint | null {
  if (rir === null || !Number.isFinite(rir)) {
    return null;
  }

  if (rir >= 4) {
    return {
      message: '💡 Try +2.5kg next set',
      color: '#86EFAC',
    };
  }

  if (rir <= 1) {
    return {
      message: '🔥 Great intensity! Stay here.',
      color: '#FBBF24',
    };
  }

  return null;
}

function parseSerializedTemplateExercises(rawValue: string | string[] | undefined): TemplatePreloadExercise[] {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (!value) {
    return [];
  }

  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalizedExercises: TemplatePreloadExercise[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      // New payload format: { exercise, restSeconds }
      if ('exercise' in item) {
        const maybeExercise = (item as { exercise?: unknown }).exercise;

        if (
          maybeExercise &&
          typeof maybeExercise === 'object' &&
          typeof (maybeExercise as ExerciseRow).id === 'string' &&
          typeof (maybeExercise as ExerciseRow).name === 'string'
        ) {
          const restSeconds = (item as { restSeconds?: number | null }).restSeconds;
          normalizedExercises.push({
            exercise: maybeExercise as ExerciseRow,
            restSeconds: normalizeExerciseRestSeconds(restSeconds),
          });
        }

        continue;
      }

      // Backward compatible payload format: ExerciseRow[]
      if (typeof (item as ExerciseRow).id === 'string' && typeof (item as ExerciseRow).name === 'string') {
        normalizedExercises.push({
          exercise: item as ExerciseRow,
          restSeconds: DEFAULT_REST_SECONDS,
        });
      }
    }

    return normalizedExercises;
  } catch {
    return [];
  }
}

function buildCatalogCacheKey(filters: ExerciseCatalogFilters): string {
  const muscle = filters.muscle ?? 'all';
  const equipment = filters.equipment ?? 'all';

  return `${muscle}::${equipment}`;
}

export default function ActiveWorkout() {
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{
    routineId?: string | string[];
    templateId?: string | string[];
    templateExercises?: string | string[];
  }>();
  useKeepAwake();

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

  const routeTemplateExercises = useMemo(
    () => parseSerializedTemplateExercises(searchParams.templateExercises),
    [searchParams.templateExercises]
  );

  const [workoutStartedAtMs] = useState(() => Date.now());
  const workoutStartedAt = useMemo(() => new Date(workoutStartedAtMs).toISOString(), [workoutStartedAtMs]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restEndAtMs, setRestEndAtMs] = useState<number | null>(null);
  const [restRemainingSeconds, setRestRemainingSeconds] = useState(0);
  const [restTotalSeconds, setRestTotalSeconds] = useState(DEFAULT_REST_SECONDS);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<ExerciseLibraryMuscleFilter>('all');
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState<ExerciseLibraryEquipmentFilter>('all');
  const [createExerciseVisible, setCreateExerciseVisible] = useState(false);
  const [catalogExercises, setCatalogExercises] = useState<ExerciseRow[]>([]);
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [ghostSetsByExerciseId, setGhostSetsByExerciseId] = useState<Record<string, PreviousExercisePerformanceSet[]>>({});
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
  const [isPlateCalculatorVisible, setIsPlateCalculatorVisible] = useState(false);
  const [plateCalculatorInitialWeight, setPlateCalculatorInitialWeight] = useState('');
  const [focusedWeightSetKey, setFocusedWeightSetKey] = useState<string | null>(null);
  const [isExerciseStatsVisible, setIsExerciseStatsVisible] = useState(false);
  const [statsExercise, setStatsExercise] = useState<ExerciseRow | null>(null);
  const [statsExerciseProgress, setStatsExerciseProgress] = useState<ExerciseProgressPoint[]>([]);
  const [isLoadingExerciseStats, setIsLoadingExerciseStats] = useState(false);
  const [exerciseStatsError, setExerciseStatsError] = useState<string | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredRestVibrationRef = useRef(false);
  const requestedGhostExerciseIdsRef = useRef<Set<string>>(new Set());
  const exerciseCatalogByFilterRef = useRef<Map<string, ExerciseRow[]>>(new Map());
  const celebratedPrExerciseIdsRef = useRef<Set<string>>(new Set());
  const previousPrHitSetIdsRef = useRef<Set<string>>(new Set());
  const prBadgeScaleBySetKeyRef = useRef<Map<string, Animated.Value>>(new Map());
  const completionGlowByExerciseIdRef = useRef<Map<string, Animated.Value>>(new Map());
  const exerciseProgressCacheRef = useRef<Map<string, ExerciseProgressPoint[]>>(new Map());
  const requestedProgressExerciseIdsRef = useRef<Set<string>>(new Set());
  const statsRequestVersionRef = useRef(0);

  const liveChartWidth = useMemo(() => Math.max(250, Dimensions.get('window').width - 72), []);

  const clearElapsedTimer = useCallback(() => {
    if (!elapsedTimerRef.current) {
      return;
    }

    clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = null;
  }, []);

  const clearRestTimer = useCallback(() => {
    if (!restTimerRef.current) {
      return;
    }

    clearInterval(restTimerRef.current);
    restTimerRef.current = null;
  }, []);

  useEffect(() => {
    const syncElapsedTimer = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - workoutStartedAtMs) / 1000));
      setElapsedSeconds(elapsed);
    };

    syncElapsedTimer();
    clearElapsedTimer();
    elapsedTimerRef.current = setInterval(syncElapsedTimer, 1000);

    return () => {
      clearElapsedTimer();
    };
  }, [clearElapsedTimer, workoutStartedAtMs]);

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

        setActiveExercises(routine.exercises.map((entry) => createExerciseBlock(entry.exercise)));
        setPreloadedRoutineId(routine.id);
      } catch (error) {
        setRoutinePreloadError(getErrorMessage(error));
      } finally {
        setIsPreloadingRoutine(false);
      }
    },
    [preloadedRoutineId]
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

        setActiveExercises(
          template.exercises.map((entry) => createExerciseBlock(entry.exercise, entry.rest_seconds ?? DEFAULT_REST_SECONDS))
        );
        setPreloadedTemplateId(template.id);
      } catch (error) {
        setTemplatePreloadError(getErrorMessage(error));
      } finally {
        setIsPreloadingTemplate(false);
      }
    },
    [preloadedTemplateId]
  );

  useEffect(() => {
    const preloadKey = routeTemplateId ?? INLINE_TEMPLATE_PRELOAD_KEY;

    if (routeTemplateExercises.length > 0) {
      if (preloadedTemplateId === preloadKey) {
        return;
      }

      setActiveExercises(
        routeTemplateExercises.map((entry) => createExerciseBlock(entry.exercise, entry.restSeconds))
      );
      setPreloadedTemplateId(preloadKey);
      setTemplatePreloadError(null);
      setIsPreloadingTemplate(false);
      return;
    }

    if (routeTemplateId) {
      void preloadTemplate(routeTemplateId);
      return;
    }

    if (routeRoutineId) {
      void preloadRoutine(routeRoutineId);
    }
  }, [
    preloadedTemplateId,
    preloadRoutine,
    preloadTemplate,
    routeRoutineId,
    routeTemplateExercises,
    routeTemplateId,
  ]);

  const hydrateGhostPerformances = useCallback(async (exerciseIds: string[]) => {
    const normalizedExerciseIds = [...new Set(exerciseIds.map((id) => id.trim()).filter(Boolean))];
    const pendingExerciseIds = normalizedExerciseIds.filter(
      (exerciseId) => !requestedGhostExerciseIdsRef.current.has(exerciseId)
    );

    if (pendingExerciseIds.length === 0) {
      return;
    }

    for (const exerciseId of pendingExerciseIds) {
      requestedGhostExerciseIdsRef.current.add(exerciseId);
    }

    const results = await Promise.all(
      pendingExerciseIds.map(async (exerciseId) => {
        try {
          const previousSets = await getPreviousExercisePerformance(exerciseId, null);

          return {
            exerciseId,
            previousSets,
          };
        } catch {
          return {
            exerciseId,
            previousSets: [] as PreviousExercisePerformanceSet[],
          };
        }
      })
    );

    setGhostSetsByExerciseId((currentValue) => {
      const nextValue = { ...currentValue };

      for (const result of results) {
        nextValue[result.exerciseId] = result.previousSets;
      }

      return nextValue;
    });
  }, []);

  useEffect(() => {
    void hydrateGhostPerformances(activeExercises.map((exercise) => exercise.exercise.id));
  }, [activeExercises, hydrateGhostPerformances]);

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

  const getPrBadgeScaleValue = useCallback((setKey: string): Animated.Value => {
    const existingScale = prBadgeScaleBySetKeyRef.current.get(setKey);

    if (existingScale) {
      return existingScale;
    }

    const newScale = new Animated.Value(1);
    prBadgeScaleBySetKeyRef.current.set(setKey, newScale);
    return newScale;
  }, []);

  const getExerciseCompletionGlowValue = useCallback((exerciseId: string): Animated.Value => {
    const existingValue = completionGlowByExerciseIdRef.current.get(exerciseId);

    if (existingValue) {
      return existingValue;
    }

    const nextValue = new Animated.Value(0);
    completionGlowByExerciseIdRef.current.set(exerciseId, nextValue);
    return nextValue;
  }, []);

  const animateExerciseCompletionGlow = useCallback(
    (exerciseId: string) => {
      const glow = getExerciseCompletionGlowValue(exerciseId);

      glow.stopAnimation();
      glow.setValue(0.02);

      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.6,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 360,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [getExerciseCompletionGlowValue]
  );

  const animatePrBadgePop = useCallback(
    (setKey: string) => {
      const scale = getPrBadgeScaleValue(setKey);

      scale.stopAnimation();
      scale.setValue(0.76);

      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.24,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 170,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [getPrBadgeScaleValue]
  );

  useEffect(() => {
    const nextPrHitSetKeys = new Set<string>();
    let shouldTriggerSuccessHaptic = false;

    for (const exercise of activeExercises) {
      const previousSets = ghostSetsByExerciseId[exercise.exercise.id] ?? [];

      for (let setIndex = 0; setIndex < exercise.sets.length; setIndex += 1) {
        const setItem = exercise.sets[setIndex];
        const ghostSet = getGhostSetForRow(previousSets, setItem.set_number, setIndex);
        const isPrHit = isPrHunterHit(setItem, ghostSet);
        const setKey = `${exercise.id}:${setItem.id}`;

        if (!isPrHit) {
          continue;
        }

        nextPrHitSetKeys.add(setKey);

        if (!previousPrHitSetIdsRef.current.has(setKey)) {
          animatePrBadgePop(setKey);

          if (!celebratedPrExerciseIdsRef.current.has(exercise.id)) {
            celebratedPrExerciseIdsRef.current.add(exercise.id);
            shouldTriggerSuccessHaptic = true;
          }
        }
      }
    }

    previousPrHitSetIdsRef.current = nextPrHitSetKeys;

    if (shouldTriggerSuccessHaptic) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        Vibration.vibrate(30);
      });
    }
  }, [activeExercises, animatePrBadgePop, ghostSetsByExerciseId]);

  const startRestTimer = useCallback((seconds = DEFAULT_REST_SECONDS) => {
    const safeSeconds = ensurePositiveRestSeconds(seconds);

    hasTriggeredRestVibrationRef.current = false;
    setRestTotalSeconds(safeSeconds);
    setRestRemainingSeconds(safeSeconds);
    setRestEndAtMs(startTimerFromNow(safeSeconds));
  }, []);

  const finishRestTimer = useCallback(() => {
    hasTriggeredRestVibrationRef.current = false;
    setRestEndAtMs(null);
    setRestRemainingSeconds(0);
    setRestTotalSeconds(DEFAULT_REST_SECONDS);
  }, []);

  const adjustRestTimer = useCallback((deltaSeconds: number) => {
    setRestEndAtMs((currentEndAtMs) => {
      const currentRemaining = currentEndAtMs ? getRemainingSeconds(currentEndAtMs) : 0;
      const nextRemaining = clampRestSeconds(currentRemaining + deltaSeconds);

      if (nextRemaining <= 0) {
        hasTriggeredRestVibrationRef.current = false;
        setRestRemainingSeconds(0);
        setRestTotalSeconds(DEFAULT_REST_SECONDS);
        return null;
      }

      setRestTotalSeconds((currentTotal) => {
        const baseTotal = currentEndAtMs ? Math.max(currentTotal, currentRemaining) : nextRemaining;
        const nextTotal = clampRestSeconds(baseTotal + deltaSeconds);

        if (nextTotal <= 0) {
          return nextRemaining;
        }

        return Math.max(nextRemaining, nextTotal);
      });

      hasTriggeredRestVibrationRef.current = false;
      setRestRemainingSeconds(nextRemaining);
      return startTimerFromNow(nextRemaining);
    });
  }, []);

  useEffect(() => {
    if (!restEndAtMs) {
      clearRestTimer();
      return;
    }

    const syncRestTimer = () => {
      const remaining = getRemainingSeconds(restEndAtMs);
      setRestRemainingSeconds(remaining);

      if (remaining > 0) {
        return;
      }

      setRestEndAtMs(null);

      if (!hasTriggeredRestVibrationRef.current) {
        hasTriggeredRestVibrationRef.current = true;
        Vibration.vibrate();
      }
    };

    syncRestTimer();
    clearRestTimer();
    restTimerRef.current = setInterval(syncRestTimer, 250);

    return () => {
      clearRestTimer();
    };
  }, [clearRestTimer, restEndAtMs]);

  useEffect(() => {
    return () => {
      clearElapsedTimer();
      clearRestTimer();
      deactivateKeepAwake();
    };
  }, [clearElapsedTimer, clearRestTimer]);

  const timerLabel = useMemo(() => formatElapsedTime(elapsedSeconds), [elapsedSeconds]);
  const restTimerLabel = useMemo(() => formatCountdown(restRemainingSeconds), [restRemainingSeconds]);
  const isRestTimerActive = restEndAtMs !== null;
  const restTimerProgress = useMemo(() => {
    if (!isRestTimerActive) {
      return 0;
    }

    const total = Math.max(1, restTotalSeconds);
    return Math.min(1, Math.max(0, restRemainingSeconds / total));
  }, [isRestTimerActive, restRemainingSeconds, restTotalSeconds]);
  const restTimerProgressRemaining = useMemo(() => Math.max(0, 1 - restTimerProgress), [restTimerProgress]);
  const liveStatsChartData = useMemo(
    () =>
      statsExerciseProgress.slice(-12).map((point) => ({
        value: Math.max(0, point.value),
        label: point.label,
      })),
    [statsExerciseProgress]
  );

  const openPlateCalculator = useCallback((weightInput: string) => {
    setFocusedWeightSetKey(null);
    setPlateCalculatorInitialWeight(sanitizeDecimalInput(weightInput));
    setIsPlateCalculatorVisible(true);
  }, []);

  const handleWeightInputFocus = useCallback((exerciseId: string, setId: string, equipment: string | null) => {
    if (!isBarbellExerciseEquipment(equipment)) {
      setFocusedWeightSetKey(null);
      return;
    }

    setFocusedWeightSetKey(buildSetFocusKey(exerciseId, setId));
  }, []);

  const handleWeightInputBlur = useCallback((exerciseId: string, setId: string) => {
    const targetKey = buildSetFocusKey(exerciseId, setId);

    setFocusedWeightSetKey((currentValue) => (currentValue === targetKey ? null : currentValue));
  }, []);

  const applyGhostSetToCurrent = useCallback(
    (exerciseId: string, setId: string, ghostSet: PreviousExercisePerformanceSet) => {
      const weightInput = formatInputFromNumber(ghostSet.weight, 'decimal');
      const repsInput = formatInputFromNumber(ghostSet.reps, 'integer');
      const rirInput = formatInputFromNumber(ghostSet.rir, 'decimal');

      setActiveExercises((currentValue) =>
        currentValue.map((exercise) => {
          if (exercise.id !== exerciseId) {
            return exercise;
          }

          return {
            ...exercise,
            sets: exercise.sets.map((setItem) => {
              if (setItem.id !== setId) {
                return setItem;
              }

              return {
                ...setItem,
                weightInput,
                repsInput,
                rirInput,
                weight: parseOptionalNumber(weightInput),
                reps: parseOptionalNumber(repsInput),
                rir: parseOptionalNumber(rirInput),
              };
            }),
          };
        })
      );

      void Haptics.selectionAsync().catch(() => {
        Vibration.vibrate(10);
      });
    },
    []
  );

  function toggleSetCompleted(exerciseId: string, setId: string) {
    setActiveExercises((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) =>
            setItem.id === setId ? { ...setItem, completed: !setItem.completed } : setItem
          ),
        };
      })
    );
  }

  function cycleSetType(exerciseId: string, setId: string) {
    setActiveExercises((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) => {
            if (setItem.id !== setId) {
              return setItem;
            }

            return {
              ...setItem,
              set_type: getNextSetType(setItem.set_type),
            };
          }),
        };
      })
    );

    void Haptics.selectionAsync().catch(() => {
      Vibration.vibrate(10);
    });
  }

  const handleSetCompletionToggle = useCallback(
    (exerciseId: string, setId: string) => {
      const targetExercise = activeExercises.find((exercise) => exercise.id === exerciseId);
      const targetSet = targetExercise?.sets.find((setItem) => setItem.id === setId);

      const willBeCompleted = targetSet ? !targetSet.completed : false;
      const restSecondsForExercise = normalizeExerciseRestSeconds(targetExercise?.defaultRestSeconds);

      toggleSetCompleted(exerciseId, setId);

      if (willBeCompleted) {
        startRestTimer(restSecondsForExercise);
        animateExerciseCompletionGlow(exerciseId);

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          Vibration.vibrate(10);
        });
      }
    },
    [activeExercises, animateExerciseCompletionGlow, startRestTimer]
  );

  function updateSetInput(exerciseId: string, setId: string, field: SetInputField, value: string) {
    const sanitizedValue = field === 'weightInput' ? sanitizeDecimalInput(value) : sanitizeIntegerInput(value);

    setActiveExercises((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) => {
            if (setItem.id !== setId) {
              return setItem;
            }

            if (field === 'weightInput') {
              return {
                ...setItem,
                weightInput: sanitizedValue,
                weight: parseOptionalNumber(sanitizedValue),
              };
            }

            if (field === 'repsInput') {
              return {
                ...setItem,
                repsInput: sanitizedValue,
                reps: parseOptionalNumber(sanitizedValue),
              };
            }

            return {
              ...setItem,
              rirInput: sanitizedValue,
              rir: parseOptionalNumber(sanitizedValue),
            };
          }),
        };
      })
    );
  }

  function addSet(exerciseId: string) {
    setActiveExercises((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const nextSetNumber = (exercise.sets[exercise.sets.length - 1]?.set_number ?? exercise.sets.length) + 1;

        return {
          ...exercise,
          sets: [...exercise.sets, createSet(exercise.exercise.id, nextSetNumber)],
        };
      })
    );
  }

  function addExercise(exercise: ExerciseRow) {
    setActiveExercises((currentValue) => [...currentValue, createExerciseBlock(exercise)]);
    setExercisePickerVisible(false);
  }

  async function handleCreateExercise() {
    const normalizedName = newExerciseName.trim();

    if (!normalizedName) {
      Alert.alert('Validation', 'Exercise name is required.');
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
      setNewExerciseMuscleGroup('');
      setNewExerciseEquipment('');
      setCreateExerciseVisible(false);

      exerciseCatalogByFilterRef.current.clear();
      await loadExercises({ muscle: selectedMuscleFilter, equipment: selectedEquipmentFilter }, true);
      addExercise(createdExercise);
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
      const setDrafts: WorkoutSetProgressDraft[] = activeExercises.flatMap((exercise) =>
        exercise.sets.map((setItem) => ({
          exerciseId: exercise.exercise.id,
          setNumber: setItem.set_number,
          weight: setItem.weight,
          reps: setItem.reps,
          rir: setItem.rir,
          completed: setItem.completed,
          setType: normalizeSetTypeOption(setItem.set_type),
        }))
      );

      const result = await finishWorkout({
        name: 'Active Workout',
        notes: null,
        templateId: routeTemplateId ?? null,
        startTime: workoutStartedAt,
        setDrafts,
      });

      setFinishSummary(result);
      setSummaryExerciseNames(getCompletedExerciseNames(activeExercises));
      setIsSummaryVisible(true);
      finishRestTimer();
    } catch (error) {
      Alert.alert('Unable to finish workout', getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleShareAndFinish = useCallback(() => {
    deactivateKeepAwake();
    clearElapsedTimer();
    clearRestTimer();
    finishRestTimer();
    setIsSummaryVisible(false);
    setFinishSummary(null);
    setSummaryExerciseNames([]);

    // Reset state defensively to avoid phantom in-memory workout state.
    setElapsedSeconds(0);
    setActiveExercises([]);
    setExercisePickerVisible(false);
    setCreateExerciseVisible(false);
    celebratedPrExerciseIdsRef.current.clear();
    previousPrHitSetIdsRef.current.clear();
    prBadgeScaleBySetKeyRef.current.clear();
    completionGlowByExerciseIdRef.current.clear();

    router.replace('/(tabs)/index' as any);
  }, [clearElapsedTimer, clearRestTimer, finishRestTimer]);

  const routePreloadLabel = routeTemplateId ? 'template' : 'routine';
  const isPreloadingRoute = routeTemplateId ? isPreloadingTemplate : isPreloadingRoutine;
  const routePreloadError = routeTemplateId ? templatePreloadError : routinePreloadError;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.container}>
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

        <View style={styles.restTimerInlineCard}>
          <View style={styles.restTimerInlineHeaderRow}>
            <View style={styles.restTimerInlineBadge}>
              <Ionicons name="timer-outline" size={14} color={palette.textMuted} />
              <Text style={styles.restTimerInlineBadgeText}>Rest</Text>
            </View>

            <Text style={[styles.restTimerInlineValue, isRestTimerActive && styles.restTimerInlineValueActive]}>
              {restTimerLabel}
            </Text>
          </View>

          <View style={styles.restTimerProgressTrack}>
            <View style={[styles.restTimerProgressFill, { flex: restTimerProgress }]} />
            <View style={{ flex: restTimerProgressRemaining }} />
          </View>

          <View style={styles.restTimerInlineActionsRow}>
            <TouchableOpacity
              style={[styles.restTimerPillButton, !isRestTimerActive && styles.restTimerPillButtonDisabled]}
              activeOpacity={0.85}
              onPress={() => adjustRestTimer(-REST_STEP_SECONDS)}
              disabled={!isRestTimerActive}
            >
              <Text style={styles.restTimerPillButtonText}>-30s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.restTimerPillButton} activeOpacity={0.85} onPress={() => adjustRestTimer(REST_STEP_SECONDS)}>
              <Text style={styles.restTimerPillButtonText}>+30s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.restTimerPillButton,
                styles.restTimerSkipButton,
                !isRestTimerActive && styles.restTimerPillButtonDisabled,
              ]}
              activeOpacity={0.85}
              onPress={finishRestTimer}
              disabled={!isRestTimerActive}
            >
              <Text style={styles.restTimerPillButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
            activeExercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.exerciseCompletionGlow,
                    {
                      opacity: getExerciseCompletionGlowValue(exercise.id),
                    },
                  ]}
                />

                <View style={styles.exerciseHeaderRow}>
                  <View style={styles.exerciseHeaderTextWrap}>
                    <Text style={styles.exerciseTitle}>{exercise.exercise.name}</Text>
                    <Text style={styles.exerciseRestHint}>{`Rest ${exercise.defaultRestSeconds}s`}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.exerciseStatsButton}
                    activeOpacity={0.86}
                    onPress={() => openExerciseStatsModal(exercise.exercise)}
                  >
                    <Ionicons name="stats-chart-outline" size={18} color={palette.textSecondary} />
                  </TouchableOpacity>
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

                {exercise.sets.map((setItem, setIndex) => {
                  const ghostSet = getGhostSetForRow(
                    ghostSetsByExerciseId[exercise.exercise.id] ?? [],
                    setItem.set_number,
                    setIndex
                  );
                  const isPrHit = isPrHunterHit(setItem, ghostSet);
                  const isBarbellExercise = isBarbellExerciseEquipment(exercise.exercise.equipment);
                  const focusKey = buildSetFocusKey(exercise.id, setItem.id);
                  const isPlateTooltipVisible = isBarbellExercise && focusedWeightSetKey === focusKey;
                  const platePreview = isPlateTooltipVisible ? calculatePlateBreakdown(setItem.weight ?? 0, 20) : null;
                  const plateChipValues = platePreview
                    ? platePreview.breakdown.flatMap((item) => Array.from({ length: item.countPerSide }, () => item.plate))
                    : [];
                  const estimatedOneRepMax = estimateOneRepMax(setItem.weight, setItem.reps);
                  const rirFeedbackColor = getRirFeedbackColor(setItem.rir);
                  const progressionHint = getProgressionHint(setItem.rir);
                  const setKey = `${exercise.id}:${setItem.id}`;

                  return (
                    <View key={setItem.id} style={styles.setRowWrapper}>
                      <View
                        style={[
                          styles.tableRow,
                          setItem.completed && styles.completedRow,
                          getSetTypeRowStyle(setItem.set_type),
                        ]}
                      >
                        <View style={[styles.cellSet, styles.setCellWrap]}>
                          <Text style={styles.setNumberText}>{setItem.set_number ?? '-'}</Text>

                          <TouchableOpacity
                            style={[styles.setTypeChip, getSetTypeChipStyle(setItem.set_type)]}
                            activeOpacity={0.88}
                            onPress={() => cycleSetType(exercise.id, setItem.id)}
                          >
                            <Text style={styles.setTypeChipText}>{getSetTypeLabel(setItem.set_type)}</Text>
                          </TouchableOpacity>

                          {isPrHit ? (
                            <Animated.View
                              style={[
                                styles.prHunterBadge,
                                {
                                  transform: [{ scale: getPrBadgeScaleValue(setKey) }],
                                },
                              ]}
                            >
                              <Text style={styles.prHunterBadgeText}>🔥</Text>
                            </Animated.View>
                          ) : null}
                        </View>

                        <View style={styles.cellKgWrap}>
                          <TextInput
                            value={setItem.weightInput}
                            onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'weightInput', value)}
                            onFocus={() => handleWeightInputFocus(exercise.id, setItem.id, exercise.exercise.equipment)}
                            onPressIn={() => handleWeightInputFocus(exercise.id, setItem.id, exercise.exercise.equipment)}
                            onBlur={() => handleWeightInputBlur(exercise.id, setItem.id)}
                            style={[styles.numericInput, styles.kgInput, setItem.completed && styles.numericInputCompleted]}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={palette.textMuted}
                          />

                          {isBarbellExercise ? (
                            <TouchableOpacity
                              style={styles.plateButton}
                              activeOpacity={0.85}
                              onPress={() => openPlateCalculator(setItem.weightInput)}
                              onLongPress={() => openPlateCalculator(setItem.weightInput)}
                            >
                              <Ionicons name="calculator-outline" size={14} color={palette.textSecondary} />
                            </TouchableOpacity>
                          ) : null}
                        </View>

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
                          style={[
                            styles.numericInput,
                            styles.cellRir,
                            setItem.completed && styles.numericInputCompleted,
                            rirFeedbackColor ? { borderColor: rirFeedbackColor, color: rirFeedbackColor } : null,
                          ]}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={palette.textMuted}
                        />

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

                      {estimatedOneRepMax !== null ? (
                        <View style={styles.estimatedOneRmWrap}>
                          <Text style={styles.estimatedOneRmText}>{`🎯 Est. 1RM: ${formatPlateWeight(estimatedOneRepMax)}kg`}</Text>
                        </View>
                      ) : null}

                      {isPlateTooltipVisible ? (
                        <View style={styles.inlinePlateTooltip}>
                          <Text style={styles.inlinePlateTitle}>Plate setup per side</Text>

                          <View style={styles.inlinePlateChipRow}>
                            <Text style={styles.inlinePlateBaseText}>Barra</Text>

                            {plateChipValues.length > 0 ? <Text style={styles.inlinePlatePlusText}>+</Text> : null}

                            {plateChipValues.length > 0 ? (
                              plateChipValues.map((plateValue, plateIndex) => (
                                <View key={`${setKey}-plate-${plateValue}-${plateIndex}`} style={styles.inlinePlateChip}>
                                  <Text style={styles.inlinePlateChipText}>{formatPlateWeight(plateValue)}</Text>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.inlinePlateEmptyText}>Apenas barra</Text>
                            )}
                          </View>

                          {platePreview && platePreview.remainderPerSide > 0 ? (
                            <Text style={styles.inlinePlateRemainderText}>
                              {`Resto por lado: ${formatPlateWeight(platePreview.remainderPerSide)}kg`}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}

                      {ghostSet ? (
                        <TouchableOpacity
                          style={styles.ghostCopyButton}
                          activeOpacity={0.85}
                          onPress={() => applyGhostSetToCurrent(exercise.id, setItem.id, ghostSet)}
                        >
                          <Ionicons name="copy-outline" size={12} color="#6B7280" />
                          <Text style={styles.ghostSetText}>{formatGhostSetLabel(ghostSet)}</Text>
                        </TouchableOpacity>
                      ) : null}

                      {progressionHint ? (
                        <View style={styles.progressionHintWrap}>
                          <Text style={[styles.progressionHintText, { color: progressionHint.color }]}>
                            {progressionHint.message}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.addSetButton} activeOpacity={0.88} onPress={() => addSet(exercise.id)}>
                  <Ionicons name="add" size={16} color={palette.textSecondary} />
                  <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
              </View>
            ))
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
        animationType="slide"
        onRequestClose={() => setExercisePickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setExercisePickerVisible(false)} />

          <View style={styles.modalSheet}>
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
                    onPress={() => addExercise(exercise)}
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
        animationType="slide"
        onRequestClose={() => setCreateExerciseVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setCreateExerciseVisible(false)} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Exercise</Text>

            <TextInput
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              style={styles.modalInput}
              placeholder="Name"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
            />
            <TextInput
              value={newExerciseMuscleGroup}
              onChangeText={setNewExerciseMuscleGroup}
              style={styles.modalInput}
              placeholder="Muscle Group"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
            />
            <TextInput
              value={newExerciseEquipment}
              onChangeText={setNewExerciseEquipment}
              style={styles.modalInput}
              placeholder="Equipment"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
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
        animationType="slide"
        onRequestClose={closeExerciseStatsModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={closeExerciseStatsModal} />

          <View style={styles.liveStatsSheet}>
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
        totalVolume={finishSummary?.totalVolume ?? 0}
        completedSetCount={finishSummary?.completedSetCount ?? 0}
        exerciseNames={summaryExerciseNames}
        onShareAndFinish={handleShareAndFinish}
      />

      <PlateCalculatorModal
        visible={isPlateCalculatorVisible}
        initialTotalWeight={plateCalculatorInitialWeight}
        onClose={() => setIsPlateCalculatorVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  container: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
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
  restTimerInlineCard: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  restTimerInlineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restTimerInlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
  },
  restTimerInlineBadgeText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  restTimerInlineValue: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  restTimerInlineValueActive: {
    color: '#22C55E',
  },
  restTimerProgressTrack: {
    marginTop: 8,
    flexDirection: 'row',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  restTimerProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  restTimerInlineActionsRow: {
    marginTop: 9,
    flexDirection: 'row',
    columnGap: 7,
  },
  restTimerPillButton: {
    flex: 1,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  restTimerPillButtonDisabled: {
    opacity: 0.45,
  },
  restTimerPillButtonText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  restTimerSkipButton: {
    borderColor: '#7F1D1D',
    backgroundColor: '#2A1118',
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
  exerciseTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  exerciseRestHint: {
    marginTop: 2,
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    columnGap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
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
  setRowWarmup: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    opacity: 0.9,
  },
  setRowDrop: {
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
  },
  setRowFailure: {
    backgroundColor: 'rgba(127, 29, 29, 0.48)',
  },
  ghostCopyButton: {
    marginTop: 4,
    marginBottom: 2,
    marginLeft: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1320',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  ghostSetText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },
  estimatedOneRmWrap: {
    marginTop: 4,
    marginLeft: 8,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#0C1D34',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  estimatedOneRmText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  inlinePlateTooltip: {
    marginTop: 5,
    marginLeft: 8,
    marginBottom: 2,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1320',
    paddingHorizontal: 8,
    paddingVertical: 6,
    rowGap: 5,
  },
  inlinePlateTitle: {
    color: '#9FB1C9',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  inlinePlateChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    rowGap: 6,
  },
  inlinePlateBaseText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
  },
  inlinePlatePlusText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  inlinePlateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#11243F',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inlinePlateChipText: {
    color: '#EAF1FF',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  inlinePlateEmptyText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  inlinePlateRemainderText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  progressionHintWrap: {
    marginTop: 4,
    marginBottom: 2,
    marginLeft: 10,
  },
  progressionHintText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  cellSet: {
    width: 44,
    textAlign: 'center',
  },
  setCellWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  setNumberText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  setTypeChip: {
    minWidth: 30,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  setTypeChipNormal: {
    borderColor: '#334155',
    backgroundColor: '#1F2937',
  },
  setTypeChipWarmup: {
    borderColor: '#D97706',
    backgroundColor: '#4B350C',
  },
  setTypeChipDrop: {
    borderColor: '#EA580C',
    backgroundColor: '#4A210D',
  },
  setTypeChipFailure: {
    borderColor: '#B91C1C',
    backgroundColor: '#3F1114',
  },
  setTypeChipText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  prHunterBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7C2D12',
    backgroundColor: '#2A160E',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  prHunterBadgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
  cellKg: {
    width: 92,
  },
  cellKgWrap: {
    width: 92,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  kgInput: {
    flex: 1,
    minWidth: 0,
  },
  cellReps: {
    width: 64,
  },
  cellRir: {
    width: 64,
  },
  numericInput: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    color: palette.textPrimary,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 6,
    fontVariant: ['tabular-nums'],
  },
  numericInputCompleted: {
    borderColor: '#3B82F6',
    backgroundColor: '#1D3550',
  },
  plateButton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellCheck: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButton: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 6,
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
