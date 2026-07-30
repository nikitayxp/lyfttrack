import type { AppLanguage } from '@/i18n/resources';
import type { Tables } from '@/types/database';
import { EXERCISE_MUSCLE_LABELS, resolveExerciseMuscleKey } from '@/constants/exerciseCatalog';

/**
 * Catalogue identity is English `name`. Optional `name_pt` is filled later by hand.
 * Muscle labels come from `muscle_group` keys via app i18n — not DB columns.
 */
export type ExerciseNameSource = Pick<Tables<'exercises'>, 'name' | 'name_pt'>;

type ExerciseMuscleSource = Pick<Tables<'exercises'>, 'muscle_group' | 'name' | 'name_pt'>;

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getLocalizedExerciseName(exercise: ExerciseNameSource, language: AppLanguage): string {
  if (language === 'pt') {
    return normalizeText(exercise.name_pt) ?? normalizeText(exercise.name) ?? 'Exercicio';
  }

  return normalizeText(exercise.name) ?? normalizeText(exercise.name_pt) ?? 'Exercise';
}

export function getLocalizedExerciseMuscle(exercise: ExerciseMuscleSource, language: AppLanguage): string | null {
  const key = resolveExerciseMuscleKey({
    muscleGroup: exercise.muscle_group,
    name: exercise.name,
    namePt: exercise.name_pt,
  });

  if (!key) {
    return normalizeText(exercise.muscle_group);
  }

  return language === 'pt' ? EXERCISE_MUSCLE_LABELS[key].pt : EXERCISE_MUSCLE_LABELS[key].en;
}

/**
 * Language-independent identity for deduping exercise lists.
 */
export function exerciseNameKey(exercise: ExerciseNameSource): string {
  return (normalizeText(exercise.name) ?? normalizeText(exercise.name_pt) ?? '').toLowerCase();
}

export function dedupeExerciseNames<T extends ExerciseNameSource>(exercises: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const exercise of exercises) {
    const key = exerciseNameKey(exercise);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(exercise);
  }

  return unique;
}
