"use client";

import { ChevronDown, Globe } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { CinematicHero, type HeroLanguage } from '@/components/ui/cinematic-hero';
import { FeaturesSection } from '@/components/home/features-section';
import { CookiePreferencesLink } from '@/components/ui/cookie-consent-banner';

const LANGUAGE_STORAGE_KEY = 'lyfttrack.site.language';
const languageListeners = new Set<() => void>();
let selectedLanguage: HeroLanguage | null = null;

function readLanguage(): HeroLanguage {
  if (selectedLanguage) return selectedLanguage;
  try {
    const stored = JSON.parse(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? 'null');
    if (stored === 'pt' || stored === 'en') return stored;
  } catch {}
  return 'pt';
}

function subscribeLanguage(listener: () => void) {
  languageListeners.add(listener);
  const onStorage = () => {
    selectedLanguage = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    languageListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function serverLanguage(): HeroLanguage {
  return 'pt';
}

export function LandingShell() {
  const [showScrollHint, setShowScrollHint] = useState(false);
  const language = useSyncExternalStore(subscribeLanguage, readLanguage, serverLanguage);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en';
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const TOP_THRESHOLD = 24;
    const BLUR_DISMISS_THRESHOLD = 110;
    let idleTimer: number | null = null;

    const clearHintTimer = () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleHint = () => {
      clearHintTimer();
      if (window.scrollY > TOP_THRESHOLD) {
        return;
      }

      idleTimer = window.setTimeout(() => {
        if (window.scrollY <= TOP_THRESHOLD) {
          setShowScrollHint(true);
        }
      }, 3000);
    };

    const dismissHint = () => {
      setShowScrollHint(false);
      clearHintTimer();
    };

    const handleScroll = () => {
      if (window.scrollY >= BLUR_DISMISS_THRESHOLD) {
        dismissHint();
        return;
      }

      if (window.scrollY <= TOP_THRESHOLD) {
        setShowScrollHint(false);
        scheduleHint();
      }
    };

    scheduleHint();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearHintTimer();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLanguageToggle = () => {
    const next = language === 'pt' ? 'en' : 'pt';
    selectedLanguage = next;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    languageListeners.forEach(listener => listener());
  };

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex items-center justify-between px-3 py-3 md:px-7 md:py-4">
        <div className="pointer-events-auto select-none text-xl font-black leading-none tracking-tight sm:text-2xl">
          <span className="text-white">Lyft</span>
          <span style={{ color: '#3B82F6' }}>Track</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--hero-header-border)] bg-[var(--hero-header-bg)] px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl md:py-2">
          <a
            href="https://lyfttrack-app.vercel.app/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#3B82F6] px-4 text-xs font-bold text-white transition-colors hover:bg-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            {language === 'pt' ? 'Entrar na app' : 'Open app'}
          </a>
          <button
            type="button"
            onClick={handleLanguageToggle}
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--hero-header-border)] bg-[var(--hero-header-pill-bg)] px-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--hero-header-text)] transition-transform hover:-translate-y-[1px] md:min-h-9"
            aria-label={language === 'pt' ? 'Alterar idioma' : 'Change language'}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            {language === 'pt' ? 'PT' : 'EN'}
          </button>
        </div>
      </header>

      <CinematicHero language={language} />
      <div className="relative z-40 -mt-1 h-24 w-full overflow-hidden bg-[#050505]" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--hero-accent)]/20 via-[var(--hero-accent)]/8 to-transparent blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent via-[#060606]/60 to-[#050505]" />
      </div>
      <FeaturesSection language={language} />

      <footer className="border-t border-white/10 bg-[#050505] px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-white/45">
            © {new Date().getFullYear()} LyftTrack
          </p>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <a href={`/blog?lang=${language}`} className="text-white/70 no-underline transition hover:text-white">
              {language === 'pt' ? 'Artigos' : 'Articles'}
            </a>
            <a href="/termos" className="text-white/70 no-underline transition hover:text-white">
              {language === 'pt' ? 'Termos de Uso' : 'Terms of Service'}
            </a>
            <a href="/privacidade" className="text-white/70 no-underline transition hover:text-white">
              {language === 'pt' ? 'Política de Privacidade' : 'Privacy Policy'}
            </a>
            <CookiePreferencesLink
              label={language === 'pt' ? 'Preferências de cookies' : 'Cookie preferences'}
            />
          </div>
        </div>
      </footer>

      <div
        className={`pointer-events-none fixed bottom-4 left-1/2 z-[130] -translate-x-1/2 transition-all duration-500 md:bottom-8 ${
          showScrollHint ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
        aria-hidden="true"
      >
        <div className="flex min-w-[170px] flex-col items-center gap-1 rounded-full border border-[var(--hero-header-border)] bg-black/55 px-3 py-2 backdrop-blur-xl md:min-w-[180px] md:px-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--hero-text-muted)]">
            {language === 'pt' ? 'Desce para explorar' : 'Scroll to explore'}
          </span>
          <div className="flex items-center text-[var(--hero-accent)]">
            <ChevronDown className="h-4 w-4 animate-bounce" />
            <ChevronDown className="-ml-2 h-4 w-4 animate-bounce opacity-70 [animation-delay:120ms]" />
          </div>
        </div>
      </div>
    </>
  );
}
