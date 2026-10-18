'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type SiteLanguage = 'pt' | 'en';

const STORAGE_KEY = 'lyfttrack.site.language';
const listeners = new Set<() => void>();
let selectedLanguage: SiteLanguage | null = null;

function readLanguage(): SiteLanguage {
  const query = window.location?.search ? new URLSearchParams(window.location.search).get('lang') : null;
  if (query === 'pt' || query === 'en') return query;
  if (selectedLanguage) return selectedLanguage;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored === 'pt' || stored === 'en') return stored;
  } catch {}
  return 'pt';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => {
    selectedLanguage = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('popstate', listener);
  };
}

function setLanguage(language: SiteLanguage) {
  selectedLanguage = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(language));
  } catch {}
  if (window.location) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', language);
    window.history.replaceState(window.history.state, '', url);
  }
  listeners.forEach(listener => listener());
}

export function useSiteLanguage(initialLanguage: SiteLanguage = 'pt') {
  const language = useSyncExternalStore(subscribe, readLanguage, () => initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en';
  }, [language]);
  return [language, setLanguage] as const;
}
