import type { AppLanguage } from '@/i18n/resources';
import type { Tables } from '@/types/database';

type ExerciseLocalizationSource = Pick<
  Tables<'exercises'>,
  'is_custom' | 'name' | 'name_en' | 'name_pt' | 'muscle_group' | 'muscle_en' | 'muscle_pt' | 'equipment'
>;

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getLocalizedExerciseName(exercise: ExerciseLocalizationSource, language: AppLanguage): string {
  if (exercise.is_custom) {
    return normalizeText(exercise.name) ?? 'Exercise';
  }

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

export function getLocalizedExerciseMuscle(exercise: ExerciseLocalizationSource, language: AppLanguage): string | null {
  if (exercise.is_custom) {
    return normalizeText(exercise.muscle_group);
  }

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
