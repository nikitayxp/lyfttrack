const AUTH_AVATAR_URL_MAX = 500;

export function resolveAuthAvatarUrl(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  for (const candidate of [record.avatar_url, record.picture]) {
    const resolved = toHttpsAvatarUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function toHttpsAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > AUTH_AVATAR_URL_MAX) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}
