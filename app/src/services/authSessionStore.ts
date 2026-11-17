import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { isDeletedAuthAccount, observeDeletedAuthAccount, subscribeDeletedAuthAccounts, supabase } from '@/services/supabase';
import { invalidateExerciseCatalogCache, invalidateWorkoutDataCache } from '@/services/dataCache';

export type AuthSessionSnapshot = { session: Session | null; isPending: boolean; hasTimedOut: boolean };
type SessionListener = (snapshot: AuthSessionSnapshot, event?: AuthChangeEvent) => void;

let snapshot: AuthSessionSnapshot = { session: null, isPending: true, hasTimedOut: false };
let generation = 0;
let disconnect: (() => void) | null = null;
const listeners = new Set<SessionListener>();
const accountListeners = new Set<() => void>();

export function onAuthAccountChange(listener: () => void): () => void {
  accountListeners.add(listener);
  return () => { accountListeners.delete(listener); };
}

function publish(session: Session | null, event?: AuthChangeEvent): void {
  if (snapshot.session?.user.id !== session?.user.id || event === 'SIGNED_OUT') {
    invalidateExerciseCatalogCache();
    invalidateWorkoutDataCache();
    accountListeners.forEach(listener => listener());
  }
  snapshot = { session, isPending: false, hasTimedOut: false };
  listeners.forEach(listener => listener(snapshot, event));
}

function connect(): void {
  const currentGeneration = ++generation;
  let hasReceivedEvent = false;
  let eventRevision = 0;
  let publishedRevision = 0;
  const invalidatedAccounts = new Set<string>();
  const timeout = setTimeout(() => {
    if (currentGeneration !== generation || !snapshot.isPending) return;
    snapshot = { ...snapshot, hasTimedOut: true };
    listeners.forEach(listener => listener(snapshot));
  }, 10_000);
  const invalidateAccount = (userId: string) => {
    if (currentGeneration !== generation) return;
    invalidatedAccounts.add(userId);
    if (snapshot.session?.user.id === userId) {
      clearTimeout(timeout);
      publish(null, 'SIGNED_OUT');
    }
  };
  const settle = async (session: Session | null, event?: AuthChangeEvent) => {
    const revision = ++eventRevision;
    const userId = session?.user.id;
    let deleted = false;
    let storageUnavailable = false;
    try {
      if (userId) deleted = invalidatedAccounts.has(userId) || await isDeletedAuthAccount(userId);
    } catch {
      storageUnavailable = true;
    }
    if (currentGeneration !== generation || revision < publishedRevision) return;
    if (userId && (deleted || invalidatedAccounts.has(userId) || storageUnavailable)) {
      // Ignore stale events without superseding a concurrent valid account event.
      if (deleted) invalidateAccount(userId);
      if (snapshot.isPending || (storageUnavailable && snapshot.session?.user.id === userId)) {
        clearTimeout(timeout);
        publish(null, 'SIGNED_OUT');
      }
      return;
    }
    publishedRevision = revision;
    clearTimeout(timeout);
    publish(session, event);
  };
  const unsubscribeDeleted = subscribeDeletedAuthAccounts(invalidateAccount);
  const storageListener = (event: StorageEvent) => observeDeletedAuthAccount(event.key, event.newValue);
  const hasStorageEvents = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  if (hasStorageEvents) window.addEventListener('storage', storageListener);
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (currentGeneration !== generation) return;
    hasReceivedEvent = true;
    void settle(session, event);
  });
  void supabase.auth.getSession().then(({ data, error }) => {
    if (currentGeneration === generation && !hasReceivedEvent) void settle(error ? null : data.session);
  }).catch(() => {
    if (currentGeneration === generation && !hasReceivedEvent) void settle(null);
  });
  let removeLifecycle: (() => void) | undefined;
  if (Platform.OS !== 'web') {
    const updateRefresh = (state: string | null | undefined) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    updateRefresh(AppState.currentState);
    const lifecycle = AppState.addEventListener('change', updateRefresh);
    removeLifecycle = () => { lifecycle.remove(); supabase.auth.stopAutoRefresh(); };
  }
  disconnect = () => {
    generation++;
    clearTimeout(timeout);
    subscription.unsubscribe();
    unsubscribeDeleted();
    if (hasStorageEvents) window.removeEventListener('storage', storageListener);
    removeLifecycle?.();
    snapshot = { session: null, isPending: true, hasTimedOut: false };
    disconnect = null;
  };
}

export function retryAuthSessionBootstrap(): void {
  if (!snapshot.isPending || snapshot.session || listeners.size === 0) return;
  disconnect?.();
  listeners.forEach(listener => listener(snapshot));
  connect();
}

export function subscribeAuthSession(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(snapshot);
  if (!disconnect) connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) disconnect?.();
  };
}
