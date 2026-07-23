import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PropsWithChildren,
} from 'react';
import { Animated, Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  useActiveWorkoutState,
  type ActiveExercise,
  type ActiveExercisesUpdater,
  type ExerciseRow,
  type RecoveredDraftState,
} from '@/hooks/useActiveWorkoutState';
import { supabase } from '@/services/supabase';

type ExerciseStopwatchEntry = {
  startedAtMs: number;
  startOffsetSeconds: number;
};

type WorkoutContextValue = {
  currentUserId: string | null;
  activeTemplateId: string | null;
  setActiveTemplateId: (templateId: string | null) => void;
  activeExercises: ActiveExercise[];
  activeExercisesRef: MutableRefObject<ActiveExercise[]>;
  setActiveExercisesWithRef: (nextValue: ActiveExercisesUpdater) => void;
  handleSetCompletionToggle: (exerciseId: string, setId: string) => void;
  updateSetInput: (exerciseId: string, setId: string, field: 'weightInput' | 'repsInput' | 'rirInput', value: string) => void;
  updateSetSide: (exerciseId: string, setId: string, side: 'both' | 'left' | 'right') => void;
  updateSetType: (exerciseId: string, setId: string, setType: 'normal' | 'warmup' | 'drop' | 'failure') => void;
  updateExerciseNotes: (exerciseId: string, notes: string | null) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  addExercise: (exercise: ExerciseRow) => void;
  clearExercises: () => void;
  removeExercise: (exerciseIndex: number) => void;
  moveExercise: (exerciseIndex: number, direction: 'up' | 'down') => void;
  getExerciseCompletionGlowValue: (exerciseId: string) => Animated.Value;
  workoutName: string | null;
  setWorkoutName: (name: string | null) => void;
  recoveredDraft: RecoveredDraftState | null;
  /** True while the persisted draft is still being read — wait before seeding exercises. */
  isDraftRecoveryPending: boolean;
  /** True once a persisted draft has been restored into this session. */
  didRestoreDraft: boolean;
  clearDraft: () => Promise<void>;
  acceptRecoveredDraft: (recovered: RecoveredDraftState) => void;
  discardRecoveredDraft: () => Promise<void>;
  workoutStartedAtMs: number | null;
  elapsedSeconds: number;
  isTimerPaused: boolean;
  toggleTimerPause: () => void;
  ensureWorkoutStarted: () => number;
  resetWorkoutSession: () => void;
  safeDeactivateKeepAwake: () => void;
  isExerciseStopwatchRunning: (exerciseId: string) => boolean;
  getExerciseStopwatchSeconds: (exerciseId: string) => number;
  getExerciseRestSecondsByExerciseId: () => Record<string, number>;
  toggleExerciseStopwatch: (exerciseId: string) => void;
  hasActiveWorkout: boolean;
  latestExerciseName: string | null;
};

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ children }: PropsWithChildren) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [workoutName, setWorkoutName] = useState<string | null>(null);
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [workoutStartedAtMs, setWorkoutStartedAtMs] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [pausedElapsedSeconds, setPausedElapsedSeconds] = useState<number | null>(null);
  const [exerciseStopwatchById, setExerciseStopwatchById] = useState<Record<string, ExerciseStopwatchEntry>>({});
  const [exerciseRestSnapshotById, setExerciseRestSnapshotById] = useState<Record<string, number>>({});
  const [stopwatchNowMs, setStopwatchNowMs] = useState(() => Date.now());
  const keepAwakeStateRef = useRef<{ activated: boolean; deactivated: boolean }>({
    activated: false,
    deactivated: false,
  });

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) {
        return;
      }

      setCurrentUserId(session?.user?.id ?? null);
      setIsAuthResolved(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setCurrentUserId(session?.user?.id ?? null);
      setIsAuthResolved(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const workoutStartedAtIso = useMemo(
    () => (workoutStartedAtMs === null ? undefined : new Date(workoutStartedAtMs).toISOString()),
    [workoutStartedAtMs]
  );

  const {
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
    isDraftRecoveryPending: isDraftReadPending,
    clearDraft,
    acceptRecoveredDraft,
    discardRecoveredDraft,
  } = useActiveWorkoutState({
    userId: currentUserId ?? undefined,
    startTime: workoutStartedAtIso,
    templateId: activeTemplateId,
    workoutName: workoutName ?? undefined,
  });

  // Recovery is only settled once we know who the user is *and* the stored
  // draft has been read. Consumers must not seed exercises before that.
  const isDraftRecoveryPending = !isAuthResolved || (currentUserId !== null && isDraftReadPending);

  const hasActiveWorkout = activeExercises.length > 0;

  const ensureWorkoutStarted = useCallback(() => {
    if (workoutStartedAtMs !== null) {
      return workoutStartedAtMs;
    }

    const now = Date.now();
    setWorkoutStartedAtMs(now);
    setElapsedSeconds(0);
    return now;
  }, [workoutStartedAtMs]);

  const resetWorkoutSession = useCallback(() => {
    setWorkoutStartedAtMs(null);
    setElapsedSeconds(0);
    setActiveTemplateId(null);
    setWorkoutName(null);
    setDidRestoreDraft(false);
    setExerciseStopwatchById({});
    setExerciseRestSnapshotById({});
    setStopwatchNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (!hasActiveWorkout && workoutStartedAtMs !== null) {
      resetWorkoutSession();
      return;
    }

    if (hasActiveWorkout && workoutStartedAtMs === null) {
      const now = Date.now();
      setWorkoutStartedAtMs(now);
      setElapsedSeconds(0);
    }
  }, [hasActiveWorkout, resetWorkoutSession, workoutStartedAtMs]);

  const toggleTimerPause = useCallback(() => {
    setIsTimerPaused((prev) => {
      if (!prev) {
        setPausedElapsedSeconds(elapsedSeconds);
      } else {
        if (pausedElapsedSeconds !== null) {
          const now = Date.now();
          setWorkoutStartedAtMs(now - pausedElapsedSeconds * 1000);
        }
        setPausedElapsedSeconds(null);
      }
      return !prev;
    });
  }, [elapsedSeconds, pausedElapsedSeconds]);

  useEffect(() => {
    if (workoutStartedAtMs === null) {
      setElapsedSeconds(0);
      return;
    }

    if (isTimerPaused) {
      return;
    }

    const syncElapsed = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - workoutStartedAtMs) / 1000));
      setElapsedSeconds(elapsed);
    };

    syncElapsed();
    const intervalId = setInterval(syncElapsed, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [workoutStartedAtMs, isTimerPaused]);

  const activateKeepAwakeSafely = useCallback(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const keepAwakeState = keepAwakeStateRef.current;
    keepAwakeState.activated = false;
    keepAwakeState.deactivated = false;

    Promise.resolve(activateKeepAwakeAsync())
      .then(() => {
        keepAwakeState.activated = true;
      })
      .catch((error) => {
        keepAwakeState.activated = false;
        console.warn('Failed to activate keep awake:', error);
      });
  }, []);

  const safeDeactivateKeepAwake = useCallback(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const keepAwakeState = keepAwakeStateRef.current;

    if (!keepAwakeState.activated || keepAwakeState.deactivated) {
      return;
    }

    keepAwakeState.deactivated = true;

    Promise.resolve(deactivateKeepAwake())
      .then(() => {
        keepAwakeState.activated = false;
      })
      .catch((error) => {
        keepAwakeState.deactivated = false;
        console.warn('Failed to deactivate keep awake:', error);
      });
  }, []);

  useEffect(() => {
    if (!hasActiveWorkout) {
      safeDeactivateKeepAwake();
      return;
    }

    activateKeepAwakeSafely();

    return () => {
      safeDeactivateKeepAwake();
    };
  }, [activateKeepAwakeSafely, hasActiveWorkout, safeDeactivateKeepAwake]);

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

    setExerciseRestSnapshotById((currentValue) => {
      let hasChanges = false;
      const nextValue: Record<string, number> = {};

      for (const exercise of activeExercises) {
        const existingValue = currentValue[exercise.id];

        if (typeof existingValue === 'number') {
          nextValue[exercise.id] = existingValue;
          continue;
        }

        nextValue[exercise.id] = Math.max(0, Math.trunc(exercise.defaultRestSeconds));
        hasChanges = true;
      }

      if (!hasChanges && Object.keys(currentValue).length !== Object.keys(nextValue).length) {
        hasChanges = true;
      }

      return hasChanges ? nextValue : currentValue;
    });
  }, [activeExercises]);

  const runningStopwatchCount = useMemo(() => Object.keys(exerciseStopwatchById).length, [exerciseStopwatchById]);

  useEffect(() => {
    if (runningStopwatchCount === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setStopwatchNowMs(Date.now());
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [runningStopwatchCount]);

  const isExerciseStopwatchRunning = useCallback(
    (exerciseId: string) => Boolean(exerciseStopwatchById[exerciseId]),
    [exerciseStopwatchById]
  );

  const getExerciseStopwatchSeconds = useCallback(
    (exerciseId: string) => {
      const entry = exerciseStopwatchById[exerciseId];

      if (!entry) {
        return Math.max(0, Math.trunc(exerciseRestSnapshotById[exerciseId] ?? 0));
      }

      return Math.max(0, entry.startOffsetSeconds + Math.floor((stopwatchNowMs - entry.startedAtMs) / 1000));
    },
    [exerciseRestSnapshotById, exerciseStopwatchById, stopwatchNowMs]
  );

  const toggleExerciseStopwatch = useCallback((exerciseId: string) => {
    setStopwatchNowMs(Date.now());

    setExerciseStopwatchById((currentValue) => {
      const currentEntry = currentValue[exerciseId];

      if (currentEntry) {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - currentEntry.startedAtMs) / 1000));
        const nextSnapshotSeconds = Math.max(0, currentEntry.startOffsetSeconds + elapsedSeconds);

        setExerciseRestSnapshotById((currentSnapshotValue) => ({
          ...currentSnapshotValue,
          [exerciseId]: nextSnapshotSeconds,
        }));

        const nextValue = { ...currentValue };
        delete nextValue[exerciseId];
        return nextValue;
      }

      const startOffsetSeconds = Math.max(0, Math.trunc(exerciseRestSnapshotById[exerciseId] ?? 0));

      return {
        ...currentValue,
        [exerciseId]: {
          startedAtMs: Date.now(),
          startOffsetSeconds,
        },
      };
    });
  }, [exerciseRestSnapshotById]);

  const getExerciseRestSecondsByExerciseId = useCallback(() => {
    const restByExerciseId: Record<string, number> = {};

    for (const activeExercise of activeExercisesRef.current) {
      const normalizedExerciseId = activeExercise.exercise.id?.trim();

      if (!normalizedExerciseId) {
        continue;
      }

      const activeExerciseId = activeExercise.id;
      const runningEntry = exerciseStopwatchById[activeExerciseId];

      if (runningEntry) {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - runningEntry.startedAtMs) / 1000));
        restByExerciseId[normalizedExerciseId] = Math.max(0, runningEntry.startOffsetSeconds + elapsedSeconds);
        continue;
      }

      const snapshotSeconds = exerciseRestSnapshotById[activeExerciseId];
      const fallbackSeconds = Math.max(0, Math.trunc(activeExercise.defaultRestSeconds));
      restByExerciseId[normalizedExerciseId] = Math.max(0, Math.trunc(snapshotSeconds ?? fallbackSeconds));
    }

    return restByExerciseId;
  }, [activeExercisesRef, exerciseRestSnapshotById, exerciseStopwatchById]);

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

        setExerciseRestSnapshotById((currentValue) => {
          if (currentValue[exerciseId] === undefined) {
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

  const addExerciseToWorkout = useCallback(
    (exercise: ExerciseRow) => {
      ensureWorkoutStarted();
      addExercise(exercise);
    },
    [addExercise, ensureWorkoutStarted]
  );

  const clearWorkout = useCallback(() => {
    clearExercises();
    resetWorkoutSession();
  }, [clearExercises, resetWorkoutSession]);

  const acceptRecoveredDraftWithTimer = useCallback(
    (recovered: RecoveredDraftState) => {
      const parsedStartMs = new Date(recovered.draft.startTime).getTime();

      setActiveTemplateId(recovered.draft.templateId ?? null);

      const restoredName = recovered.draft.workoutName?.trim();
      if (restoredName) {
        setWorkoutName(restoredName);
      }

      if (Number.isFinite(parsedStartMs)) {
        setWorkoutStartedAtMs(parsedStartMs);
      } else {
        ensureWorkoutStarted();
      }

      acceptRecoveredDraft(recovered);
    },
    [acceptRecoveredDraft, ensureWorkoutStarted, setActiveTemplateId]
  );

  // Restore the persisted draft automatically. The previous flow asked for
  // confirmation through Alert.alert, which is a no-op on react-native-web, so
  // a browser refresh silently dropped every exercise of the active workout.
  const hasHandledDraftRecoveryRef = useRef(false);

  useEffect(() => {
    if (!recoveredDraft || hasHandledDraftRecoveryRef.current) {
      return;
    }

    // Never clobber a workout the user has already started in this session.
    if (activeExercisesRef.current.length > 0) {
      return;
    }

    hasHandledDraftRecoveryRef.current = true;
    setDidRestoreDraft(true);
    acceptRecoveredDraftWithTimer(recoveredDraft);
  }, [acceptRecoveredDraftWithTimer, activeExercisesRef, recoveredDraft]);

  const latestExerciseName = useMemo(() => {
    const latest = activeExercises[activeExercises.length - 1];
    return latest?.exercise.name ?? null;
  }, [activeExercises]);

  const contextValue = useMemo<WorkoutContextValue>(() => ({
    currentUserId,
    activeTemplateId,
    setActiveTemplateId,
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
    addExercise: addExerciseToWorkout,
    clearExercises: clearWorkout,
    removeExercise,
    moveExercise,
    getExerciseCompletionGlowValue,
    workoutName,
    setWorkoutName,
    recoveredDraft,
    isDraftRecoveryPending,
    didRestoreDraft,
    clearDraft,
    acceptRecoveredDraft: acceptRecoveredDraftWithTimer,
    discardRecoveredDraft,
    workoutStartedAtMs,
    elapsedSeconds,
    isTimerPaused,
    toggleTimerPause,
    ensureWorkoutStarted,
    resetWorkoutSession,
    safeDeactivateKeepAwake,
    isExerciseStopwatchRunning,
    getExerciseStopwatchSeconds,
    getExerciseRestSecondsByExerciseId,
    toggleExerciseStopwatch,
    hasActiveWorkout,
    latestExerciseName,
  }), [
    activeTemplateId,
    activeExercises,
    activeExercisesRef,
    addExerciseToWorkout,
    addSet,
    removeSet,
    clearDraft,
    clearWorkout,
    currentUserId,
    discardRecoveredDraft,
    elapsedSeconds,
    ensureWorkoutStarted,
    getExerciseCompletionGlowValue,
    getExerciseRestSecondsByExerciseId,
    getExerciseStopwatchSeconds,
    handleSetCompletionToggle,
    hasActiveWorkout,
    isExerciseStopwatchRunning,
    latestExerciseName,
    moveExercise,
    recoveredDraft,
    isDraftRecoveryPending,
    didRestoreDraft,
    workoutName,
    removeExercise,
    resetWorkoutSession,
    safeDeactivateKeepAwake,
    setActiveTemplateId,
    setWorkoutName,
    setActiveExercisesWithRef,
    toggleExerciseStopwatch,
    updateSetInput,
    updateSetSide,
    updateSetType,
    updateExerciseNotes,
    isTimerPaused,
    toggleTimerPause,
    workoutStartedAtMs,
    acceptRecoveredDraftWithTimer,
  ]);

  return <WorkoutContext.Provider value={contextValue}>{children}</WorkoutContext.Provider>;
}

export function useWorkoutContext() {
  const context = useContext(WorkoutContext);

  if (!context) {
    throw new Error('useWorkoutContext must be used within a WorkoutProvider.');
  }

  return context;
}
