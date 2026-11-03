export function createDataCache(ttlMs: number) {
  const entries = new Map<string, { accountId: string; expiresAt: number; value: Promise<unknown> }>();
  return {
    get<T>(accountId: string, key: string, load: () => Promise<T>): Promise<T> {
      const cacheKey = JSON.stringify([accountId, key]);
      const previous = entries.get(cacheKey);
      if (previous && previous.expiresAt > Date.now()) return previous.value as Promise<T>;
      const entry = { accountId, expiresAt: Number.POSITIVE_INFINITY, value: Promise.resolve() as Promise<unknown> };
      entry.value = load().then(value => {
        if (entries.get(cacheKey) === entry) entry.expiresAt = Date.now() + ttlMs;
        return value;
      }, error => {
        if (entries.get(cacheKey) === entry) entries.delete(cacheKey);
        throw error;
      });
      entries.set(cacheKey, entry);
      return entry.value as Promise<T>;
    },
    invalidate(accountId?: string): void {
      if (!accountId) entries.clear();
      else for (const [key, entry] of entries) if (entry.accountId === accountId) entries.delete(key);
    },
  };
}

export const exerciseCatalogCache = createDataCache(5 * 60_000);
export const workoutReferenceCache = createDataCache(30_000);
export function invalidateExerciseCatalogCache(accountId?: string): void { exerciseCatalogCache.invalidate(accountId); }
export function invalidateWorkoutDataCache(accountId?: string): void { workoutReferenceCache.invalidate(accountId); }
