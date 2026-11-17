import { NavigatorLockAcquireTimeoutError, type Session } from '@supabase/supabase-js';

export type AuthStorageAdapter = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};
type StorageLock = <T>(work: () => Promise<T>) => Promise<T>;

/** A timed-out waiter must not run alongside a session operation. */
export function createBrowserSessionLock(manager: LockManager) {
  return async function lock<T>(name: string, timeout: number, work: () => Promise<T>): Promise<T> {
    const controller = timeout > 0 ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : undefined;
    const timeoutError = () => new NavigatorLockAcquireTimeoutError(`Timed out waiting for ${name}`);

    try {
      const options = timeout === 0 ? { ifAvailable: true } : { signal: controller?.signal };
      return await manager.request(name, options, async held => {
        clearTimeout(timer);
        if (!held) throw timeoutError();
        return work();
      });
    } catch (error) {
      if (controller?.signal.aborted) throw timeoutError();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

function parseSession(value: string | null): Session | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Session;
    return typeof parsed?.user?.id === 'string' && typeof parsed.access_token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** Serialize conditional removal with every SDK write, including native storage. */
export function createAccountSessionStorage(raw: AuthStorageAdapter, sessionKey: string, lock: StorageLock) {
  const deleted = new Set<string>();
  const listeners = new Set<(userId: string) => void>();
  const deletionPrefix = `${sessionKey}.deleted.`;
  let pending: Promise<unknown> = Promise.resolve();

  function run<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(() => lock(work));
    pending = result.catch(() => undefined);
    return result;
  }
  async function isDeleted(userId: string): Promise<boolean> {
    if (deleted.has(userId)) return true;
    if (await raw.getItem(`${deletionPrefix}${userId}`) === '1') {
      deleted.add(userId);
      return true;
    }
    return false;
  }
  function notify(userId: string): void {
    deleted.add(userId);
    listeners.forEach(listener => listener(userId));
  }

  const storage: AuthStorageAdapter = {
    getItem: key => run(async () => {
      const value = await raw.getItem(key);
      const session = key === sessionKey ? parseSession(value) : null;
      return session && await isDeleted(session.user.id) ? null : value;
    }),
    setItem: (key, value) => run(async () => {
      const session = key === sessionKey ? parseSession(value) : null;
      if (session && await isDeleted(session.user.id)) return;
      await raw.setItem(key, value);
    }),
    removeItem: key => run(async () => { await raw.removeItem(key); }),
  };

  return {
    storage,
    readSession: () => run(async () => {
      const session = parseSession(await raw.getItem(sessionKey));
      return session && !await isDeleted(session.user.id) ? session : null;
    }),
    isDeleted: (userId: string) => run(() => isDeleted(userId)),
    reserveDeletion: (userId: string) => run(async () => {
      const key = `${deletionPrefix}${userId}`;
      if (await raw.getItem(key) === null) await raw.setItem(key, '0');
    }),
    cancelDeletion: (userId: string) => run(async () => {
      const key = `${deletionPrefix}${userId}`;
      if (await raw.getItem(key) === '0') await raw.removeItem(key);
    }),
    async clearForAccount(userId: string): Promise<boolean> {
      // A reserved one-byte marker can be replaced without growing storage.
      deleted.add(userId);
      try {
        return await run(async () => {
          await raw.setItem(`${deletionPrefix}${userId}`, '1');
          const value = await raw.getItem(sessionKey);
          if (value === null) return true;
          if (parseSession(value)?.user.id !== userId) return false;
          await raw.removeItem(sessionKey);
          // The PKCE verifier may already belong to a different pending login.
          return true;
        });
      } finally {
        notify(userId);
      }
    },
    observeDeletion(key: string | null, value: string | null): void {
      if (key?.startsWith(deletionPrefix) && value === '1') notify(key.slice(deletionPrefix.length));
    },
    subscribe(listener: (userId: string) => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
