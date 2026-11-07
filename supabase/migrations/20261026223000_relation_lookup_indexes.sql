create index if not exists sets_workout_exercise_id_idx
  on public.sets (workout_exercise_id);
create index if not exists workout_exercises_exercise_workout_idx
  on public.workout_exercises (exercise_id, workout_id);
