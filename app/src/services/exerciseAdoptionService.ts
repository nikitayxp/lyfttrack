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

export async function adoptForeignCustomExercises(
  rows: ExerciseRow[],
  requiredExerciseIds: readonly string[] = rows.map((row) => row.id),
): Promise<Map<string, ExerciseRow>> {
  const byOriginalId = new Map(rows.map((row) => [row.id, row] as const));
  if (requiredExerciseIds.some((id) => !byOriginalId.has(id))) {
    throw new Error('Unable to copy exercises: source exercises are unavailable');
  }
  const user = await getAuthenticatedUserOrThrow();
  const foreignRows = [...byOriginalId.values()].filter((row) => row.is_custom && row.created_by !== user.id);

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

  const ownByContent = new Map<string, ExerciseRow[]>();
  for (const row of [...(ownRows ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = exerciseContentKey(row);
    ownByContent.set(key, [...(ownByContent.get(key) ?? []), row]);
  }
  const usedIds = new Set(rows.filter((row) => !row.is_custom || row.created_by === user.id).map((row) => row.id));
  const pendingCopies = new Map<string, TablesInsert<'exercises'> & { id: string }>();

  for (const row of foreignRows) {
    const key = exerciseContentKey(row);
    const reusable = ownByContent.get(key)?.find((candidate) => !usedIds.has(candidate.id));
    if (reusable) {
      byOriginalId.set(row.id, reusable);
      usedIds.add(reusable.id);
      continue;
    }

    pendingCopies.set(row.id, {
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

    const createdById = new Map((created ?? []).map((row) => [row.id, row] as const));
    for (const [originalId, copy] of pendingCopies) {
      const ownRow = createdById.get(copy.id);
      if (!ownRow || ownRow.created_by !== user.id || !ownRow.is_custom
        || exerciseContentKey(ownRow) !== exerciseContentKey(byOriginalId.get(originalId)!)) {
        throw new Error('Unable to copy exercises: an owned copy was not returned');
      }
      byOriginalId.set(originalId, ownRow);
    }
  }

  return byOriginalId;
}
