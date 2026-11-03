import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/services/supabase';
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
  const timeout = setTimeout(() => {
    if (currentGeneration !== generation || hasReceivedEvent || !snapshot.isPending) return;
    snapshot = { ...snapshot, hasTimedOut: true };
    listeners.forEach(listener => listener(snapshot));
  }, 10_000);
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (currentGeneration !== generation) return;
    clearTimeout(timeout);
    hasReceivedEvent = true;
    publish(session, event);
  });
  void supabase.auth.getSession().then(({ data, error }) => {
    clearTimeout(timeout);
    if (currentGeneration === generation && !hasReceivedEvent) publish(error ? null : data.session);
  }).catch(() => {
    clearTimeout(timeout);
    if (currentGeneration === generation && !hasReceivedEvent) publish(null);
  });
  let removeLifecycle: (() => void) | undefined;
  if (Platform.OS !== 'web') {
    const updateRefresh = (state: string) => {
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
