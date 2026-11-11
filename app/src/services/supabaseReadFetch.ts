const READ_DEADLINE_MS = 15_000;

// These RPCs use POST for their arguments and only read database state.
const READ_ONLY_RPC_PATHS = new Set([
  'rpc/all_time_personal_records',
  'rpc/exercise_history_page',
  'rpc/exercise_stats_summary',
  'rpc/exercise_training_references',
  'rpc/import_workout_snapshots',
  'rpc/latest_workout_comments',
  'rpc/recent_candidate_activity',
  'rpc/workout_month_buckets',
  'rpc/workout_record_summaries',
]);

export function createSupabaseReadFetch(baseUrl: string): typeof fetch {
  const url = baseUrl.trim();
  const restPrefix = new URL('rest/v1/', url.endsWith('/') ? url : `${url}/`).href;

  return async (input, init) => {
    const method = init?.method ?? 'GET';
    const callerSignal = init?.signal;
    const path = typeof input === 'string' && input.startsWith(restPrefix)
      ? input.slice(restPrefix.length).split('?', 1)[0]
      : '';
    const isRead = path && (method === 'GET' || method === 'HEAD'
      || (method === 'POST' && READ_ONLY_RPC_PATHS.has(path)));
    if (!isRead || callerSignal?.aborted) return fetch(input, init);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, READ_DEADLINE_MS);
    const cancel = () => {
      clearTimeout(timer);
      controller.abort();
    };
    const cleanup = () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', cancel);
    };
    const readError = (error: unknown) =>
      timedOut ? new Error('Data read timed out. Please try again.', { cause: error }) : error;
    callerSignal?.addEventListener('abort', cancel, { once: true });

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (method === 'HEAD' && response.ok) {
        cleanup();
        return response;
      }

      // PostgREST consumes the response through text(), including error bodies.
      // Keep the deadline active until that body has been received.
      const readText = response.text.bind(response);
      response.text = async () => {
        try {
          return await readText();
        } catch (error) {
          throw readError(error);
        } finally {
          cleanup();
        }
      };
      return response;
    } catch (error) {
      cleanup();
      throw readError(error);
    }
  };
}
