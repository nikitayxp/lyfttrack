export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

function flattenClassValue(value: ClassValue, output: string[]): void {
  if (!value) {
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    output.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      flattenClassValue(item, output);
    }

    return;
  }

  for (const [key, enabled] of Object.entries(value)) {
    if (enabled) {
      output.push(key);
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const output: string[] = [];

  for (const input of inputs) {
    flattenClassValue(input, output);
  }

  return output.join(' ');
}
