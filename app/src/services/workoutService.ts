import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import {
  EXERCISE_MUSCLE_LABELS,
  normalizeEquipmentKey,
  normalizeMuscleKey,
  resolveExerciseMuscleKey,
  type ExerciseMuscleKey,
} from '@/constants/exerciseCatalog';
import type { Tables, TablesInsert } from '@/types/database';
import { INPUT_LIMITS, sanitizeText, toSafeInteger, toSafeNumber } from '@/utils/inputValidation';
import type { WorkoutSetDraft, WorkoutSetProgressDraft, WorkoutSetType } from './workoutSession.types';
import { countPersonalRecords, type PersonalRecordSetSample } from '@/utils/personalRecords';

export type ExerciseCatalogItem = Tables<'exercises'>;
export type ExerciseLibraryMuscleFilter = 'all' | ExerciseMuscleKey;
export type ExerciseLibraryEquipmentFilter = 'all' | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell';
export type { WorkoutSetType } from './workoutSession.types';
export type ExerciseCatalogFilters = {
  muscle?: ExerciseLibraryMuscleFilter;
  equipment?: ExerciseLibraryEquipmentFilter;
};
export type RoutineRow = Tables<'routines'>;
export type RoutineExerciseRow = Tables<'routine_exercises'>;
export type WorkoutExerciseRow = Tables<'workout_exercises'>;
export type ProfileRow = Tables<'profiles'>;

export type CreateExerciseInput = {
  name: string;
  muscleGroup?: string | null;
  equipment?: string | null;
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
  prCount: number | null;
  exerciseNames: string[];
  exerciseGroups: WorkoutFeedExerciseGroup[];
  likes_count: number;
  comments_count: number;
  has_liked: boolean;
  latest_comment?: { content: string; author: string } | null;
};

export type WorkoutFeedExerciseSet = Pick<Tables<'sets'>, 'id' | 'set_number' | 'weight' | 'reps' | 'rir'> & {
  set_type: WorkoutSetType;
};

export type WorkoutFeedExerciseGroup = {
  exercise_id: string | null;
  exercise_name: string;
  sets: WorkoutFeedExerciseSet[];
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
  'id' | 'set_number' | 'weight' | 'reps' | 'rir' | 'workout_exercise_id' | 'exercise_id' | 'side'
> & {
  set_type: WorkoutSetType;
};

export type WorkoutDetailsExercise = {
  id: string | null;
  order: number;
  rest_time: number | null;
  exercise_id: string;
  exercise_name: string;
  name_en: string | null;
  name_pt: string | null;
  is_custom: boolean;
  image_url: string | null;
  muscle_group: string | null;
  equipment: string | null;
  notes: string | null;
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
  prCount: number;
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

function normalizeRequiredName(value: string, label: string): string {
  const normalized = sanitizeText(value, { maxLength: INPUT_LIMITS.nameMax, allowEmpty: false });

  if (!normalized || normalized.length < 2) {
    throw new Error(`${label} must have at least 2 characters.`);
  }

  return normalized;
}

export function normalizeWriteText(value: string | null | undefined, maxLength: number): string | null {
  return sanitizeText(value, { maxLength, allowEmpty: true });
}

export function normalizeIsoTimestamp(value: string, label: string): string {
  const normalized = sanitizeText(value, { maxLength: 64, allowEmpty: false, stripTags: false });

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  const parsed = new Date(normalized);

  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${label} must be a valid datetime.`);
  }

  return parsed.toISOString();
}

export function normalizeExerciseIdList(exerciseIds: string[]): string[] {
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

export function normalizeOptionalId(value: string | null | undefined): string | null {
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

type ExerciseSummary = Pick<
  ExerciseCatalogItem,
  'id' | 'name' | 'name_en' | 'name_pt' | 'muscle_group' | 'equipment' | 'is_custom' | 'image_url'
>;

type RawWorkoutExerciseDetailsRow = Pick<WorkoutExerciseRow, 'id' | 'order' | 'rest_time' | 'exercise_id' | 'notes'> & {
  exercises?: ExerciseSummary | ExerciseSummary[] | null;
};

type RawWorkoutDetailsSetRow = Pick<
  Tables<'sets'>,
  'id' | 'set_number' | 'weight' | 'reps' | 'rir' | 'set_type' | 'workout_exercise_id' | 'exercise_id' | 'side'
>;

type RawWorkoutFeedSetRow = Pick<
  Tables<'sets'>,
  'id' | 'workout_id' | 'exercise_id' | 'set_number' | 'weight' | 'reps' | 'rir' | 'set_type'
> & {
  exercises?: Pick<ExerciseCatalogItem, 'id' | 'name'> | Pick<ExerciseCatalogItem, 'id' | 'name'>[] | null;
};

type RawExerciseRestTimeRow = Pick<WorkoutExerciseRow, 'exercise_id' | 'rest_time'>;

type SupabaseErrorMeta = {
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
};

export function isWorkoutExercisesTableMissing(error: unknown): boolean {
  const meta = extractSupabaseErrorMeta(error);
  const message = meta.message.toLowerCase();

  return message.includes("could not find the table 'public.workout_exercises'") ||
    (message.includes('workout_exercises') && message.includes('schema cache'));
}

export function isWorkoutExerciseIdColumnMissing(error: unknown): boolean {
  const meta = extractSupabaseErrorMeta(error);
  const message = meta.message.toLowerCase();

  return message.includes('workout_exercise_id') &&
    (message.includes('schema cache') || message.includes('column') || message.includes('could not find'));
}

export function extractSupabaseErrorMeta(error: unknown): SupabaseErrorMeta {
  if (!error || typeof error !== 'object') {
    return {
      code: null,
      message: 'Unknown error',
      details: null,
      hint: null,
    };
  }

  const maybeError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  return {
    code: typeof maybeError.code === 'string' ? maybeError.code : null,
    message: typeof maybeError.message === 'string' ? maybeError.message : 'Unknown error',
    details: typeof maybeError.details === 'string' ? maybeError.details : null,
    hint: typeof maybeError.hint === 'string' ? maybeError.hint : null,
  };
}

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
    side: normalizeSetSide(raw.side),
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

function sortWorkoutFeedExerciseSets(a: WorkoutFeedExerciseSet, b: WorkoutFeedExerciseSet): number {
  const aNumber = a.set_number ?? Number.MAX_SAFE_INTEGER;
  const bNumber = b.set_number ?? Number.MAX_SAFE_INTEGER;

  if (aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  return a.id.localeCompare(b.id);
}

type WorkoutFeedAggregate = {
  totalVolume: number;
  totalSets: number;
  exerciseNames: string[];
  exerciseGroups: WorkoutFeedExerciseGroup[];
};

function aggregateWorkoutFeedSets(rows: RawWorkoutFeedSetRow[]): Map<string, WorkoutFeedAggregate> {
  const aggregateByWorkout = new Map<string, WorkoutFeedAggregate>();
  const groupIndexByWorkout = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const workoutId = normalizeOptionalId(row.workout_id);

    if (!workoutId) {
      continue;
    }

    const aggregate =
      aggregateByWorkout.get(workoutId) ?? {
        totalVolume: 0,
        totalSets: 0,
        exerciseNames: [],
        exerciseGroups: [],
      };

    const groupIndex = groupIndexByWorkout.get(workoutId) ?? new Map<string, number>();
    const exerciseData = resolveEmbeddedObject(row.exercises);
    const normalizedExerciseName = normalizeOptionalText(exerciseData?.name) ?? 'Exercicio';
    const normalizedExerciseId = normalizeOptionalId(row.exercise_id);
    const groupKey = `${normalizedExerciseId ?? 'unknown'}:${normalizedExerciseName.toLowerCase()}`;

    const weight = normalizeNumber(row.weight) ?? 0;
    const reps = normalizeNumber(row.reps) ?? 0;

    aggregate.totalSets += 1;
    aggregate.totalVolume += Math.max(0, weight) * Math.max(0, reps);

    if (!aggregate.exerciseNames.includes(normalizedExerciseName)) {
      aggregate.exerciseNames.push(normalizedExerciseName);
    }

    let groupPosition = groupIndex.get(groupKey);

    if (groupPosition === undefined) {
      aggregate.exerciseGroups.push({
        exercise_id: normalizedExerciseId,
        exercise_name: normalizedExerciseName,
        sets: [],
      });

      groupPosition = aggregate.exerciseGroups.length - 1;
      groupIndex.set(groupKey, groupPosition);
    }

    aggregate.exerciseGroups[groupPosition].sets.push({
      id: row.id,
      set_number: row.set_number,
      weight: row.weight,
      reps: row.reps,
      rir: row.rir,
      set_type: normalizeSetType(row.set_type),
    });

    groupIndexByWorkout.set(workoutId, groupIndex);
    aggregateByWorkout.set(workoutId, aggregate);
  }

  for (const aggregate of aggregateByWorkout.values()) {
    for (const group of aggregate.exerciseGroups) {
      group.sets.sort(sortWorkoutFeedExerciseSets);
    }
  }

  return aggregateByWorkout;
}

function samplesFromFeedAggregate(aggregate: WorkoutFeedAggregate | undefined): PersonalRecordSetSample[] {
  if (!aggregate) {
    return [];
  }

  const samples: PersonalRecordSetSample[] = [];

  for (const group of aggregate.exerciseGroups) {
    const exerciseId = (group.exercise_id ?? '').trim();
    if (!exerciseId) {
      continue;
    }

    for (const setItem of group.sets) {
      samples.push({
        exerciseId,
        weight: setItem.weight,
        reps: setItem.reps,
      });
    }
  }

  return samples;
}

async function resolvePrCountsByWorkoutId(
  workouts: Array<Pick<Tables<'workouts'>, 'id' | 'user_id' | 'start_time'>>,
  currentSetsByWorkoutId: Map<string, PersonalRecordSetSample[]>
): Promise<Map<string, number>> {
  const prCountByWorkoutId = new Map<string, number>();

  for (const workout of workouts) {
    prCountByWorkoutId.set(workout.id, 0);
  }

  const workoutsByUserId = new Map<string, typeof workouts>();

  for (const workout of workouts) {
    const list = workoutsByUserId.get(workout.user_id) ?? [];
    list.push(workout);
    workoutsByUserId.set(workout.user_id, list);
  }

  for (const [userId, userWorkouts] of workoutsByUserId) {
    const exerciseIds = new Set<string>();

    for (const workout of userWorkouts) {
      for (const sample of currentSetsByWorkoutId.get(workout.id) ?? []) {
        if (sample.exerciseId) {
          exerciseIds.add(sample.exerciseId);
        }
      }
    }

    if (exerciseIds.size === 0) {
      continue;
    }

    const { data: historyWorkouts, error: historyError } = await supabase
      .from('workouts')
      .select('id, start_time')
      .eq('user_id', userId)
      .not('end_time', 'is', null)
      .order('start_time', { ascending: true });

    if (historyError || !historyWorkouts || historyWorkouts.length === 0) {
      continue;
    }

    const historyWorkoutIds = historyWorkouts.map((row) => row.id);

    const { data: historySets, error: historySetsError } = await supabase
      .from('sets')
      .select('workout_id, exercise_id, weight, reps')
      .in('workout_id', historyWorkoutIds)
      .in('exercise_id', [...exerciseIds]);

    if (historySetsError) {
      continue;
    }

    const historySetsByWorkoutId = new Map<string, PersonalRecordSetSample[]>();

    for (const row of historySets ?? []) {
      const workoutId = normalizeOptionalId(row.workout_id);
      const exerciseId = (row.exercise_id ?? '').trim();
      if (!workoutId || !exerciseId) {
        continue;
      }

      const list = historySetsByWorkoutId.get(workoutId) ?? [];
      list.push({
        exerciseId,
        weight: row.weight,
        reps: row.reps,
      });
      historySetsByWorkoutId.set(workoutId, list);
    }

    for (const workout of userWorkouts) {
      const previousSamples: PersonalRecordSetSample[] = [];

      for (const historyWorkout of historyWorkouts) {
        if (historyWorkout.id === workout.id) {
          continue;
        }

        if (historyWorkout.start_time >= workout.start_time) {
          continue;
        }

        previousSamples.push(...(historySetsByWorkoutId.get(historyWorkout.id) ?? []));
      }

      prCountByWorkoutId.set(
        workout.id,
        countPersonalRecords(currentSetsByWorkoutId.get(workout.id) ?? [], previousSamples)
      );
    }
  }

  return prCountByWorkoutId;
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

export function buildSetInsertRow(
  workoutId: string,
  draft: WorkoutSetDraft,
  workoutExerciseId: string | null = null
): TablesInsert<'sets'> | null {
  const normalizedExerciseId = draft.exerciseId?.trim();
  const normalizedSetNumber = toSafeInteger(draft.setNumber, {
    min: 1,
    max: INPUT_LIMITS.setNumberMax,
  });

  if (!normalizedExerciseId) {
    return null;
  }

  if (!normalizedSetNumber) {
    return null;
  }

  const normalizedWeight = toSafeNumber(draft.weight, {
    min: 0,
    max: INPUT_LIMITS.weightMax,
    decimals: 2,
  });
  const normalizedReps = toSafeInteger(draft.reps, {
    min: 0,
    max: INPUT_LIMITS.repsMax,
  });
  const normalizedRir = toSafeInteger(draft.rir, {
    min: 0,
    max: INPUT_LIMITS.rirMax,
  });

  return {
    workout_id: workoutId,
    workout_exercise_id: workoutExerciseId,
    exercise_id: normalizedExerciseId,
    set_number: Math.trunc(normalizedSetNumber),
    weight: normalizedWeight,
    reps: normalizedReps,
    rir: normalizedRir,
    set_type: normalizeSetType(draft.setType),
    side: normalizeSetSide(draft.side),
  };
}

export function normalizeSetSide(value: unknown): 'both' | 'left' | 'right' {
  if (value === 'left' || value === 'right') {
    return value;
  }
  return 'both';
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

export function calculateDurationSeconds(startIso: string, endIso: string): number {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

export function toCompletedSetDrafts(setDrafts: WorkoutSetProgressDraft[]): WorkoutSetDraft[] {
  return setDrafts
    .filter((draft) => draft.completed === true)
    .map((draft) => ({
      exerciseId: draft.exerciseId,
      setNumber: draft.setNumber,
      weight: draft.weight,
      reps: draft.reps,
      rir: draft.rir,
      setType: draft.setType,
      side: draft.side,
    }));
}

// Volume is based on completed sets only (weight * reps).
export function calculateWorkoutVolume(setDrafts: WorkoutSetProgressDraft[]): number {
  let total = 0;

  for (const draft of setDrafts) {
    if (draft.completed !== true) {
      continue;
    }

    const weight = toSafeNumber(draft.weight, {
      min: 0,
      max: INPUT_LIMITS.weightMax,
      decimals: 2,
    }) ?? 0;
    const reps = toSafeInteger(draft.reps, {
      min: 0,
      max: INPUT_LIMITS.repsMax,
    }) ?? 0;

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

const MUSCLE_FILTER_KEYWORDS: Record<Exclude<ExerciseLibraryMuscleFilter, 'all'>, readonly string[]> = {
  chest: ['chest', 'peito', 'peitoral', 'supino', 'bench_press', 'fly'],
  back: ['back', 'costa', 'dorsal', 'lat', 'puxada', 'pulldown', 'remada', 'row'],
  shoulders: ['shoulder', 'ombro', 'deltoid', 'delt', 'desenvolvimento', 'lateral_raise'],
  biceps: ['bicep', 'biceps', 'curl', 'rosca'],
  triceps: ['tricep', 'triceps', 'testa', 'pushdown', 'pulley', 'bench_dip'],
  forearms: ['forearm', 'antebraco', 'wrist_curl', 'reverse_curl'],
  quadriceps: ['quadriceps', 'quadricep', 'quad', 'squat', 'agachamento', 'leg_press', 'leg_extension'],
  hamstrings: ['hamstring', 'posterior', 'romeno', 'stiff', 'leg_curl', 'mesa_flexora'],
  glutes: ['glute', 'gluteo', 'hip_thrust', 'glute_bridge', 'ponte_de_gluteo'],
  calves: ['calf', 'gemeo', 'panturrilha', 'calf_raise', 'elevacao_de_gemeos'],
  core: ['core', 'abs', 'abdominal', 'prancha', 'plank', 'crunch'],
};

const EQUIPMENT_FILTER_KEYWORDS: Record<Exclude<ExerciseLibraryEquipmentFilter, 'all'>, readonly string[]> = {
  barbell: ['barbell', 'barra'],
  dumbbell: ['dumbbell', 'dumbell', 'halter'],
  machine: ['machine', 'maquina', 'smith'],
  cable: ['cable', 'polia'],
  bodyweight: ['bodyweight', 'body_weight', 'peso_corporal', 'calistenia', 'sem_equipamento'],
  kettlebell: ['kettlebell'],
};

function normalizeFilterLookup(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function matchesKeywords(normalizedValue: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => normalizedValue.includes(keyword));
}

const EXERCISE_NAME_CANONICAL_ALIASES: Record<string, string> = {
  bench_press: 'barbell_bench_press',
  incline_bench_press: 'incline_barbell_bench_press',
  decline_bench_press: 'decline_barbell_bench_press',
  supino_reto_com_barra: 'barbell_bench_press',
  supino_inclinado_com_barra: 'incline_barbell_bench_press',
  supino_declinado_com_barra: 'decline_barbell_bench_press',
  triceps_pulley: 'triceps_pushdown',
  rosca_direta: 'barbell_curl',
};

function canonicalizeExerciseNameToken(token: string): string {
  const directAlias = EXERCISE_NAME_CANONICAL_ALIASES[token];

  if (directAlias) {
    return directAlias;
  }

  const withoutLeadingEquipment = token.replace(/^(barbell|dumbbell|machine|cable|kettlebell)_/, '');
  const withoutTrailingEquipment = withoutLeadingEquipment
    .replace(/_com_(barra|halteres)$/g, '')
    .replace(/_na_(maquina|polia)$/g, '');

  return EXERCISE_NAME_CANONICAL_ALIASES[withoutTrailingEquipment] ?? withoutTrailingEquipment;
}

function getExerciseNameTokens(exercise: ExerciseCatalogItem): string[] {
  const tokens: string[] = [];

  for (const value of [exercise.name_en, exercise.name, exercise.name_pt]) {
    const normalized = normalizeFilterLookup(value);

    if (!normalized || tokens.includes(normalized)) {
      continue;
    }

    tokens.push(normalized);
  }

  return tokens;
}

function buildPreferredNameTokenMap(rows: ExerciseCatalogItem[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const row of rows) {
    const englishToken = canonicalizeExerciseNameToken(
      normalizeFilterLookup(row.name_en) || normalizeFilterLookup(row.name)
    );

    if (!englishToken) {
      continue;
    }

    for (const token of getExerciseNameTokens(row)) {
      const existingPreferred = map.get(token);

      if (!existingPreferred || existingPreferred.length < englishToken.length) {
        map.set(token, englishToken);
      }
    }
  }

  return map;
}

function resolveCatalogMuscleKey(exercise: ExerciseCatalogItem): ExerciseMuscleKey | null {
  return resolveExerciseMuscleKey({
    muscleGroup: exercise.muscle_group,
    muscleEn: exercise.muscle_en,
    musclePt: exercise.muscle_pt,
    name: exercise.name,
    nameEn: exercise.name_en,
    namePt: exercise.name_pt,
  });
}

function getCatalogDedupeKey(exercise: ExerciseCatalogItem, preferredTokenMap: Map<string, string>): string {
  const tokens = getExerciseNameTokens(exercise).map(canonicalizeExerciseNameToken);

  let canonicalNameToken = '';

  for (const token of tokens) {
    const preferred = preferredTokenMap.get(token);

    if (preferred) {
      canonicalNameToken = preferred;
      break;
    }
  }

  if (!canonicalNameToken) {
    canonicalNameToken = tokens[0] ?? normalizeFilterLookup(exercise.id);
  }

  const fallbackMuscleKey = normalizeFilterLookup(exercise.muscle_group);
  const fallbackEquipmentKey = normalizeFilterLookup(exercise.equipment);
  const muscleKey = resolveCatalogMuscleKey(exercise) ?? (fallbackMuscleKey || 'general');
  const equipmentKey = normalizeEquipmentKey(exercise.equipment) ?? (fallbackEquipmentKey || 'unknown');

  return `${canonicalNameToken}::${muscleKey}::${equipmentKey}`;
}

function getCatalogQualityScore(exercise: ExerciseCatalogItem): number {
  let score = 0;

  if (!exercise.is_custom) {
    score += 80;
  }

  if (normalizeFilterLookup(exercise.name_en)) {
    score += 20;
  }

  if (normalizeFilterLookup(exercise.name_pt)) {
    score += 20;
  }

  if (normalizeFilterLookup(exercise.muscle_en)) {
    score += 8;
  }

  if (normalizeFilterLookup(exercise.muscle_pt)) {
    score += 8;
  }

  if (resolveCatalogMuscleKey(exercise)) {
    score += 6;
  }

  if (normalizeEquipmentKey(exercise.equipment)) {
    score += 4;
  }

  return score;
}

function isCatalogCandidatePreferred(candidate: ExerciseCatalogItem, current: ExerciseCatalogItem): boolean {
  const candidateScore = getCatalogQualityScore(candidate);
  const currentScore = getCatalogQualityScore(current);

  if (candidateScore !== currentScore) {
    return candidateScore > currentScore;
  }

  return candidate.id.localeCompare(current.id) < 0;
}

function dedupeBuiltinCatalogRows(rows: ExerciseCatalogItem[]): ExerciseCatalogItem[] {
  const preferredTokenMap = buildPreferredNameTokenMap(rows);
  const bestByKey = new Map<string, ExerciseCatalogItem>();

  for (const row of rows) {
    const dedupeKey = getCatalogDedupeKey(row, preferredTokenMap);
    const current = bestByKey.get(dedupeKey);

    if (!current || isCatalogCandidatePreferred(row, current)) {
      bestByKey.set(dedupeKey, row);
    }
  }

  return [...bestByKey.values()];
}

function matchesMuscleFilter(exercise: ExerciseCatalogItem, filter: ExerciseLibraryMuscleFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  const inferredMuscleKey = resolveCatalogMuscleKey(exercise);

  if (inferredMuscleKey) {
    return inferredMuscleKey === filter;
  }

  const keywords = MUSCLE_FILTER_KEYWORDS[filter];
  const candidates = [
    exercise.muscle_group,
    exercise.muscle_en,
    exercise.muscle_pt,
    exercise.name,
    exercise.name_en,
    exercise.name_pt,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const normalizedCandidate = normalizeFilterLookup(candidate);

    if (normalizedCandidate && matchesKeywords(normalizedCandidate, keywords)) {
      return true;
    }
  }

  return false;
}

function matchesEquipmentFilter(exercise: ExerciseCatalogItem, filter: ExerciseLibraryEquipmentFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  const candidate = exercise.equipment;

  if (normalizeEquipmentKey(candidate) === filter) {
    return true;
  }

  const normalizedCandidate = normalizeFilterLookup(candidate);

  if (!normalizedCandidate) {
    return false;
  }

  return matchesKeywords(normalizedCandidate, EQUIPMENT_FILTER_KEYWORDS[filter]);
}

export async function getRecentExerciseIds(limit = 20): Promise<string[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from('workout_exercises')
    .select('exercise_id, workouts!inner(user_id, end_time, start_time)')
    .eq('workouts.user_id', user.id)
    .not('workouts.end_time', 'is', null)
    .order('workouts(start_time)', { ascending: false })
    .limit(200);

  if (error) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const row of data ?? []) {
    const id = (row as any).exercise_id as string;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= limit) break;
  }

  return result;
}

export async function getExercisesCatalog(filters: ExerciseCatalogFilters = {}): Promise<ExerciseCatalogItem[]> {
  const muscleFilter = filters.muscle ?? 'all';
  const equipmentFilter = filters.equipment ?? 'all';

  const { data, error } = await supabase.from('exercises').select('*').order('name', { ascending: true });

  if (error) {
    throw new Error(`Unable to load exercises: ${error.message}`);
  }

  const rows = data ?? [];

  const filteredRows = rows.filter(
    (exercise) => matchesMuscleFilter(exercise, muscleFilter) && matchesEquipmentFilter(exercise, equipmentFilter)
  );

  const customRows = filteredRows.filter((exercise) => exercise.is_custom);
  const builtInRows = filteredRows.filter((exercise) => !exercise.is_custom);
  const dedupedBuiltIns = dedupeBuiltinCatalogRows(builtInRows);

  return [...dedupedBuiltIns, ...customRows].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getExercisesByIds(exerciseIds: string[]): Promise<ExerciseCatalogItem[]> {
  const normalizedIds = [...new Set(exerciseIds.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];

  if (normalizedIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('exercises').select('*').in('id', normalizedIds);

  if (error) {
    throw new Error(`Unable to load exercises: ${error.message}`);
  }

  return data ?? [];
}

export async function createExercise(input: CreateExerciseInput): Promise<ExerciseCatalogItem> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedName = normalizeRequiredName(input.name, 'Exercise name');
  const normalizedMuscleKey = normalizeMuscleKey(input.muscleGroup);
  const normalizedEquipmentKey = normalizeEquipmentKey(input.equipment);

  const muscleLabels = normalizedMuscleKey ? EXERCISE_MUSCLE_LABELS[normalizedMuscleKey] : null;

  const insertRow: TablesInsert<'exercises'> = {
    name: normalizedName,
    name_en: normalizedName,
    name_pt: normalizedName,
    created_by: user.id,
    is_custom: true,
    muscle_group: normalizedMuscleKey ?? normalizeWriteText(input.muscleGroup, INPUT_LIMITS.nameMax),
    muscle_en: muscleLabels?.en ?? null,
    muscle_pt: muscleLabels?.pt ?? null,
    equipment: normalizedEquipmentKey ?? normalizeWriteText(input.equipment, INPUT_LIMITS.nameMax),
  };

  const { data, error } = await supabase.from('exercises').insert(insertRow).select('*').single();

  if (error || !data) {
    throw new Error(`Unable to create exercise: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

export async function getLastExerciseRestTimes(exerciseIds: string[]): Promise<Record<string, number>> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedExerciseIds = normalizeExerciseIdList(exerciseIds);

  if (normalizedExerciseIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('workout_exercises')
    .select('exercise_id, rest_time, workouts!inner(user_id, start_time, end_time)')
    .eq('workouts.user_id', user.id)
    .not('workouts.end_time', 'is', null)
    .in('exercise_id', normalizedExerciseIds)
    .not('rest_time', 'is', null)
    .order('start_time', { foreignTable: 'workouts', ascending: false });

  if (error) {
    if (isWorkoutExercisesTableMissing(error)) {
      return {};
    }

    throw new Error(`Unable to load exercise rest history: ${error.message}`);
  }

  const latestByExerciseId: Record<string, number> = {};

  for (const row of (data as RawExerciseRestTimeRow[] | null) ?? []) {
    const exerciseId = normalizeOptionalId(row.exercise_id);

    if (!exerciseId || latestByExerciseId[exerciseId] !== undefined) {
      continue;
    }

    latestByExerciseId[exerciseId] = toSafeInteger(row.rest_time, { min: 0, max: 3600 }) ?? 0;
  }

  return latestByExerciseId;
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

  const normalizedName = normalizeRequiredName(name, 'Routine name');

  const normalizedExerciseIds = normalizeExerciseIdList(exerciseIds);
  if (normalizedExerciseIds.length === 0) {
    throw new Error('Select at least one exercise to create a routine.');
  }

  const routineInsert: TablesInsert<'routines'> = {
    user_id: user.id,
    name: normalizedName,
    notes: normalizeWriteText(notes, INPUT_LIMITS.notesMax),
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
    .select('id, workout_id, exercise_id, set_number, weight, reps, rir, set_type, exercises(id, name)')
    .in('workout_id', workoutIds)
    .order('exercise_id', { ascending: true })
    .order('set_number', { ascending: true })
    .order('id', { ascending: true });

  if (setsError) {
    throw new Error(`Unable to load workout feed sets: ${setsError.message}`);
  }

  const aggregateByWorkout = aggregateWorkoutFeedSets((allSets as RawWorkoutFeedSetRow[] | null) ?? []);

  const currentSetsByWorkoutId = new Map<string, PersonalRecordSetSample[]>();
  for (const workout of rawWorkouts) {
    currentSetsByWorkoutId.set(workout.id, samplesFromFeedAggregate(aggregateByWorkout.get(workout.id)));
  }

  let prCountByWorkoutId = new Map<string, number>();
  try {
    prCountByWorkoutId = await resolvePrCountsByWorkoutId(
      rawWorkouts.map((workout) => ({
        id: workout.id,
        user_id: workout.user_id,
        start_time: workout.start_time,
      })),
      currentSetsByWorkoutId
    );
  } catch {
    // Non-critical — feed still loads with 0 PRs
  }

  const { data: latestCommentsData } = await supabase
    .from('workout_comments')
    .select('workout_id, content, profiles(username)')
    .in('workout_id', workoutIds)
    .order('created_at', { ascending: false });

  const latestCommentByWorkout = new Map<string, { content: string; author: string }>();

  for (const comment of latestCommentsData ?? []) {
    const wId = normalizeOptionalId(comment.workout_id);
    if (!wId || latestCommentByWorkout.has(wId)) continue;
    
    latestCommentByWorkout.set(wId, {
      content: comment.content,
      author: (comment.profiles as any)?.username ?? 'Atleta',
    });
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
      prCount: prCountByWorkoutId.get(workout.id) ?? 0,
      exerciseNames: aggregate?.exerciseNames ?? [],
      exerciseGroups: aggregate?.exerciseGroups ?? [],
      likes_count: extractRelationCount(workout.workout_likes),
      comments_count: extractRelationCount(workout.workout_comments),
      has_liked: likedWorkoutIds.has(workout.id),
      latest_comment: latestCommentByWorkout.get(workout.id) ?? null,
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

  const { data: rawWorkoutExercisesData, error: workoutExercisesError } = await supabase
    .from('workout_exercises')
    .select('id, order, rest_time, exercise_id, notes, exercises(id, name, name_en, name_pt, muscle_group, equipment, is_custom, image_url)')
    .eq('workout_id', normalizedWorkoutId)
    .order('order', { ascending: true });

  let workoutExercisesRows = rawWorkoutExercisesData;
  let workoutExercisesLoadError = workoutExercisesError;

  if (workoutExercisesError) {
    const notesMissingMessage = (workoutExercisesError.message ?? '').toLowerCase();
    const isNotesMissing =
      notesMissingMessage.includes('notes') &&
      (notesMissingMessage.includes('column') || notesMissingMessage.includes('schema cache'));

    if (isNotesMissing) {
      const fallback = await supabase
        .from('workout_exercises')
        .select('id, order, rest_time, exercise_id, exercises(id, name, name_en, name_pt, muscle_group, equipment, is_custom, image_url)')
        .eq('workout_id', normalizedWorkoutId)
        .order('order', { ascending: true });

      workoutExercisesRows = (fallback.data as typeof rawWorkoutExercisesData) ?? null;
      workoutExercisesLoadError = fallback.error;
    }
  }

  if (workoutExercisesLoadError && !isWorkoutExercisesTableMissing(workoutExercisesLoadError)) {
    throw new Error(`Unable to load workout exercises: ${workoutExercisesLoadError.message}`);
  }

  if (workoutExercisesLoadError && isWorkoutExercisesTableMissing(workoutExercisesLoadError)) {
    console.warn('[getWorkoutDetails] workout_exercises table missing, using sets fallback grouping', {
      workoutId: normalizedWorkoutId,
      error: extractSupabaseErrorMeta(workoutExercisesLoadError),
    });
  }

  let rawSetRows: RawWorkoutDetailsSetRow[] | null = null;
  let setRowsError: unknown = null;

  {
    const result = await supabase
      .from('sets')
      .select('id, set_number, weight, reps, rir, set_type, side, workout_exercise_id, exercise_id')
      .eq('workout_id', normalizedWorkoutId)
      .order('set_number', { ascending: true })
      .order('id', { ascending: true });

    rawSetRows = (result.data as RawWorkoutDetailsSetRow[] | null) ?? null;
    setRowsError = result.error;
  }

  if (setRowsError && isWorkoutExerciseIdColumnMissing(setRowsError)) {
    const legacyResult = await supabase
      .from('sets')
      .select('id, set_number, weight, reps, rir, set_type, side, exercise_id')
      .eq('workout_id', normalizedWorkoutId)
      .order('set_number', { ascending: true })
      .order('id', { ascending: true });

    if (legacyResult.error) {
      setRowsError = legacyResult.error;
    } else {
      rawSetRows = ((legacyResult.data ?? []) as Omit<RawWorkoutDetailsSetRow, 'workout_exercise_id'>[]).map((row) => ({
        ...row,
        side: normalizeSetSide((row as { side?: unknown }).side),
        workout_exercise_id: null,
      }));
      setRowsError = null;

      console.warn('[getWorkoutDetails] sets.workout_exercise_id column missing, using legacy set projection', {
        workoutId: normalizedWorkoutId,
      });
    }
  }

  // If `side` column is missing on older schemas, retry without it.
  if (setRowsError) {
    const sideMissingMessage = String((setRowsError as { message?: string })?.message ?? '').toLowerCase();
    const isSideMissing =
      sideMissingMessage.includes('side') &&
      (sideMissingMessage.includes('column') || sideMissingMessage.includes('schema cache'));

    if (isSideMissing) {
      const fallbackResult = await supabase
        .from('sets')
        .select('id, set_number, weight, reps, rir, set_type, workout_exercise_id, exercise_id')
        .eq('workout_id', normalizedWorkoutId)
        .order('set_number', { ascending: true })
        .order('id', { ascending: true });

      if (!fallbackResult.error) {
        rawSetRows = ((fallbackResult.data ?? []) as Omit<RawWorkoutDetailsSetRow, 'side'>[]).map((row) => ({
          ...row,
          side: 'both' as const,
        }));
        setRowsError = null;
      }
    }
  }

  if (setRowsError) {
    throw new Error(`Unable to load workout sets: ${toErrorMessage(setRowsError)}`);
  }

  const workoutExercises = ((workoutExercisesRows ?? []) as RawWorkoutExerciseDetailsRow[]).map((row) => ({
    ...row,
    notes: row.notes ?? null,
  }));
  const setRows = rawSetRows ?? [];

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
      .select('id, name, name_en, name_pt, muscle_group, equipment, is_custom, image_url')
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
      name_en: exerciseInfo?.name_en ?? null,
      name_pt: exerciseInfo?.name_pt ?? null,
      is_custom: exerciseInfo?.is_custom ?? false,
      image_url: exerciseInfo?.image_url ?? null,
      muscle_group: exerciseInfo?.muscle_group ?? null,
      equipment: exerciseInfo?.equipment ?? null,
      notes: relation.notes ?? null,
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
      name_en: exerciseInfo?.name_en ?? null,
      name_pt: exerciseInfo?.name_pt ?? null,
      is_custom: exerciseInfo?.is_custom ?? false,
      image_url: exerciseInfo?.image_url ?? null,
      muscle_group: exerciseInfo?.muscle_group ?? null,
      equipment: exerciseInfo?.equipment ?? null,
      notes: null,
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
      name_en: exerciseInfo?.name_en ?? null,
      name_pt: exerciseInfo?.name_pt ?? null,
      is_custom: exerciseInfo?.is_custom ?? false,
      image_url: exerciseInfo?.image_url ?? null,
      muscle_group: exerciseInfo?.muscle_group ?? null,
      equipment: exerciseInfo?.equipment ?? null,
      notes: null,
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

  let prCount = 0;
  try {
    const currentSamples: PersonalRecordSetSample[] = detailsExercises.flatMap((exercise) =>
      exercise.sets.map((setItem) => ({
        exerciseId: exercise.exercise_id,
        weight: setItem.weight,
        reps: setItem.reps,
      }))
    );

    const exerciseIds = [...new Set(currentSamples.map((sample) => sample.exerciseId).filter(Boolean))];

    if (exerciseIds.length > 0) {
      const { data: priorWorkouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', workout.user_id)
        .neq('id', workout.id)
        .not('end_time', 'is', null)
        .lt('start_time', workout.start_time);

      if (priorWorkouts && priorWorkouts.length > 0) {
        const { data: previousSets } = await supabase
          .from('sets')
          .select('exercise_id, weight, reps')
          .in(
            'workout_id',
            priorWorkouts.map((row) => row.id)
          )
          .in('exercise_id', exerciseIds);

        prCount = countPersonalRecords(
          currentSamples,
          (previousSets ?? []).map((row) => ({
            exerciseId: row.exercise_id ?? '',
            weight: row.weight,
            reps: row.reps,
          }))
        );
      }
    }
  } catch {
    // Non-critical
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
    prCount,
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
    .select('id, workout_id, exercise_id, set_number, weight, reps, rir, set_type, exercises(id, name)')
    .in('workout_id', workoutIds)
    .order('exercise_id', { ascending: true })
    .order('set_number', { ascending: true })
    .order('id', { ascending: true });

  if (setsError) {
    throw new Error(`Unable to load workout history sets: ${setsError.message}`);
  }

  const aggregateByWorkout = aggregateWorkoutFeedSets((allSets as RawWorkoutFeedSetRow[] | null) ?? []);

  const currentSetsByWorkoutId = new Map<string, PersonalRecordSetSample[]>();
  for (const workout of rawWorkouts) {
    currentSetsByWorkoutId.set(workout.id, samplesFromFeedAggregate(aggregateByWorkout.get(workout.id)));
  }

  let prCountByWorkoutId = new Map<string, number>();
  try {
    prCountByWorkoutId = await resolvePrCountsByWorkoutId(
      rawWorkouts.map((workout) => ({
        id: workout.id,
        user_id: workout.user_id,
        start_time: workout.start_time,
      })),
      currentSetsByWorkoutId
    );
  } catch {
    // Non-critical
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
      prCount: prCountByWorkoutId.get(workout.id) ?? 0,
      exerciseNames: aggregate?.exerciseNames ?? [],
      exerciseGroups: aggregate?.exerciseGroups ?? [],
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
