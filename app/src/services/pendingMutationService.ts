import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '@/utils/uuid';

export type PendingMutation = {
  key: string;
  payload: string;
  mutationId: string;
  resultId: string;
};

function storageKey(userId: string, scope: string, payload: string): string {
  let hash = 2166136261;
  let second = 5381;
  for (let index = 0; index < payload.length; index += 1) {
    hash = Math.imul(hash ^ payload.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ payload.charCodeAt(index);
  }
  return `pending-mutation:v1:${userId}:${scope}:${hash >>> 0}:${second >>> 0}`;
}

const queues = new Map<string, Promise<void>>();

function serially<T>(key: string, run: () => Promise<T>): Promise<T> {
  const result = (queues.get(key) ?? Promise.resolve()).then(run);
  const tail = result.then(() => undefined, () => undefined);
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return result;
}

export async function getPendingMutation(userId: string, scope: string, value: unknown): Promise<PendingMutation> {
  const payload = JSON.stringify(value);
  const key = storageKey(userId, scope, payload);
  return serially(key, async () => {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const record = JSON.parse(stored) as PendingMutation;
      if (record.key !== key || record.payload !== payload || !record.mutationId || !record.resultId) {
        throw new Error('Pending save identity is invalid. Retry after restoring local storage.');
      }
      return record;
    }
    const record = { key, payload, mutationId: generateId(), resultId: generateId() };
    await AsyncStorage.setItem(key, JSON.stringify(record));
    return record;
  });
}

export async function completePendingMutation(record: PendingMutation): Promise<void> {
  return serially(record.key, async () => {
    const stored = await AsyncStorage.getItem(record.key);
    if (stored && (JSON.parse(stored) as PendingMutation).mutationId === record.mutationId) {
      await AsyncStorage.removeItem(record.key);
    }
  });
}
