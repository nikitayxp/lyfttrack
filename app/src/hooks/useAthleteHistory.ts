import { useCallback, useEffect, useRef, useState } from 'react';
import { getPublicProfileById, type PublicProfileView } from '@/services/profileService';
import {
  getErrorMessage,
  getUserWorkoutMonthBuckets,
  getUserWorkouts,
  type WorkoutFeedItem,
  type WorkoutListFilter,
  type WorkoutMonthBucket,
} from '@/services/workoutService';

const PAGE_SIZE = 20;
type HistoryPage = {
  key: string;
  rows: WorkoutFeedItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

export function useAthleteHistory(profileId: string | null, filter: WorkoutListFilter) {
  const periodKey = filter.periodKey ?? null;
  const search = filter.search ?? '';
  const key = JSON.stringify([profileId, periodKey, search]);
  const scopeRef = useRef({ profileId, key });
  scopeRef.current = { profileId, key };
  const metadataRequest = useRef(0);
  const historyRequest = useRef(0);
  const busyKey = useRef<string | null>(null);
  const [profileState, setProfileState] = useState<{
    id: string | null;
    value: PublicProfileView | null;
    loading: boolean;
    error: string | null;
  }>({ id: null, value: null, loading: true, error: null });
  const [summary, setSummary] = useState<{
    id: string | null;
    months: WorkoutMonthBucket[] | null;
    error: string | null;
  }>({ id: null, months: null, error: null });
  const [history, setHistory] = useState<HistoryPage>({
    key: '',
    rows: [],
    page: 0,
    hasMore: false,
    loading: true,
    error: null,
  });
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);

  const loadMetadata = useCallback(async () => {
    const request = ++metadataRequest.current;
    const current = () => metadataRequest.current === request && scopeRef.current.profileId === profileId;
    if (!profileId) {
      setProfileState({ id: profileId, value: null, loading: false, error: null });
      return;
    }
    await Promise.all([
      getPublicProfileById(profileId)
        .then((value) => {
          if (current()) setProfileState({ id: profileId, value, loading: false, error: null });
        })
        .catch((error) => {
          if (current())
            setProfileState({ id: profileId, value: null, loading: false, error: getErrorMessage(error) });
        }),
      getUserWorkoutMonthBuckets(profileId)
        .then((months) => {
          if (current()) setSummary({ id: profileId, months, error: null });
        })
        .catch((error) => {
          if (current()) setSummary({ id: profileId, months: null, error: getErrorMessage(error) });
        }),
    ]);
  }, [profileId]);

  const loadPage = useCallback(
    async (page: number, append: boolean) => {
      if (!profileId || (append && busyKey.current === key)) return;
      const request = ++historyRequest.current;
      busyKey.current = key;
      const current = () => request === historyRequest.current && scopeRef.current.key === key;
      setHistory((previous) => ({
        key,
        rows: previous.key === key ? previous.rows : [],
        page: append ? page - 1 : 0,
        hasMore: append,
        loading: true,
        error: null,
      }));
      try {
        const rows = await getUserWorkouts(profileId, page, PAGE_SIZE, { periodKey, search });
        if (!current()) return;
        setHistory((previous) => ({
          key,
          rows: append
            ? [...new Map([...previous.rows, ...rows].map((row) => [row.id, row])).values()]
            : rows,
          page,
          hasMore: rows.length === PAGE_SIZE,
          loading: false,
          error: null,
        }));
      } catch (error) {
        if (current())
          setHistory((previous) => ({ ...previous, loading: false, error: getErrorMessage(error) }));
      } finally {
        if (request === historyRequest.current) busyKey.current = null;
      }
    },
    [key, periodKey, profileId, search],
  );

  useEffect(() => {
    void loadMetadata();
    return () => {
      metadataRequest.current += 1;
    };
  }, [loadMetadata]);

  useEffect(() => {
    void loadPage(0, false);
    return () => {
      historyRequest.current += 1;
      busyKey.current = null;
    };
  }, [loadPage]);

  const refresh = useCallback(async () => {
    setRefreshingKey(key);
    await Promise.all([loadMetadata(), loadPage(0, false)]);
    if (scopeRef.current.key === key) setRefreshingKey(null);
  }, [key, loadMetadata, loadPage]);

  const loadMore = useCallback(async () => {
    if (history.key === key && history.hasMore && !history.loading) await loadPage(history.page + 1, true);
  }, [history, key, loadPage]);

  return {
    profile: profileState.id === profileId ? profileState.value : null,
    isLoadingProfile: Boolean(profileId) && (profileState.id !== profileId || profileState.loading),
    error: profileState.id === profileId ? profileState.error : null,
    historyMonths: summary.id === profileId ? (summary.months ?? []) : [],
    hasSummary: summary.id === profileId && summary.months !== null,
    summaryError: summary.id === profileId ? summary.error : null,
    workouts: history.key === key ? history.rows : [],
    isLoadingHistory: Boolean(profileId) && (history.key !== key || history.loading),
    historyError: history.key === key ? history.error : null,
    hasMore: history.key === key && history.hasMore,
    isRefreshing: refreshingKey === key,
    refresh,
    retryHistory: () =>
      loadPage(
        history.hasMore && history.error ? history.page + 1 : 0,
        Boolean(history.hasMore && history.error),
      ),
    loadMore,
  };
}
