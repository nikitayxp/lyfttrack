import { supabase } from '@/services/supabase';
import {
  createExercise,
  getAuthenticatedUserOrThrow,
  getExercisesCatalog,
  type ExerciseCatalogItem,
} from '@/services/workoutService';
import { createWorkoutWithSets } from '@/services/sessionRepository';
import type { WorkoutSetDraft } from '@/services/workoutSession.types';
import {
  EXERCISE_EQUIPMENT_FILTER_KEYWORDS,
  resolveExerciseMuscleKey,
  type ExerciseEquipmentKey,
} from '@/constants/exerciseCatalog';
import {
  collectExerciseTitles,
  parseHevyCsv,
  type HevyParseResult,
  type HevyParsedWorkout,
} from './hevyCsv';

export type ImportSource = 'hevy';

export type ExerciseMatchKind = 'exact' | 'alias' | 'none';

export type ExerciseMatch = {
  /** The name as it appears in the export. */
  title: string;
  exerciseId: string | null;
  /** The catalogue name we landed on, so the preview can show the pairing. */
  matchedName: string | null;
  kind: ExerciseMatchKind;
};

export type ImportPlan = {
  source: ImportSource;
  parse: HevyParseResult;
  matches: ExerciseMatch[];
  /** Titles with nothing in the catalogue; imported as custom exercises. */
  unmatchedTitles: string[];
  /** Workouts already in the account at the same start time. Skipped on import. */
  duplicateStartTimes: string[];
  /** Workouts that would actually be written. */
  importableWorkouts: number;
};

export type ImportProgress = {
  done: number;
  total: number;
};

export type ImportSummary = {
  importedWorkouts: number;
  importedSets: number;
  skippedDuplicates: number;
  createdExercises: number;
  /** Workouts that threw. The rest still went in — this is not a transaction. */
  failedWorkouts: { title: string; startTime: string; reason: string }[];
};

/**
 * Case, accents and punctuation all vary between an export and our catalogue
 * ("Máquina" vs "maquina", "Rosca Scott (Halter)" vs "Rosca Scott - Halter"),
 * so names are compared on letters and digits alone.
 */
function normalizeTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Equipment / spelling bridges shared with the exercise search bar. */
function applyEquipmentSynonyms(normalized: string): string {
  return normalized
    .replace(/\bbarra\b/g, 'bar')
    .replace(/\btbar\b/g, 't bar')
    .replace(/\bhalteres?\b/g, 'dumbbell')
    .replace(/\bmaquina\b/g, 'machine')
    .replace(/\bpolia\b/g, 'cable');
}

/**
 * Movement words that mean the same lift in PT and EN.
 * Kept tight on purpose — loose aliases (e.g. bare "press") would cross wires.
 */
const MOVEMENT_TOKEN_CANONICAL: Record<string, string> = {
  remada: 'row',
  row: 'row',
  rows: 'row',
  puxada: 'pulldown',
  pulldown: 'pulldown',
  pulldowns: 'pulldown',
  supino: 'bench',
  bench: 'bench',
  agachamento: 'squat',
  squat: 'squat',
  squats: 'squat',
  rosca: 'curl',
  curl: 'curl',
  curls: 'curl',
  desenvolvimento: 'press',
  terra: 'deadlift',
  deadlift: 'deadlift',
  stiff: 'rdl',
  romeno: 'rdl',
};

const TITLE_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'in',
  'na',
  'nas',
  'no',
  'nos',
  'of',
  'on',
  'para',
  'the',
]);

/**
 * Sorted significant tokens after PT/EN equipment + movement synonyms.
 * "Remada na Barra T" and "T-Bar Row" both become "bar row t".
 */
export function titleTokenKey(value: string): string {
  const normalized = applyEquipmentSynonyms(normalizeTitle(value));
  const tokens = normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => MOVEMENT_TOKEN_CANONICAL[token] ?? token)
    .filter((token) => token.length > 0 && !TITLE_STOP_WORDS.has(token));

  return [...new Set(tokens)].sort().join(' ');
}

function inferEquipmentKey(title: string): ExerciseEquipmentKey | null {
  const normalized = applyEquipmentSynonyms(normalizeTitle(title));

  // T-bar / landmine style titles mention "bar" and must not become "machine"
  // just because Hevy's export sometimes says "maquina" nearby in other rows.
  if (/\bt\b/.test(normalized) && /\bbar\b/.test(normalized)) {
    return 'barbell';
  }

  for (const [key, keywords] of Object.entries(EXERCISE_EQUIPMENT_FILTER_KEYWORDS)) {
    for (const keyword of keywords) {
      const needle = applyEquipmentSynonyms(normalizeTitle(keyword.replace(/_/g, ' ')));
      if (needle.length > 2 && normalized.includes(needle)) {
        return key as ExerciseEquipmentKey;
      }
    }
  }

  return null;
}

function catalogQuality(item: ExerciseCatalogItem): number {
  let score = item.is_custom ? 0 : 80;
  if (item.listed !== false) score += 50;
  if (item.name_en) score += 20;
  if (item.name_pt) score += 20;
  return score;
}

function preferCatalogItem(candidate: ExerciseCatalogItem, current: ExerciseCatalogItem | undefined): boolean {
  if (!current) return true;
  return catalogQuality(candidate) > catalogQuality(current);
}

function indexCatalog(catalog: ExerciseCatalogItem[]) {
  const exact = new Map<string, ExerciseCatalogItem>();
  const byAlias = new Map<string, ExerciseCatalogItem>();
  const byTokens = new Map<string, ExerciseCatalogItem>();

  for (const item of catalog) {
    for (const name of [item.name, item.name_en, item.name_pt]) {
      if (!name) continue;

      const exactKey = normalizeTitle(name);
      if (exactKey && preferCatalogItem(item, exact.get(exactKey))) {
        exact.set(exactKey, item);
      }

      const tokenKey = titleTokenKey(name);
      if (tokenKey && preferCatalogItem(item, byTokens.get(tokenKey))) {
        byTokens.set(tokenKey, item);
      }
    }

    for (const alias of item.aliases ?? []) {
      if (!alias) continue;
      const aliasKey = normalizeTitle(alias);
      if (aliasKey && preferCatalogItem(item, byAlias.get(aliasKey))) {
        byAlias.set(aliasKey, item);
      }
      const tokenKey = titleTokenKey(alias);
      if (tokenKey && preferCatalogItem(item, byTokens.get(tokenKey))) {
        byTokens.set(tokenKey, item);
      }
    }
  }

  return { exact, byAlias, byTokens };
}

/**
 * Match Hevy titles to the catalogue.
 *
 * 1. Exact letters/digits after normalisation ("Supino - Barra" = "Supino (Barra)").
 * 2. Catalogue aliases (listed winners keep unlisted Hevy names).
 * 3. Token alias: same significant words after PT/EN synonyms
 *    ("Remada na Barra T" = "T-Bar Row"). Still requires the *same* set of
 *    movement+equipment tokens, so "Supino Máquina" never lands on "Supino Barra".
 */
export function matchExerciseTitles(
  titles: string[],
  catalog: ExerciseCatalogItem[]
): ExerciseMatch[] {
  const { exact, byAlias, byTokens } = indexCatalog(catalog);

  return titles.map((title) => {
    const exactHit = exact.get(normalizeTitle(title));
    if (exactHit) {
      return {
        title,
        exerciseId: exactHit.id,
        matchedName: exactHit.name,
        kind: 'exact' as const,
      };
    }

    const aliasHit = byAlias.get(normalizeTitle(title));
    if (aliasHit) {
      return {
        title,
        exerciseId: aliasHit.id,
        matchedName: aliasHit.name,
        kind: 'alias' as const,
      };
    }

    const tokenHit = byTokens.get(titleTokenKey(title));
    if (tokenHit) {
      return {
        title,
        exerciseId: tokenHit.id,
        matchedName: tokenHit.name,
        kind: 'alias' as const,
      };
    }

    return { title, exerciseId: null, matchedName: null, kind: 'none' as const };
  });
}

// ponytail: import matching checks (no test runner in app/)
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.assert(
    titleTokenKey('Remada na Barra T') === titleTokenKey('T-Bar Row'),
    'Remada na Barra T ↔ T-Bar Row tokens'
  );
  console.assert(
    titleTokenKey('Remada na Barra T') === titleTokenKey('Remada T-Bar'),
    'Remada na Barra T ↔ Remada T-Bar tokens'
  );
  console.assert(
    titleTokenKey('Supino Maquina') !== titleTokenKey('Supino Barra'),
    'machine bench must not equal barbell bench'
  );
}

/**
 * Start times already in the account, so a second run of the same file adds
 * nothing. Two sessions starting in the same minute would be indistinguishable,
 * but that is not a thing that happens.
 */
async function findExistingStartTimes(startTimes: string[]): Promise<Set<string>> {
  const user = await getAuthenticatedUserOrThrow();
  const existing = new Set<string>();

  if (startTimes.length === 0) return existing;

  const sorted = [...startTimes].sort();
  const { data, error } = await supabase
    .from('workouts')
    .select('start_time')
    .eq('user_id', user.id)
    .gte('start_time', sorted[0])
    .lte('start_time', sorted[sorted.length - 1]);

  if (error) {
    throw new Error(`Unable to check for workouts already imported: ${error.message}`);
  }

  for (const row of data ?? []) {
    const value = row.start_time;
    if (typeof value === 'string') {
      existing.add(new Date(value).toISOString());
    }
  }

  return existing;
}

export async function buildImportPlan(csvText: string): Promise<ImportPlan> {
  const parse = parseHevyCsv(csvText);
  const titles = collectExerciseTitles(parse);
  const catalog = await getExercisesCatalog({ includeUnlisted: true });
  const matches = matchExerciseTitles(titles, catalog);

  const existing = await findExistingStartTimes(parse.workouts.map((workout) => workout.startTime));
  const duplicateStartTimes = parse.workouts
    .map((workout) => workout.startTime)
    .filter((startTime) => existing.has(startTime));

  return {
    source: 'hevy',
    parse,
    matches,
    unmatchedTitles: matches.filter((match) => match.kind === 'none').map((match) => match.title),
    duplicateStartTimes,
    importableWorkouts: parse.workouts.length - duplicateStartTimes.length,
  };
}

async function resolveExerciseIds(
  plan: ImportPlan
): Promise<{ idByTitle: Map<string, string>; created: number }> {
  const idByTitle = new Map<string, string>();
  let created = 0;

  for (const match of plan.matches) {
    if (match.exerciseId) {
      idByTitle.set(match.title, match.exerciseId);
      continue;
    }

    // Nothing in the catalogue answers to this name, so the history keeps it as
    // the user's own exercise rather than being quietly dropped.
    const muscleKey = resolveExerciseMuscleKey({ name: match.title });
    const equipmentKey = inferEquipmentKey(match.title);

    const exercise = await createExercise({
      name: match.title,
      muscleGroup: muscleKey ?? null,
      equipment: equipmentKey ?? null,
    });

    idByTitle.set(match.title, exercise.id);
    created += 1;
  }

  return { idByTitle, created };
}

function buildSetDrafts(
  workout: HevyParsedWorkout,
  idByTitle: Map<string, string>
): { drafts: WorkoutSetDraft[]; notesByExerciseId: Record<string, string> } {
  const drafts: WorkoutSetDraft[] = [];
  const notesByExerciseId: Record<string, string> = {};

  for (const exercise of workout.exercises) {
    const exerciseId = idByTitle.get(exercise.title);
    if (!exerciseId) continue;

    if (exercise.notes && !notesByExerciseId[exerciseId]) {
      notesByExerciseId[exerciseId] = exercise.notes;
    }

    for (const set of exercise.sets) {
      drafts.push({
        exerciseId,
        setNumber: set.setNumber,
        weight: set.weightKg,
        reps: set.reps,
        setType: set.setType,
      });
    }
  }

  return { drafts, notesByExerciseId };
}

export async function runImport(
  plan: ImportPlan,
  options: { onProgress?: (progress: ImportProgress) => void } = {}
): Promise<ImportSummary> {
  const { idByTitle, created } = await resolveExerciseIds(plan);

  const duplicates = new Set(plan.duplicateStartTimes);
  const pending = plan.parse.workouts.filter((workout) => !duplicates.has(workout.startTime));

  const summary: ImportSummary = {
    importedWorkouts: 0,
    importedSets: 0,
    skippedDuplicates: plan.duplicateStartTimes.length,
    createdExercises: created,
    failedWorkouts: [],
  };

  for (let i = 0; i < pending.length; i += 1) {
    const workout = pending[i];
    const { drafts, notesByExerciseId } = buildSetDrafts(workout, idByTitle);

    if (drafts.length === 0) {
      options.onProgress?.({ done: i + 1, total: pending.length });
      continue;
    }

    try {
      // One workout at a time on purpose. A failure part-way leaves the
      // sessions already written in place instead of losing the whole file,
      // and the summary says which ones did not make it.
      const result = await createWorkoutWithSets({
        name: workout.title,
        notes: workout.description,
        startTime: workout.startTime,
        endTime: workout.endTime,
        setDrafts: drafts,
        notesByExerciseId,
      });

      summary.importedWorkouts += 1;
      summary.importedSets += result.insertedSetCount;
    } catch (error) {
      summary.failedWorkouts.push({
        title: workout.title,
        startTime: workout.startTime,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    options.onProgress?.({ done: i + 1, total: pending.length });
  }

  return summary;
}
