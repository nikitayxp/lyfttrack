import { useCallback, useEffect, useRef, useState } from 'react';
import { getWorkoutComments, type WorkoutCommentWithProfile } from '@/services/interactionService';
import { getErrorMessage } from '@/services/workoutService';

const PAGE_SIZE = 50;

export function useWorkoutComments() {
  const [commentsByWorkoutId, setCommentsByWorkoutId] = useState<Record<string, WorkoutCommentWithProfile[]>>({});
  const [commentCountByWorkoutId, setCommentCountByWorkoutId] = useState<Record<string, number>>({});
  const [hasMoreCommentsByWorkoutId, setHasMoreCommentsByWorkoutId] = useState<Record<string, boolean>>({});
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const offsets = useRef(new Map<string, number>());
  const requests = useRef(new Map<string, number>());
  const pending = useRef(new Set<string>());
  const latest = useRef(0);
  const currentComments = useRef(commentsByWorkoutId);
  currentComments.current = commentsByWorkoutId;

  useEffect(() => () => { latest.current += 1; requests.current.clear(); }, []);

  const loadCommentsForWorkout = useCallback(async (workoutId: string, append = false) => {
    if (append && pending.current.has(workoutId)) return;
    const request = (requests.current.get(workoutId) ?? 0) + 1;
    requests.current.set(workoutId, request);
    pending.current.add(workoutId);
    const current = ++latest.current;
    const offset = append ? offsets.current.get(workoutId) ?? 0 : 0;
    const existingIds = new Set((currentComments.current[workoutId] ?? []).map(row => row.id));
    setCommentsError(null);
    setIsCommentsLoading(!append);
    setIsLoadingMoreComments(append);
    try {
      const page = await getWorkoutComments(workoutId, { limit: PAGE_SIZE, offset });
      if (requests.current.get(workoutId) !== request) return;
      offsets.current.set(workoutId, offset + page.length);
      const mergePage = (rows: WorkoutCommentWithProfile[] = []) => [...new Map(
        (append ? [...rows, ...page] : [...page, ...rows.filter(row => !existingIds.has(row.id))])
          .map(row => [row.id, row]),
      ).values()];
      setCommentsByWorkoutId(previous => ({
        ...previous,
        [workoutId]: mergePage(previous[workoutId]),
      }));
      setHasMoreCommentsByWorkoutId(previous => ({ ...previous, [workoutId]: page.length > 0 }));
      if (page.length === 0) {
        setCommentCountByWorkoutId(previous => ({
          ...previous,
          [workoutId]: Math.max(offset, mergePage(currentComments.current[workoutId]).length),
        }));
      }
    } catch (error) {
      if (current === latest.current) setCommentsError(getErrorMessage(error));
    } finally {
      if (requests.current.get(workoutId) === request) pending.current.delete(workoutId);
      if (current === latest.current) {
        setIsCommentsLoading(false);
        setIsLoadingMoreComments(false);
      }
    }
  }, []);

  return {
    commentsByWorkoutId, setCommentsByWorkoutId,
    commentCountByWorkoutId, setCommentCountByWorkoutId,
    hasMoreCommentsByWorkoutId, isCommentsLoading, isLoadingMoreComments,
    commentsError, setCommentsError, loadCommentsForWorkout,
  };
}
