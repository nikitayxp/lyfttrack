export type ExerciseMuscleKey =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core';

export type ExerciseEquipmentKey =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell';

export const EXERCISE_MUSCLE_OPTIONS: readonly ExerciseMuscleKey[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
];

export const EXERCISE_EQUIPMENT_OPTIONS: readonly ExerciseEquipmentKey[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
];

export const EXERCISE_MUSCLE_TRANSLATION_KEY: Record<ExerciseMuscleKey, string> = {
  chest: 'exercise.muscles.chest',
  back: 'exercise.muscles.back',
  legs: 'exercise.muscles.legs',
  shoulders: 'exercise.muscles.shoulders',
  arms: 'exercise.muscles.arms',
  core: 'exercise.muscles.core',
};

export const EXERCISE_MUSCLE_LABELS: Record<ExerciseMuscleKey, { en: string; pt: string }> = {
  chest: { en: 'Chest', pt: 'Peito' },
  back: { en: 'Back', pt: 'Costas' },
  legs: { en: 'Legs', pt: 'Pernas' },
  shoulders: { en: 'Shoulders', pt: 'Ombros' },
  arms: { en: 'Arms', pt: 'Bracos' },
  core: { en: 'Core', pt: 'Core' },
};

export const EXERCISE_EQUIPMENT_TRANSLATION_KEY: Record<ExerciseEquipmentKey, string> = {
  barbell: 'exercise.equipment.barbell',
  dumbbell: 'exercise.equipment.dumbbell',
  machine: 'exercise.equipment.machine',
  cable: 'exercise.equipment.cable',
  bodyweight: 'exercise.equipment.bodyweight',
  kettlebell: 'exercise.equipment.kettlebell',
};

export const EXERCISE_EQUIPMENT_LABELS: Record<ExerciseEquipmentKey, { en: string; pt: string }> = {
  barbell: { en: 'Barbell', pt: 'Barra' },
  dumbbell: { en: 'Dumbbell', pt: 'Halteres' },
  machine: { en: 'Machine', pt: 'Maquina' },
  cable: { en: 'Cable', pt: 'Polia' },
  bodyweight: { en: 'Bodyweight', pt: 'Peso corporal' },
  kettlebell: { en: 'Kettlebell', pt: 'Kettlebell' },
};

const muscleAliasMap: Record<string, ExerciseMuscleKey> = {
  chest: 'chest',
  peito: 'chest',
  back: 'back',
  costas: 'back',
  legs: 'legs',
  pernas: 'legs',
  shoulders: 'shoulders',
  ombros: 'shoulders',
  arms: 'arms',
  bracos: 'arms',
  core: 'core',
};

const equipmentAliasMap: Record<string, ExerciseEquipmentKey> = {
  barbell: 'barbell',
  barra: 'barbell',
  dumbbell: 'dumbbell',
  halteres: 'dumbbell',
  machine: 'machine',
  maquina: 'machine',
  cable: 'cable',
  polia: 'cable',
  bodyweight: 'bodyweight',
  body_weight: 'bodyweight',
  peso_corporal: 'bodyweight',
  'peso corporal': 'bodyweight',
  kettlebell: 'kettlebell',
};

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

export function normalizeMuscleKey(value: string | null | undefined): ExerciseMuscleKey | null {
  if (!value) {
    return null;
  }

  const alias = muscleAliasMap[normalizeLookupKey(value)];
  return alias ?? null;
}

export function normalizeEquipmentKey(value: string | null | undefined): ExerciseEquipmentKey | null {
  if (!value) {
    return null;
  }

  const alias = equipmentAliasMap[normalizeLookupKey(value)];
  return alias ?? null;
}

export function isExerciseMuscleKey(value: string | null | undefined): value is ExerciseMuscleKey {
  return normalizeMuscleKey(value) !== null;
}

export function isExerciseEquipmentKey(value: string | null | undefined): value is ExerciseEquipmentKey {
  return normalizeEquipmentKey(value) !== null;
}

export function getMuscleTranslationKey(value: string | null | undefined): string | null {
  const normalized = normalizeMuscleKey(value);
  return normalized ? EXERCISE_MUSCLE_TRANSLATION_KEY[normalized] : null;
}

export function getEquipmentTranslationKey(value: string | null | undefined): string | null {
  const normalized = normalizeEquipmentKey(value);
  return normalized ? EXERCISE_EQUIPMENT_TRANSLATION_KEY[normalized] : null;
}
