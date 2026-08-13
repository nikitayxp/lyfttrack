import { supabase } from '@/services/supabase';
import {
  buildSetInsertRow,
  createCustomExercisesForImport,
  getAuthenticatedUserOrThrow,
  getExercisesCatalog,
  normalizeWriteText,
  type ExerciseCatalogItem,
} from '@/services/workoutService';
import type { WorkoutSetDraft } from '@/services/workoutSession.types';
import type { TablesInsert } from '@/types/database';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';
import { generateId } from '@/utils/uuid';
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

function isShortenedTokenKey(aliasKey: string, canonicalKey: string): boolean {
  if (!aliasKey || !canonicalKey || aliasKey === canonicalKey) {
    return false;
  }

  const aliasTokens = aliasKey.split(' ');
  const canonicalTokens = canonicalKey.split(' ');

  if (aliasTokens.length >= canonicalTokens.length) {
    return false;
  }

  const canonicalSet = new Set(canonicalTokens);
  return aliasTokens.every((token) => canonicalSet.has(token));
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

    const ownTokenKeys = [item.name, item.name_en, item.name_pt]
      .filter((name): name is string => Boolean(name))
      .map((name) => titleTokenKey(name))
      .filter(Boolean);

    for (const alias of item.aliases ?? []) {
      if (!alias) continue;
      const aliasTokenKey = titleTokenKey(alias);
      if (ownTokenKeys.some((key) => isShortenedTokenKey(aliasTokenKey, key))) {
        continue;
      }
      const aliasKey = normalizeTitle(alias);
      if (aliasKey && preferCatalogItem(item, byAlias.get(aliasKey))) {
        byAlias.set(aliasKey, item);
      }
      if (aliasTokenKey && preferCatalogItem(item, byTokens.get(aliasTokenKey))) {
        byTokens.set(aliasTokenKey, item);
      }
    }
  }

  return { exact, byAlias, byTokens };
}

function splitCollapsedHevyTitles(matches: ExerciseMatch[]): ExerciseMatch[] {
  const indicesByExerciseId = new Map<string, number[]>();

  matches.forEach((match, index) => {
    if (!match.exerciseId) {
      return;
    }

    const indices = indicesByExerciseId.get(match.exerciseId) ?? [];
    indices.push(index);
    indicesByExerciseId.set(match.exerciseId, indices);
  });

  const result = matches.map((match) => ({ ...match }));

  for (const indices of indicesByExerciseId.values()) {
    const tokenKeys = new Set(indices.map((index) => titleTokenKey(result[index].title)));
    if (tokenKeys.size <= 1) {
      continue;
    }

    let keepIndex = indices[0];
    let keepScore = -1;

    for (const index of indices) {
      const titleKey = titleTokenKey(result[index].title);
      const catalogKey = result[index].matchedName ? titleTokenKey(result[index].matchedName as string) : '';
      const score =
        (result[index].kind === 'exact' ? 100 : 0) +
        (titleKey === catalogKey ? 50 : 0) +
        titleKey.split(' ').length;

      if (score > keepScore) {
        keepScore = score;
        keepIndex = index;
      }
    }

    const keepTokenKey = titleTokenKey(result[keepIndex].title);

    for (const index of indices) {
      if (titleTokenKey(result[index].title) === keepTokenKey) {
        continue;
      }

      result[index] = {
        title: result[index].title,
        exerciseId: null,
        matchedName: null,
        kind: 'none',
      };
    }
  }

  return result;
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

  const matches = titles.map((title) => {
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

  return splitCollapsedHevyTitles(matches);
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
  console.assert(
    titleTokenKey('Puxada alta na polia (maquina)') !== titleTokenKey('Puxada alta (maquina)'),
    'polia machine pulldown must not equal machine pulldown'
  );

  const latPulldown = {
    id: 'lat-pulldown-machine',
    name: 'Lat Pulldown (Machine)',
    name_en: 'Lat Pulldown (Machine)',
    name_pt: 'Puxada Alta na Polia (Máquina)',
    aliases: ['Puxada Alta (Máquina)', 'Puxada Alta (Maquina)'],
    is_custom: false,
    listed: true,
  } as ExerciseCatalogItem;

  const pulldownMatches = matchExerciseTitles(
    ['Puxada alta na polia (maquina)', 'Puxada alta (maquina)'],
    [latPulldown]
  );
  console.assert(
    pulldownMatches[0]?.exerciseId === latPulldown.id && pulldownMatches[0]?.kind === 'exact',
    'full polia title still maps to lat pulldown'
  );
  console.assert(
    pulldownMatches[1]?.kind === 'none' && pulldownMatches[1]?.exerciseId === null,
    'short machine pulldown must not collapse onto the polia row'
  );

  const tBar = {
    id: 't-bar',
    name: 'T-Bar Row',
    name_en: 'T-Bar Row',
    name_pt: 'Remada na Barra T',
    aliases: ['Remada T-Bar'],
    is_custom: false,
    listed: true,
  } as ExerciseCatalogItem;
  const tBarMatches = matchExerciseTitles(['Remada na Barra T', 'T-Bar Row'], [tBar]);
  console.assert(
    tBarMatches.every((match) => match.exerciseId === tBar.id),
    'PT and EN t-bar titles stay the same exercise'
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
  plan: ImportPlan,
  userId: string
): Promise<{ idByTitle: Map<string, string>; created: number }> {
  const idByTitle = new Map<string, string>();
  const toCreate: { title: string; input: { name: string; muscleGroup: string | null; equipment: ExerciseEquipmentKey | null } }[] = [];

  for (const match of plan.matches) {
    if (match.exerciseId) {
      idByTitle.set(match.title, match.exerciseId);
      continue;
    }

    // Nothing in the catalogue answers to this name, so the history keeps it as
    // the user's own exercise rather than being quietly dropped.
    const muscleKey = resolveExerciseMuscleKey({ name: match.title });
    const equipmentKey = inferEquipmentKey(match.title);

    toCreate.push({
      title: match.title,
      input: { name: match.title, muscleGroup: muscleKey ?? null, equipment: equipmentKey ?? null },
    });
  }

  if (toCreate.length === 0) {
    return { idByTitle, created: 0 };
  }

  // One insert for every custom exercise instead of a round-trip each — the old
  // per-exercise createExercise also re-fetched the user every time.
  const createdIds = await createCustomExercisesForImport(
    userId,
    toCreate.map((entry) => entry.input)
  );

  toCreate.forEach((entry, index) => {
    idByTitle.set(entry.title, createdIds[index]);
  });

  return { idByTitle, created: toCreate.length };
}

type WorkoutExerciseBlock = {
  exerciseId: string;
  notes: string | null;
  sets: WorkoutSetDraft[];
};

/**
 * Group a parsed workout into the exercises it touches, in first-seen order,
 * merging repeat appearances of the same exercise under one block (mirrors the
 * single-workout path, where workout_exercises is unique per exercise).
 */
function collectWorkoutExercises(
  workout: HevyParsedWorkout,
  idByTitle: Map<string, string>
): WorkoutExerciseBlock[] {
  const blocks: WorkoutExerciseBlock[] = [];
  const blockByExerciseId = new Map<string, WorkoutExerciseBlock>();

  for (const exercise of workout.exercises) {
    const exerciseId = idByTitle.get(exercise.title);
    if (!exerciseId) continue;

    let block = blockByExerciseId.get(exerciseId);
    if (!block) {
      block = { exerciseId, notes: null, sets: [] };
      blockByExerciseId.set(exerciseId, block);
      blocks.push(block);
    }

    if (exercise.notes && !block.notes) {
      block.notes = exercise.notes;
    }

    for (const set of exercise.sets) {
      block.sets.push({
        exerciseId,
        setNumber: set.setNumber,
        weight: set.weightKg,
        reps: set.reps,
        setType: set.setType,
      });
    }
  }

  return blocks;
}

const IMPORT_BATCH_SIZE = 20;
const MAX_WRITE_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Transient errors worth another go: network blips, gateway timeouts, rate
 * limits (429) and statement-timeout style Postgres codes. A schema/constraint
 * error is not transient and is rethrown immediately.
 */
function isTransientError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  const code = (error as { code?: string })?.code ?? '';

  if (/failed to fetch|network|timeout|temporar|too many|rate limit|429|502|503|504/.test(message)) {
    return true;
  }

  return ['57014', '08000', '08006', '53300', '53400'].includes(code);
}

async function withWriteRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_WRITE_ATTEMPTS - 1 && isTransientError(error)) {
        await delay(500 * 2 ** attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

async function insertRowsOrThrow(
  table: 'workouts' | 'workout_exercises' | 'sets',
  rows: TablesInsert<'workouts'>[] | TablesInsert<'workout_exercises'>[] | TablesInsert<'sets'>[]
): Promise<void> {
  if (rows.length === 0) return;

  await withWriteRetry(async () => {
    // Supabase returns errors on the result instead of throwing, so surface it
    // as a throw with the Postgres code attached for the retry classifier.
    const { error } = await supabase.from(table).insert(rows as never[]);
    if (error) {
      const wrapped = new Error(`${table} insert failed: ${error.message}`);
      (wrapped as { code?: string }).code = error.code;
      throw wrapped;
    }
  });
}

/**
 * Write one batch of workouts with client-generated ids, so workouts, their
 * exercises and their sets all go in three bulk inserts instead of ~4
 * round-trips per workout. If any insert fails after the workouts landed, the
 * batch's workouts are deleted (children cascade) so a re-run re-imports them
 * cleanly rather than leaving empty sessions the dedup would then skip.
 */
async function writeWorkoutBatch(
  userId: string,
  batch: HevyParsedWorkout[],
  idByTitle: Map<string, string>
): Promise<{ workouts: number; sets: number }> {
  const workoutRows: TablesInsert<'workouts'>[] = [];
  const workoutExerciseRows: TablesInsert<'workout_exercises'>[] = [];
  const setRows: TablesInsert<'sets'>[] = [];

  for (const workout of batch) {
    const blocks = collectWorkoutExercises(workout, idByTitle);
    if (blocks.length === 0) continue;

    const workoutId = generateId();
    workoutRows.push({
      id: workoutId,
      user_id: userId,
      name: sanitizeText(workout.title, { maxLength: INPUT_LIMITS.nameMax, allowEmpty: true }) ?? 'Untitled Workout',
      notes: normalizeWriteText(workout.description, INPUT_LIMITS.notesMax),
      start_time: workout.startTime,
      end_time: workout.endTime,
    });

    blocks.forEach((block, index) => {
      const workoutExerciseId = generateId();
      workoutExerciseRows.push({
        id: workoutExerciseId,
        workout_id: workoutId,
        exercise_id: block.exerciseId,
        order: index + 1,
        notes: normalizeWriteText(block.notes, 1000),
      });

      for (const draft of block.sets) {
        const row = buildSetInsertRow(workoutId, draft, workoutExerciseId);
        if (row) setRows.push(row);
      }
    });
  }

  if (workoutRows.length === 0) {
    return { workouts: 0, sets: 0 };
  }

  const workoutIds = workoutRows.map((row) => row.id as string);

  try {
    await insertRowsOrThrow('workouts', workoutRows);
    await insertRowsOrThrow('workout_exercises', workoutExerciseRows);
    await insertRowsOrThrow('sets', setRows);
  } catch (error) {
    // Best-effort rollback of this batch so the same workouts can be re-imported
    // without the dedup mistaking a half-written session for one already there.
    await supabase
      .from('workouts')
      .delete()
      .in('id', workoutIds)
      .then(
        () => undefined,
        () => undefined
      );
    throw error;
  }

  return { workouts: workoutRows.length, sets: setRows.length };
}

export async function runImport(
  plan: ImportPlan,
  options: { onProgress?: (progress: ImportProgress) => void } = {}
): Promise<ImportSummary> {
  // Resolve the user once. The old path called supabase.auth.getUser() (a
  // network round-trip) inside every workout write, which tripped the auth rate
  // limit part-way through a large import and stranded the rest.
  const user = await getAuthenticatedUserOrThrow();

  const { idByTitle, created } = await resolveExerciseIds(plan, user.id);

  const duplicates = new Set(plan.duplicateStartTimes);
  const pending = plan.parse.workouts.filter((workout) => !duplicates.has(workout.startTime));

  const summary: ImportSummary = {
    importedWorkouts: 0,
    importedSets: 0,
    skippedDuplicates: plan.duplicateStartTimes.length,
    createdExercises: created,
    failedWorkouts: [],
  };

  let done = 0;

  for (let start = 0; start < pending.length; start += IMPORT_BATCH_SIZE) {
    const batch = pending.slice(start, start + IMPORT_BATCH_SIZE);

    try {
      const result = await writeWorkoutBatch(user.id, batch, idByTitle);
      summary.importedWorkouts += result.workouts;
      summary.importedSets += result.sets;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      for (const workout of batch) {
        summary.failedWorkouts.push({
          title: workout.title,
          startTime: workout.startTime,
          reason,
        });
      }
    }

    done += batch.length;
    options.onProgress?.({ done, total: pending.length });
  }

  return summary;
}
