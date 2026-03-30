import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/workoutService';
import type { Tables, TablesInsert } from '@/types/database';
import { toSafeNumber } from '@/utils/inputValidation';

type BodyMeasurementRowWithMeasured = Pick<
  Tables<'body_measurements'>,
  'id' | 'user_id' | 'weight' | 'measured_at' | 'created_at'
>;

type BodyMeasurementRowWithoutMeasured = Pick<
  Tables<'body_measurements'>,
  'id' | 'user_id' | 'weight' | 'created_at'
>;

type BodyMeasurementRow = BodyMeasurementRowWithMeasured | BodyMeasurementRowWithoutMeasured;

export type BodyMeasurementEntry = {
  id: string;
  user_id: string;
  weight: number;
  created_at: string;
  recorded_at: string;
};

const MAX_HISTORY_ENTRIES = 30;

function normalizeWeightInput(value: number): number {
  const normalized = toSafeNumber(value, {
    min: 0,
    max: 500,
    decimals: 2,
  });

  if (normalized === null) {
    throw new Error('O peso tem de ser um numero valido.');
  }

  if (normalized <= 0) {
    throw new Error('O peso tem de ser superior a 0 kg.');
  }

  if (normalized > 500) {
    throw new Error('O peso tem de ser realista (<= 500 kg).');
  }

  return normalized;
}

function isMissingMeasuredAtColumn(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) {
    return false;
  }

  const normalizedMessage = (error.message ?? '').toLowerCase();

  return (
    error.code === '42703' ||
    (normalizedMessage.includes('measured_at') && normalizedMessage.includes('does not exist'))
  );
}

function toMeasurementEntry(row: BodyMeasurementRow): BodyMeasurementEntry {
  const measuredAt = 'measured_at' in row ? row.measured_at : undefined;

  return {
    id: row.id,
    user_id: row.user_id,
    weight: row.weight,
    created_at: row.created_at,
    recorded_at: measuredAt ?? row.created_at,
  };
}

export async function addWeight(value: number): Promise<BodyMeasurementEntry> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedWeight = normalizeWeightInput(value);

  const baseRow: Pick<TablesInsert<'body_measurements'>, 'user_id' | 'weight'> = {
    user_id: user.id,
    weight: normalizedWeight,
  };

  const rowWithMeasuredAt: TablesInsert<'body_measurements'> = {
    ...baseRow,
    measured_at: new Date().toISOString(),
  };

  const insertWithMeasured = await supabase
    .from('body_measurements')
    .insert(rowWithMeasuredAt)
    .select('id, user_id, weight, measured_at, created_at')
    .single();

  if (!insertWithMeasured.error && insertWithMeasured.data) {
    return toMeasurementEntry(insertWithMeasured.data);
  }

  if (!isMissingMeasuredAtColumn(insertWithMeasured.error)) {
    throw new Error(
      `Nao foi possivel guardar o registo de peso corporal: ${insertWithMeasured.error?.message ?? 'Erro desconhecido.'}`
    );
  }

  const fallbackInsert = await supabase
    .from('body_measurements')
    .insert(baseRow)
    .select('id, user_id, weight, created_at')
    .single();

  if (fallbackInsert.error || !fallbackInsert.data) {
    throw new Error(
      `Nao foi possivel guardar o registo de peso corporal: ${fallbackInsert.error?.message ?? 'Erro desconhecido.'}`
    );
  }

  return toMeasurementEntry(fallbackInsert.data);
}

export async function getWeightHistory(): Promise<BodyMeasurementEntry[]> {
  const user = await getAuthenticatedUserOrThrow();

  const withMeasuredAt = await supabase
    .from('body_measurements')
    .select('id, user_id, weight, measured_at, created_at')
    .eq('user_id', user.id)
    .order('measured_at', { ascending: false })
    .limit(MAX_HISTORY_ENTRIES);

  if (!withMeasuredAt.error) {
    return (withMeasuredAt.data ?? []).map((row) => toMeasurementEntry(row));
  }

  if (!isMissingMeasuredAtColumn(withMeasuredAt.error)) {
    throw new Error(`Nao foi possivel carregar o historico de peso corporal: ${withMeasuredAt.error.message}`);
  }

  const fallbackHistory = await supabase
    .from('body_measurements')
    .select('id, user_id, weight, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_ENTRIES);

  if (fallbackHistory.error) {
    throw new Error(`Nao foi possivel carregar o historico de peso corporal: ${fallbackHistory.error.message}`);
  }

  return (fallbackHistory.data ?? []).map((row) => toMeasurementEntry(row));
}
