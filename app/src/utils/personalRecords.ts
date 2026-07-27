export type PersonalRecordSetSample = {
  exerciseId: string;
  weight: number | null;
  reps: number | null;
};

function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) {
    return null;
  }

  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
    return null;
  }

  return weight * (1 + reps / 30);
}

function groupByExercise(sets: PersonalRecordSetSample[]): Map<string, PersonalRecordSetSample[]> {
  const grouped = new Map<string, PersonalRecordSetSample[]>();

  for (const setItem of sets) {
    const exerciseId = setItem.exerciseId.trim();
    if (!exerciseId) {
      continue;
    }

    const current = grouped.get(exerciseId) ?? [];
    current.push(setItem);
    grouped.set(exerciseId, current);
  }

  return grouped;
}

export type PersonalBest = {
  bestWeight: number;
  bestE1rm: number;
};

export const EMPTY_PERSONAL_BEST: PersonalBest = { bestWeight: 0, bestE1rm: 0 };

/** The all-time numbers an exercise has to beat to count as a record. */
export function summarizePersonalBest(sets: PersonalRecordSetSample[]): PersonalBest {
  return {
    bestWeight: bestWeightKg(sets),
    bestE1rm: bestEstimatedOneRepMax(sets),
  };
}

/**
 * Whether one set beats a stored best, by the same rule the finish-screen count
 * uses. Kept here so an in-workout hint and the final tally cannot disagree.
 */
export function isRecordSet(
  set: Pick<PersonalRecordSetSample, 'weight' | 'reps'>,
  best: PersonalBest
): boolean {
  // No history means no record: a first-ever performance is not a PR, matching
  // findPersonalRecordExerciseIds.
  if (best.bestWeight <= 0 && best.bestE1rm <= 0) {
    return false;
  }

  const weight = set.weight ?? 0;

  if (Number.isFinite(weight) && weight > best.bestWeight && weight > 0) {
    return true;
  }

  const e1rm = estimateOneRepMax(set.weight, set.reps);

  return e1rm != null && e1rm > best.bestE1rm && e1rm > 0;
}

/** Fold one more set into a best, so a later lighter set cannot re-claim it. */
export function mergePersonalBest(
  best: PersonalBest,
  set: Pick<PersonalRecordSetSample, 'weight' | 'reps'>
): PersonalBest {
  const weight = set.weight ?? 0;
  const e1rm = estimateOneRepMax(set.weight, set.reps) ?? 0;

  return {
    bestWeight: Math.max(best.bestWeight, Number.isFinite(weight) ? weight : 0),
    bestE1rm: Math.max(best.bestE1rm, e1rm),
  };
}

function bestWeightKg(sets: PersonalRecordSetSample[]): number {
  let max = 0;

  for (const setItem of sets) {
    if (setItem.weight != null && Number.isFinite(setItem.weight) && setItem.weight > max) {
      max = setItem.weight;
    }
  }

  return max;
}

function bestEstimatedOneRepMax(sets: PersonalRecordSetSample[]): number {
  let max = 0;

  for (const setItem of sets) {
    const estimated = estimateOneRepMax(setItem.weight, setItem.reps);
    if (estimated != null && estimated > max) {
      max = estimated;
    }
  }

  return max;
}

/**
 * Which exercises set a personal record in `currentSets` vs `previousSets`.
 * First-ever performance of an exercise does NOT count as a PR.
 * A PR is heaviest weight OR better estimated 1RM (covers rep PRs at similar load).
 */
export function findPersonalRecordExerciseIds(
  currentSets: PersonalRecordSetSample[],
  previousSets: PersonalRecordSetSample[]
): string[] {
  const currentByExercise = groupByExercise(currentSets);
  const previousByExercise = groupByExercise(previousSets);
  const recordExerciseIds: string[] = [];

  for (const [exerciseId, currentExerciseSets] of currentByExercise) {
    const previousExerciseSets = previousByExercise.get(exerciseId);

    if (!previousExerciseSets || previousExerciseSets.length === 0) {
      continue;
    }

    const currentWeight = bestWeightKg(currentExerciseSets);
    const previousWeight = bestWeightKg(previousExerciseSets);

    if (currentWeight > previousWeight && currentWeight > 0) {
      recordExerciseIds.push(exerciseId);
      continue;
    }

    const currentE1rm = bestEstimatedOneRepMax(currentExerciseSets);
    const previousE1rm = bestEstimatedOneRepMax(previousExerciseSets);

    if (currentE1rm > previousE1rm && currentE1rm > 0) {
      recordExerciseIds.push(exerciseId);
    }
  }

  return recordExerciseIds;
}

/**
 * Kept as the count-only view of the same answer, so the number shown on a card
 * and the exercises marked on the summary can never disagree.
 */
export function countPersonalRecords(
  currentSets: PersonalRecordSetSample[],
  previousSets: PersonalRecordSetSample[]
): number {
  return findPersonalRecordExerciseIds(currentSets, previousSets).length;
}

// ponytail: one runnable check
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const prev = [{ exerciseId: 'squat', weight: 100, reps: 5 }];
  const heavier = [{ exerciseId: 'squat', weight: 105, reps: 5 }];
  const moreReps = [{ exerciseId: 'squat', weight: 100, reps: 6 }];
  const firstTime = [{ exerciseId: 'bench', weight: 60, reps: 8 }];

  console.assert(countPersonalRecords(heavier, prev) === 1, 'heavier weight is PR');
  console.assert(countPersonalRecords(moreReps, prev) === 1, 'more reps is PR via e1rm');
  console.assert(countPersonalRecords(firstTime, prev) === 0, 'first exercise is not PR');
  console.assert(countPersonalRecords(prev, []) === 0, 'no history is not PR');
  console.assert(
    findPersonalRecordExerciseIds(heavier, prev).join() === 'squat',
    'names the exercise that set the record'
  );
}
