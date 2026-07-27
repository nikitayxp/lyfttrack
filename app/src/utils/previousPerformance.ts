import type { PreviousExercisePerformanceSet } from '@/services/workoutService';

function trimWeightLabel(weight: number): string {
  if (Number.isInteger(weight)) {
    return String(weight);
  }

  return String(Math.round(weight * 100) / 100);
}

/** Hevy-style previous cell: `80 kg × 8` / `80 kg × 8 @2` or `—`. */
export function formatPreviousSetLabel(set: PreviousExercisePerformanceSet | null | undefined): string {
  if (!set) {
    return '—';
  }

  const hasWeight = set.weight != null && Number.isFinite(set.weight) && set.weight > 0;
  const hasReps = set.reps != null && Number.isFinite(set.reps) && set.reps > 0;
  const hasRir = set.rir != null && Number.isFinite(set.rir) && set.rir >= 0;

  if (!hasWeight && !hasReps) {
    return '—';
  }

  const weightPart = hasWeight ? `${trimWeightLabel(set.weight as number)} kg` : '—';
  const repsPart = hasReps ? String(Math.trunc(set.reps as number)) : '—';
  const base = `${weightPart} × ${repsPart}`;
  if (!hasRir) {
    return base;
  }

  const rirPart = Number.isInteger(set.rir as number)
    ? String(set.rir as number)
    : String(Math.round((set.rir as number) * 10) / 10);
  return `${base} @${rirPart}`;
}

export function previousSetForRow(
  previousSets: PreviousExercisePerformanceSet[] | undefined,
  setNumber: number | null | undefined,
  rowIndex: number
): PreviousExercisePerformanceSet | undefined {
  if (!previousSets || previousSets.length === 0) {
    return undefined;
  }

  if (setNumber != null) {
    const byNumber = previousSets.find((entry) => entry.setNumber === setNumber);
    if (byNumber) {
      return byNumber;
    }
  }

  return previousSets[rowIndex];
}

// ponytail: one runnable check
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.assert(formatPreviousSetLabel(undefined) === '—', 'empty previous');
  console.assert(
    formatPreviousSetLabel({ setNumber: 1, weight: 80, reps: 8, rir: null, setType: 'normal' }) === '80 kg × 8',
    '80 kg × 8 previous'
  );
  console.assert(
    formatPreviousSetLabel({ setNumber: 1, weight: 15, reps: 8, rir: 2, setType: 'normal' }) === '15 kg × 8 @2',
    '15 kg × 8 @2 previous'
  );
}
