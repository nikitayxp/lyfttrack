/**
 * Cookie consent state for the marketing site.
 *
 * Today the site loads no analytics or marketing scripts at all — the only
 * client storage is the language/theme preference and this consent record,
 * which are strictly necessary. The optional categories exist so that adding a
 * tracker later is a matter of reading `hasConsent('analytics')` rather than
 * retrofitting a consent layer, and so the banner copy can stay honest about
 * what is actually running.
 */

export const CONSENT_STORAGE_KEY = 'lyfttrack.cookie.consent';

/** Bump when the categories change, so stored consent is re-asked rather than assumed. */
export const CONSENT_VERSION = 2;

export const CONSENT_UPDATED_EVENT = 'lyfttrack:cookie-consent-updated';

export type ConsentCategory = 'essential' | 'analytics' | 'marketing';

export type ConsentPreferences = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

export type StoredConsent = {
  version: number;
  decidedAt: string;
  preferences: ConsentPreferences;
};

export const ESSENTIAL_ONLY: ConsentPreferences = {
  essential: true,
  analytics: false,
  marketing: false,
};

export const ACCEPT_ALL: ConsentPreferences = {
  essential: true,
  analytics: true,
  marketing: true,
};

function isConsentPreferences(value: unknown): value is ConsentPreferences {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.essential === true &&
    typeof candidate.analytics === 'boolean' &&
    typeof candidate.marketing === 'boolean'
  );
}

/**
 * Returns null when no valid decision exists — including a decision recorded
 * against an older version. Callers must treat null as "no consent given",
 * never as an implicit acceptance.
 */
export function readStoredConsent(): StoredConsent | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;

    if (candidate.version !== CONSENT_VERSION || !isConsentPreferences(candidate.preferences)) {
      return null;
    }

    return {
      version: CONSENT_VERSION,
      decidedAt: typeof candidate.decidedAt === 'string' ? candidate.decidedAt : new Date().toISOString(),
      preferences: candidate.preferences,
    };
  } catch {
    // Includes the v1 format, which stored the bare strings 'accepted' /
    // 'managed' and carried no per-category decision worth migrating.
    return null;
  }
}

export function writeConsent(preferences: ConsentPreferences): StoredConsent {
  const record: StoredConsent = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    preferences,
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: record }));
  }

  return record;
}

/** Essential is always true; every other category defaults to false. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'essential') {
    return true;
  }

  return readStoredConsent()?.preferences[category] ?? false;
}
