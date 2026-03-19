export const INPUT_LIMITS = {
  weightMax: 1000,
  repsMax: 1000,
  rirMax: 10,
  setNumberMax: 100,
  bioMax: 300,
  nameMax: 100,
  notesMax: 300,
  commentMax: 1000,
} as const;

export const BODY_WEIGHT_MIN_KG = 0;
export const BODY_WEIGHT_MAX_KG = 500;

type NumericOptions = {
  min?: number;
  max?: number;
  decimals?: number;
};

type TextOptions = {
  maxLength: number;
  allowEmpty?: boolean;
  stripTags?: boolean;
};

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

export function sanitizeDecimalText(value: string): string {
  const normalized = value.replace(/,/g, '.');
  const digitsAndDot = normalized.replace(/[^0-9.]/g, '');
  const [head, ...tail] = digitsAndDot.split('.');

  if (tail.length === 0) {
    return head;
  }

  return `${head}.${tail.join('')}`;
}

export function sanitizeIntegerText(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function sanitizeText(value: string | null | undefined, options: TextOptions): string | null {
  const allowEmpty = options.allowEmpty ?? false;
  const stripTags = options.stripTags ?? true;

  let normalized = typeof value === 'string' ? value : '';

  if (stripTags) {
    normalized = stripHtmlTags(normalized);
  }

  normalized = normalized.trim();

  if (options.maxLength > 0 && normalized.length > options.maxLength) {
    normalized = normalized.substring(0, options.maxLength).trim();
  }

  if (!allowEmpty && normalized.length === 0) {
    return null;
  }

  return normalized.length > 0 ? normalized : null;
}

export function toSafeNumber(value: unknown, options: NumericOptions = {}): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(',', '.').trim());

  if (!Number.isFinite(parsed)) {
    return null;
  }

  let normalized = parsed;

  if (typeof options.decimals === 'number' && options.decimals >= 0) {
    const factor = 10 ** options.decimals;
    normalized = Math.round(normalized * factor) / factor;
  }

  if (typeof options.min === 'number') {
    normalized = Math.max(options.min, normalized);
  }

  if (typeof options.max === 'number') {
    normalized = Math.min(options.max, normalized);
  }

  return normalized;
}

export function toSafeInteger(value: unknown, options: NumericOptions = {}): number | null {
  const normalized = toSafeNumber(value, options);

  if (normalized === null) {
    return null;
  }

  const truncated = Math.trunc(normalized);

  if (typeof options.min === 'number' && truncated < options.min) {
    return options.min;
  }

  if (typeof options.max === 'number' && truncated > options.max) {
    return options.max;
  }

  return truncated;
}
