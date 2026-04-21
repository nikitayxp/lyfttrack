import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/workoutService';
import { EXERCISE_MUSCLE_LABELS, resolveExerciseMuscleKey } from '@/constants/exerciseCatalog';
import type { Tables } from '@/types/database';

export type ProgressMetric = 'duration' | 'volume' | 'reps';

export type StatsExerciseOption = {
  id: string;
  name: string;
};

export type ExerciseProgressPoint = {
  date: string;
  label: string;
  value: number;
  volumeTotal: number;
  repsTotal: number;
  durationMinutes: number;
  estimated1RMMax: number;
};

export type ExercisePersonalRecords = {
  heaviestWeight: number;
  bestEstimated1RM: number;
  bestDayVolume: number;
  completedSetCount: number;
};

export type AllTimePR = {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  achievedAt: string;
};

export type WeeklyVolumeByMuscle = {
  muscle: string;
  sets: number;
};

type WorkoutRef = Pick<Tables<'workouts'>, 'start_time' | 'end_time' | 'user_id'>;
type ExerciseRef = Pick<Tables<'exercises'>, 'id' | 'name'>;
type WeeklyExerciseRef = Pick<
  Tables<'exercises'>,
  'name' | 'name_en' | 'name_pt' | 'muscle_group' | 'muscle_en' | 'muscle_pt'
>;

type RawSetWithWorkout = Pick<Tables<'sets'>, 'weight' | 'reps' | 'exercise_id'> & {
  workouts: WorkoutRef | WorkoutRef[] | null;
  exercises?: ExerciseRef | ExerciseRef[] | null;
};

type RawWeeklySetWithWorkout = Pick<Tables<'sets'>, 'id'> & {
  is_completed?: boolean | null;
  workouts: WorkoutRef | WorkoutRef[] | null;
  exercises?: WeeklyExerciseRef | WeeklyExerciseRef[] | null;
};

function resolveEmbeddedObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function toNonNegativeNumber(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) {
    return 0;
  }

  return weight * (1 + reps / 30);
}

function getWorkoutDurationMinutes(startTimeIso: string | null | undefined, endTimeIso: string | null | undefined): number {
  if (!startTimeIso || !endTimeIso) {
    return 0;
  }

  const startMs = new Date(startTimeIso).getTime();
  const endMs = new Date(endTimeIso).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  return Math.max(0, Math.round((endMs - startMs) / (1000 * 60)));
}

function formatProgressLabel(dateIso: string, localeTag?: string): string {
  const d = new Date(`${dateIso}T12:00:00.000Z`);
  const locale =
    localeTag === 'pt' || localeTag?.toLowerCase().startsWith('pt')
      ? 'pt-PT'
      : localeTag && localeTag.length > 2
        ? localeTag
        : 'en-US';

  return d.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
}

function normalizeMuscleLabel(exercise: WeeklyExerciseRef | null | undefined): string {
  if (!exercise) {
    return 'Other';
  }

  const normalizedKey = resolveExerciseMuscleKey({
    muscleGroup: exercise.muscle_group,
    muscleEn: exercise.muscle_en,
    musclePt: exercise.muscle_pt,
    name: exercise.name,
    nameEn: exercise.name_en,
    namePt: exercise.name_pt,
  });

  if (!normalizedKey) {
    return 'Other';
  }

  return EXERCISE_MUSCLE_LABELS[normalizedKey].en;
}

function getWeekStartKey(dateValue: Date): string {
  const utcDate = new Date(Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate()));
  const day = utcDate.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - mondayOffset);

  return utcDate.toISOString().slice(0, 10);
}

function getPreviousWeekStartKey(weekStartKey: string): string {
  const weekStartDate = new Date(`${weekStartKey}T00:00:00.000Z`);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 7);

  return getWeekStartKey(weekStartDate);
}

async function getExerciseSetRowsForUser(exerciseId: string): Promise<RawSetWithWorkout[]> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedExerciseId = exerciseId.trim();

  if (!normalizedExerciseId) {
    throw new Error('Exercise id is required to load progress.');
  }

  const { data, error } = await supabase
    .from('sets')
    .select('exercise_id, weight, reps, workouts!inner(start_time, end_time, user_id)')
    .eq('exercise_id', normalizedExerciseId)
    .eq('workouts.user_id', user.id);

  if (error) {
    throw new Error(`Unable to load exercise progress: ${error.message}`);
  }

  const rows = (data as RawSetWithWorkout[] | null) ?? [];

  return rows.filter((row) => {
    const workout = resolveEmbeddedObject(row.workouts);
    return Boolean(workout?.end_time);
  });
}

export async function getTrackedExercises(): Promise<StatsExerciseOption[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from('sets')
    .select('exercise_id, exercises!inner(id, name), workouts!inner(user_id, end_time)')
    .eq('workouts.user_id', user.id)
    .not('workouts.end_time', 'is', null);

  if (error) {
    throw new Error(`Unable to load tracked exercises: ${error.message}`);
  }

  const optionsById = new Map<string, StatsExerciseOption>();

  for (const row of (data as RawSetWithWorkout[] | null) ?? []) {
    const exercise = resolveEmbeddedObject(row.exercises);

    if (!exercise?.id || !exercise.name) {
      continue;
    }

    optionsById.set(exercise.id, {
      id: exercise.id,
      name: exercise.name,
    });
  }

  return [...optionsById.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getExerciseProgress(
  exerciseId: string,
  metric: ProgressMetric = 'volume'
): Promise<ExerciseProgressPoint[]> {
  const rows = await getExerciseSetRowsForUser(exerciseId);

  const byDay = new Map<
    string,
    {
      volumeTotal: number;
      repsTotal: number;
      durationMinutes: number;
      estimated1RMMax: number;
      timestamp: number;
      trackedWorkoutKeys: Set<string>;
    }
  >();

  for (const row of rows) {
    const workout = resolveEmbeddedObject(row.workouts);

    if (!workout?.start_time) {
      continue;
    }

    const dateKey = workout.start_time.slice(0, 10);
    const timestamp = new Date(dateKey).getTime();
    const weight = toNonNegativeNumber(row.weight);
    const reps = toNonNegativeNumber(row.reps);
    const volume = weight * reps;
    const estimated1RM = estimate1RM(weight, reps);

    const current = byDay.get(dateKey) ?? {
      volumeTotal: 0,
      repsTotal: 0,
      durationMinutes: 0,
      estimated1RMMax: 0,
      timestamp,
      trackedWorkoutKeys: new Set<string>(),
    };

    current.volumeTotal += volume;
    current.repsTotal += reps;
    current.estimated1RMMax = Math.max(current.estimated1RMMax, estimated1RM);

    const workoutKey = `${workout.start_time}|${workout.end_time ?? ''}`;

    if (!current.trackedWorkoutKeys.has(workoutKey)) {
      current.trackedWorkoutKeys.add(workoutKey);
      current.durationMinutes += getWorkoutDurationMinutes(workout.start_time, workout.end_time);
    }

    byDay.set(dateKey, current);
  }

  return [...byDay.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([date, aggregate]) => {
      const volumeTotal = Math.round(aggregate.volumeTotal);
      const repsTotal = Math.round(aggregate.repsTotal);
      const durationMinutes = Math.round(aggregate.durationMinutes);
      const estimated1RMMax = Number(aggregate.estimated1RMMax.toFixed(1));

      const value = metric === 'duration'
        ? durationMinutes
        : metric === 'reps'
          ? repsTotal
          : volumeTotal;

      return {
        date,
        label: formatProgressLabel(date),
        value,
        volumeTotal,
        repsTotal,
        durationMinutes,
        estimated1RMMax,
      };
    });
}

export async function getExercisePersonalRecords(exerciseId: string): Promise<ExercisePersonalRecords> {
  const rows = await getExerciseSetRowsForUser(exerciseId);
  const progress = await getExerciseProgress(exerciseId, 'volume');

  let heaviestWeight = 0;
  let bestEstimated1RM = 0;
  let completedSetCount = 0;

  for (const row of rows) {
    const weight = toNonNegativeNumber(row.weight);
    const reps = toNonNegativeNumber(row.reps);

    heaviestWeight = Math.max(heaviestWeight, weight);
    bestEstimated1RM = Math.max(bestEstimated1RM, estimate1RM(weight, reps));
    completedSetCount += 1;
  }

  const bestDayVolume = progress.reduce((maxValue, point) => Math.max(maxValue, point.volumeTotal), 0);

  return {
    heaviestWeight: Number(heaviestWeight.toFixed(1)),
    bestEstimated1RM: Number(bestEstimated1RM.toFixed(1)),
    bestDayVolume,
    completedSetCount,
  };
}

export async function getAllTimePRs(): Promise<AllTimePR[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from('sets')
    .select('exercise_id, weight, workouts!inner(start_time, end_time, user_id), exercises!inner(id, name)')
    .eq('workouts.user_id', user.id)
    .not('workouts.end_time', 'is', null)
    .not('weight', 'is', null)
    .gt('weight', 0)
    .order('weight', { ascending: false });

  if (error) {
    throw new Error(`Unable to load all-time PRs: ${error.message}`);
  }

  const rows = (data as RawSetWithWorkout[] | null) ?? [];
  const bestByExerciseId = new Map<string, AllTimePR>();

  for (const row of rows) {
    const exercise = resolveEmbeddedObject(row.exercises);
    const workout = resolveEmbeddedObject(row.workouts);

    if (!exercise?.id || !exercise.name || !workout?.start_time) {
      continue;
    }

    const weight = toNonNegativeNumber(row.weight);

    if (weight <= 0) {
      continue;
    }

    const achievedAt = workout.end_time ?? workout.start_time;
    const existing = bestByExerciseId.get(exercise.id);

    if (!existing) {
      bestByExerciseId.set(exercise.id, {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        maxWeight: Number(weight.toFixed(1)),
        achievedAt,
      });
      continue;
    }

    if (weight > existing.maxWeight) {
      bestByExerciseId.set(exercise.id, {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        maxWeight: Number(weight.toFixed(1)),
        achievedAt,
      });
      continue;
    }

    if (weight === existing.maxWeight) {
      const existingDateMs = new Date(existing.achievedAt).getTime();
      const nextDateMs = new Date(achievedAt).getTime();

      if (Number.isFinite(nextDateMs) && (!Number.isFinite(existingDateMs) || nextDateMs > existingDateMs)) {
        bestByExerciseId.set(exercise.id, {
          ...existing,
          achievedAt,
        });
      }
    }
  }

  return [...bestByExerciseId.values()].sort((a, b) => {
    if (b.maxWeight !== a.maxWeight) {
      return b.maxWeight - a.maxWeight;
    }

    return a.exerciseName.localeCompare(b.exerciseName);
  });
}

export async function getWeeklyVolumeByMuscle(): Promise<WeeklyVolumeByMuscle[]> {
  const user = await getAuthenticatedUserOrThrow();
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('sets')
    .select('id, workouts!inner(start_time, end_time, user_id), exercises(name, name_en, name_pt, muscle_group, muscle_en, muscle_pt)')
    .eq('workouts.user_id', user.id)
    .gte('workouts.start_time', sinceIso)
    .not('workouts.end_time', 'is', null);

  if (error) {
    throw new Error(`Unable to load weekly muscle volume: ${error.message}`);
  }

  const rows = (data as RawWeeklySetWithWorkout[] | null) ?? [];

  const setsByMuscle = new Map<string, number>();

  for (const row of rows) {
    const workout = resolveEmbeddedObject(row.workouts);

    if (!workout?.end_time) {
      continue;
    }

    const exercise = resolveEmbeddedObject(row.exercises);
    const muscle = normalizeMuscleLabel(exercise);
    setsByMuscle.set(muscle, (setsByMuscle.get(muscle) ?? 0) + 1);
  }

  return [...setsByMuscle.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => {
      if (b.sets !== a.sets) {
        return b.sets - a.sets;
      }

      return a.muscle.localeCompare(b.muscle);
    });
}

export async function getCurrentWorkoutStreak(): Promise<number> {
  const user = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from('workouts')
    .select('start_time, end_time, user_id')
    .eq('user_id', user.id)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false });

  if (error) {
    throw new Error(`Unable to load workout streak: ${error.message}`);
  }

  const rows = (data as WorkoutRef[] | null) ?? [];

  if (rows.length === 0) {
    return 0;
  }

  const weekKeys = new Set<string>();

  for (const row of rows) {
    if (!row.start_time) {
      continue;
    }

    const workoutDate = new Date(row.start_time);

    if (!Number.isFinite(workoutDate.getTime())) {
      continue;
    }

    weekKeys.add(getWeekStartKey(workoutDate));
  }

  if (weekKeys.size === 0) {
    return 0;
  }

  const now = new Date();
  const currentWeekKey = getWeekStartKey(now);
  const previousWeekKey = getPreviousWeekStartKey(currentWeekKey);

  if (!weekKeys.has(currentWeekKey) && !weekKeys.has(previousWeekKey)) {
    return 0;
  }

  let streak = 0;
  let cursorWeekKey = weekKeys.has(currentWeekKey) ? currentWeekKey : previousWeekKey;

  while (weekKeys.has(cursorWeekKey)) {
    streak += 1;
    cursorWeekKey = getPreviousWeekStartKey(cursorWeekKey);
  }

  return streak;
}
