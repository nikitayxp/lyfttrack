import { supabase } from '@/services/supabase';
import type { Json } from '@/types/database';
import { INPUT_LIMITS, sanitizeText, toSafeInteger, toSafeNumber } from '@/utils/inputValidation';
import {
  getAuthenticatedUserOrThrow,
  extractSupabaseErrorMeta,
  normalizeIsoTimestamp,
  normalizeOptionalId,
  normalizeExerciseIdList,
  buildSetInsertRow,
  calculateDurationSeconds,
  toCompletedSetDrafts,
  calculateWorkoutVolume,
  normalizeWriteText
} from './workoutService';
import {
  type CreateWorkoutWithSetsInput,
  type CreateWorkoutWithSetsResult,
  type FinishWorkoutInput,
  type FinishWorkoutResult,
  type WorkoutSetDraft,
  WorkoutSaveValidationError,
} from './workoutSession.types';
import { findPersonalRecordExerciseIds, type PersonalRecordSetSample } from '@/utils/personalRecords';

// ---------- Create Workout ----------

async function findNewPersonalRecordExerciseIds(
  currentWorkoutId: string,
  completedSetDrafts: WorkoutSetDraft[],
): Promise<string[]> {
  const currentSamples: PersonalRecordSetSample[] = [];

  for (const draft of completedSetDrafts) {
    const exerciseId = (draft.exerciseId ?? '').trim();
    if (!exerciseId) continue;

    currentSamples.push({
      exerciseId,
      weight: toSafeNumber(draft.weight, { min: 0, max: INPUT_LIMITS.weightMax, decimals: 2 }),
      reps: toSafeInteger(draft.reps, { min: 0, max: INPUT_LIMITS.repsMax }),
    });
  }

  if (currentSamples.length === 0) return [];

  const { data: currentWorkout, error: currentWorkoutError } = await supabase
    .from('workouts')
    .select('id, user_id, start_time')
    .eq('id', currentWorkoutId)
    .maybeSingle();

  if (currentWorkoutError || !currentWorkout) {
    return [];
  }

  const exerciseIds = [...new Set(currentSamples.map((sample) => sample.exerciseId))];

  const { data: priorWorkouts } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', currentWorkout.user_id)
    .neq('id', currentWorkoutId)
    .not('end_time', 'is', null)
    .lt('start_time', currentWorkout.start_time);

  if (!priorWorkouts || priorWorkouts.length === 0) {
    return [];
  }

  const { data: previousSets } = await supabase
    .from('sets')
    .select('exercise_id, weight, reps')
    .in(
      'workout_id',
      priorWorkouts.map((workout) => workout.id)
    )
    .in('exercise_id', exerciseIds);

  return findPersonalRecordExerciseIds(
    currentSamples,
    (previousSets ?? []).map((row) => ({
      exerciseId: row.exercise_id ?? '',
      weight: row.weight,
      reps: row.reps,
    }))
  );
}

export async function finishWorkout(input: FinishWorkoutInput): Promise<FinishWorkoutResult> {
  const endTime = new Date().toISOString();
  const completedSetDrafts = toCompletedSetDrafts(input.setDrafts);

  if (completedSetDrafts.length === 0) {
    throw new WorkoutSaveValidationError(
      'no-completed-sets',
      'Mark at least one set as completed before finishing the workout.'
    );
  }

  let saveResult: CreateWorkoutWithSetsResult;

  try {
    saveResult = await createWorkoutWithSets({
      name: input.name,
      notes: input.notes,
      templateId: input.templateId ?? null,
      exerciseRestSecondsByExerciseId: input.exerciseRestSecondsByExerciseId,
      notesByExerciseId: input.notesByExerciseId,
      startTime: input.startTime,
      sessionStartTime: input.sessionStartTime ?? input.startTime,
      endTime,
      setDrafts: completedSetDrafts,
    });
  } catch (error) {
    if (error instanceof WorkoutSaveValidationError) {
      throw error;
    }

    console.error('[finishWorkout] Unable to persist workout to Supabase', {
      templateId: input.templateId ?? null,
      startTime: input.startTime,
      sessionStartTime: input.sessionStartTime ?? input.startTime,
      endTime,
      totalSetDrafts: input.setDrafts.length,
      completedSetDrafts: completedSetDrafts.length,
      error: extractSupabaseErrorMeta(error),
    });
    throw error;
  }

  let prExerciseIds: string[] = [];
  try {
    prExerciseIds = await findNewPersonalRecordExerciseIds(saveResult.workoutId, completedSetDrafts);
  } catch {
    // Non-critical — default to none if PR check fails
  }

  return {
    workoutId: saveResult.workoutId,
    insertedSetCount: saveResult.insertedSetCount,
    completedSetCount: completedSetDrafts.length,
    completedWorkingSetCount: completedSetDrafts.filter((draft) => draft.setType !== 'warmup').length,
    totalVolume: calculateWorkoutVolume(input.setDrafts),
    durationSeconds: calculateDurationSeconds(saveResult.startTime, saveResult.endTime),
    startTime: saveResult.startTime,
    endTime: saveResult.endTime,
    prCount: prExerciseIds.length,
    prExerciseIds,
  };
}

export async function createWorkoutWithSets(
  input: CreateWorkoutWithSetsInput
): Promise<CreateWorkoutWithSetsResult> {
  if (input.setDrafts.length === 0 || input.setDrafts.length > 1000) {
    throw new WorkoutSaveValidationError('no-valid-set-rows', 'Provide between 1 and 1000 completed sets.');
  }
  const user = await getAuthenticatedUserOrThrow();
  const startTime = normalizeIsoTimestamp(input.startTime, 'Workout start time');
  const endTime = normalizeIsoTimestamp(input.endTime, 'Workout end time');
  const sessionStartTime = normalizeIsoTimestamp(input.sessionStartTime ?? input.startTime, 'Workout session identity');
  if (new Date(endTime).getTime() < new Date(startTime).getTime()) {
    throw new Error('Workout end time must be after start time.');
  }
  const rows = input.setDrafts.map(draft => {
    const row = buildSetInsertRow('', draft);
    if (!row || (draft.weight != null && row.weight == null) || (draft.reps != null && row.reps == null) || (draft.rir != null && row.rir == null)) {
      throw new WorkoutSaveValidationError('no-valid-set-rows', 'Review the completed sets before saving.');
    }
    return {
      exercise_id: row.exercise_id, set_number: row.set_number, weight: row.weight,
      reps: row.reps, rir: row.rir, set_type: row.set_type, side: row.side,
    };
  });
  const exerciseIds = normalizeExerciseIdList(rows.map(row => row.exercise_id ?? ''));
  const exercises = exerciseIds.map((id, index) => ({
    exercise_id: id, order: index + 1,
    rest_time: toSafeInteger(input.exerciseRestSecondsByExerciseId?.[id], { min: 0, max: 3600 }) ?? 0,
    notes: normalizeWriteText(input.notesByExerciseId?.[id], 1000),
  }));
  const { data, error } = await supabase.rpc('create_workout_atomic', {
    p_expected_user_id: user.id,
    p_workout: {
      name: sanitizeText(input.name, { maxLength: INPUT_LIMITS.nameMax, allowEmpty: true }) ?? 'Untitled Workout',
      notes: normalizeWriteText(input.notes, INPUT_LIMITS.notesMax),
      template_id: normalizeOptionalId(input.templateId), start_time: startTime, end_time: endTime, session_started_at: sessionStartTime,
    },
    p_exercises: exercises, p_sets: rows,
  });
  if (error) throw new Error(`Unable to save workout: ${error.message}`);
  const result = data as { workout_id?: string; inserted_set_count?: number; start_time?: string; end_time?: string } | null;
  if (!result?.workout_id || !Number.isInteger(result.inserted_set_count) || result.inserted_set_count! <= 0 || !result.start_time || !result.end_time) {
    throw new Error('The server did not confirm the saved workout. Please retry.');
  }
  const currentUser = await getAuthenticatedUserOrThrow();
  if (currentUser.id !== user.id) throw new Error('Account changed while saving. Return to the original account to check the saved workout.');
  return {
    workoutId: result.workout_id, insertedSetCount: result.inserted_set_count!,
    startTime: result.start_time, endTime: result.end_time,
  };
}

// ---------- Edit Workout (completed) ----------

export type WorkoutSetPatch = {
  setId: string;
  weight?: number | null;
  reps?: number | null;
  rir?: number | null;
  side?: 'both' | 'left' | 'right';
};

export type UpdateWorkoutSetsInput = {
  workoutId: string;
  setPatches: WorkoutSetPatch[];
  workoutName?: string | null;
  workoutNotes?: string | null;
  notesByExerciseId?: Record<string, string | null | undefined>;
};

export async function updateWorkoutSets(input: UpdateWorkoutSetsInput): Promise<void> {
  const normalizedWorkoutId = input.workoutId.trim();
  if (!normalizedWorkoutId) {
    throw new WorkoutSaveValidationError('no-valid-set-rows', 'Workout id is required');
  }

  const workoutPatch: Record<string, Json> = {};
  if (typeof input.workoutName === 'string') {
    workoutPatch.name = normalizeWriteText(input.workoutName, INPUT_LIMITS.nameMax) ?? 'Workout';
  }
  if (input.workoutNotes !== undefined) {
    workoutPatch.notes = normalizeWriteText(input.workoutNotes, INPUT_LIMITS.notesMax);
  }

  const setPatches = input.setPatches.map((patch) => {
    const id = patch.setId?.trim();
    if (!id) {
      throw new WorkoutSaveValidationError('no-valid-set-rows', 'Set id is required');
    }
    const normalized: Record<string, Json> = { id };
    if (patch.weight !== undefined) {
      normalized.weight = toSafeNumber(patch.weight, { min: 0, max: INPUT_LIMITS.weightMax, decimals: 2 });
    }
    if (patch.reps !== undefined) {
      normalized.reps = toSafeInteger(patch.reps, { min: 0, max: INPUT_LIMITS.repsMax });
    }
    if (patch.rir !== undefined) {
      normalized.rir = toSafeInteger(patch.rir, { min: 0, max: INPUT_LIMITS.rirMax });
    }
    if (patch.side !== undefined) {
      normalized.side = patch.side;
    }
    return normalized;
  });

  const exerciseNotes: Record<string, Json> = {};
  for (const [exerciseId, notes] of Object.entries(input.notesByExerciseId ?? {})) {
    const id = exerciseId.trim();
    if (!id) {
      throw new WorkoutSaveValidationError('no-valid-set-rows', 'Exercise id is required');
    }
    exerciseNotes[id] = normalizeWriteText(notes, INPUT_LIMITS.notesMax);
  }

  const { error } = await supabase.rpc('update_workout_atomic', {
    p_workout_id: normalizedWorkoutId,
    p_workout_patch: workoutPatch,
    p_set_patches: setPatches,
    p_exercise_notes: exerciseNotes,
  });
  if (error) {
    throw new Error(`Unable to update workout: ${error.message}`);
  }
}
