import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import type { Tables, TablesInsert } from '@/types/database';

export type ExerciseCatalogItem = Tables<'exercises'>;
export type ExerciseLibraryMuscleFilter = 'all' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms';
export type ExerciseLibraryEquipmentFilter = 'all' | 'barbell' | 'dumbbell' | 'machine' | 'cable';
export type ExerciseCatalogFilters = {
  muscle?: ExerciseLibraryMuscleFilter;
  equipment?: ExerciseLibraryEquipmentFilter;
};
export type RoutineRow = Tables<'routines'>;
export type RoutineExerciseRow = Tables<'routine_exercises'>;
export type WorkoutExerciseRow = Tables<'workout_exercises'>;
export type ProfileRow = Tables<'profiles'>;
export type WorkoutSetType = Exclude<Tables<'sets'>['set_type'], null>;

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
  setType?: WorkoutSetType | string | null;
};

export type WorkoutSetProgressDraft = WorkoutSetDraft & {
  completed?: boolean | null;
};

export type CreateWorkoutWithSetsInput = {
  name: string;
  notes?: string | null;
  routineId?: string | null;
  startTime: string;
  endTime: string;
  setDrafts: WorkoutSetDraft[];
};

export type CreateWorkoutWithSetsResult = {
  workoutId: string;
  insertedSetCount: number;
};

export type FinishWorkoutInput = {
  name: string;
  notes?: string | null;
  routineId?: string | null;
  startTime: string;
  setDrafts: WorkoutSetProgressDraft[];
};

export type FinishWorkoutResult = {
  workoutId: string;
  insertedSetCount: number;
  completedSetCount: number;
  totalVolume: number;
  durationSeconds: number;
  startTime: string;
  endTime: string;
};

export type RoutineSummary = Pick<RoutineRow, 'id' | 'name' | 'notes'> & {
  exerciseCount: number;
};

export type RoutineDetailExercise = Pick<RoutineExerciseRow, 'id' | 'order'> & {
  exercise: ExerciseCatalogItem;
};

export type RoutineDetail = Pick<RoutineRow, 'id' | 'name' | 'notes'> & {
  exercises: RoutineDetailExercise[];
};

// ---------- Workout History Types ----------

export type WorkoutHistorySet = {
  id: string;
  set_number: number | null;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  set_type: WorkoutSetType;
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

export type PublicProfile = Pick<ProfileRow, 'id' | 'username' | 'full_name' | 'avatar_url'>;

export type WorkoutFeedItem = Pick<
  Tables<'workouts'>,
  'id' | 'name' | 'notes' | 'start_time' | 'end_time' | 'user_id'
> & {
  profile: PublicProfile | null;
  totalVolume: number;
  totalSets: number;
  exerciseNames: string[];
  likes_count: number;
  comments_count: number;
  has_liked: boolean;
};

export type RoutineFeedItem = Pick<Tables<'routines'>, 'id' | 'name' | 'notes' | 'created_at' | 'user_id'> & {
  profile: PublicProfile | null;
  exerciseCount: number;
};

export type PreviousExercisePerformanceSet = {
  setNumber: number | null;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  setType: WorkoutSetType;
};

export type WorkoutDetailsSet = Pick<
  Tables<'sets'>,
  'id' | 'set_number' | 'weight' | 'reps' | 'rir' | 'workout_exercise_id' | 'exercise_id'
> & {
  set_type: WorkoutSetType;
};

export type WorkoutDetailsExercise = {
  id: string | null;
  order: number;
  rest_time: number | null;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  equipment: string | null;
  sets: WorkoutDetailsSet[];
};

export type WorkoutDetails = Pick<
  Tables<'workouts'>,
  'id' | 'name' | 'notes' | 'start_time' | 'end_time' | 'user_id'
> & {
  profile: PublicProfile | null;
  exercises: WorkoutDetailsExercise[];
  totalVolume: number;
  totalSets: number;
  durationSeconds: number;
  heaviestWeight: number | null;
  bestEstimated1RM: number | null;
};

// ---------- Helpers ----------

function normalizeNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function normalizeSetType(value: string | null | undefined): WorkoutSetType {
  if (!value) {
    return 'normal';
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'normal' || normalized === 'working') return 'normal';
  if (normalized === 'warmup') return 'warmup';
  if (normalized === 'dropset' || normalized === 'drop') return 'drop';
  if (normalized === 'failure') return 'failure';

  return 'normal';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeExerciseIdList(exerciseIds: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of exerciseIds) {
    const normalized = value.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type RelationCountRow = {
  count: number | null;
};

type RawWorkoutFeedRow = Tables<'workouts'> & {
  workout_likes?: RelationCountRow[] | null;
  workout_comments?: RelationCountRow[] | null;
};

type ExerciseSummary = Pick<ExerciseCatalogItem, 'id' | 'name' | 'muscle_group' | 'equipment'>;

type RawWorkoutExerciseDetailsRow = Pick<WorkoutExerciseRow, 'id' | 'order' | 'rest_time' | 'exercise_id'> & {
  exercises?: ExerciseSummary | ExerciseSummary[] | null;
};

type RawWorkoutDetailsSetRow = Pick<
  Tables<'sets'>,
  'id' | 'set_number' | 'weight' | 'reps' | 'rir' | 'set_type' | 'workout_exercise_id' | 'exercise_id'
>;

function extractRelationCount(rows: RelationCountRow[] | null | undefined): number {
  if (!rows || rows.length === 0) {
    return 0;
  }

  const count = rows[0]?.count;

  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return 0;
  }

  return count;
}

async function getPublicProfilesByIds(userIds: string[]): Promise<Map<string, PublicProfile>> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', uniqueUserIds);

  if (profilesError) {
    throw new Error(`Unable to load profile data: ${profilesError.message}`);
  }

  return new Map((profiles ?? []).map((profile) => [profile.id, profile]));
}

function resolveEmbeddedObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function mapWorkoutDetailsSet(raw: RawWorkoutDetailsSetRow): WorkoutDetailsSet {
  return {
    id: raw.id,
    set_number: raw.set_number,
    weight: raw.weight,
    reps: raw.reps,
    rir: raw.rir,
    set_type: normalizeSetType(raw.set_type),
    workout_exercise_id: raw.workout_exercise_id,
    exercise_id: raw.exercise_id,
  };
}

function sortWorkoutDetailsSets(a: WorkoutDetailsSet, b: WorkoutDetailsSet): number {
  const aNumber = a.set_number ?? Number.MAX_SAFE_INTEGER;
  const bNumber = b.set_number ?? Number.MAX_SAFE_INTEGER;

  if (aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  return a.id.localeCompare(b.id);
}

function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) {
    return null;
  }

  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
    return null;
  }

  return weight * (1 + reps / 30);
}

function buildSetInsertRow(
  workoutId: string,
  draft: WorkoutSetDraft,
  workoutExerciseId: string | null = null
): TablesInsert<'sets'> | null {
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
    workout_exercise_id: workoutExerciseId,
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

function calculateDurationSeconds(startIso: string, endIso: string): number {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function toCompletedSetDrafts(setDrafts: WorkoutSetProgressDraft[]): WorkoutSetDraft[] {
  return setDrafts
    .filter((draft) => draft.completed === true)
    .map((draft) => ({
      exerciseId: draft.exerciseId,
      setNumber: draft.setNumber,
      weight: draft.weight,
      reps: draft.reps,
      rir: draft.rir,
      setType: draft.setType,
    }));
}

// Volume is based on completed sets only (weight * reps).
export function calculateWorkoutVolume(setDrafts: WorkoutSetProgressDraft[]): number {
  let total = 0;

  for (const draft of setDrafts) {
    if (draft.completed !== true) {
      continue;
    }

    const weight = draft.weight ?? 0;
    const reps = draft.reps ?? 0;

    if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
      continue;
    }

    total += Math.max(0, weight) * Math.max(0, reps);
  }

  return Math.round(total);
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

function getMuscleKeyword(filter: ExerciseLibraryMuscleFilter): string | null {
  if (filter === 'all') {
    return null;
  }

  if (filter === 'legs') {
    return 'leg';
  }

  if (filter === 'shoulders') {
    return 'shoulder';
  }

  return filter;
}

function getEquipmentKeyword(filter: ExerciseLibraryEquipmentFilter): string | null {
  if (filter === 'all') {
    return null;
  }

  return filter;
}

export async function getExercisesCatalog(filters: ExerciseCatalogFilters = {}): Promise<ExerciseCatalogItem[]> {
  const muscleFilter = filters.muscle ?? 'all';
  const equipmentFilter = filters.equipment ?? 'all';
  let query = supabase.from('exercises').select('*');

  const muscleKeyword = getMuscleKeyword(muscleFilter);
  const equipmentKeyword = getEquipmentKeyword(equipmentFilter);

  if (muscleKeyword) {
    query = query.ilike('muscle_group', `%${muscleKeyword}%`);
  }

  if (equipmentKeyword) {
    query = query.ilike('equipment', `%${equipmentKeyword}%`);
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) {
    throw new Error(`Unable to load exercises: ${error.message}`);
  }

  return data ?? [];
}

export async function createExercise(input: CreateExerciseInput): Promise<ExerciseCatalogItem> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedName = input.name.trim();

  if (normalizedName.length < 2) {
    throw new Error('Exercise name must have at least 2 characters.');
  }

  const insertRow: TablesInsert<'exercises'> = {
    name: normalizedName,
    created_by: user.id,
    is_custom: true,
    muscle_group: normalizeOptionalText(input.muscleGroup),
    equipment: normalizeOptionalText(input.equipment),
  };

  const { data, error } = await supabase.from('exercises').insert(insertRow).select('*').single();

  if (error || !data) {
    throw new Error(`Unable to create exercise: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

// ---------- Routines ----------

export async function getRoutines(): Promise<RoutineSummary[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data: routines, error: routinesError } = await supabase
    .from('routines')
    .select('id, name, notes')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (routinesError) {
    throw new Error(`Unable to load routines: ${routinesError.message}`);
  }

  if (!routines || routines.length === 0) {
    return [];
  }

  const routineIds = routines.map((routine) => routine.id);

  const { data: routineExercises, error: routineExercisesError } = await supabase
    .from('routine_exercises')
    .select('routine_id')
    .in('routine_id', routineIds);

  if (routineExercisesError) {
    throw new Error(`Unable to load routine exercises: ${routineExercisesError.message}`);
  }

  const exerciseCountByRoutine = new Map<string, number>();

  for (const relation of routineExercises ?? []) {
    const currentCount = exerciseCountByRoutine.get(relation.routine_id) ?? 0;
    exerciseCountByRoutine.set(relation.routine_id, currentCount + 1);
  }

  return routines.map((routine) => ({
    id: routine.id,
    name: routine.name,
    notes: routine.notes,
    exerciseCount: exerciseCountByRoutine.get(routine.id) ?? 0,
  }));
}

export async function getRoutineById(routineId: string): Promise<RoutineDetail> {
  const normalizedRoutineId = routineId.trim();

  if (!normalizedRoutineId) {
    throw new Error('Routine id is required.');
  }

  const user = await getAuthenticatedUserOrThrow();

  const { data: routine, error: routineError } = await supabase
    .from('routines')
    .select('id, name, notes')
    .eq('id', normalizedRoutineId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (routineError) {
    throw new Error(`Unable to load routine: ${routineError.message}`);
  }

  if (!routine) {
    throw new Error('Routine not found.');
  }

  const { data: routineExercises, error: routineExercisesError } = await supabase
    .from('routine_exercises')
    .select('id, order, exercise_id')
    .eq('routine_id', routine.id)
    .order('order', { ascending: true });

  if (routineExercisesError) {
    throw new Error(`Unable to load routine exercises: ${routineExercisesError.message}`);
  }

  if (!routineExercises || routineExercises.length === 0) {
    return {
      id: routine.id,
      name: routine.name,
      notes: routine.notes,
      exercises: [],
    };
  }

  const exerciseIds = routineExercises.map((entry) => entry.exercise_id);

  const { data: exercises, error: exercisesError } = await supabase
    .from('exercises')
    .select('*')
    .in('id', exerciseIds);

  if (exercisesError) {
    throw new Error(`Unable to load routine exercise details: ${exercisesError.message}`);
  }

  const exerciseById = new Map((exercises ?? []).map((exercise) => [exercise.id, exercise]));

  const orderedExercises: RoutineDetailExercise[] = routineExercises.flatMap((entry) => {
    const exercise = exerciseById.get(entry.exercise_id);

    if (!exercise) {
      return [];
    }

    return [
      {
        id: entry.id,
        order: entry.order,
        exercise,
      },
    ];
  });

  return {
    id: routine.id,
    name: routine.name,
    notes: routine.notes,
    exercises: orderedExercises,
  };
}

export async function createRoutine(
  name: string,
  notes: string | null | undefined,
  exerciseIds: string[]
): Promise<RoutineRow> {
  const user = await getAuthenticatedUserOrThrow();

  const normalizedName = name.trim();
  if (normalizedName.length < 2) {
    throw new Error('Routine name must have at least 2 characters.');
  }

  const normalizedExerciseIds = normalizeExerciseIdList(exerciseIds);
  if (normalizedExerciseIds.length === 0) {
    throw new Error('Select at least one exercise to create a routine.');
  }

  const routineInsert: TablesInsert<'routines'> = {
    user_id: user.id,
    name: normalizedName,
    notes: normalizeOptionalText(notes),
  };

  const { data: createdRoutine, error: routineError } = await supabase
    .from('routines')
    .insert(routineInsert)
    .select('*')
    .single();

  if (routineError || !createdRoutine) {
    throw new Error(`Unable to create routine: ${routineError?.message ?? 'Unknown error'}`);
  }

  const routineExerciseRows: TablesInsert<'routine_exercises'>[] = normalizedExerciseIds.map((exerciseId, index) => ({
    routine_id: createdRoutine.id,
    exercise_id: exerciseId,
    order: index + 1,
  }));

  const { error: routineExercisesError } = await supabase.from('routine_exercises').insert(routineExerciseRows);

  if (!routineExercisesError) {
    return createdRoutine;
  }

  const { error: rollbackError } = await supabase
    .from('routines')
    .delete()
    .eq('id', createdRoutine.id)
    .eq('user_id', user.id);

  if (rollbackError) {
    throw new Error(
      `Unable to save routine exercises: ${routineExercisesError.message}. Rollback failed for routine ${createdRoutine.id}: ${rollbackError.message}`
    );
  }

  throw new Error(
    `Unable to save routine exercises: ${routineExercisesError.message}. Routine ${createdRoutine.id} was rolled back successfully.`
  );
}

// ---------- Create Workout ----------

export async function finishWorkout(input: FinishWorkoutInput): Promise<FinishWorkoutResult> {
  const endTime = new Date().toISOString();
  const completedSetDrafts = toCompletedSetDrafts(input.setDrafts);

  const saveResult = await createWorkoutWithSets({
    name: input.name,
    notes: input.notes,
    routineId: input.routineId,
    startTime: input.startTime,
    endTime,
    setDrafts: completedSetDrafts,
  });

  return {
    workoutId: saveResult.workoutId,
    insertedSetCount: saveResult.insertedSetCount,
    completedSetCount: completedSetDrafts.length,
    totalVolume: calculateWorkoutVolume(input.setDrafts),
    durationSeconds: calculateDurationSeconds(input.startTime, endTime),
    startTime: input.startTime,
    endTime,
  };
}

export async function createWorkoutWithSets(
  input: CreateWorkoutWithSetsInput
): Promise<CreateWorkoutWithSetsResult> {
  const user = await getAuthenticatedUserOrThrow();

  const workoutInsert: TablesInsert<'workouts'> = {
    user_id: user.id,
    name: input.name.trim() || 'Untitled Workout',
    notes: input.notes ?? null,
    routine_id: normalizeOptionalId(input.routineId),
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

    for (const relation of insertedWorkoutExercises ?? []) {
      workoutExerciseIdByExercise.set(relation.exercise_id, relation.id);
    }
  }

  const setRows = input.setDrafts
    .map((draft) => {
      const normalizedExerciseId = draft.exerciseId?.trim() ?? '';
      return buildSetInsertRow(createdWorkout.id, draft, workoutExerciseIdByExercise.get(normalizedExerciseId) ?? null);
    })
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
      set_type: normalizeSetType((raw as { set_type: string | null }).set_type),
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

export async function getPreviousExercisePerformance(
  exerciseId: string,
  currentWorkoutId: string | null
): Promise<PreviousExercisePerformanceSet[]> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedExerciseId = normalizeOptionalId(exerciseId);
  const normalizedCurrentWorkoutId = normalizeOptionalId(currentWorkoutId);

  if (!normalizedExerciseId) {
    throw new Error('Exercise id is required to load previous performance.');
  }

  const latestWorkoutQuery = supabase
    .from('workouts')
    .select('id, sets!inner(exercise_id)')
    .eq('user_id', user.id)
    .eq('sets.exercise_id', normalizedExerciseId)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1);

  if (normalizedCurrentWorkoutId) {
    latestWorkoutQuery.neq('id', normalizedCurrentWorkoutId);
  }

  const { data: latestWorkoutRows, error: latestWorkoutError } = await latestWorkoutQuery;

  if (latestWorkoutError) {
    throw new Error(`Unable to load previous workout reference: ${latestWorkoutError.message}`);
  }

  const latestWorkoutId = latestWorkoutRows?.[0]?.id;

  if (!latestWorkoutId) {
    return [];
  }

  const { data: previousSets, error: previousSetsError } = await supabase
    .from('sets')
    .select('set_number, weight, reps, rir, set_type')
    .eq('workout_id', latestWorkoutId)
    .eq('exercise_id', normalizedExerciseId)
    .order('set_number', { ascending: true });

  if (previousSetsError) {
    throw new Error(`Unable to load previous exercise sets: ${previousSetsError.message}`);
  }

  return (previousSets ?? []).map((setRow) => ({
    setNumber: setRow.set_number,
    weight: setRow.weight,
    reps: setRow.reps,
    rir: setRow.rir,
    setType: normalizeSetType(setRow.set_type),
  }));
}

async function getFeedParticipantIds(userId: string): Promise<string[]> {
  const { data: friendships, error: friendshipsError } = await supabase
    .from('friends')
    .select('user_low_id, user_high_id')
    .or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`);

  if (friendshipsError) {
    throw new Error(`Unable to load friend network: ${friendshipsError.message}`);
  }

  const participantIds = new Set<string>([userId]);

  for (const friendship of friendships ?? []) {
    if (friendship.user_low_id === userId) {
      participantIds.add(friendship.user_high_id);
    } else {
      participantIds.add(friendship.user_low_id);
    }
  }

  return [...participantIds];
}

export async function getFeedWorkouts(page = 0, limit = 20): Promise<WorkoutFeedItem[]> {
  const safePage = Number.isFinite(page) ? Math.max(0, Math.trunc(page)) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
  const from = safePage * safeLimit;
  const to = from + safeLimit - 1;

  const user = await getAuthenticatedUserOrThrow();
  const participantIds = await getFeedParticipantIds(user.id);

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('*, workout_likes(count), workout_comments(count)')
    .in('user_id', participantIds)
    .order('start_time', { ascending: false })
    .range(from, to);

  if (workoutsError) {
    throw new Error(`Unable to load workout feed: ${workoutsError.message}`);
  }

  if (!workouts || workouts.length === 0) {
    return [];
  }

  const rawWorkouts = workouts as RawWorkoutFeedRow[];

  const workoutIds = rawWorkouts.map((w) => w.id);
  const profileByUserId = await getPublicProfilesByIds(rawWorkouts.map((w) => w.user_id));

  const { data: ownLikes, error: ownLikesError } = await supabase
    .from('workout_likes')
    .select('workout_id')
    .eq('user_id', user.id)
    .in('workout_id', workoutIds);

  if (ownLikesError) {
    throw new Error(`Unable to load your like status for feed workouts: ${ownLikesError.message}`);
  }

  const likedWorkoutIds = new Set((ownLikes ?? []).map((row) => row.workout_id));

  const { data: allSets, error: setsError } = await supabase
    .from('sets')
    .select('*, exercises(name)')
    .in('workout_id', workoutIds);

  if (setsError) {
    throw new Error(`Unable to load workout feed sets: ${setsError.message}`);
  }

  type WorkoutAggregate = {
    totalVolume: number;
    totalSets: number;
    exerciseNames: string[];
  };

  const aggregateByWorkout = new Map<string, WorkoutAggregate>();

  for (const raw of allSets ?? []) {
    const workoutId = raw.workout_id;
    if (!workoutId) continue;

    const exerciseData = raw.exercises as { name: string } | null;
    const currentValue = aggregateByWorkout.get(workoutId) ?? {
      totalVolume: 0,
      totalSets: 0,
      exerciseNames: [],
    };

    currentValue.totalSets += 1;
    currentValue.totalVolume += (raw.weight ?? 0) * (raw.reps ?? 0);

    if (exerciseData?.name && !currentValue.exerciseNames.includes(exerciseData.name)) {
      currentValue.exerciseNames.push(exerciseData.name);
    }

    aggregateByWorkout.set(workoutId, currentValue);
  }

  return rawWorkouts.map((workout) => {
    const aggregate = aggregateByWorkout.get(workout.id);

    return {
      id: workout.id,
      user_id: workout.user_id,
      name: workout.name,
      notes: workout.notes,
      start_time: workout.start_time,
      end_time: workout.end_time,
      profile: profileByUserId.get(workout.user_id) ?? null,
      totalVolume: Math.round(aggregate?.totalVolume ?? 0),
      totalSets: aggregate?.totalSets ?? 0,
      exerciseNames: aggregate?.exerciseNames ?? [],
      likes_count: extractRelationCount(workout.workout_likes),
      comments_count: extractRelationCount(workout.workout_comments),
      has_liked: likedWorkoutIds.has(workout.id),
    };
  });
}

export async function getWorkoutDetails(workoutId: string): Promise<WorkoutDetails> {
  const viewer = await getAuthenticatedUserOrThrow();
  const normalizedWorkoutId = normalizeOptionalId(workoutId);

  if (!normalizedWorkoutId) {
    throw new Error('Workout id is required to load details.');
  }

  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .select('id, user_id, name, notes, start_time, end_time')
    .eq('id', normalizedWorkoutId)
    .maybeSingle();

  if (workoutError) {
    throw new Error(`Unable to load workout details: ${workoutError.message}`);
  }

  if (!workout) {
    throw new Error('Workout not found.');
  }

  if (workout.user_id !== viewer.id) {
    const { data: friendshipRows, error: friendshipError } = await supabase
      .from('friends')
      .select('id')
      .or(
        `and(user_low_id.eq.${viewer.id},user_high_id.eq.${workout.user_id}),and(user_high_id.eq.${viewer.id},user_low_id.eq.${workout.user_id})`
      )
      .limit(1);

    if (friendshipError) {
      throw new Error(`Unable to validate workout access: ${friendshipError.message}`);
    }

    if (!friendshipRows || friendshipRows.length === 0) {
      throw new Error('You do not have permission to view this workout.');
    }
  }

  const profileByUserId = await getPublicProfilesByIds([workout.user_id]);

  const { data: rawWorkoutExercises, error: workoutExercisesError } = await supabase
    .from('workout_exercises')
    .select('id, order, rest_time, exercise_id, exercises(id, name, muscle_group, equipment)')
    .eq('workout_id', normalizedWorkoutId)
    .order('order', { ascending: true });

  if (workoutExercisesError) {
    throw new Error(`Unable to load workout exercises: ${workoutExercisesError.message}`);
  }

  const { data: rawSetRows, error: setRowsError } = await supabase
    .from('sets')
    .select('id, set_number, weight, reps, rir, set_type, workout_exercise_id, exercise_id')
    .eq('workout_id', normalizedWorkoutId)
    .order('set_number', { ascending: true })
    .order('id', { ascending: true });

  if (setRowsError) {
    throw new Error(`Unable to load workout sets: ${setRowsError.message}`);
  }

  const workoutExercises = (rawWorkoutExercises ?? []) as RawWorkoutExerciseDetailsRow[];
  const setRows = (rawSetRows ?? []) as RawWorkoutDetailsSetRow[];

  const exerciseInfoById = new Map<string, ExerciseSummary>();

  for (const relation of workoutExercises) {
    const embeddedExercise = resolveEmbeddedObject(relation.exercises);

    if (!embeddedExercise?.id) {
      continue;
    }

    exerciseInfoById.set(embeddedExercise.id, embeddedExercise);
  }

  const missingExerciseIds = [
    ...new Set(
      setRows
        .map((setRow) => setRow.exercise_id)
        .filter((exerciseId): exerciseId is string => typeof exerciseId === 'string' && exerciseId.length > 0)
        .filter((exerciseId) => !exerciseInfoById.has(exerciseId))
    ),
  ];

  if (missingExerciseIds.length > 0) {
    const { data: missingExercises, error: missingExercisesError } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment')
      .in('id', missingExerciseIds);

    if (missingExercisesError) {
      throw new Error(`Unable to load missing exercise details: ${missingExercisesError.message}`);
    }

    for (const exercise of missingExercises ?? []) {
      exerciseInfoById.set(exercise.id, exercise);
    }
  }

  const setsByWorkoutExerciseId = new Map<string, WorkoutDetailsSet[]>();
  const legacySetsByExerciseId = new Map<string, WorkoutDetailsSet[]>();

  for (const rawSet of setRows) {
    const mappedSet = mapWorkoutDetailsSet(rawSet);

    if (mappedSet.workout_exercise_id) {
      const existingSetGroup = setsByWorkoutExerciseId.get(mappedSet.workout_exercise_id) ?? [];
      existingSetGroup.push(mappedSet);
      setsByWorkoutExerciseId.set(mappedSet.workout_exercise_id, existingSetGroup);
      continue;
    }

    if (mappedSet.exercise_id) {
      const legacySetGroup = legacySetsByExerciseId.get(mappedSet.exercise_id) ?? [];
      legacySetGroup.push(mappedSet);
      legacySetsByExerciseId.set(mappedSet.exercise_id, legacySetGroup);
    }
  }

  const detailsExercises: WorkoutDetailsExercise[] = [];
  const consumedLegacyExerciseIds = new Set<string>();
  const usedWorkoutExerciseIds = new Set<string>();

  for (const relation of workoutExercises) {
    usedWorkoutExerciseIds.add(relation.id);

    const relationSets = [...(setsByWorkoutExerciseId.get(relation.id) ?? [])];

    if (relationSets.length === 0 && !consumedLegacyExerciseIds.has(relation.exercise_id)) {
      const legacySets = legacySetsByExerciseId.get(relation.exercise_id);

      if (legacySets && legacySets.length > 0) {
        relationSets.push(...legacySets);
        consumedLegacyExerciseIds.add(relation.exercise_id);
      }
    }

    relationSets.sort(sortWorkoutDetailsSets);

    const exerciseInfo = exerciseInfoById.get(relation.exercise_id);
    detailsExercises.push({
      id: relation.id,
      order: relation.order,
      rest_time: relation.rest_time,
      exercise_id: relation.exercise_id,
      exercise_name: exerciseInfo?.name ?? 'Unknown exercise',
      muscle_group: exerciseInfo?.muscle_group ?? null,
      equipment: exerciseInfo?.equipment ?? null,
      sets: relationSets,
    });
  }

  let nextOrder =
    detailsExercises.reduce((maxValue, currentValue) => Math.max(maxValue, currentValue.order), 0) + 1;

  for (const [workoutExerciseId, groupedSets] of setsByWorkoutExerciseId.entries()) {
    if (usedWorkoutExerciseIds.has(workoutExerciseId)) {
      continue;
    }

    groupedSets.sort(sortWorkoutDetailsSets);

    const exerciseId = groupedSets[0]?.exercise_id ?? null;

    if (!exerciseId) {
      continue;
    }

    consumedLegacyExerciseIds.add(exerciseId);
    const exerciseInfo = exerciseInfoById.get(exerciseId);

    detailsExercises.push({
      id: workoutExerciseId,
      order: nextOrder,
      rest_time: null,
      exercise_id: exerciseId,
      exercise_name: exerciseInfo?.name ?? 'Unknown exercise',
      muscle_group: exerciseInfo?.muscle_group ?? null,
      equipment: exerciseInfo?.equipment ?? null,
      sets: groupedSets,
    });

    nextOrder += 1;
  }

  for (const [exerciseId, groupedSets] of legacySetsByExerciseId.entries()) {
    if (consumedLegacyExerciseIds.has(exerciseId)) {
      continue;
    }

    groupedSets.sort(sortWorkoutDetailsSets);

    const exerciseInfo = exerciseInfoById.get(exerciseId);

    detailsExercises.push({
      id: null,
      order: nextOrder,
      rest_time: null,
      exercise_id: exerciseId,
      exercise_name: exerciseInfo?.name ?? 'Unknown exercise',
      muscle_group: exerciseInfo?.muscle_group ?? null,
      equipment: exerciseInfo?.equipment ?? null,
      sets: groupedSets,
    });

    nextOrder += 1;
  }

  detailsExercises.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a.exercise_name.localeCompare(b.exercise_name);
  });

  const allSets = detailsExercises.flatMap((exercise) => exercise.sets);

  let totalVolume = 0;
  let heaviestWeight = 0;
  let hasWeight = false;
  let bestEstimated1RM = 0;
  let hasEstimated1RM = false;

  for (const setItem of allSets) {
    const weight = setItem.weight ?? 0;
    const reps = setItem.reps ?? 0;

    if (Number.isFinite(weight) && Number.isFinite(reps)) {
      totalVolume += Math.max(0, weight) * Math.max(0, reps);
    }

    if (setItem.weight !== null && Number.isFinite(setItem.weight)) {
      hasWeight = true;
      heaviestWeight = Math.max(heaviestWeight, Math.max(0, setItem.weight));
    }

    const estimatedOneRepMax = estimateOneRepMax(setItem.weight, setItem.reps);

    if (estimatedOneRepMax !== null) {
      hasEstimated1RM = true;
      bestEstimated1RM = Math.max(bestEstimated1RM, estimatedOneRepMax);
    }
  }

  return {
    id: workout.id,
    user_id: workout.user_id,
    name: workout.name,
    notes: workout.notes,
    start_time: workout.start_time,
    end_time: workout.end_time,
    profile: profileByUserId.get(workout.user_id) ?? null,
    exercises: detailsExercises,
    totalVolume: Math.round(totalVolume),
    totalSets: allSets.length,
    durationSeconds: workout.end_time ? calculateDurationSeconds(workout.start_time, workout.end_time) : 0,
    heaviestWeight: hasWeight ? Number(heaviestWeight.toFixed(1)) : null,
    bestEstimated1RM: hasEstimated1RM ? Number(bestEstimated1RM.toFixed(1)) : null,
  };
}

export async function getUserWorkouts(userId: string, page = 0, limit = 20): Promise<WorkoutFeedItem[]> {
  const safePage = Number.isFinite(page) ? Math.max(0, Math.trunc(page)) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
  const from = safePage * safeLimit;
  const to = from + safeLimit - 1;

  const viewer = await getAuthenticatedUserOrThrow();
  const normalizedUserId = normalizeOptionalId(userId);

  if (!normalizedUserId) {
    throw new Error('User id is required to load workout history.');
  }

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('*, workout_likes(count), workout_comments(count)')
    .eq('user_id', normalizedUserId)
    .order('start_time', { ascending: false })
    .range(from, to);

  if (workoutsError) {
    throw new Error(`Unable to load user workouts: ${workoutsError.message}`);
  }

  if (!workouts || workouts.length === 0) {
    return [];
  }

  const rawWorkouts = workouts as RawWorkoutFeedRow[];
  const workoutIds = rawWorkouts.map((workout) => workout.id);
  const profileByUserId = await getPublicProfilesByIds(rawWorkouts.map((workout) => workout.user_id));

  const { data: ownLikes, error: ownLikesError } = await supabase
    .from('workout_likes')
    .select('workout_id')
    .eq('user_id', viewer.id)
    .in('workout_id', workoutIds);

  if (ownLikesError) {
    throw new Error(`Unable to load like status for workout history: ${ownLikesError.message}`);
  }

  const likedWorkoutIds = new Set((ownLikes ?? []).map((row) => row.workout_id));

  const { data: allSets, error: setsError } = await supabase
    .from('sets')
    .select('*, exercises(name)')
    .in('workout_id', workoutIds);

  if (setsError) {
    throw new Error(`Unable to load workout history sets: ${setsError.message}`);
  }

  type WorkoutAggregate = {
    totalVolume: number;
    totalSets: number;
    exerciseNames: string[];
  };

  const aggregateByWorkout = new Map<string, WorkoutAggregate>();

  for (const raw of allSets ?? []) {
    const workoutId = raw.workout_id;

    if (!workoutId) {
      continue;
    }

    const exerciseData = raw.exercises as { name: string } | null;
    const currentValue = aggregateByWorkout.get(workoutId) ?? {
      totalVolume: 0,
      totalSets: 0,
      exerciseNames: [],
    };

    currentValue.totalSets += 1;
    currentValue.totalVolume += (raw.weight ?? 0) * (raw.reps ?? 0);

    if (exerciseData?.name && !currentValue.exerciseNames.includes(exerciseData.name)) {
      currentValue.exerciseNames.push(exerciseData.name);
    }

    aggregateByWorkout.set(workoutId, currentValue);
  }

  return rawWorkouts.map((workout) => {
    const aggregate = aggregateByWorkout.get(workout.id);

    return {
      id: workout.id,
      user_id: workout.user_id,
      name: workout.name,
      notes: workout.notes,
      start_time: workout.start_time,
      end_time: workout.end_time,
      profile: profileByUserId.get(workout.user_id) ?? null,
      totalVolume: Math.round(aggregate?.totalVolume ?? 0),
      totalSets: aggregate?.totalSets ?? 0,
      exerciseNames: aggregate?.exerciseNames ?? [],
      likes_count: extractRelationCount(workout.workout_likes),
      comments_count: extractRelationCount(workout.workout_comments),
      has_liked: likedWorkoutIds.has(workout.id),
    };
  });
}

export async function getWorkoutFeed(page = 0, limit = 20): Promise<WorkoutFeedItem[]> {
  return getFeedWorkouts(page, limit);
}

export async function getRoutineFeed(limit = 30): Promise<RoutineFeedItem[]> {
  const { data: routines, error: routinesError } = await supabase
    .from('routines')
    .select('id, user_id, name, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (routinesError) {
    throw new Error(`Unable to load routine feed: ${routinesError.message}`);
  }

  if (!routines || routines.length === 0) {
    return [];
  }

  const routineIds = routines.map((routine) => routine.id);
  const profileByUserId = await getPublicProfilesByIds(routines.map((routine) => routine.user_id));

  const { data: routineExercises, error: routineExercisesError } = await supabase
    .from('routine_exercises')
    .select('routine_id')
    .in('routine_id', routineIds);

  if (routineExercisesError) {
    throw new Error(`Unable to load routine feed exercises: ${routineExercisesError.message}`);
  }

  const exerciseCountByRoutine = new Map<string, number>();

  for (const relation of routineExercises ?? []) {
    const currentCount = exerciseCountByRoutine.get(relation.routine_id) ?? 0;
    exerciseCountByRoutine.set(relation.routine_id, currentCount + 1);
  }

  return routines.map((routine) => ({
    id: routine.id,
    user_id: routine.user_id,
    name: routine.name,
    notes: routine.notes,
    created_at: routine.created_at,
    profile: profileByUserId.get(routine.user_id) ?? null,
    exerciseCount: exerciseCountByRoutine.get(routine.id) ?? 0,
  }));
}

export function getErrorMessage(error: unknown): string {
  return toErrorMessage(error);
}
