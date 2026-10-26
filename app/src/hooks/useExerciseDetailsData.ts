import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getExerciseStats,
  getExerciseWorkoutHistory,
  type ExercisePersonalRecords,
  type ExerciseProgressPoint,
  type ExerciseWorkoutHistoryEntry,
} from '@/services/statsService';
import { getErrorMessage } from '@/services/workoutService';

const PAGE_SIZE = 20;

export function useExerciseDetailsData(exerciseId: string | null) {
  const [progress, setProgress] = useState<ExerciseProgressPoint[]>([]);
  const [records, setRecords] = useState<ExercisePersonalRecords | null>(null);
  const [history, setHistory] = useState<ExerciseWorkoutHistoryEntry[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [settledExerciseId, setSettledExerciseId] = useState<string | null>(null);
  const generation = useRef(0);
  const historyOffset = useRef(0);
  const loadingMore = useRef(false);

  const reloadStats = useCallback(async () => {
    const request = ++generation.current;
    historyOffset.current = 0;
    loadingMore.current = false;
    setIsLoadingMoreHistory(false);
    setStatsError(null);
    if (!exerciseId) {
      setIsLoadingStats(false);
      return;
    }
    setIsLoadingStats(true);
    try {
      const [stats, page] = await Promise.all([
        getExerciseStats(exerciseId, 'weight'),
        getExerciseWorkoutHistory(exerciseId, { limit: PAGE_SIZE, offset: 0 }),
      ]);
      if (request !== generation.current) return;
      setProgress(stats.progress);
      setRecords(stats.records);
      setHistory(page);
      historyOffset.current = page.length;
      setHasMoreHistory(page.length === PAGE_SIZE);
    } catch (error) {
      if (request === generation.current) setStatsError(getErrorMessage(error));
    } finally {
      if (request === generation.current) {
        setIsLoadingStats(false);
        setSettledExerciseId(exerciseId);
      }
    }
  }, [exerciseId]);

  useEffect(() => {
    setProgress([]);
    setRecords(null);
    setHistory([]);
    setHasMoreHistory(false);
    void reloadStats();
    return () => { generation.current += 1; };
  }, [reloadStats]);

  const loadMoreHistory = useCallback(async () => {
    if (!exerciseId || !hasMoreHistory || loadingMore.current || isLoadingStats) return;
    const request = generation.current;
    loadingMore.current = true;
    setIsLoadingMoreHistory(true);
    setStatsError(null);
    try {
      const page = await getExerciseWorkoutHistory(exerciseId, { limit: PAGE_SIZE, offset: historyOffset.current });
      if (request !== generation.current) return;
      historyOffset.current += page.length;
      setHistory(current => [...new Map([...current, ...page].map(row => [row.workoutId, row])).values()]);
      setHasMoreHistory(page.length === PAGE_SIZE);
    } catch (error) {
      if (request === generation.current) setStatsError(getErrorMessage(error));
    } finally {
      if (request === generation.current) {
        loadingMore.current = false;
        setIsLoadingMoreHistory(false);
      }
    }
  }, [exerciseId, hasMoreHistory, isLoadingStats]);

  const isAwaitingFirstLoad = exerciseId !== null && settledExerciseId !== exerciseId;

  return { progress, records, history, isLoadingStats: isLoadingStats || isAwaitingFirstLoad, isLoadingMoreHistory, hasMoreHistory, statsError, reloadStats, loadMoreHistory };
}
