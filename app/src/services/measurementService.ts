import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/workoutService';
import type { Tables, TablesInsert } from '@/types/database';
import { BODY_WEIGHT_MAX_KG, BODY_WEIGHT_MIN_KG, toSafeNumber } from '@/utils/inputValidation';

type BodyMeasurementRowWithMeasured = Pick<
  Tables<'body_measurements'>,
  'id' | 'user_id' | 'weight' | 'measured_at' | 'created_at'
>;

type BodyMeasurementRowWithoutMeasured = Pick<
  Tables<'body_measurements'>,
  'id' | 'user_id' | 'weight' | 'created_at'
>;

type BodyMeasurementRow = BodyMeasurementRowWithMeasured | BodyMeasurementRowWithoutMeasured;

type MeasurementServiceError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type BodyMeasurementEntry = {
  id: string;
  user_id: string;
  weight: number;
  created_at: string;
  recorded_at: string;
};

const MAX_HISTORY_ENTRIES = 30;
const WEIGHT_TRACE_PREFIX = '[weight-save-trace]';
export { BODY_WEIGHT_MAX_KG };

function createWeightTraceId(scope: 'add' | 'history'): string {
  return `${scope}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendTraceId(message: string, traceId?: string): string {
  if (!traceId) {
    return message;
  }

  return `${message} [trace:${traceId}]`;
}

function logWeightTrace(stage: string, payload: Record<string, unknown>): void {
  console.info(`${WEIGHT_TRACE_PREFIX} ${stage}`, payload);
}

export function parseBodyWeightInput(value: unknown): number {
  const normalized = toSafeNumber(value, {
    min: BODY_WEIGHT_MIN_KG,
    decimals: 2,
  });

  if (normalized === null) {
    throw new Error('O peso tem de ser um numero valido.');
  }

  if (normalized <= 0) {
    throw new Error('O peso tem de ser superior a 0 kg.');
  }

  if (normalized > BODY_WEIGHT_MAX_KG) {
    throw new Error(`O peso tem de ser realista (<= ${BODY_WEIGHT_MAX_KG} kg).`);
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

function isRlsOrPermissionError(error: MeasurementServiceError | null): boolean {
  if (!error) {
    return false;
  }

  const normalizedMessage = (error.message ?? '').toLowerCase();

  return (
    error.code === '42501' ||
    normalizedMessage.includes('row-level security') ||
    normalizedMessage.includes('permission denied')
  );
}

function isUniqueViolationError(error: MeasurementServiceError | null): boolean {
  return error?.code === '23505';
}

function logMeasurementError(
  operation: string,
  error: MeasurementServiceError | null,
  context: Record<string, unknown>
): void {
  if (!error) {
    return;
  }

  console.error(`[measurementService] ${operation} failed`, {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    ...context,
  });
}

function toWeightWriteErrorMessage(error: MeasurementServiceError | null, traceId?: string): string {
  if (isRlsOrPermissionError(error)) {
    return appendTraceId('Nao foi possivel guardar o registo de peso corporal por falta de permissao (RLS 42501).', traceId);
  }

  const codeSuffix = error?.code ? ` (codigo ${error.code})` : '';
  return appendTraceId(
    `Nao foi possivel guardar o registo de peso corporal${codeSuffix}: ${error?.message ?? 'Erro desconhecido.'}`,
    traceId
  );
}

function toWeightHistoryErrorMessage(error: MeasurementServiceError | null, traceId?: string): string {
  if (isRlsOrPermissionError(error)) {
    return appendTraceId('Nao foi possivel carregar o historico de peso corporal por falta de permissao (RLS 42501).', traceId);
  }

  const codeSuffix = error?.code ? ` (codigo ${error.code})` : '';
  return appendTraceId(
    `Nao foi possivel carregar o historico de peso corporal${codeSuffix}: ${error?.message ?? 'Erro desconhecido.'}`,
    traceId
  );
}

function createLocalMeasurementEntry(userId: string, weight: number, recordedAt: string): BodyMeasurementEntry {
  return {
    id: `local-${recordedAt}`,
    user_id: userId,
    weight,
    created_at: recordedAt,
    recorded_at: recordedAt,
  };
}

function normalizeMeasurementWeight(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

async function tryUpdateExistingMeasurementOrNull(
  userId: string,
  normalizedWeight: number,
  recordedAt: string,
  traceId?: string
): Promise<BodyMeasurementEntry | null> {
  const updateWithMeasured = await supabase
    .from('body_measurements')
    .update(
      {
        weight: normalizedWeight,
        measured_at: recordedAt,
      },
      {
        count: 'exact',
      }
    )
    .eq('user_id', userId);

  if (!updateWithMeasured.error) {
    if ((updateWithMeasured.count ?? 0) > 0) {
      logWeightTrace('addWeight_recover_update_with_measured_at_ok', {
        traceId,
        userId,
        count: updateWithMeasured.count ?? null,
      });

      return loadLatestMeasurementEntryOrFallback(userId, normalizedWeight, recordedAt, traceId);
    }

    return null;
  }

  if (!isMissingMeasuredAtColumn(updateWithMeasured.error)) {
    logMeasurementError('update_existing_with_measured_at', updateWithMeasured.error, {
      userId,
      weight: normalizedWeight,
      traceId,
    });

    throw new Error(toWeightWriteErrorMessage(updateWithMeasured.error, traceId));
  }

  const updateWithoutMeasured = await supabase
    .from('body_measurements')
    .update(
      {
        weight: normalizedWeight,
      },
      {
        count: 'exact',
      }
    )
    .eq('user_id', userId);

  if (updateWithoutMeasured.error) {
    logMeasurementError('update_existing_without_measured_at', updateWithoutMeasured.error, {
      userId,
      weight: normalizedWeight,
      traceId,
    });

    throw new Error(toWeightWriteErrorMessage(updateWithoutMeasured.error, traceId));
  }

  if ((updateWithoutMeasured.count ?? 0) <= 0) {
    return null;
  }

  logWeightTrace('addWeight_recover_update_without_measured_at_ok', {
    traceId,
    userId,
    count: updateWithoutMeasured.count ?? null,
  });

  return loadLatestMeasurementEntryOrFallback(userId, normalizedWeight, recordedAt, traceId);
}

async function loadLatestMeasurementEntryOrFallback(
  userId: string,
  normalizedWeight: number,
  recordedAt: string,
  traceId?: string
): Promise<BodyMeasurementEntry> {
  const withMeasuredAt = await supabase
    .from('body_measurements')
    .select('id, user_id, weight, measured_at, created_at')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!withMeasuredAt.error && withMeasuredAt.data) {
    logWeightTrace('addWeight_readback_with_measured_at_ok', {
      traceId,
      userId,
      entryId: withMeasuredAt.data.id,
    });

    return toMeasurementEntry(withMeasuredAt.data);
  }

  if (withMeasuredAt.error && !isMissingMeasuredAtColumn(withMeasuredAt.error)) {
    logMeasurementError('readback_with_measured_at', withMeasuredAt.error, {
      userId,
      traceId,
    });

    logWeightTrace('addWeight_readback_with_measured_at_fallback_local', {
      traceId,
      userId,
      reason: withMeasuredAt.error.code ?? withMeasuredAt.error.message ?? 'unknown',
    });

    return createLocalMeasurementEntry(userId, normalizedWeight, recordedAt);
  }

  const withoutMeasuredAt = await supabase
    .from('body_measurements')
    .select('id, user_id, weight, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (withoutMeasuredAt.error || !withoutMeasuredAt.data) {
    logMeasurementError('readback_without_measured_at', withoutMeasuredAt.error, {
      userId,
      traceId,
    });

    logWeightTrace('addWeight_readback_without_measured_at_fallback_local', {
      traceId,
      userId,
      reason: withoutMeasuredAt.error?.code ?? withoutMeasuredAt.error?.message ?? 'no_data',
    });

    return createLocalMeasurementEntry(userId, normalizedWeight, recordedAt);
  }

  logWeightTrace('addWeight_readback_without_measured_at_ok', {
    traceId,
    userId,
    entryId: withoutMeasuredAt.data.id,
  });

  return toMeasurementEntry(withoutMeasuredAt.data);
}

function toMeasurementEntry(row: BodyMeasurementRow): BodyMeasurementEntry {
  const measuredAt = 'measured_at' in row ? row.measured_at : undefined;
  const normalizedWeight = normalizeMeasurementWeight((row as { weight: unknown }).weight);

  return {
    id: row.id,
    user_id: row.user_id,
    weight: normalizedWeight,
    created_at: row.created_at,
    recorded_at: measuredAt ?? row.created_at,
  };
}

export async function addWeight(value: number): Promise<BodyMeasurementEntry> {
  const traceId = createWeightTraceId('add');
  const user = await getAuthenticatedUserOrThrow();
  const normalizedWeight = parseBodyWeightInput(value);
  const writeTimestamp = new Date().toISOString();

  logWeightTrace('addWeight_start', {
    traceId,
    userId: user.id,
    inputWeight: value,
    normalizedWeight,
    writeTimestamp,
  });

  const baseRow: Pick<TablesInsert<'body_measurements'>, 'user_id' | 'weight'> = {
    user_id: user.id,
    weight: normalizedWeight,
  };

  const rowWithMeasuredAt: TablesInsert<'body_measurements'> = {
    ...baseRow,
    measured_at: writeTimestamp,
  };

  const insertWithMeasured = await supabase
    .from('body_measurements')
    .insert(rowWithMeasuredAt);

  if (!insertWithMeasured.error) {
    logWeightTrace('addWeight_insert_with_measured_at_ok', {
      traceId,
      userId: user.id,
    });

    return loadLatestMeasurementEntryOrFallback(user.id, normalizedWeight, writeTimestamp, traceId);
  }

  if (!isMissingMeasuredAtColumn(insertWithMeasured.error)) {
    logMeasurementError('insert_with_measured_at', insertWithMeasured.error, {
      userId: user.id,
      weight: normalizedWeight,
      traceId,
    });

    if (isUniqueViolationError(insertWithMeasured.error) || isRlsOrPermissionError(insertWithMeasured.error)) {
      const recoveredEntry = await tryUpdateExistingMeasurementOrNull(user.id, normalizedWeight, writeTimestamp, traceId);

      if (recoveredEntry) {
        logWeightTrace('addWeight_recovered_via_update_after_insert_error', {
          traceId,
          userId: user.id,
          insertErrorCode: insertWithMeasured.error.code ?? null,
        });

        return recoveredEntry;
      }
    }

    throw new Error(toWeightWriteErrorMessage(insertWithMeasured.error, traceId));
  }

  console.warn('[measurementService] measured_at column missing. Retrying insert without measured_at.', {
    userId: user.id,
    weight: normalizedWeight,
    code: insertWithMeasured.error.code ?? null,
    message: insertWithMeasured.error.message ?? null,
    traceId,
  });

  const fallbackInsert = await supabase
    .from('body_measurements')
    .insert(baseRow);

  if (fallbackInsert.error) {
    logMeasurementError('insert_without_measured_at', fallbackInsert.error, {
      userId: user.id,
      weight: normalizedWeight,
      traceId,
    });

    if (isUniqueViolationError(fallbackInsert.error) || isRlsOrPermissionError(fallbackInsert.error)) {
      const recoveredEntry = await tryUpdateExistingMeasurementOrNull(user.id, normalizedWeight, writeTimestamp, traceId);

      if (recoveredEntry) {
        logWeightTrace('addWeight_recovered_via_update_after_fallback_insert_error', {
          traceId,
          userId: user.id,
          insertErrorCode: fallbackInsert.error.code ?? null,
        });

        return recoveredEntry;
      }
    }

    throw new Error(toWeightWriteErrorMessage(fallbackInsert.error, traceId));
  }

  logWeightTrace('addWeight_insert_without_measured_at_ok', {
    traceId,
    userId: user.id,
  });

  return loadLatestMeasurementEntryOrFallback(user.id, normalizedWeight, writeTimestamp, traceId);
}

export async function getWeightHistory(): Promise<BodyMeasurementEntry[]> {
  const traceId = createWeightTraceId('history');
  const user = await getAuthenticatedUserOrThrow();

  logWeightTrace('history_start', {
    traceId,
    userId: user.id,
  });

  const withMeasuredAt = await supabase
    .from('body_measurements')
    .select('id, user_id, weight, measured_at, created_at')
    .eq('user_id', user.id)
    .order('measured_at', { ascending: false })
    .limit(MAX_HISTORY_ENTRIES);

  if (!withMeasuredAt.error) {
    const history = (withMeasuredAt.data ?? []).map((row) => toMeasurementEntry(row));

    logWeightTrace('history_with_measured_at_ok', {
      traceId,
      userId: user.id,
      count: history.length,
    });

    return history;
  }

  if (!isMissingMeasuredAtColumn(withMeasuredAt.error)) {
    logMeasurementError('history_with_measured_at', withMeasuredAt.error, {
      userId: user.id,
      traceId,
    });

    throw new Error(toWeightHistoryErrorMessage(withMeasuredAt.error, traceId));
  }

  console.warn('[measurementService] measured_at column missing. Loading history ordered by created_at.', {
    userId: user.id,
    code: withMeasuredAt.error.code ?? null,
    message: withMeasuredAt.error.message ?? null,
    traceId,
  });

  const fallbackHistory = await supabase
    .from('body_measurements')
    .select('id, user_id, weight, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_ENTRIES);

  if (fallbackHistory.error) {
    logMeasurementError('history_without_measured_at', fallbackHistory.error, {
      userId: user.id,
      traceId,
    });

    throw new Error(toWeightHistoryErrorMessage(fallbackHistory.error, traceId));
  }

  const history = (fallbackHistory.data ?? []).map((row) => toMeasurementEntry(row));

  logWeightTrace('history_without_measured_at_ok', {
    traceId,
    userId: user.id,
    count: history.length,
  });

  return history;
}
