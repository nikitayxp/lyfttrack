import type { AllTimePR } from '@/services/statsService';
import type { ExerciseMuscleKey } from '@/constants/exerciseCatalog';
import { getLocalizedExerciseName } from '@/utils/exerciseLocalization';

export type TrophySort = 'recent' | 'weight';
type TrophyOptions = {
  language: string;
  query?: string;
  muscle?: ExerciseMuscleKey | 'all';
  sort?: TrophySort;
  limit?: number;
};

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function selectTrophies(records: AllTimePR[], options: TrophyOptions): AllTimePR[] {
  const query = normalizeSearch(options.query ?? '');
  const matches = records.filter((record) => {
    if (options.muscle && options.muscle !== 'all' && record.muscleKey !== options.muscle) return false;
    const names = [record.exercise.name, record.exercise.name_en, record.exercise.name_pt].filter(Boolean).join(' ');
    return !query || normalizeSearch(names).includes(query);
  });
  matches.sort((a, b) => {
    if (options.sort === 'weight' && a.maxWeight !== b.maxWeight) return b.maxWeight - a.maxWeight;
    const dateDifference = Date.parse(b.achievedAt) - Date.parse(a.achievedAt);
    if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference;
    return getLocalizedExerciseName(a.exercise, options.language.startsWith('pt') ? 'pt' : 'en').localeCompare(getLocalizedExerciseName(b.exercise, options.language.startsWith('pt') ? 'pt' : 'en'));
  });
  return options.limit === undefined ? matches : matches.slice(0, Math.max(0, options.limit));
}

export function formatTrophyDate(value: string, language: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(language.startsWith('pt') ? 'pt-PT' : 'en-GB') : '—';
}

export function trophyShareText(record: AllTimePR, language: string): string {
  return `${getLocalizedExerciseName(record.exercise, language.startsWith('pt') ? 'pt' : 'en')}\n${record.maxWeight} kg · ${formatTrophyDate(record.achievedAt, language)}\nLyftTrack`;
}
