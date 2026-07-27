import type { PreviousExercisePerformanceSet } from '@/services/workoutService';

function trimWeightLabel(weight: number): string {
  if (Number.isInteger(weight)) {
    return String(weight);
  }

  return String(Math.round(weight * 100) / 100);
}

/** Hevy-style previous cell: `80×8` / `100×10@1` or `—`. */
export function formatPreviousSetLabel(set: PreviousExercisePerformanceSet | null | undefined): string {
  if (!set) {
    return '—';
  }

  const hasWeight = set.weight != null && Number.isFinite(set.weight) && set.weight > 0;
  const hasReps = set.reps != null && Number.isFinite(set.reps) && set.reps > 0;
  // Show RIR only when it was actually logged as a positive/zero value that matters;
  // warmups usually leave rir null and should stay as `80×8`.
  const hasRir = set.rir != null && Number.isFinite(set.rir) && set.rir >= 0;

  if (!hasWeight && !hasReps) {
    return '—';
  }

  const weightPart = hasWeight ? trimWeightLabel(set.weight as number) : '—';
  const repsPart = hasReps ? String(Math.trunc(set.reps as number)) : '—';
  const base = `${weightPart}×${repsPart}`;
  if (!hasRir) {
    return base;
  }

  const rirPart = Number.isInteger(set.rir as number)
    ? String(set.rir as number)
    : String(Math.round((set.rir as number) * 10) / 10);
  return `${base}@${rirPart}`;
}

/** Bigger type for short labels (`15×5`), tighter for `100×10@1`. */
export function previousLabelFontSize(label: string): number {
  if (label === '—') {
    return 12;
  }

  const length = label.length;
  if (length <= 4) return 13;
  if (length <= 5) return 12;
  if (length <= 6) return 11;
  if (length <= 8) return 10;
  return 9;
}

/** Cell width hugs the string so short values can breathe. */
export function previousLabelWidth(label: string): number {
  if (label === '—') {
    return 36;
  }

  return Math.min(96, Math.max(40, Math.ceil(label.length * 7.6)));
}

export function previousColumnWidthForSets(
  previousSets: PreviousExercisePerformanceSet[] | undefined,
  rowCount: number,
  setNumbers: Array<number | null | undefined>
): number {
  if (!previousSets || previousSets.length === 0 || rowCount === 0) {
    return 40;
  }

  let maxWidth = 40;
  for (let index = 0; index < rowCount; index += 1) {
    const label = formatPreviousSetLabel(previousSetForRow(previousSets, setNumbers[index], index));
    maxWidth = Math.max(maxWidth, previousLabelWidth(label));
  }

  return maxWidth;
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
    formatPreviousSetLabel({ setNumber: 1, weight: 80, reps: 8, rir: null, setType: 'normal' }) === '80×8',
    '80×8 previous'
  );
  console.assert(
    formatPreviousSetLabel({ setNumber: 1, weight: 100, reps: 10, rir: 1, setType: 'normal' }) === '100×10@1',
    '100×10@1 previous'
  );
  console.assert(previousLabelFontSize('15×5') > previousLabelFontSize('100×10@1'), 'short label bigger type');
  console.assert(previousLabelWidth('15×5') < previousLabelWidth('100×10@1'), 'long label wider cell');
}
