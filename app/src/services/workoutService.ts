import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import type { Tables, TablesInsert } from '@/types/database';

export type ExerciseCatalogItem = Tables<'exercises'>;

export type CreateExerciseInput = {
  name: string;
  muscleGroup?: string | null;
  equipment?: string | null;
};

export type WorkoutSetDraft = {
  exerciseId: string | null | undefined;
  setNumber: number | null | undefined;
  weight?: number | null;
  reps?: number | null;
  rir?: number | null;
  setType?: string | null;
};

export type CreateWorkoutWithSetsInput = {
  name: string;
  notes?: string | null;
  startTime: string;
  endTime: string;
  setDrafts: WorkoutSetDraft[];
};

export type CreateWorkoutWithSetsResult = {
  workoutId: string;
  insertedSetCount: number;
};

// ---------- Workout History Types ----------

export type WorkoutHistorySet = {
  id: string;
  set_number: number | null;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  set_type: string | null;
  exercise_name: string;
  muscle_group: string | null;
};

export type WorkoutHistoryItem = {
  id: string;
  name: string;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  sets: WorkoutHistorySet[];
  totalVolume: number;
  totalSets: number;
  exerciseNames: string[];
};

export type WorkoutStats = {
  totalWorkouts: number;
  totalVolume: number;
  totalSets: number;
};

// ---------- Helpers ----------

function normalizeNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function normalizeSetType(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildSetInsertRow(workoutId: string, draft: WorkoutSetDraft): TablesInsert<'sets'> | null {
  const normalizedExerciseId = draft.exerciseId?.trim();
  const normalizedSetNumber = draft.setNumber ?? null;

  if (!normalizedExerciseId) {
    return null;
  }

  if (!normalizedSetNumber || !Number.isFinite(normalizedSetNumber) || normalizedSetNumber < 1) {
    return null;
  }

  return {
    workout_id: workoutId,
    exercise_id: normalizedExerciseId,
    set_number: Math.trunc(normalizedSetNumber),
    weight: normalizeNumber(draft.weight),
    reps: normalizeNumber(draft.reps),
    rir: normalizeNumber(draft.rir),
    set_type: normalizeSetType(draft.setType),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

// ---------- Auth ----------

export async function getAuthenticatedUserOrThrow(): Promise<User> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Unable to fetch authenticated user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('Authenticated user not found. Please log in again.');
  }

  return data.user;
}

// ---------- Exercises CRUD ----------

export async function getExercisesCatalog(): Promise<ExerciseCatalogItem[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Unable to load exercises: ${error.message}`);
  }

  return data ?? [];
}

export async function createExercise(input: CreateExerciseInput): Promise<ExerciseCatalogItem> {
  const normalizedName = input.name.trim();

  if (normalizedName.length < 2) {
    throw new Error('Exercise name must have at least 2 characters.');
  }

  const insertRow: TablesInsert<'exercises'> = {
    name: normalizedName,
    muscle_group: normalizeOptionalText(input.muscleGroup),
    equipment: normalizeOptionalText(input.equipment),
  };

  const { data, error } = await supabase.from('exercises').insert(insertRow).select('*').single();

  if (error || !data) {
    throw new Error(`Unable to create exercise: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

// ---------- Create Workout ----------

export async function createWorkoutWithSets(
  input: CreateWorkoutWithSetsInput
): Promise<CreateWorkoutWithSetsResult> {
  const user = await getAuthenticatedUserOrThrow();

  const workoutInsert: TablesInsert<'workouts'> = {
    user_id: user.id,
    name: input.name.trim() || 'Untitled Workout',
    notes: input.notes ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
  };

  const { data: createdWorkout, error: workoutError } = await supabase
    .from('workouts')
    .insert(workoutInsert)
    .select('id')
    .single();

  if (workoutError || !createdWorkout) {
    throw new Error(`Unable to create workout: ${workoutError?.message ?? 'Unknown error'}`);
  }

  const setRows = input.setDrafts
    .map((draft) => buildSetInsertRow(createdWorkout.id, draft))
    .filter((row): row is TablesInsert<'sets'> => row !== null);

  if (setRows.length === 0) {
    return {
      workoutId: createdWorkout.id,
      insertedSetCount: 0,
    };
  }

  const { error: setsError } = await supabase.from('sets').insert(setRows);

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

// ---------- Workout History ----------

export async function getWorkoutHistory(limit = 20): Promise<WorkoutHistoryItem[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)
    .order('start_time', { ascending: false })
    .limit(limit);

  if (workoutsError) {
    throw new Error(`Unable to load workout history: ${workoutsError.message}`);
  }

  if (!workouts || workouts.length === 0) {
    return [];
  }

  const workoutIds = workouts.map((w) => w.id);

  const { data: allSets, error: setsError } = await supabase
    .from('sets')
    .select('*, exercises(name, muscle_group)')
    .in('workout_id', workoutIds);

  if (setsError) {
    throw new Error(`Unable to load workout sets: ${setsError.message}`);
  }

  const setsByWorkout = new Map<string, WorkoutHistorySet[]>();

  for (const raw of allSets ?? []) {
    const workoutId = raw.workout_id;
    if (!workoutId) continue;

    const exerciseData = raw.exercises as { name: string; muscle_group: string | null} | null;

    const set: WorkoutHistorySet = {
      id: raw.id,
      set_number: raw.set_number,
      weight: raw.weight,
      reps: raw.reps,
      rir: raw.rir,
      set_type: raw.set_type,
      exercise_name: exerciseData?.name ?? 'Unknown',
      muscle_group: exerciseData?.muscle_group ?? null,
    };

    const existing = setsByWorkout.get(workoutId) ?? [];
    existing.push(set);
    setsByWorkout.set(workoutId, existing);
  }

  return workouts.map((workout) => {
    const sets = setsByWorkout.get(workout.id) ?? [];

    let totalVolume = 0;
    for (const s of sets) {
      const w = s.weight ?? 0;
      const r = s.reps ?? 0;
      totalVolume += w * r;
    }

    const uniqueExercises = [...new Set(sets.map((s) => s.exercise_name))];

    return {
      id: workout.id,
      name: workout.name,
      notes: workout.notes,
      start_time: workout.start_time,
      end_time: workout.end_time,
      sets,
      totalVolume: Math.round(totalVolume),
      totalSets: sets.length,
      exerciseNames: uniqueExercises,
    };
  });
}

export async function getWorkoutStats(): Promise<WorkoutStats> {
  const history = await getWorkoutHistory(100);

  let totalVolume = 0;
  let totalSets = 0;

  for (const workout of history) {
    totalVolume += workout.totalVolume;
    totalSets += workout.totalSets;
  }

  return {
    totalWorkouts: history.length,
    totalVolume: Math.round(totalVolume),
    totalSets,
  };
}

export function getErrorMessage(error: unknown): string {
  return toErrorMessage(error);
}
