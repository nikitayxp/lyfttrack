type ExerciseSearchFields = {
  name?: string | null;
  name_en?: string | null;
  name_pt?: string | null;
  muscle_group?: string | null;
  muscle_en?: string | null;
  muscle_pt?: string | null;
};

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** PT/EN nicknames → shared tokens (barra ↔ bar, tbar ↔ t bar). */
function applySearchSynonyms(normalized: string): string {
  return normalized.replace(/\bbarra\b/g, 'bar').replace(/\btbar\b/g, 't bar');
}

function tokenMatchesHaystack(token: string, haystack: string, words: string[]): boolean {
  // Single-letter tokens must be whole words / word prefixes ("t" must not hit "chest").
  if (token.length === 1) {
    return words.some((word) => word === token || word.startsWith(token));
  }

  return haystack.includes(token) || words.some((word) => word.startsWith(token));
}

export function matchesExerciseSearch(
  exercise: ExerciseSearchFields,
  query: string,
  displayName: string,
  displayMuscle: string
): boolean {
  const normalizedQuery = applySearchSynonyms(normalizeSearchText(query));
  if (!normalizedQuery) {
    return true;
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const haystack = applySearchSynonyms(
    normalizeSearchText(
      [
        displayName,
        displayMuscle,
        exercise.name,
        exercise.name_en,
        exercise.name_pt,
        exercise.muscle_group,
        exercise.muscle_en,
        exercise.muscle_pt,
      ]
        .filter(Boolean)
        .join(' ')
    )
  );
  const words = haystack.split(' ').filter(Boolean);

  return tokens.every((token) => tokenMatchesHaystack(token, haystack, words));
}

// ponytail: one runnable check; no test framework in app/
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const tBar = {
    name: 'T-Bar Row',
    name_en: 'T-Bar Row',
    name_pt: 'Remada T-Bar',
    muscle_group: 'Back',
    muscle_en: 'Back',
    muscle_pt: 'Costas',
  };
  const chest = {
    name: 'Chest Press',
    name_en: 'Chest Press',
    name_pt: 'Supino Maquina',
    muscle_group: 'Chest',
    muscle_en: 'Chest',
    muscle_pt: 'Peito',
  };

  console.assert(matchesExerciseSearch(tBar, 'barra t', 'Remada T-Bar', 'Costas'), 'barra t → T-Bar');
  console.assert(matchesExerciseSearch(tBar, 't bar', 'Remada T-Bar', 'Costas'), 't bar → T-Bar');
  console.assert(matchesExerciseSearch(tBar, 'tbar', 'Remada T-Bar', 'Costas'), 'tbar → T-Bar');
  console.assert(!matchesExerciseSearch(chest, 'barra t', 'Supino Maquina', 'Peito'), 'barra t ↛ chest');
}
