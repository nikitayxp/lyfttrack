import type { Tables } from '@/types/database';

/** Fields that can also be returned from a base-table insert. */
export const EXERCISE_PUBLIC_COLUMNS = 'id,name,name_en,name_pt,listed,muscle_group,muscle_en,muscle_pt,equipment,is_custom,image_url,created_by' as const;

type PublicExercise = Omit<Tables<'exercises'>, 'description' | 'aliases'>;

export function exerciseWithEmptyPrivateFields(exercise: PublicExercise): Tables<'exercises'> {
  return { ...exercise, description: null, aliases: [] };
}
