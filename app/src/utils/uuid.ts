/**
 * Client-side UUID for rows we want to correlate before the round-trip returns.
 *
 * Bulk inserts (e.g. the Hevy import) generate the workout, workout_exercise
 * and set ids up front so children can point at their parents without a second
 * SELECT to read the server-assigned ids back. Postgres accepts a supplied
 * value in place of its `gen_random_uuid()` default.
 *
 * Uses the platform's crypto.randomUUID when present (web, modern Hermes) and
 * falls back to an RFC 4122 v4 string built from Math.random otherwise — good
 * enough for correlating a few hundred rows within one import.
 */
export function generateId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
