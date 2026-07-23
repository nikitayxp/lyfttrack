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
 * Count exercises that set a personal record in `currentSets` vs `previousSets`.
 * First-ever performance of an exercise does NOT count as a PR.
 * A PR is heaviest weight OR better estimated 1RM (covers rep PRs at similar load).
 */
export function countPersonalRecords(
  currentSets: PersonalRecordSetSample[],
  previousSets: PersonalRecordSetSample[]
): number {
  const currentByExercise = groupByExercise(currentSets);
  const previousByExercise = groupByExercise(previousSets);
  let prCount = 0;

  for (const [exerciseId, currentExerciseSets] of currentByExercise) {
    const previousExerciseSets = previousByExercise.get(exerciseId);

    if (!previousExerciseSets || previousExerciseSets.length === 0) {
      continue;
    }

    const currentWeight = bestWeightKg(currentExerciseSets);
    const previousWeight = bestWeightKg(previousExerciseSets);

    if (currentWeight > previousWeight && currentWeight > 0) {
      prCount += 1;
      continue;
    }

    const currentE1rm = bestEstimatedOneRepMax(currentExerciseSets);
    const previousE1rm = bestEstimatedOneRepMax(previousExerciseSets);

    if (currentE1rm > previousE1rm && currentE1rm > 0) {
      prCount += 1;
    }
  }

  return prCount;
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
}
