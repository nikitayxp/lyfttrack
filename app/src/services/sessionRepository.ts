import { supabase } from '@/services/supabase';
import type { TablesInsert } from '@/types/database';
import { INPUT_LIMITS, sanitizeText, toSafeNumber } from '@/utils/inputValidation';
import {
  getAuthenticatedUserOrThrow,
  extractSupabaseErrorMeta,
  normalizeIsoTimestamp,
  normalizeOptionalId,
  normalizeExerciseIdList,
  isWorkoutExercisesTableMissing,
  buildSetInsertRow,
  isWorkoutExerciseIdColumnMissing,
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

// ---------- Create Workout ----------

async function countNewPersonalRecords(
  currentWorkoutId: string,
  completedSetDrafts: WorkoutSetDraft[],
): Promise<number> {
  const exerciseMaxWeights = new Map<string, number>();

  for (const draft of completedSetDrafts) {
    const exerciseId = (draft.exerciseId ?? '').trim();
    if (!exerciseId) continue;

    const weight = toSafeNumber(draft.weight, { min: 0, max: INPUT_LIMITS.weightMax, decimals: 2 }) ?? 0;
    if (weight <= 0) continue;

    const current = exerciseMaxWeights.get(exerciseId) ?? 0;
    if (weight > current) {
      exerciseMaxWeights.set(exerciseId, weight);
    }
  }

  if (exerciseMaxWeights.size === 0) return 0;

  const user = await getAuthenticatedUserOrThrow();

  const { data: userWorkoutIds } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .neq('id', currentWorkoutId);

  if (!userWorkoutIds || userWorkoutIds.length === 0) {
    return exerciseMaxWeights.size;
  }

  const workoutIds = userWorkoutIds.map((w) => w.id);
  const exerciseIds = [...exerciseMaxWeights.keys()];

  const { data: previousSets } = await supabase
    .from('sets')
    .select('exercise_id, weight')
    .in('workout_id', workoutIds)
    .in('exercise_id', exerciseIds)
    .not('weight', 'is', null);

  const previousMaxMap = new Map<string, number>();
  if (previousSets) {
    for (const row of previousSets) {
      if (!row.exercise_id) continue;
      const weight = row.weight ?? 0;
      const current = previousMaxMap.get(row.exercise_id) ?? 0;
      if (weight > current) {
        previousMaxMap.set(row.exercise_id, weight);
      }
    }
  }

  let prCount = 0;
  for (const [exerciseId, newMax] of exerciseMaxWeights) {
    const previousMax = previousMaxMap.get(exerciseId) ?? 0;
    if (newMax > previousMax) prCount++;
  }

  return prCount;
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
      startTime: input.startTime,
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
      endTime,
      totalSetDrafts: input.setDrafts.length,
      completedSetDrafts: completedSetDrafts.length,
      error: extractSupabaseErrorMeta(error),
    });
    throw error;
  }

  let prCount = 0;
  try {
    prCount = await countNewPersonalRecords(saveResult.workoutId, completedSetDrafts);
  } catch {
    // Non-critical — default to 0 if PR check fails
  }

  return {
    workoutId: saveResult.workoutId,
    insertedSetCount: saveResult.insertedSetCount,
    completedSetCount: completedSetDrafts.length,
    totalVolume: calculateWorkoutVolume(input.setDrafts),
    durationSeconds: calculateDurationSeconds(input.startTime, endTime),
    startTime: input.startTime,
    endTime,
    prCount,
  };
}

export async function createWorkoutWithSets(
  input: CreateWorkoutWithSetsInput
): Promise<CreateWorkoutWithSetsResult> {
  if (input.setDrafts.length === 0) {
    throw new WorkoutSaveValidationError('no-valid-set-rows', 'No completed sets were provided for saving.');
  }

  const user = await getAuthenticatedUserOrThrow();
  const normalizedStartTime = normalizeIsoTimestamp(input.startTime, 'Workout start time');
  const normalizedEndTime = normalizeIsoTimestamp(input.endTime, 'Workout end time');
  const normalizedWorkoutName = sanitizeText(input.name, {
    maxLength: INPUT_LIMITS.nameMax,
    allowEmpty: true,
  }) ?? 'Untitled Workout';
  const normalizedWorkoutNotes = normalizeWriteText(input.notes, INPUT_LIMITS.notesMax);

  if (new Date(normalizedEndTime).getTime() < new Date(normalizedStartTime).getTime()) {
    throw new Error('Workout end time must be after start time.');
  }

  const normalizedTemplateId = normalizeOptionalId(input.templateId);
  let safeTemplateId: string | null = normalizedTemplateId;

  if (normalizedTemplateId) {
    const { data: ownedTemplate, error: ownedTemplateError } = await supabase
      .from('workout_templates')
      .select('id')
      .eq('id', normalizedTemplateId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (ownedTemplateError) {
      console.error('[createWorkoutWithSets] Failed to validate template_id, using null fallback', {
        userId: user.id,
        templateId: normalizedTemplateId,
        error: extractSupabaseErrorMeta(ownedTemplateError),
      });
      safeTemplateId = null;
    } else if (!ownedTemplate) {
      console.error('[createWorkoutWithSets] Invalid template_id for user, using null fallback', {
        userId: user.id,
        templateId: normalizedTemplateId,
      });
      safeTemplateId = null;
    }
  }

  let workoutInsert: TablesInsert<'workouts'> = {
    user_id: user.id,
    name: normalizedWorkoutName,
    notes: normalizedWorkoutNotes,
    template_id: safeTemplateId ?? null,
    start_time: normalizedStartTime,
    end_time: normalizedEndTime,
  };

  const insertWorkout = async (payload: TablesInsert<'workouts'>) => {
    return supabase
      .from('workouts')
      .insert(payload)
      .select('id')
      .single();
  };

  let { data: createdWorkout, error: workoutError } = await insertWorkout(workoutInsert);

  if (workoutError && workoutInsert.template_id !== null) {
    const errorMeta = extractSupabaseErrorMeta(workoutError);
    const shouldRetryWithoutTemplate =
      errorMeta.code === '23503' ||
      errorMeta.code === 'PGRST204' ||
      errorMeta.message.toLowerCase().includes('template_id');

    if (shouldRetryWithoutTemplate) {
      console.error('[createWorkoutWithSets] workouts insert failed with template_id, retrying with null template_id', {
        payload: workoutInsert,
        error: errorMeta,
      });

      workoutInsert = {
        ...workoutInsert,
        template_id: null,
      };

      const retryResult = await insertWorkout(workoutInsert);
      createdWorkout = retryResult.data;
      workoutError = retryResult.error;
    }
  }

  if (workoutError || !createdWorkout) {
    console.error('[createWorkoutWithSets] workouts insert failed', {
      payload: workoutInsert,
      templateIdInput: input.templateId ?? null,
      normalizedTemplateId,
      safeTemplateId,
      error: extractSupabaseErrorMeta(workoutError),
    });
    throw new Error(`Unable to create workout: ${workoutError?.message ?? 'Unknown error'}`);
  }

  const uniqueExerciseIds = normalizeExerciseIdList(
    input.setDrafts.map((draft) => draft.exerciseId ?? '')
  );

  const workoutExerciseRows: TablesInsert<'workout_exercises'>[] = uniqueExerciseIds.map((exerciseId, index) => ({
    workout_id: createdWorkout.id,
    exercise_id: exerciseId,
    order: index + 1,
    rest_time: null,
  }));

  const workoutExerciseIdByExercise = new Map<string, string>();

  if (workoutExerciseRows.length > 0) {
    const { data: insertedWorkoutExercises, error: workoutExercisesError } = await supabase
      .from('workout_exercises')
      .insert(workoutExerciseRows)
      .select('id, exercise_id');

    if (workoutExercisesError) {
      if (isWorkoutExercisesTableMissing(workoutExercisesError)) {
        console.warn('[createWorkoutWithSets] workout_exercises table missing, continuing with legacy sets-only insertion', {
          workoutId: createdWorkout.id,
          error: extractSupabaseErrorMeta(workoutExercisesError),
        });
      } else {
        const { error: rollbackError } = await supabase.from('workouts').delete().eq('id', createdWorkout.id);

        if (rollbackError) {
          throw new Error(
            `Unable to create workout exercises: ${workoutExercisesError.message}. Rollback failed for workout ${createdWorkout.id}: ${rollbackError.message}`
          );
        }

        throw new Error(
          `Unable to create workout exercises: ${workoutExercisesError.message}. Workout ${createdWorkout.id} was rolled back successfully.`
        );
      }
    } else {
      for (const relation of insertedWorkoutExercises ?? []) {
        workoutExerciseIdByExercise.set(relation.exercise_id, relation.id);
      }
    }
  }

  const mappedSetRows = input.setDrafts
    .map((draft) => {
      const normalizedExerciseId = draft.exerciseId?.trim() ?? '';
      return buildSetInsertRow(createdWorkout.id, draft, workoutExerciseIdByExercise.get(normalizedExerciseId) ?? null);
    });

  const setRows = mappedSetRows.filter((row): row is TablesInsert<'sets'> => row !== null);
  const rejectedSetRows = mappedSetRows.length - setRows.length;

  if (rejectedSetRows > 0) {
    console.warn('[createWorkoutWithSets] Some set rows were dropped during validation', {
      workoutId: createdWorkout.id,
      attemptedSetRows: mappedSetRows.length,
      insertedCandidateRows: setRows.length,
      rejectedSetRows,
    });
  }

  if (setRows.length === 0) {
    const { error: rollbackError } = await supabase.from('workouts').delete().eq('id', createdWorkout.id);

    if (rollbackError) {
      throw new Error(
        `No valid sets were generated for insertion. Rollback failed for workout ${createdWorkout.id}: ${rollbackError.message}`
      );
    }

    throw new WorkoutSaveValidationError(
      'no-valid-set-rows',
      'No valid completed sets were found to save. Please review your sets and try again.'
    );
  }

  const insertSets = async (rows: TablesInsert<'sets'>[]) => {
    return supabase.from('sets').insert(rows);
  };

  let { error: setsError } = await insertSets(setRows);

  if (setsError && isWorkoutExerciseIdColumnMissing(setsError)) {
    const legacySetRows: TablesInsert<'sets'>[] = setRows.map(({ workout_exercise_id: _ignored, ...rest }) => rest);

    console.warn('[createWorkoutWithSets] sets.workout_exercise_id column missing, retrying insert without it', {
      workoutId: createdWorkout.id,
      error: extractSupabaseErrorMeta(setsError),
    });

    const retryResult = await insertSets(legacySetRows);
    setsError = retryResult.error;
  }

  if (!setsError) {
    return {
      workoutId: createdWorkout.id,
      insertedSetCount: setRows.length,
    };
  }

  const { error: rollbackError } = await supabase.from('workouts').delete().eq('id', createdWorkout.id);

  if (rollbackError) {
    throw new Error(
      `Unable to save sets: ${setsError.message}. Rollback failed for workout ${createdWorkout.id}: ${rollbackError.message}`
    );
  }

  throw new Error(
    `Unable to save sets: ${setsError.message}. Workout ${createdWorkout.id} was rolled back successfully.`
  );
}
