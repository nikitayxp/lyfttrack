export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

// Match the database: trim surrounding ASCII whitespace and fold A-Z only.
export function normalizeUsername(value: string): string {
  return value
    .replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '')
    .replace(/[A-Z]/g, letter => letter.toLowerCase());
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9._]{3,24}$/.test(value);
}

// The input shows this suggestion before saving; persistence validates strictly.
export function sanitizeUsernameInput(value: string): string {
  return normalizeUsername(value)
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}
