import type { TFunction } from 'i18next';
import type { AppLanguage } from '@/i18n/resources';

// The app language is a bare code ('pt'), which Intl would resolve to whatever
// regional defaults it feels like. Pinning the region keeps the fallback date
// stable across devices.
const DATE_LOCALES: Record<AppLanguage, string> = {
  en: 'en-US',
  pt: 'pt-PT',
};

export function formatRelativeTime(iso: string, t: TFunction, language: AppLanguage): string {
  const timestamp = new Date(iso);
  const justNow = t('common.relativeTime.justNow');

  if (Number.isNaN(timestamp.getTime())) {
    return justNow;
  }

  const nowMs = Date.now();
  const diffMs = nowMs - timestamp.getTime();

  if (diffMs <= 0) {
    return justNow;
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return justNow;
  }

  const minutes = Math.floor(diffMs / minuteMs);
  if (minutes < 60) {
    return t('common.relativeTime.minutes', { count: minutes });
  }

  const hours = Math.floor(diffMs / hourMs);
  if (hours < 24) {
    return t('common.relativeTime.hours', { count: hours });
  }

  const days = Math.floor(diffMs / dayMs);
  if (days < 30) {
    return t('common.relativeTime.days', { count: days });
  }

  return timestamp.toLocaleDateString(DATE_LOCALES[language], {
    month: 'short',
    day: 'numeric',
  });
}
