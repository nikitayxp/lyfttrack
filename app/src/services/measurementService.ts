import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/workoutService';
import type { Tables, TablesInsert } from '@/types/database';

export type BodyMeasurementEntry = Pick<
  Tables<'body_measurements'>,
  'id' | 'user_id' | 'weight_kg' | 'measured_at' | 'created_at'
>;

const MAX_HISTORY_ENTRIES = 30;

function normalizeWeightInput(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Weight must be a valid number.');
  }

  const normalized = Number(value.toFixed(2));

  if (normalized <= 0) {
    throw new Error('Weight must be greater than 0 kg.');
  }

  if (normalized > 500) {
    throw new Error('Weight must be realistic (<= 500 kg).');
  }

  return normalized;
}

export async function addWeight(value: number): Promise<BodyMeasurementEntry> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedWeight = normalizeWeightInput(value);

  const row: TablesInsert<'body_measurements'> = {
    user_id: user.id,
    weight_kg: normalizedWeight,
    measured_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('body_measurements')
    .insert(row)
    .select('id, user_id, weight_kg, measured_at, created_at')
    .single();

  if (error || !data) {
    throw new Error(`Unable to save bodyweight entry: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

export async function getWeightHistory(): Promise<BodyMeasurementEntry[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, user_id, weight_kg, measured_at, created_at')
    .eq('user_id', user.id)
    .order('measured_at', { ascending: false })
    .limit(MAX_HISTORY_ENTRIES);

  if (error) {
    throw new Error(`Unable to load bodyweight history: ${error.message}`);
  }

  return data ?? [];
}
