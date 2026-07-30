import { supabase } from '@/services/supabase';
import {
  getAuthenticatedUserOrThrow,
  normalizeSetType,
  type WorkoutSetType,
} from '@/services/workoutService';
import { EXERCISE_MUSCLE_LABELS, resolveExerciseMuscleKey } from '@/constants/exerciseCatalog';
import type { Tables } from '@/types/database';
import { getLocalizedExerciseName, type ExerciseNameSource } from '@/utils/exerciseLocalization';
import { estimateOneRepMax } from '@/utils/estimateOneRepMax';

export type ProgressMetric = 'duration' | 'volume' | 'reps' | 'weight' | 'e1rm';

export type ExerciseProgressOptions = {
  /** Inclusive lower bound as YYYY-MM-DD (UTC date key). */
  sinceDate?: string;
};

export type StatsExerciseOption = ExerciseNameSource & {
  id: string;
};

export type ExerciseProgressPoint = {
  date: string;
  label: string;
  value: number;
  volumeTotal: number;
  repsTotal: number;
  durationMinutes: number;
  estimated1RMMax: number;
  maxWeight: number;
  /** Reps done on the heaviest set that day, so a point can read "100 kg x 5". */
  maxWeightReps: number;
  /** Live tip from an unfinished workout — hollow point on the chart. */
  isActive?: boolean;
};

export type ExercisePersonalRecords = {
  heaviestWeight: number;
  bestEstimated1RM: number;
  bestDayVolume: number;
  completedSetCount: number;
};

export type AllTimePR = {
  exerciseId: string;
  exercise: ExerciseNameSource;
  maxWeight: number;
  achievedAt: string;
};

export type WeeklyVolumeByMuscle = {
  muscle: string;
  sets: number;
};

type WorkoutRef = Pick<Tables<'workouts'>, 'start_time' | 'end_time' | 'user_id'>;
type ExerciseRef = Pick<Tables<'exercises'>, 'id' | 'name' | 'name_pt'>;
type WeeklyExerciseRef = Pick<
  Tables<'exercises'>,
  'name' | 'name_pt' | 'muscle_group'
>;

type RawSetWithWorkout = Pick<Tables<'sets'>, 'weight' | 'reps' | 'rir' | 'set_type' | 'exercise_id'> & {
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

function isPortugueseLocale(localeTag?: string): boolean {
  const normalized = localeTag?.trim().toLowerCase();
  return Boolean(normalized && normalized.startsWith('pt'));
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
  const locale = isPortugueseLocale(localeTag)
    ? 'pt-PT'
    : localeTag && localeTag.length > 2
      ? localeTag
      : 'en-US';

  return d.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
}

function normalizeMuscleLabel(exercise: WeeklyExerciseRef | null | undefined, localeTag?: string): string {
  if (!exercise) {
    return isPortugueseLocale(localeTag) ? 'Outros' : 'Other';
  }

  const normalizedKey = resolveExerciseMuscleKey({
    muscleGroup: exercise.muscle_group,
    name: exercise.name,
    namePt: exercise.name_pt,
  });

  if (!normalizedKey) {
    return isPortugueseLocale(localeTag) ? 'Outros' : 'Other';
  }

  return isPortugueseLocale(localeTag)
    ? EXERCISE_MUSCLE_LABELS[normalizedKey].pt
    : EXERCISE_MUSCLE_LABELS[normalizedKey].en;
}

function getWeekStartKey(dateValue: Date): string {
  const utcDate = new Date(Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate()));
  const day = utcDate.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - mondayOffset);

  return utcDate.toISOString().slice(0, 10);
}

async function getExerciseSetRowsForUser(exerciseId: string): Promise<RawSetWithWorkout[]> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedExerciseId = exerciseId.trim();

  if (!normalizedExerciseId) {
    throw new Error('Exercise id is required to load progress.');
  }

  const { data, error } = await supabase
    .from('sets')
    .select('exercise_id, weight, reps, rir, set_type, workouts!inner(start_time, end_time, user_id)')
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

export async function getTrackedExercises(language: 'en' | 'pt' = 'en'): Promise<StatsExerciseOption[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from('sets')
    .select('exercise_id, exercises!inner(id, name, name_pt), workouts!inner(user_id, end_time)')
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
      name_pt: exercise.name_pt ?? null,
    });
  }

  return [...optionsById.values()].sort((a, b) =>
    getLocalizedExerciseName(a, language).localeCompare(getLocalizedExerciseName(b, language))
  );
}

export async function getExerciseProgress(
  exerciseId: string,
  metric: ProgressMetric = 'volume',
  localeTag?: string,
  options?: ExerciseProgressOptions
): Promise<ExerciseProgressPoint[]> {
  const rows = await getExerciseSetRowsForUser(exerciseId);
  const sinceDate = options?.sinceDate?.trim() || null;

  const byDay = new Map<
    string,
    {
      volumeTotal: number;
      repsTotal: number;
      durationMinutes: number;
      estimated1RMMax: number;
      maxWeight: number;
      maxWeightReps: number;
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

    if (sinceDate && dateKey < sinceDate) {
      continue;
    }

    const timestamp = new Date(dateKey).getTime();
    const weight = toNonNegativeNumber(row.weight);
    const reps = toNonNegativeNumber(row.reps);
    const volume = weight * reps;
    const setType = normalizeSetType(row.set_type);
    const isWarmup = setType === 'warmup';
    const estimated1RM = isWarmup ? 0 : estimateOneRepMax(weight, reps, row.rir);

    const current = byDay.get(dateKey) ?? {
      volumeTotal: 0,
      repsTotal: 0,
      durationMinutes: 0,
      estimated1RMMax: 0,
      maxWeight: 0,
      maxWeightReps: 0,
      timestamp,
      trackedWorkoutKeys: new Set<string>(),
    };

    current.volumeTotal += volume;
    current.repsTotal += reps;
    current.estimated1RMMax = Math.max(current.estimated1RMMax, estimated1RM);

    // Chart metrics ignore warm-ups so a heavy warm-up does not flatten the line.
    if (
      !isWarmup &&
      (weight > current.maxWeight || (weight === current.maxWeight && reps > current.maxWeightReps))
    ) {
      current.maxWeight = weight;
      current.maxWeightReps = reps;
    }

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

      const maxWeight = Number(aggregate.maxWeight.toFixed(1));
      const maxWeightReps = Math.round(aggregate.maxWeightReps);

      const value =
        metric === 'duration'
          ? durationMinutes
          : metric === 'reps'
            ? repsTotal
            : metric === 'weight'
              ? maxWeight
              : metric === 'e1rm'
                ? estimated1RMMax
                : volumeTotal;

      return {
        date,
        label: formatProgressLabel(date, localeTag),
        value,
        volumeTotal,
        repsTotal,
        durationMinutes,
        estimated1RMMax,
        maxWeight,
        maxWeightReps,
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
    bestEstimated1RM = Math.max(bestEstimated1RM, estimateOneRepMax(weight, reps, row.rir));
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

export async function getAllTimePRs(language: 'en' | 'pt' = 'en'): Promise<AllTimePR[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from('sets')
    .select('exercise_id, weight, workouts!inner(start_time, end_time, user_id), exercises!inner(id, name, name_pt)')
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
    const exerciseNames: ExerciseNameSource = {
      name: exercise.name,
      name_pt: exercise.name_pt ?? null,
    };

    if (!existing) {
      bestByExerciseId.set(exercise.id, {
        exerciseId: exercise.id,
        exercise: exerciseNames,
        maxWeight: Number(weight.toFixed(1)),
        achievedAt,
      });
      continue;
    }

    if (weight > existing.maxWeight) {
      bestByExerciseId.set(exercise.id, {
        exerciseId: exercise.id,
        exercise: exerciseNames,
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

    return getLocalizedExerciseName(a.exercise, language).localeCompare(
      getLocalizedExerciseName(b.exercise, language)
    );
  });
}

export async function getWeeklyVolumeByMuscle(localeTag?: string): Promise<WeeklyVolumeByMuscle[]> {
  const user = await getAuthenticatedUserOrThrow();
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('sets')
    .select('id, workouts!inner(start_time, end_time, user_id), exercises(name, name_pt, muscle_group)')
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
    const muscle = normalizeMuscleLabel(exercise, localeTag);
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

export type ExerciseHistorySet = {
  setNumber: number | null;
  weight: number;
  reps: number;
  rir: number | null;
  setType: WorkoutSetType;
};

export type ExerciseWorkoutHistoryEntry = {
  workoutId: string;
  workoutName: string;
  date: string;
  /** Every set logged for this exercise in this workout, warm-ups included. */
  sets: ExerciseHistorySet[];
  workingSetCount: number;
  /**
   * The single heaviest set actually performed. Weight and reps come from the
   * same set — taking independent maxima reported pairs that never happened.
   */
  bestSet: ExerciseHistorySet | null;
};

function sortHistorySets(a: ExerciseHistorySet, b: ExerciseHistorySet): number {
  const aNumber = a.setNumber ?? Number.MAX_SAFE_INTEGER;
  const bNumber = b.setNumber ?? Number.MAX_SAFE_INTEGER;
  return aNumber - bNumber;
}

/** Heavier wins; equal weight is broken by reps, so the harder set surfaces. */
function isBetterSet(candidate: ExerciseHistorySet, current: ExerciseHistorySet | null): boolean {
  if (!current) {
    return true;
  }

  if (candidate.weight !== current.weight) {
    return candidate.weight > current.weight;
  }

  return candidate.reps > current.reps;
}

export async function getExerciseWorkoutHistory(exerciseId: string): Promise<ExerciseWorkoutHistoryEntry[]> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedId = exerciseId.trim();

  if (!normalizedId) {
    return [];
  }

  const { data, error } = await supabase
    .from('workout_exercises')
    .select(
      'workout_id, workouts!inner(id, name, start_time, end_time, user_id), sets!sets_workout_exercise_id_fkey(set_number, weight, reps, rir, set_type)'
    )
    .eq('exercise_id', normalizedId)
    .eq('workouts.user_id', user.id)
    .not('workouts.end_time', 'is', null)
    .order('workouts(start_time)', { ascending: false });

  if (error) {
    throw new Error(`Unable to load exercise history: ${error.message}`);
  }

  type HistoryWorkout = { id: string; name: string; start_time: string; end_time: string | null; user_id: string };

  type HistoryRow = {
    workout_id: string;
    workouts: HistoryWorkout | HistoryWorkout[] | null;
    sets:
      | {
          set_number: number | null;
          weight: number | null;
          reps: number | null;
          rir: number | null;
          set_type: string | null;
        }[]
      | null;
  };

  const rows = (data as HistoryRow[] | null) ?? [];
  const entriesByWorkout = new Map<string, ExerciseWorkoutHistoryEntry>();

  for (const row of rows) {
    const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
    if (!workout?.id || !workout.start_time || !workout.end_time) continue;

    const existing = entriesByWorkout.get(workout.id);
    const collectedSets = existing?.sets ?? [];
    let bestSet = existing?.bestSet ?? null;

    for (const rawSet of row.sets ?? []) {
      const historySet: ExerciseHistorySet = {
        setNumber: rawSet.set_number,
        weight: toNonNegativeNumber(rawSet.weight),
        reps: toNonNegativeNumber(rawSet.reps),
        rir: rawSet.rir,
        setType: normalizeSetType(rawSet.set_type),
      };

      collectedSets.push(historySet);

      // Warm-ups are logged light on purpose and would never win anyway, but
      // excluding them keeps "best set" meaning the best working set.
      if (historySet.setType !== 'warmup' && isBetterSet(historySet, bestSet)) {
        bestSet = historySet;
      }
    }

    collectedSets.sort(sortHistorySets);

    entriesByWorkout.set(workout.id, {
      workoutId: workout.id,
      workoutName: workout.name,
      date: workout.start_time.slice(0, 10),
      sets: collectedSets,
      workingSetCount: collectedSets.filter((setItem) => setItem.setType !== 'warmup').length,
      bestSet,
    });
  }

  return [...entriesByWorkout.values()];
}

export async function getWeeklyTrainingHours(localeTag?: string): Promise<{ weekLabel: string; hours: number; workouts: number }[]> {
  const user = await getAuthenticatedUserOrThrow();
  const weeksBack = 12;
  const sinceIso = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('workouts')
    .select('start_time, end_time')
    .eq('user_id', user.id)
    .not('end_time', 'is', null)
    .gte('start_time', sinceIso)
    .order('start_time', { ascending: true });

  if (error) {
    throw new Error(`Unable to load weekly training hours: ${error.message}`);
  }

  const rows = (data as WorkoutRef[] | null) ?? [];
  const weekMap = new Map<string, { hours: number; workouts: number }>();

  for (const row of rows) {
    if (!row.start_time || !row.end_time) continue;
    const d = new Date(row.start_time);
    if (!Number.isFinite(d.getTime())) continue;
    const weekKey = getWeekStartKey(d);
    const minutes = getWorkoutDurationMinutes(row.start_time, row.end_time);
    const cur = weekMap.get(weekKey) ?? { hours: 0, workouts: 0 };
    cur.hours += minutes / 60;
    cur.workouts += 1;
    weekMap.set(weekKey, cur);
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, val]) => ({
      weekLabel: formatProgressLabel(weekKey, localeTag),
      hours: Number(val.hours.toFixed(1)),
      workouts: val.workouts,
    }));
}

export type WeeklyDashboardMetric = 'duration' | 'volume' | 'reps';

export type WeeklyDashboardPoint = {
  weekKey: string;
  weekLabel: string;
  volumeKg: number;
  durationMinutes: number;
  repsTotal: number;
  workouts: number;
};

export async function getWeeklyDashboardMetrics(
  localeTag?: string,
  weeksBack = 12
): Promise<WeeklyDashboardPoint[]> {
  const user = await getAuthenticatedUserOrThrow();
  const sinceIso = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('id, start_time, end_time')
    .eq('user_id', user.id)
    .not('end_time', 'is', null)
    .gte('start_time', sinceIso)
    .order('start_time', { ascending: true });

  if (workoutsError) {
    throw new Error(`Unable to load dashboard workouts: ${workoutsError.message}`);
  }

  const workoutRows = (workouts as Array<{ id: string; start_time: string; end_time: string | null }> | null) ?? [];
  if (workoutRows.length === 0) {
    return [];
  }

  const workoutIds = workoutRows.map((row) => row.id);
  const { data: setRows, error: setsError } = await supabase
    .from('sets')
    .select('workout_id, weight, reps')
    .in('workout_id', workoutIds);

  if (setsError) {
    throw new Error(`Unable to load dashboard sets: ${setsError.message}`);
  }

  const volumeByWorkout = new Map<string, { volumeKg: number; repsTotal: number }>();
  for (const row of (setRows as Array<{ workout_id: string | null; weight: number | null; reps: number | null }> | null) ?? []) {
    if (!row.workout_id) continue;
    const weight = toNonNegativeNumber(row.weight);
    const reps = toNonNegativeNumber(row.reps);
    const current = volumeByWorkout.get(row.workout_id) ?? { volumeKg: 0, repsTotal: 0 };
    current.volumeKg += weight * reps;
    current.repsTotal += reps;
    volumeByWorkout.set(row.workout_id, current);
  }

  const weekMap = new Map<string, WeeklyDashboardPoint>();

  for (const workout of workoutRows) {
    const start = new Date(workout.start_time);
    if (!Number.isFinite(start.getTime())) continue;
    const weekKey = getWeekStartKey(start);
    const setsAgg = volumeByWorkout.get(workout.id) ?? { volumeKg: 0, repsTotal: 0 };
    const current = weekMap.get(weekKey) ?? {
      weekKey,
      weekLabel: formatProgressLabel(weekKey, localeTag),
      volumeKg: 0,
      durationMinutes: 0,
      repsTotal: 0,
      workouts: 0,
    };

    current.volumeKg += setsAgg.volumeKg;
    current.repsTotal += setsAgg.repsTotal;
    current.durationMinutes += getWorkoutDurationMinutes(workout.start_time, workout.end_time);
    current.workouts += 1;
    weekMap.set(weekKey, current);
  }

  return [...weekMap.values()]
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .map((point) => ({
      ...point,
      volumeKg: Math.round(point.volumeKg),
      durationMinutes: Math.round(point.durationMinutes),
      repsTotal: Math.round(point.repsTotal),
    }));
}

