import { supabase } from '@/services/supabase';

export type WorkoutRecordSummary = {
  workout_id: string;
  exercise_id: string;
  has_history: boolean;
  best_weight: number;
  best_e1rm: number;
};

export async function getWorkoutRecordSummaries(workoutIds: string[]): Promise<WorkoutRecordSummary[]> {
  const ids = [...new Set(workoutIds.map(id => id.trim()).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc('workout_record_summaries', { p_workout_ids: ids });
  if (error) throw new Error(`Unable to load workout records: ${error.message}`);
  return (data ?? []) as WorkoutRecordSummary[];
}
