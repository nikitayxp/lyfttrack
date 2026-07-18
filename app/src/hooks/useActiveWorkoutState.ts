import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Animated, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Tables } from '@/types/database';
import {
  INPUT_LIMITS,
  sanitizeDecimalText,
  sanitizeIntegerText,
  toSafeInteger,
  toSafeNumber,
} from '@/utils/inputValidation';
import {
  type DraftExercise,
  type WorkoutDraft,
  buildDraftId,
  clearWorkoutDraft,
  loadWorkoutDraft,
  saveWorkoutDraftNow,
  scheduleWorkoutDraftSave,
  SCHEMA_VERSION,
} from '@/services/offlineSyncService';

export type ExerciseRow = Tables<'exercises'>;
export type SetRow = Tables<'sets'>;

export type SetTypeOption = Exclude<SetRow['set_type'], null>;
export type SetSideOption = SetRow['side'];
export type SetInputField = 'weightInput' | 'repsInput' | 'rirInput';

export type ActiveSet = Pick<SetRow, 'id' | 'set_number' | 'weight' | 'reps' | 'rir' | 'set_type'> & {
  completed: boolean;
  weightInput: string;
  repsInput: string;
  rirInput: string;
  side: SetSideOption;
};

export type ActiveExercise = {
  id: string;
  exercise: ExerciseRow;
  defaultRestSeconds: number;
  sets: ActiveSet[];
  /** Per-workout snapshot of the exercise description/notes. */
  notes: string | null;
};

export type ActiveExercisesUpdater = ActiveExercise[] | ((currentValue: ActiveExercise[]) => ActiveExercise[]);

const DEFAULT_REST_SECONDS = 90;

function parseOptionalWeight(value: string): number | null {
  return toSafeNumber(value, { min: 0, max: INPUT_LIMITS.weightMax, decimals: 2 });
}

function trimWeightInput(weight: number): string {
  const normalized = toSafeNumber(weight, { min: 0, max: INPUT_LIMITS.weightMax, decimals: 2 });
  if (normalized === null) {
    return '';
  }
  return Number.isInteger(normalized) ? String(normalized) : String(normalized);
}

function parseOptionalReps(value: string): number | null {
  return toSafeInteger(value, { min: 0, max: INPUT_LIMITS.repsMax });
}

function parseOptionalRir(value: string): number | null {
  return toSafeInteger(value, { min: 0, max: INPUT_LIMITS.rirMax });
}

export function normalizeSetTypeOption(current: SetRow['set_type']): SetTypeOption {
  if (!current) return 'normal';
  const normalized = current.toLowerCase();
  if (normalized === 'working') return 'normal';
  if (normalized === 'dropset') return 'drop';
  if (normalized === 'warmup' || normalized === 'normal' || normalized === 'drop' || normalized === 'failure') {
    return normalized as SetTypeOption;
  }
  return 'normal';
}

export function normalizeExerciseRestSeconds(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_REST_SECONDS;
  const normalized = Math.trunc(value);
  return Math.max(0, Math.min(900, normalized));
}

export function createSet(
  exerciseId: string,
  setNumber: number,
  initial?: {
    weightInput?: string;
    repsInput?: string;
    rirInput?: string;
    setType?: SetTypeOption;
    side?: SetSideOption;
  }
): ActiveSet {
  const weightInput = initial?.weightInput ?? '';
  const repsInput = initial?.repsInput ?? '';
  const rirInput = initial?.rirInput ?? '';
  return {
    id: `${exerciseId}-set-${setNumber}-${Math.random().toString(36).slice(2, 8)}`,
    set_number: setNumber,
    set_type: initial?.setType ?? 'normal',
    side: initial?.side ?? 'both',
    weight: parseOptionalWeight(weightInput),
    reps: parseOptionalReps(repsInput),
    rir: parseOptionalRir(rirInput),
    completed: false,
    weightInput,
    repsInput,
    rirInput,
  };
}

export function createExerciseBlock(exercise: ExerciseRow, defaultRestSeconds = DEFAULT_REST_SECONDS): ActiveExercise {
  return {
    id: `active-${exercise.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    exercise,
    defaultRestSeconds: normalizeExerciseRestSeconds(defaultRestSeconds),
    notes: exercise.description ?? null,
    sets: [
      createSet(exercise.id, 1, { setType: 'warmup' }),
      createSet(exercise.id, 2, { setType: 'normal' }),
    ],
  };
}

export type CopySetSeed = {
  setType?: SetTypeOption | null;
  weight?: number | null;
  reps?: number | null;
  rir?: number | null;
  side?: SetSideOption | null;
};

/**
 * Build an ActiveExercise from a list of past set seeds (e.g. when copying a
 * previous workout). Inputs (kg/reps/rir) are pre-filled but every set starts
 * uncompleted, so the user has to tick them off as they execute.
 */
export function createExerciseBlockFromSets(
  exercise: ExerciseRow,
  sets: CopySetSeed[],
  options: { defaultRestSeconds?: number; notes?: string | null } = {}
): ActiveExercise {
  const safeSets = sets.length > 0 ? sets : [{ setType: 'warmup' as SetTypeOption }, { setType: 'normal' as SetTypeOption }];

  return {
    id: `active-${exercise.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    exercise,
    defaultRestSeconds: normalizeExerciseRestSeconds(options.defaultRestSeconds ?? DEFAULT_REST_SECONDS),
    notes: options.notes ?? exercise.description ?? null,
    sets: safeSets.map((seed, index) => {
      const weightInput =
        seed.weight != null && Number.isFinite(seed.weight) && seed.weight > 0
          ? trimWeightInput(seed.weight)
          : '';
      const repsInput =
        seed.reps != null && Number.isFinite(seed.reps) && seed.reps > 0
          ? String(Math.trunc(seed.reps))
          : '';
      const rirInput =
        seed.rir != null && Number.isFinite(seed.rir) ? String(seed.rir) : '';

      return createSet(exercise.id, index + 1, {
        setType: (seed.setType as SetTypeOption | undefined) ?? 'normal',
        side: (seed.side as SetSideOption | undefined) ?? 'both',
        weightInput,
        repsInput,
        rirInput,
      });
    }),
  };
}

export function getCompletedExerciseNames(exercises: ActiveExercise[]): string[] {
  const names = exercises
    .filter((exercise) => exercise.sets.some((setItem) => setItem.completed))
    .map((exercise) => exercise.exercise.name.trim())
    .filter((name) => name.length > 0);
  return [...new Set(names)];
}

// ---------- Draft hydration helpers ----------

function exerciseToDraft(exercise: ActiveExercise): DraftExercise {
  return {
    id: exercise.id,
    exerciseId: exercise.exercise.id,
    exerciseName: exercise.exercise.name,
    muscle_group: exercise.exercise.muscle_group ?? null,
    equipment: exercise.exercise.equipment ?? null,
    defaultRestSeconds: exercise.defaultRestSeconds,
    notes: exercise.notes ?? null,
    sets: exercise.sets.map((s) => ({
      id: s.id,
      set_number: s.set_number,
      set_type: s.set_type ?? 'normal',
      side: s.side ?? 'both',
      weight: s.weight,
      reps: s.reps,
      rir: s.rir,
      completed: s.completed,
      weightInput: s.weightInput,
      repsInput: s.repsInput,
      rirInput: s.rirInput,
    })),
  };
}

function normalizeSide(value: unknown): SetSideOption {
  return value === 'left' || value === 'right' ? value : 'both';
}

function draftToActiveExercise(draft: DraftExercise): ActiveExercise {
  const exercise: ExerciseRow = {
    id: draft.exerciseId,
    name: draft.exerciseName,
    name_en: null,
    name_pt: null,
    muscle_group: draft.muscle_group,
    muscle_en: null,
    muscle_pt: null,
    equipment: draft.equipment,
    // required DB fields that aren't stored in the draft
    created_by: null,
    created_at: new Date().toISOString(),
    is_custom: false,
    description: null,
  } as ExerciseRow;

  return {
    id: draft.id,
    exercise,
    defaultRestSeconds: draft.defaultRestSeconds,
    notes: draft.notes ?? null,
    sets: draft.sets.map((s) => ({
      id: s.id,
      set_number: s.set_number,
      set_type: s.set_type as SetTypeOption,
      side: normalizeSide(s.side),
      weight: s.weight,
      reps: s.reps,
      rir: s.rir,
      completed: s.completed,
      weightInput: s.weightInput,
      repsInput: s.repsInput,
      rirInput: s.rirInput,
    })),
  };
}

// ---------- Hook ----------

interface UseActiveWorkoutStateProps {
  onSetCompleted?: (restSeconds: number) => void;
  /** Supabase user.id — required to scope the draft key per user */
  userId?: string | null;
  /** ISO string of when the workout started — used in draft + elapsed reconstruction */
  startTime?: string;
  workoutName?: string;
  templateId?: string | null;
}

export type RecoveredDraftState = {
  draft: WorkoutDraft;
  exercises: ActiveExercise[];
};

export function useActiveWorkoutState({
  onSetCompleted,
  userId,
  startTime,
  workoutName,
  templateId,
}: UseActiveWorkoutStateProps = {}) {
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const activeExercisesRef = useRef<ActiveExercise[]>([]);
  const completionGlowByExerciseIdRef = useRef<Map<string, Animated.Value>>(new Map());

  // Draft state exposed to the consumer so they can show a recovery dialog
  const [recoveredDraft, setRecoveredDraft] = useState<RecoveredDraftState | null>(null);

  // ── Draft auto-save: flush immediately on app-background ──────────────────

  const buildCurrentDraft = useCallback((): WorkoutDraft | null => {
    if (!userId || !startTime) return null;

    return {
      schemaVersion: SCHEMA_VERSION,
      draftId: buildDraftId(userId, startTime),
      userId,
      workoutName: workoutName ?? 'Untitled Workout',
      startTime,
      templateId: templateId ?? null,
      exercises: activeExercisesRef.current.map(exerciseToDraft),
      savedAt: new Date().toISOString(),
    };
  }, [userId, startTime, workoutName, templateId]);

  // Flush on app background
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const draft = buildCurrentDraft();
        if (draft) {
          void saveWorkoutDraftNow(draft);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [buildCurrentDraft]);

  // ── Draft recovery on mount ───────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const tryRecover = async () => {
      const draft = await loadWorkoutDraft(userId);

      if (cancelled || !draft || draft.exercises.length === 0) return;

      const exercises = draft.exercises.map(draftToActiveExercise);
      setRecoveredDraft({ draft, exercises });
    };

    void tryRecover();

    return () => {
      cancelled = true;
    };
  }, [userId]); // Only run on mount — userId won't change during a session

  // ── Core state management ────────────────────────────────────────────────

  const setActiveExercisesWithRef = useCallback((nextValue: ActiveExercisesUpdater) => {
    setActiveExercises((currentValue) => {
      const resolvedValue =
        typeof nextValue === 'function' ? nextValue(currentValue) : nextValue;
      activeExercisesRef.current = resolvedValue;
      return resolvedValue;
    });
  }, []);

  useEffect(() => {
    activeExercisesRef.current = activeExercises;
  }, [activeExercises]);

  // Schedule a debounced draft save whenever exercises change
  useEffect(() => {
    if (!userId || !startTime) return;

    const draft = buildCurrentDraft();
    if (draft) {
      scheduleWorkoutDraftSave(draft);
    }
  }, [activeExercises, buildCurrentDraft, userId, startTime]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getExerciseCompletionGlowValue = useCallback((exerciseId: string): Animated.Value => {
    const existingValue = completionGlowByExerciseIdRef.current.get(exerciseId);
    if (existingValue) return existingValue;
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
        Animated.timing(glow, { toValue: 0.6, duration: 140, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 360, useNativeDriver: true }),
      ]).start();
    },
    [getExerciseCompletionGlowValue]
  );

  const toggleSetCompleted = useCallback((exerciseId: string, setId: string) => {
    setActiveExercisesWithRef((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) =>
            setItem.id === setId ? { ...setItem, completed: !setItem.completed } : setItem
          ),
        };
      })
    );
  }, [setActiveExercisesWithRef]);

  const handleSetCompletionToggle = useCallback(
    (exerciseId: string, setId: string) => {
      const targetExercise = activeExercisesRef.current.find((exercise) => exercise.id === exerciseId);
      const targetSet = targetExercise?.sets.find((setItem) => setItem.id === setId);

      const willBeCompleted = targetSet ? !targetSet.completed : false;
      const restSecondsForExercise = normalizeExerciseRestSeconds(targetExercise?.defaultRestSeconds);

      toggleSetCompleted(exerciseId, setId);

      if (willBeCompleted) {
        if (onSetCompleted) {
          onSetCompleted(restSecondsForExercise);
        }
        animateExerciseCompletionGlow(exerciseId);

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          Vibration.vibrate(10);
        });
      }
    },
    [animateExerciseCompletionGlow, onSetCompleted, toggleSetCompleted]
  );

  const updateSetInput = useCallback((exerciseId: string, setId: string, field: SetInputField, value: string) => {
    const sanitizedValue = field === 'weightInput' ? sanitizeDecimalText(value) : sanitizeIntegerText(value);

    setActiveExercisesWithRef((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) => {
            if (setItem.id !== setId) return setItem;

            if (field === 'weightInput') {
              const normalizedWeight = parseOptionalWeight(sanitizedValue);
              return {
                ...setItem,
                weightInput: sanitizedValue,
                weight: normalizedWeight,
              };
            }

            if (field === 'repsInput') {
              const normalizedReps = parseOptionalReps(sanitizedValue);
              return {
                ...setItem,
                repsInput: sanitizedValue,
                reps: normalizedReps,
              };
            }

            const normalizedRir = parseOptionalRir(sanitizedValue);
            return {
              ...setItem,
              rirInput: sanitizedValue,
              rir: normalizedRir,
            };
          }),
        };
      })
    );
  }, [setActiveExercisesWithRef]);

  const updateSetSide = useCallback(
    (exerciseId: string, setId: string, side: SetSideOption) => {
      setActiveExercisesWithRef((currentValue) =>
        currentValue.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;

          return {
            ...exercise,
            sets: exercise.sets.map((setItem) =>
              setItem.id === setId ? { ...setItem, side } : setItem
            ),
          };
        })
      );
    },
    [setActiveExercisesWithRef]
  );

  const updateSetType = useCallback(
    (exerciseId: string, setId: string, setType: SetTypeOption) => {
      setActiveExercisesWithRef((currentValue) =>
        currentValue.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;

          return {
            ...exercise,
            sets: exercise.sets.map((setItem) =>
              setItem.id === setId ? { ...setItem, set_type: setType } : setItem
            ),
          };
        })
      );
    },
    [setActiveExercisesWithRef]
  );

  const updateExerciseNotes = useCallback(
    (exerciseId: string, notes: string | null) => {
      const raw = notes ?? '';
      const next = raw.length === 0 ? null : raw.slice(0, 1000);
      setActiveExercisesWithRef((currentValue) =>
        currentValue.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, notes: next } : exercise
        )
      );
    },
    [setActiveExercisesWithRef]
  );

  const addSet = useCallback((exerciseId: string) => {
    setActiveExercisesWithRef((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        const nextSetNumber = (exercise.sets[exercise.sets.length - 1]?.set_number ?? exercise.sets.length) + 1;
        return {
          ...exercise,
          sets: [...exercise.sets, createSet(exercise.exercise.id, nextSetNumber)],
        };
      })
    );
  }, [setActiveExercisesWithRef]);

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    setActiveExercisesWithRef((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        if (exercise.sets.length <= 1) return exercise;

        const nextSets = exercise.sets
          .filter((setItem) => setItem.id !== setId)
          .map((setItem, index) => ({
            ...setItem,
            set_number: index + 1,
          }));

        return {
          ...exercise,
          sets: nextSets,
        };
      })
    );
  }, [setActiveExercisesWithRef]);

  const addExercise = useCallback((exercise: ExerciseRow) => {
    setActiveExercisesWithRef((currentValue) => [...currentValue, createExerciseBlock(exercise)]);
  }, [setActiveExercisesWithRef]);

  const clearExercises = useCallback(() => {
    setActiveExercisesWithRef([]);
    completionGlowByExerciseIdRef.current.clear();
  }, [setActiveExercisesWithRef]);

  /** Call after successfully saving to Supabase to remove the draft */
  const clearDraft = useCallback(async () => {
    setRecoveredDraft(null);
    if (userId) {
      await clearWorkoutDraft(userId);
    }
  }, [userId]);

  /** Accept a recovered draft — replaces current exercises with draft state */
  const acceptRecoveredDraft = useCallback((recovered: RecoveredDraftState) => {
    setActiveExercisesWithRef(recovered.exercises);
    setRecoveredDraft(null);
  }, [setActiveExercisesWithRef]);

  /** Discard a recovered draft — clears it from storage */
  const discardRecoveredDraft = useCallback(async () => {
    setRecoveredDraft(null);
    if (userId) {
      await clearWorkoutDraft(userId);
    }
  }, [userId]);

  return {
    activeExercises,
    activeExercisesRef,
    setActiveExercisesWithRef,
    handleSetCompletionToggle,
    updateSetInput,
    updateSetSide,
    updateSetType,
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
  };
}
