import type { WorkoutSetType } from '@/services/workoutSession.types';

/**
 * Parser for the workout CSV that Hevy exports (Settings → Export Data).
 *
 * Everything here is pure: text in, structure out. Nothing touches Supabase, so
 * the shape of a real export can be checked without an account.
 *
 * What a real export looks like, from the 7868-row file this was written
 * against:
 *
 * - `\r\n` line endings, every field quoted, quotes doubled RFC-4180 style.
 * - Newlines inside notes are written as a literal backslash-n, not as a real
 *   newline. One exercise title carried a trailing one.
 * - Dates follow the app's language, not ISO: `28 Jul 2026, 10:42`, and in a
 *   Portuguese account the months read Fev/Abr/Mai/Ago/Set/Out/Dez.
 * - `set_index` starts at 0 and restarts for each exercise.
 * - `weight_kg` is blank for bodyweight work; `distance_km`, `duration_seconds`
 *   and `rpe` are blank for lifting.
 */

export type HevyParsedSet = {
  /** 1-based, renumbered per exercise. Hevy's own index is 0-based. */
  setNumber: number;
  setType: WorkoutSetType;
  weightKg: number | null;
  reps: number | null;
  /** Kept so the caller can report what it cannot store, not written anywhere. */
  distanceKm: number | null;
  durationSeconds: number | null;
};

export type HevyParsedExercise = {
  title: string;
  notes: string | null;
  sets: HevyParsedSet[];
};

export type HevyParsedWorkout = {
  title: string;
  /** ISO 8601, converted from the export's local wall-clock time. */
  startTime: string;
  endTime: string;
  description: string | null;
  exercises: HevyParsedExercise[];
};

export type HevyParseIssueCode =
  | 'missing-columns'
  | 'empty-file'
  | 'bad-date'
  | 'empty-set'
  | 'unknown-set-type';

export type HevyParseIssue = {
  code: HevyParseIssueCode;
  /** 1-based line in the file, so a person can go and look at it. */
  line: number | null;
  detail: string;
};

export type HevyParseResult = {
  workouts: HevyParsedWorkout[];
  issues: HevyParseIssue[];
  stats: {
    dataRows: number;
    workouts: number;
    exercises: number;
    sets: number;
    skippedRows: number;
    /** Cardio rows we can read but have nowhere to put. */
    droppedCardioFields: number;
  };
};

const REQUIRED_COLUMNS = [
  'title',
  'start_time',
  'end_time',
  'exercise_title',
  'set_index',
  'set_type',
  'weight_kg',
  'reps',
] as const;

/**
 * Both languages in one table. There is no collision between them — the months
 * that differ (feb/fev, apr/abr, may/mai, aug/ago, sep/set, oct/out, dec/dez)
 * differ in spelling, and the rest are spelled the same in both.
 */
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  fev: 1,
  mar: 2,
  apr: 3,
  abr: 3,
  may: 4,
  mai: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  ago: 7,
  sep: 8,
  set: 8,
  oct: 9,
  out: 9,
  nov: 10,
  dec: 11,
  dez: 11,
};

/** RFC-4180 split. Handles quoted fields, doubled quotes, CRLF and a BOM. */
export function parseDelimited(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];

  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let hasContent = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      hasContent = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      hasContent = true;
      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      hasContent = false;
      continue;
    }

    field += char;
    hasContent = true;
  }

  if (hasContent || field.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Hevy writes line breaks inside a field as the two characters `\` and `n`
 * rather than as a real newline, so they survive the CSV untouched and have to
 * be put back by hand.
 */
function unescapeText(value: string): string {
  return value
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    // A quoted field may also hold a real line break, which survives the split
    // above untouched; normalise it so notes never carry a stray carriage return.
    .replace(/\r\n?/g, '\n');
}

function cleanText(value: string | undefined): string {
  return unescapeText(value ?? '').trim();
}

function optionalText(value: string | undefined): string | null {
  const cleaned = cleanText(value);
  return cleaned.length > 0 ? cleaned : null;
}

function parseNumber(value: string | undefined): number | null {
  const raw = (value ?? '').trim();
  if (raw.length === 0) return null;

  // Some locales export a decimal comma. There is never a thousands separator
  // in these columns, so a lone comma can only be the decimal point.
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `28 Jul 2026, 10:42` in whatever language the account is set to, with ISO as
 * a fallback in case a future export changes its mind.
 *
 * The export carries wall-clock time with no offset, which is the user's own
 * local time — so it is read as local and converted, not treated as UTC.
 */
export function parseHevyDate(value: string): Date | null {
  const raw = (value ?? '').trim();
  if (raw.length === 0) return null;

  const match = raw.match(/^(\d{1,2})\s+([\p{L}]+)\.?\s+(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/u);

  if (match) {
    const [, day, monthName, year, hour, minute, second] = match;
    const monthKey = monthName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 3);
    const month = MONTHS[monthKey];

    if (month !== undefined) {
      const date = new Date(
        Number(year),
        month,
        Number(day),
        Number(hour ?? 0),
        Number(minute ?? 0),
        Number(second ?? 0)
      );
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeSetType(value: string | undefined): { type: WorkoutSetType; known: boolean } {
  const raw = (value ?? '').trim().toLowerCase();

  switch (raw) {
    case 'normal':
    case '':
      return { type: 'normal', known: true };
    case 'warmup':
    case 'warm up':
    case 'warm-up':
      return { type: 'warmup', known: true };
    case 'failure':
      return { type: 'failure', known: true };
    case 'drop':
    case 'dropset':
      return { type: 'drop', known: true };
    default:
      return { type: 'normal', known: false };
  }
}

export function parseHevyCsv(text: string): HevyParseResult {
  const issues: HevyParseIssue[] = [];
  const empty: HevyParseResult = {
    workouts: [],
    issues,
    stats: { dataRows: 0, workouts: 0, exercises: 0, sets: 0, skippedRows: 0, droppedCardioFields: 0 },
  };

  const rows = parseDelimited(text);

  if (rows.length < 2) {
    issues.push({ code: 'empty-file', line: null, detail: 'The file has no rows below the header.' });
    return empty;
  }

  const header = rows[0].map((name) => name.trim().toLowerCase());
  const columnIndex = new Map<string, number>();
  header.forEach((name, index) => {
    if (!columnIndex.has(name)) columnIndex.set(name, index);
  });

  const missing = REQUIRED_COLUMNS.filter((name) => !columnIndex.has(name));

  if (missing.length > 0) {
    issues.push({
      code: 'missing-columns',
      line: 1,
      detail: missing.join(', '),
    });
    return empty;
  }

  const at = (row: string[], name: string): string | undefined => {
    const index = columnIndex.get(name);
    return index === undefined ? undefined : row[index];
  };

  // Workouts are keyed on title plus start time because a title alone repeats
  // across months, and a start time alone would merge two gyms in one minute.
  const workoutsByKey = new Map<string, HevyParsedWorkout>();
  const order: string[] = [];

  let dataRows = 0;
  let skippedRows = 0;
  let droppedCardioFields = 0;
  let unknownSetTypeReported = false;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const line = i + 1;

    // A trailing newline leaves a one-element row of empty string behind.
    if (row.length === 1 && row[0].trim() === '') continue;

    dataRows += 1;

    const title = cleanText(at(row, 'title')) || 'Hevy';
    const startRaw = (at(row, 'start_time') ?? '').trim();
    const endRaw = (at(row, 'end_time') ?? '').trim();

    const start = parseHevyDate(startRaw);

    if (!start) {
      skippedRows += 1;
      issues.push({ code: 'bad-date', line, detail: startRaw || '(empty)' });
      continue;
    }

    const end = parseHevyDate(endRaw) ?? start;

    const exerciseTitle = cleanText(at(row, 'exercise_title'));

    const weightKg = parseNumber(at(row, 'weight_kg'));
    const reps = parseNumber(at(row, 'reps'));
    const distanceKm = parseNumber(at(row, 'distance_km'));
    const durationSeconds = parseNumber(at(row, 'duration_seconds'));

    // A row with no load and no reps carries nothing we could store as a set.
    // Cardio rows do carry something, so they are kept and counted instead.
    if (weightKg === null && reps === null) {
      if (distanceKm === null && durationSeconds === null) {
        skippedRows += 1;
        issues.push({ code: 'empty-set', line, detail: exerciseTitle || '(no exercise)' });
        continue;
      }
    }

    if (distanceKm !== null || durationSeconds !== null) {
      droppedCardioFields += 1;
    }

    const setType = normalizeSetType(at(row, 'set_type'));

    if (!setType.known && !unknownSetTypeReported) {
      unknownSetTypeReported = true;
      issues.push({
        code: 'unknown-set-type',
        line,
        detail: (at(row, 'set_type') ?? '').trim(),
      });
    }

    const key = `${title} ${startRaw}`;
    let workout = workoutsByKey.get(key);

    if (!workout) {
      workout = {
        title,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        description: optionalText(at(row, 'description')),
        exercises: [],
      };
      workoutsByKey.set(key, workout);
      order.push(key);
    }

    // A new block starts whenever the exercise changes. Doing the same exercise
    // twice in one session is two blocks, which is what the export shows.
    let exercise = workout.exercises[workout.exercises.length - 1];

    if (!exercise || exercise.title !== exerciseTitle) {
      exercise = {
        title: exerciseTitle,
        notes: optionalText(at(row, 'exercise_notes')),
        sets: [],
      };
      workout.exercises.push(exercise);
    } else if (!exercise.notes) {
      exercise.notes = optionalText(at(row, 'exercise_notes'));
    }

    exercise.sets.push({
      setNumber: exercise.sets.length + 1,
      setType: setType.type,
      weightKg,
      reps,
      distanceKm,
      durationSeconds,
    });
  }

  const workouts = order
    .map((key) => workoutsByKey.get(key))
    .filter((workout): workout is HevyParsedWorkout => Boolean(workout))
    // Oldest first, so importing reads like training in the order it happened.
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  let exerciseCount = 0;
  let setCount = 0;

  for (const workout of workouts) {
    exerciseCount += workout.exercises.length;
    for (const exercise of workout.exercises) setCount += exercise.sets.length;
  }

  return {
    workouts,
    issues,
    stats: {
      dataRows,
      workouts: workouts.length,
      exercises: exerciseCount,
      sets: setCount,
      skippedRows,
      droppedCardioFields,
    },
  };
}

/** Every distinct exercise name in the file, in the order it first appears. */
export function collectExerciseTitles(result: HevyParseResult): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const workout of result.workouts) {
    for (const exercise of workout.exercises) {
      const key = exercise.title.toLowerCase();
      if (exercise.title.length === 0 || seen.has(key)) continue;
      seen.add(key);
      titles.push(exercise.title);
    }
  }

  return titles;
}
