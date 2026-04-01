import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';

const DEFAULT_REST_SECONDS = 90;

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

export function useWorkoutTimer() {
  const [workoutStartedAtMs] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restEndAtMs, setRestEndAtMs] = useState<number | null>(null);
  const [restRemainingSeconds, setRestRemainingSeconds] = useState(0);
  const [restTotalSeconds, setRestTotalSeconds] = useState(DEFAULT_REST_SECONDS);

  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredRestVibrationRef = useRef(false);
  const keepAwakeStateRef = useRef<{ activated: boolean; deactivated: boolean }>({
    activated: false,
    deactivated: false,
  });

  const clearElapsedTimer = useCallback(() => {
    if (!elapsedTimerRef.current) return;
    clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = null;
  }, []);

  const clearRestTimer = useCallback(() => {
    if (!restTimerRef.current) return;
    clearInterval(restTimerRef.current);
    restTimerRef.current = null;
  }, []);

  const activateKeepAwakeSafely = useCallback(() => {
    if (Platform.OS === 'web') return;

    const keepAwakeState = keepAwakeStateRef.current;
    keepAwakeState.activated = false;
    keepAwakeState.deactivated = false;

    Promise.resolve(activateKeepAwake())
      .then(() => {
        keepAwakeState.activated = true;
      })
      .catch((error) => {
        keepAwakeState.activated = false;
        console.warn('Failed to activate keep awake:', error);
      });
  }, []);

  const safeDeactivateKeepAwake = useCallback(() => {
    if (Platform.OS === 'web') return;

    const keepAwakeState = keepAwakeStateRef.current;

    if (!keepAwakeState.activated || keepAwakeState.deactivated) return;

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
    activateKeepAwakeSafely();
    return () => {
      safeDeactivateKeepAwake();
    };
  }, [activateKeepAwakeSafely, safeDeactivateKeepAwake]);

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
          return DEFAULT_REST_SECONDS;
        }

        return nextTotal;
      });

      setRestRemainingSeconds(nextRemaining);
      return startTimerFromNow(nextRemaining);
    });
  }, []);

  useEffect(() => {
    if (restEndAtMs === null) {
      clearRestTimer();
      setRestRemainingSeconds(0);
      return;
    }

    const syncRestTimer = () => {
      const remaining = getRemainingSeconds(restEndAtMs);
      setRestRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearRestTimer();
        setRestEndAtMs(null);

        if (!hasTriggeredRestVibrationRef.current) {
          hasTriggeredRestVibrationRef.current = true;
          if (Platform.OS !== 'web') {
            Vibration.vibrate([0, 500, 200, 500]);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        }
      }
    };

    syncRestTimer();
    clearRestTimer();
    restTimerRef.current = setInterval(syncRestTimer, 500);

    return () => {
      clearRestTimer();
    };
  }, [clearRestTimer, restEndAtMs]);

  return {
    workoutStartedAtMs,
    elapsedSeconds,
    restEndAtMs,
    restRemainingSeconds,
    restTotalSeconds,
    startRestTimer,
    finishRestTimer,
    adjustRestTimer,
    safeDeactivateKeepAwake,
  };
}
