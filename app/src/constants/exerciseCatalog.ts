export type ExerciseMuscleKey =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
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
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
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
  shoulders: 'exercise.muscles.shoulders',
  biceps: 'exercise.muscles.biceps',
  triceps: 'exercise.muscles.triceps',
  forearms: 'exercise.muscles.forearms',
  quadriceps: 'exercise.muscles.quadriceps',
  hamstrings: 'exercise.muscles.hamstrings',
  glutes: 'exercise.muscles.glutes',
  calves: 'exercise.muscles.calves',
  core: 'exercise.muscles.core',
};

export const EXERCISE_MUSCLE_LABELS: Record<ExerciseMuscleKey, { en: string; pt: string }> = {
  chest: { en: 'Chest', pt: 'Peito' },
  back: { en: 'Back', pt: 'Costas' },
  shoulders: { en: 'Shoulders', pt: 'Ombros' },
  biceps: { en: 'Biceps', pt: 'Biceps' },
  triceps: { en: 'Triceps', pt: 'Triceps' },
  forearms: { en: 'Forearms', pt: 'Antebracos' },
  quadriceps: { en: 'Quadriceps', pt: 'Quadriceps' },
  hamstrings: { en: 'Hamstrings', pt: 'Posteriores' },
  glutes: { en: 'Glutes', pt: 'Gluteos' },
  calves: { en: 'Calves', pt: 'Gemeos' },
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
  peito_superior: 'chest',
  upper_chest: 'chest',
  peitoral: 'chest',
  peitorais: 'chest',
  pec: 'chest',
  pecs: 'chest',
  back: 'back',
  costas: 'back',
  dorsal: 'back',
  dorsais: 'back',
  lats: 'back',
  lat: 'back',
  bicep: 'biceps',
  biceps: 'biceps',
  tricep: 'triceps',
  triceps: 'triceps',
  forearm: 'forearms',
  forearms: 'forearms',
  antebraco: 'forearms',
  antebracos: 'forearms',
  quadricep: 'quadriceps',
  quadriceps: 'quadriceps',
  quad: 'quadriceps',
  quads: 'quadriceps',
  hamstring: 'hamstrings',
  hamstrings: 'hamstrings',
  posterior: 'hamstrings',
  posteriores: 'hamstrings',
  posterior_de_coxa: 'hamstrings',
  glute: 'glutes',
  glutes: 'glutes',
  gluteo: 'glutes',
  gluteos: 'glutes',
  calf: 'calves',
  calves: 'calves',
  gemeo: 'calves',
  gemeos: 'calves',
  panturrilha: 'calves',
  panturrilhas: 'calves',
  shoulders: 'shoulders',
  shoulder: 'shoulders',
  ombros: 'shoulders',
  ombro: 'shoulders',
  deltoid: 'shoulders',
  deltoids: 'shoulders',
  core: 'core',
  abs: 'core',
  abdominal: 'core',
  abdominais: 'core',
};

const MUSCLE_INFERENCE_KEYWORDS: Record<ExerciseMuscleKey, readonly string[]> = {
  chest: ['chest', 'peito', 'peitoral', 'pec', 'bench_press', 'supino', 'crossover', 'fly', 'push_up'],
  back: ['back', 'costa', 'dorsal', 'lat', 'row', 'remada', 'puxada', 'pulldown', 'pull_up', 'chin_up', 'deadlift', 'terra'],
  shoulders: ['shoulder', 'ombro', 'deltoid', 'delt', 'desenvolvimento', 'arnold_press', 'lateral_raise', 'front_raise', 'rear_delt', 'upright_row', 'face_pull'],
  biceps: ['bicep', 'biceps', 'curl', 'rosca', 'preacher', 'scott', 'concentration_curl', 'hammer_curl'],
  triceps: ['tricep', 'triceps', 'pushdown', 'pulley', 'testa', 'skull_crusher', 'overhead_triceps', 'supino_fechado', 'close_grip_bench', 'bench_dip', 'corda'],
  forearms: ['forearm', 'forearms', 'antebraco', 'antebracos', 'wrist_curl', 'reverse_curl', 'grip'],
  quadriceps: ['quadriceps', 'quadricep', 'quad', 'squat', 'agachamento', 'lunge', 'avanco', 'leg_press', 'hack_squat', 'leg_extension', 'extensora', 'split_squat', 'goblet_squat'],
  hamstrings: ['hamstring', 'posterior', 'posteriores', 'romeno', 'romanian_deadlift', 'stiff', 'leg_curl', 'mesa_flexora', 'good_morning', 'nordic'],
  glutes: ['glute', 'gluteo', 'gluteos', 'hip_thrust', 'glute_bridge', 'ponte_de_gluteo', 'kickback', 'abducao'],
  calves: ['calf', 'calves', 'gemeo', 'gemeos', 'panturrilha', 'panturrilhas', 'calf_raise', 'elevacao_de_gemeos'],
  core: ['core', 'abs', 'abdominal', 'abdominais', 'prancha', 'plank', 'crunch', 'ab_wheel', 'russian_twist', 'dead_bug', 'mountain_climber'],
};

const MUSCLE_INFERENCE_PRIORITY: readonly ExerciseMuscleKey[] = [
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'shoulders',
  'chest',
  'back',
  'core',
];

const equipmentAliasMap: Record<string, ExerciseEquipmentKey> = {
  barbell: 'barbell',
  barra: 'barbell',
  olympic_barbell: 'barbell',
  dumbbell: 'dumbbell',
  dumbell: 'dumbbell',
  halteres: 'dumbbell',
  halter: 'dumbbell',
  machine: 'machine',
  maquina: 'machine',
  smith_machine: 'machine',
  cable: 'cable',
  polia: 'cable',
  bodyweight: 'bodyweight',
  body_weight: 'bodyweight',
  peso_corporal: 'bodyweight',
  'peso corporal': 'bodyweight',
  sem_equipamento: 'bodyweight',
  calistenia: 'bodyweight',
  kettlebell: 'kettlebell',
};

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function collectNormalizedCandidates(values: (string | null | undefined)[]): string[] {
  const candidates: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized = normalizeLookupKey(value);

    if (!normalized || candidates.includes(normalized)) {
      continue;
    }

    candidates.push(normalized);
  }

  return candidates;
}

function inferMuscleKeyFromCandidates(candidates: readonly string[]): ExerciseMuscleKey | null {
  if (candidates.length === 0) {
    return null;
  }

  for (const muscleKey of MUSCLE_INFERENCE_PRIORITY) {
    const keywords = MUSCLE_INFERENCE_KEYWORDS[muscleKey];

    for (const candidate of candidates) {
      if (keywords.some((keyword) => candidate.includes(keyword))) {
        return muscleKey;
      }
    }
  }

  return null;
}

export type ExerciseMuscleInferenceInput = {
  muscleGroup?: string | null;
  muscleEn?: string | null;
  musclePt?: string | null;
  name?: string | null;
  nameEn?: string | null;
  namePt?: string | null;
};

export function normalizeMuscleKey(value: string | null | undefined): ExerciseMuscleKey | null {
  if (!value) {
    return null;
  }

  const alias = muscleAliasMap[normalizeLookupKey(value)];
  return alias ?? null;
}

export function resolveExerciseMuscleKey(input: ExerciseMuscleInferenceInput): ExerciseMuscleKey | null {
  const directCandidates = [input.muscleGroup, input.muscleEn, input.musclePt];

  for (const candidate of directCandidates) {
    const directMatch = normalizeMuscleKey(candidate);

    if (directMatch) {
      return directMatch;
    }
  }

  const inferenceCandidates = collectNormalizedCandidates([
    input.muscleGroup,
    input.muscleEn,
    input.musclePt,
    input.name,
    input.nameEn,
    input.namePt,
  ]);

  return inferMuscleKeyFromCandidates(inferenceCandidates);
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

export function getExerciseMuscleTranslationKey(input: ExerciseMuscleInferenceInput): string | null {
  const normalized = resolveExerciseMuscleKey(input);
  return normalized ? EXERCISE_MUSCLE_TRANSLATION_KEY[normalized] : null;
}

export function getEquipmentTranslationKey(value: string | null | undefined): string | null {
  const normalized = normalizeEquipmentKey(value);
  return normalized ? EXERCISE_EQUIPMENT_TRANSLATION_KEY[normalized] : null;
}
