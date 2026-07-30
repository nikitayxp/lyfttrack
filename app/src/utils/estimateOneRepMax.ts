/**
 * Epley 1RM. When RIR is logged, treat reps as effective reps to failure:
 * 3 reps @ 1 RIR ≈ 4 reps @ 0 RIR.
 */
export function estimateOneRepMax(
  weight: number | null | undefined,
  reps: number | null | undefined,
  rir?: number | null
): number {
  if (
    weight === null ||
    weight === undefined ||
    reps === null ||
    reps === undefined ||
    !Number.isFinite(weight) ||
    !Number.isFinite(reps) ||
    weight <= 0 ||
    reps <= 0
  ) {
    return 0;
  }

  const effectiveReps =
    rir !== null && rir !== undefined && Number.isFinite(rir) && rir >= 0
      ? reps + rir
      : reps;

  return weight * (1 + effectiveReps / 30);
}
