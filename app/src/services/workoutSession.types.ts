import type { Tables } from '@/types/database';

export type WorkoutSetType = Exclude<Tables<'sets'>['set_type'], null>;
export type WorkoutSetSide = Tables<'sets'>['side'];

export type WorkoutSetDraft = {
  exerciseId: string | null | undefined;
  setNumber: number | null | undefined;
  weight?: number | null;
  reps?: number | null;
  rir?: number | null;
  setType?: WorkoutSetType | string | null;
  side?: WorkoutSetSide | string | null;
};

export type WorkoutSetProgressDraft = WorkoutSetDraft & {
  completed?: boolean | null;
};

export type CreateWorkoutWithSetsInput = {
  name: string;
  notes?: string | null;
  templateId?: string | null;
  exerciseRestSecondsByExerciseId?: Record<string, number | null | undefined>;
  /** Map of exercise.id → per-workout notes snapshot. */
  notesByExerciseId?: Record<string, string | null | undefined>;
  startTime: string;
  endTime: string;
  setDrafts: WorkoutSetDraft[];
};

export type CreateWorkoutWithSetsResult = {
  workoutId: string;
  insertedSetCount: number;
};

export type FinishWorkoutInput = {
  name: string;
  notes?: string | null;
  templateId?: string | null;
  exerciseRestSecondsByExerciseId?: Record<string, number | null | undefined>;
  notesByExerciseId?: Record<string, string | null | undefined>;
  startTime: string;
  setDrafts: WorkoutSetProgressDraft[];
};

export type FinishWorkoutResult = {
  workoutId: string;
  insertedSetCount: number;
  completedSetCount: number;
  totalVolume: number;
  durationSeconds: number;
  startTime: string;
  endTime: string;
  prCount: number;
};

export type WorkoutSaveValidationCode = 'no-completed-sets' | 'no-valid-set-rows';

export class WorkoutSaveValidationError extends Error {
  readonly code: WorkoutSaveValidationCode;

  constructor(code: WorkoutSaveValidationCode, message: string) {
    super(message);
    this.name = 'WorkoutSaveValidationError';
    this.code = code;
  }
}
