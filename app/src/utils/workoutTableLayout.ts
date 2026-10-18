export const WORKOUT_TABLE_COLUMNS = {
  set: 38,
  weight: 52,
  reps: 40,
  rir: 40,
  complete: 44,
  gap: 4,
  padding: 2,
} as const;

export function getWorkoutTableLayout(rowWidth: number, previousWidth: number) {
  const columns = WORKOUT_TABLE_COLUMNS;
  const compactWidth = columns.set + columns.weight + columns.reps + columns.rir
    + columns.complete + columns.gap * 4 + columns.padding * 2;
  const inlineWidth = compactWidth + previousWidth + columns.gap;
  const stackPrevious = rowWidth < inlineWidth;

  return { stackPrevious, minimumWidth: stackPrevious ? compactWidth : inlineWidth };
}
