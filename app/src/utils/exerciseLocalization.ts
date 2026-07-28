import type { AppLanguage } from '@/i18n/resources';
import type { Tables } from '@/types/database';

/**
 * Only the name columns are required to localize a name. Keeping this narrow
 * lets services carry the three columns around instead of resolving a display
 * string too early — resolving early is what leaks English names into a
 * Portuguese UI.
 */
export type ExerciseNameSource = Pick<Tables<'exercises'>, 'name' | 'name_en' | 'name_pt'>;

type ExerciseMuscleSource = Pick<Tables<'exercises'>, 'muscle_group' | 'muscle_en' | 'muscle_pt'>;

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getLocalizedExerciseName(exercise: ExerciseNameSource, language: AppLanguage): string {
  if (language === 'pt') {
    return (
      normalizeText(exercise.name_pt) ??
      normalizeText(exercise.name) ??
      normalizeText(exercise.name_en) ??
      'Exercicio'
    );
  }

  return (
    normalizeText(exercise.name_en) ??
    normalizeText(exercise.name) ??
    normalizeText(exercise.name_pt) ??
    'Exercise'
  );
}

export function getLocalizedExerciseMuscle(exercise: ExerciseMuscleSource, language: AppLanguage): string | null {
  if (language === 'pt') {
    return (
      normalizeText(exercise.muscle_pt) ??
      normalizeText(exercise.muscle_group) ??
      normalizeText(exercise.muscle_en)
    );
  }

  return (
    normalizeText(exercise.muscle_en) ??
    normalizeText(exercise.muscle_group) ??
    normalizeText(exercise.muscle_pt)
  );
}

/**
 * Language-independent identity for deduping exercise lists. Dedupe used to run
 * on the display name, which merged/split entries depending on the active
 * language.
 */
export function exerciseNameKey(exercise: ExerciseNameSource): string {
  return [exercise.name_en, exercise.name, exercise.name_pt]
    .map((value) => normalizeText(value)?.toLowerCase() ?? '')
    .join('|');
}

// Generic over the element so callers can carry extra fields (an id, say)
// through the dedupe instead of resolving them separately afterwards.
export function dedupeExerciseNames<T extends ExerciseNameSource>(exercises: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const exercise of exercises) {
    const key = exerciseNameKey(exercise);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(exercise);
  }

  return unique;
}
