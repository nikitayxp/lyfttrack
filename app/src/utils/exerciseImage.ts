import type { Tables } from '@/types/database';

import imageMap from './exerciseImageMap.json';

const FREE_EXERCISE_DB_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

type ExerciseImageSource = Pick<Tables<'exercises'>, 'name' | 'name_en' | 'name_pt' | 'image_url'>;

const normalizedMap = new Map<string, string>();
for (const [key, value] of Object.entries(imageMap)) {
  normalizedMap.set(key, value as string);
}

// Extra PT / Hevy-style aliases → free-exercise-db ids (gratis, sem API paga).
const aliasMap: Record<string, string> = {
  'elevacao lateral': 'Side_Lateral_Raise',
  'elevacao lateral maquina': 'Side_Lateral_Raise',
  'desenvolvimento de ombros': 'Machine_Shoulder_Military_Press',
  'desenvolvimento de ombros maquina': 'Machine_Shoulder_Military_Press',
  'desenvolvimento de ombros maquina de placas': 'Machine_Shoulder_Military_Press',
  'supino halter': 'Dumbbell_Bench_Press',
  'supino com halter': 'Dumbbell_Bench_Press',
  'supino com halteres': 'Dumbbell_Bench_Press',
  'rosca scott': 'Preacher_Curl',
  'rosca scott halter': 'Preacher_Hammer_Dumbbell_Curl',
  'extensao de triceps unilateral': 'Cable_One_Arm_Tricep_Extension',
  'extensao de triceps unilateral cabo': 'Cable_One_Arm_Tricep_Extension',
  'extensao de triceps acima da cabeca': 'Cable_Rope_Overhead_Triceps_Extension',
  'extensao de triceps acima da cabeca cabo': 'Cable_Rope_Overhead_Triceps_Extension',
  'crucifixo no voador': 'Butterfly',
  'crucifixo na maquina': 'Butterfly',
  'pec deck': 'Butterfly',
  'lateral raise': 'Side_Lateral_Raise',
  'shoulder press machine': 'Machine_Shoulder_Military_Press',
  'dumbbell bench press': 'Dumbbell_Bench_Press',
  'preacher curl': 'Preacher_Curl',
};

for (const [key, value] of Object.entries(aliasMap)) {
  normalizedMap.set(key, value);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestMatch(name: string): string | null {
  const lower = name.toLowerCase().trim();
  const direct = normalizedMap.get(lower);
  if (direct) return direct;

  const norm = normalize(name);
  const alias = normalizedMap.get(norm);
  if (alias) return alias;

  for (const [key, id] of normalizedMap) {
    if (normalize(key) === norm) return id;
  }

  for (const [key, id] of normalizedMap) {
    const normKey = normalize(key);
    if (normKey.length < 4 || norm.length < 4) continue;
    if (normKey.includes(norm) || norm.includes(normKey)) return id;
  }

  return null;
}

export function getExerciseImageUrl(exercise: ExerciseImageSource): string | null {
  if (exercise.image_url) {
    return exercise.image_url;
  }

  const candidates = [exercise.name_en, exercise.name, exercise.name_pt].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );

  for (const candidate of candidates) {
    const matchId = findBestMatch(candidate);
    if (matchId) {
      return `${FREE_EXERCISE_DB_BASE}/${matchId}/0.jpg`;
    }
  }

  return null;
}
