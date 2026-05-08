"use client";

import { toast } from 'sonner';

interface AppDownloadSectionProps {
  language?: 'pt' | 'en';
}

const SOON_MSG = {
  pt: 'Disponível Brevemente — a app está a ser afinada para o lançamento oficial.',
  en: 'Coming Soon — the app is being polished for the official launch.',
};

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-1.06.61-1.78 1.65-1.77 3 .01 1.56.93 2.93 2.3 3.53-.17.46-.35.9-.58 1.35M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11"/>
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M3.18 23.76c.3.17.65.2.98.08l11.65-11.65L12 8.38 3.18 23.76zM20.07 10.5l-2.52-1.44-3.18 3.18 3.18 3.18 2.55-1.46c.73-.42.73-1.47-.03-1.46zM2.01 1.27C1.7 1.58 1.5 2.06 1.5 2.7v18.6c0 .64.2 1.12.52 1.43L2.1 22.8l10.42-10.42v-.24L2.01 1.27zM12 8.38l3.81-3.81-11.64-6.66c-.35-.2-.73-.22-1.06-.06L12 8.38z"/>
    </svg>
  );
}

export function AppDownloadSection({ language = 'pt' }: AppDownloadSectionProps) {
  const handleBadgeClick = () => {
    toast(SOON_MSG[language], {
      duration: 4000,
      style: {
        background: '#111111',
        border: '1px solid rgba(59,130,246,0.25)',
        color: '#FFFFFF',
        fontSize: '14px',
        fontWeight: '600',
        borderRadius: '14px',
        padding: '14px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      },
    });
  };

  const isEn = language === 'en';

  return (
    <section className="relative w-full bg-[#050505] pb-20 pt-12">
      {/* top separator line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#3B82F6]">
            {isEn ? 'Mobile App' : 'App Mobile'}
          </span>

          <h2 className="mb-3 text-3xl font-black tracking-tighter text-white md:text-5xl">
            {isEn ? 'Take it to the gym.' : 'Leva para o ginásio.'}
          </h2>
          <p className="mx-auto mb-10 max-w-md text-base font-medium leading-relaxed text-white/50">
            {isEn
              ? 'LyftTrack is coming to iOS and Android. Be the first to know.'
              : 'LyftTrack está a chegar ao iOS e Android. Sê o primeiro a saber.'}
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            {/* App Store badge */}
            <button
              type="button"
              onClick={handleBadgeClick}
              className="group relative inline-flex h-14 min-w-[180px] items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] active:translate-y-0"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <AppleIcon />
              <div className="text-left">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                  {isEn ? 'Download on the' : 'Disponível na'}
                </div>
                <div className="text-base font-bold leading-none text-white">App Store</div>
              </div>
            </button>

            {/* Google Play badge */}
            <button
              type="button"
              onClick={handleBadgeClick}
              className="group relative inline-flex h-14 min-w-[180px] items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] active:translate-y-0"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <GooglePlayIcon />
              <div className="text-left">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                  {isEn ? 'Get it on' : 'Disponível no'}
                </div>
                <div className="text-base font-bold leading-none text-white">Google Play</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
