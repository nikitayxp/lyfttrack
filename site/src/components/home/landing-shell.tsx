"use client";

import { ChevronDown, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CinematicHero, type HeroLanguage } from '@/components/ui/cinematic-hero';
import { FeaturesSection } from '@/components/home/features-section';

const LANGUAGE_STORAGE_KEY = 'lyfttrack.site.language';

export function LandingShell() {
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [language, setLanguage] = useState<HeroLanguage>('pt');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(language));
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined' || hintDismissed) {
      return;
    }

    const dismissHint = () => {
      setShowScrollHint(false);
      setHintDismissed(true);
      window.clearTimeout(idleTimer);
    };

    const handleScroll = () => {
      if (window.scrollY > 24) {
        dismissHint();
      }
    };

    const idleTimer = window.setTimeout(() => {
      if (window.scrollY <= 24) {
        setShowScrollHint(true);
      }
    }, 3000);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', dismissHint, { passive: true });
    window.addEventListener('touchstart', dismissHint, { passive: true });
    window.addEventListener('pointerdown', dismissHint, { passive: true });
    window.addEventListener('keydown', dismissHint);

    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', dismissHint);
      window.removeEventListener('touchstart', dismissHint);
      window.removeEventListener('pointerdown', dismissHint);
      window.removeEventListener('keydown', dismissHint);
    };
  }, [hintDismissed]);

  const handleLanguageToggle = () => {
    setLanguage((current) => (current === 'pt' ? 'en' : 'pt'));
  };

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex items-center justify-between px-3 py-3 md:px-7 md:py-4">
        <div className="pointer-events-auto select-none text-xl font-black leading-none tracking-tight sm:text-2xl">
          <span className="text-white">Lyft</span>
          <span style={{ color: '#3B82F6' }}>Track</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--hero-header-border)] bg-[var(--hero-header-bg)] px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl md:py-2">
          <button
            type="button"
            onClick={handleLanguageToggle}
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--hero-header-border)] bg-[var(--hero-header-pill-bg)] px-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--hero-header-text)] transition-transform hover:-translate-y-[1px] md:min-h-9"
            aria-label="Toggle language"
          >
            <Globe className="h-4 w-4" />
            {language === 'pt' ? 'PT' : 'EN'}
          </button>
        </div>
      </header>

      <CinematicHero language={language} />
      <FeaturesSection language={language} />

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
