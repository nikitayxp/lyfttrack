import type { Tables } from '@/types/database';

import imageMap from './exerciseImageMap.json';

const FREE_EXERCISE_DB_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

type ExerciseImageSource = Pick<Tables<'exercises'>, 'name' | 'name_en' | 'image_url'>;

const normalizedMap = new Map<string, string>();
for (const [key, value] of Object.entries(imageMap)) {
  normalizedMap.set(key, value as string);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function findBestMatch(name: string): string | null {
  const lower = name.toLowerCase().trim();
  const direct = normalizedMap.get(lower);
  if (direct) return direct;

  const norm = normalize(name);
  for (const [key, id] of normalizedMap) {
    if (normalize(key) === norm) return id;
  }

  for (const [key, id] of normalizedMap) {
    const normKey = normalize(key);
    if (normKey.includes(norm) || norm.includes(normKey)) return id;
  }

  return null;
}

export function getExerciseImageUrl(exercise: ExerciseImageSource): string | null {
  if (exercise.image_url) {
    return exercise.image_url;
  }

  const nameToMatch = exercise.name_en ?? exercise.name;
  const matchId = findBestMatch(nameToMatch);

  if (matchId) {
    return `${FREE_EXERCISE_DB_BASE}/${matchId}/0.jpg`;
  }

  return null;
}
