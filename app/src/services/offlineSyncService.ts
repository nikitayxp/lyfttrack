/**
 * offlineSyncService.ts
 *
 * Persists the active workout draft to AsyncStorage so that data is never lost
 * if the app crashes, is backgrounded, or loses connectivity.
 *
 * Key design decisions:
 *  - Draft key is per-user to avoid cross-account collisions.
 *  - Writes are debounced (800 ms) to avoid thrashing storage on rapid input.
 *  - On web there is an extra synchronous mirror written straight to
 *    localStorage. AsyncStorage is promise-based, so a `beforeunload` (F5 /
 *    tab close) can kill the page before the write lands. The mirror is
 *    written under its own key and the newest of the two wins on load.
 *  - The draft stores a minimal snapshot: exercises + their sets + input strings.
 *    Timer state is intentionally excluded (startTime is included so elapsed
 *    time can be reconstructed on recovery).
 *  - Schema version field allows safe migration if the shape changes later.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ---------- Schema ----------

const SCHEMA_VERSION = 1;
const DRAFT_KEY_PREFIX = 'lyfttrack:workout_draft:';
const SYNC_DRAFT_KEY_PREFIX = 'lyfttrack:workout_draft_sync:';
const WRITE_DEBOUNCE_MS = 800;

export type DraftSet = {
  id: string;
  set_number: number | null;
  set_type: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  completed: boolean;
  weightInput: string;
  repsInput: string;
  rirInput: string;
  /** Unilateral side. Older drafts may omit this; default to 'both' on load. */
  side?: 'both' | 'left' | 'right';
};

export type DraftExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscle_group: string | null;
  equipment: string | null;
  defaultRestSeconds: number;
  sets: DraftSet[];
  /** Per-workout snapshot of the exercise notes. */
  notes?: string | null;
};

export type WorkoutDraft = {
  schemaVersion: number;
  draftId: string;
  userId: string;
  workoutName: string;
  startTime: string; // ISO string – used to reconstruct elapsed time
  templateId: string | null;
  exercises: DraftExercise[];
  savedAt: string; // ISO string
};

// ---------- Private Helpers ----------

function getDraftKey(userId: string): string {
  return `${DRAFT_KEY_PREFIX}${userId}`;
}

function getSyncDraftKey(userId: string): string {
  return `${SYNC_DRAFT_KEY_PREFIX}${userId}`;
}

/** localStorage, but only on web and only when the browser actually allows it. */
function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;

  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    // Blocked by privacy settings / sandboxed iframe.
    return null;
  }
}

function parseDraft(raw: string | null): WorkoutDraft | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<WorkoutDraft>;

    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    if (!parsed.draftId || !parsed.userId || !parsed.startTime || !Array.isArray(parsed.exercises)) return null;

    return parsed as WorkoutDraft;
  } catch {
    return null;
  }
}

function getSavedAtMs(draft: WorkoutDraft | null): number {
  if (!draft) return -1;
  const parsed = new Date(draft.savedAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ---------- Public API ----------

/**
 * Persist the workout draft immediately (bypassing debounce).
 * Use this for lifecycle events such as app-background.
 */
export async function saveWorkoutDraftNow(draft: WorkoutDraft): Promise<void> {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const key = getDraftKey(draft.userId);
  const payload = JSON.stringify({ ...draft, savedAt: new Date().toISOString() });

  // Mirror synchronously on web so a refresh mid-flight still leaves a draft.
  writeWebMirror(draft.userId, payload);

  try {
    await AsyncStorage.setItem(key, payload);
  } catch (error) {
    // Storage write failures are non-fatal — the in-memory state is still valid.
    console.warn('[offlineSyncService] Draft save failed:', error);
  }
}

function writeWebMirror(userId: string, payload: string): void {
  const storage = getWebStorage();
  if (!storage) return;

  try {
    storage.setItem(getSyncDraftKey(userId), payload);
  } catch (error) {
    console.warn('[offlineSyncService] Draft mirror save failed:', error);
  }
}

/**
 * Fully synchronous save. Use from `beforeunload` / `pagehide`, where a promise
 * has no chance of settling before the document goes away. On native this falls
 * back to the regular async write.
 */
export function saveWorkoutDraftSync(draft: WorkoutDraft): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const payload = JSON.stringify({ ...draft, savedAt: new Date().toISOString() });
  const storage = getWebStorage();

  if (!storage) {
    void saveWorkoutDraftNow(draft);
    return;
  }

  writeWebMirror(draft.userId, payload);

  // Best-effort async write too, so both keys converge when the page survives.
  void AsyncStorage.setItem(getDraftKey(draft.userId), payload).catch(() => {
    // Mirror already holds the data.
  });
}

/**
 * Debounced save — called on every state mutation.
 * Coalesces rapid consecutive writes into a single storage operation.
 */
export function scheduleWorkoutDraftSave(draft: WorkoutDraft): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    void saveWorkoutDraftNow(draft);
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Load a persisted draft for the given user.
 * Returns null if no draft exists or the schema is incompatible.
 */
export async function loadWorkoutDraft(userId: string): Promise<WorkoutDraft | null> {
  let asyncDraft: WorkoutDraft | null = null;

  try {
    asyncDraft = parseDraft(await AsyncStorage.getItem(getDraftKey(userId)));
  } catch (error) {
    console.warn('[offlineSyncService] Failed to load draft:', error);
  }

  let mirrorDraft: WorkoutDraft | null = null;
  const storage = getWebStorage();

  if (storage) {
    try {
      mirrorDraft = parseDraft(storage.getItem(getSyncDraftKey(userId)));
    } catch (error) {
      console.warn('[offlineSyncService] Failed to load draft mirror:', error);
    }
  }

  // The mirror is written last on unload, so it can be newer than the async copy.
  const draft = getSavedAtMs(mirrorDraft) > getSavedAtMs(asyncDraft) ? mirrorDraft : asyncDraft;

  if (!draft) {
    // Nothing usable — drop whatever malformed/outdated payload is left behind.
    await clearWorkoutDraft(userId);
    return null;
  }

  return draft;
}

/**
 * Remove the persisted draft after a successful save to Supabase,
 * or when the user explicitly discards the workout.
 */
export async function clearWorkoutDraft(userId: string): Promise<void> {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const storage = getWebStorage();

  if (storage) {
    try {
      storage.removeItem(getSyncDraftKey(userId));
    } catch (error) {
      console.warn('[offlineSyncService] Failed to clear draft mirror:', error);
    }
  }

  try {
    await AsyncStorage.removeItem(getDraftKey(userId));
  } catch (error) {
    console.warn('[offlineSyncService] Failed to clear draft:', error);
  }
}

/**
 * Build a canonical draftId so that duplicate recovery dialogs are avoided
 * when the user loads the same session multiple times.
 */
export function buildDraftId(userId: string, startTime: string): string {
  return `${userId}:${startTime}`;
}

export { SCHEMA_VERSION };
