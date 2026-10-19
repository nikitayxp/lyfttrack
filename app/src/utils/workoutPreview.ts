import type { WorkoutFeedExerciseGroup } from '@/services/workoutService';
import { getLocalizedExerciseName } from '@/utils/exerciseLocalization';

export function summarizeExercisePreview(
  group: WorkoutFeedExerciseGroup,
  language: 'pt' | 'en',
  workingOnly: boolean,
) {
  const sets = workingOnly ? group.sets.filter((set) => set.set_type !== 'warmup') : group.sets;
  const valid = sets.filter(
    (set) =>
      set.set_type !== 'warmup' &&
      Number.isFinite(set.weight) &&
      Number.isFinite(set.reps) &&
      (set.weight ?? -1) >= 0 &&
      (set.reps ?? 0) > 0,
  );
  const best = valid.reduce<(typeof valid)[number] | null>((current, set) => {
    if (
      !current ||
      (set.weight ?? 0) > (current.weight ?? 0) ||
      (set.weight === current.weight && (set.reps ?? 0) > (current.reps ?? 0))
    )
      return set;
    return current;
  }, null);
  return {
    name: getLocalizedExerciseName(
      { name: group.exercise_name, name_en: group.name_en, name_pt: group.name_pt },
      language,
    ),
    setCount: sets.length,
    weight: best?.weight ?? null,
    reps: best?.reps ?? null,
  };
}
