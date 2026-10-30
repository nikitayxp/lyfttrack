import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/authUserService';
import type { Tables, TablesInsert } from '@/types/database';
import { generateId } from '@/utils/uuid';

type ExerciseRow = Tables<'exercises'>;

function exerciseContentKey(row: ExerciseRow): string {
  return JSON.stringify([
    row.name.trim().toLocaleLowerCase(),
    row.name_en ?? null,
    row.name_pt ?? null,
    row.description ?? null,
    row.equipment ?? null,
    row.image_url ?? null,
    row.muscle_group ?? null,
    row.muscle_en ?? null,
    row.muscle_pt ?? null,
    row.aliases ?? [],
    row.listed ?? true,
  ]);
}

export async function adoptForeignCustomExercises(rows: ExerciseRow[]): Promise<Map<string, ExerciseRow>> {
  const byOriginalId = new Map(rows.map((row) => [row.id, row] as const));
  const user = await getAuthenticatedUserOrThrow();
  const foreignRows = rows.filter((row) => row.is_custom && row.created_by !== user.id);

  if (foreignRows.length === 0) {
    return byOriginalId;
  }

  const { data: ownRows, error: ownError } = await supabase
    .from('exercises')
    .select('*')
    .eq('created_by', user.id)
    .eq('is_custom', true);

  if (ownError) {
    throw new Error(`Unable to load exercises: ${ownError.message}`);
  }

  const ownByContent = new Map((ownRows ?? []).map((row) => [exerciseContentKey(row), row] as const));
  const pendingCopies = new Map<string, TablesInsert<'exercises'>>();

  for (const row of foreignRows) {
    const key = exerciseContentKey(row);
    if (ownByContent.has(key) || pendingCopies.has(key)) {
      continue;
    }

    pendingCopies.set(key, {
      id: generateId(),
      name: row.name,
      name_en: row.name_en,
      name_pt: row.name_pt,
      description: row.description,
      equipment: row.equipment,
      image_url: row.image_url,
      muscle_group: row.muscle_group,
      muscle_en: row.muscle_en,
      muscle_pt: row.muscle_pt,
      aliases: row.aliases ?? [],
      listed: row.listed ?? true,
      created_by: user.id,
      is_custom: true,
    });
  }

  if (pendingCopies.size > 0) {
    const { data: created, error: createError } = await supabase
      .from('exercises')
      .insert([...pendingCopies.values()])
      .select('*');

    if (createError) {
      throw new Error(`Unable to create exercises: ${createError.message}`);
    }

    for (const row of created ?? []) {
      ownByContent.set(exerciseContentKey(row), row);
    }
  }

  for (const row of foreignRows) {
    const ownRow = ownByContent.get(exerciseContentKey(row));
    if (ownRow) {
      byOriginalId.set(row.id, ownRow);
    } else {
      throw new Error('Unable to copy exercises: an owned copy was not returned');
    }
  }

  return byOriginalId;
}
