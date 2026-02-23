/**
 * offlineSyncService.ts
 *
 * Persists the active workout draft to AsyncStorage so that data is never lost
 * if the app crashes, is backgrounded, or loses connectivity.
 *
 * Key design decisions:
 *  - Draft key is per-user to avoid cross-account collisions.
 *  - Writes are debounced (3 s) to avoid thrashing storage on rapid input.
 *  - The draft stores a minimal snapshot: exercises + their sets + input strings.
 *    Timer state is intentionally excluded (startTime is included so elapsed
 *    time can be reconstructed on recovery).
 *  - Schema version field allows safe migration if the shape changes later.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------- Schema ----------

const SCHEMA_VERSION = 1;
const DRAFT_KEY_PREFIX = 'lyfttrack:workout_draft:';
const WRITE_DEBOUNCE_MS = 3_000;

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

  try {
    await AsyncStorage.setItem(key, payload);
  } catch (error) {
    // Storage write failures are non-fatal — the in-memory state is still valid.
    console.warn('[offlineSyncService] Draft save failed:', error);
  }
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
  const key = getDraftKey(userId);

  try {
    const raw = await AsyncStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkoutDraft>;

    // Validate schema version
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn(
        `[offlineSyncService] Draft schema v${parsed.schemaVersion} is incompatible with current v${SCHEMA_VERSION}. Discarding.`
      );
      await clearWorkoutDraft(userId);
      return null;
    }

    if (!parsed.draftId || !parsed.userId || !parsed.startTime || !Array.isArray(parsed.exercises)) {
      console.warn('[offlineSyncService] Draft is malformed. Discarding.');
      await clearWorkoutDraft(userId);
      return null;
    }

    return parsed as WorkoutDraft;
  } catch (error) {
    console.warn('[offlineSyncService] Failed to load draft:', error);
    return null;
  }
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

  const key = getDraftKey(userId);

  try {
    await AsyncStorage.removeItem(key);
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
