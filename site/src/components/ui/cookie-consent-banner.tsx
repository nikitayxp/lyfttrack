"use client";

import { startTransition, useEffect, useState } from 'react';
import { X } from 'lucide-react';

const CONSENT_KEY = 'lyfttrack.cookie.consent';

export function CookieConsentBanner() {
  // Always start hidden (matches SSR). Check localStorage only on client after mount.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      startTransition(() => setVisible(true));
    }
  }, []);

  const dismiss = (value: 'accepted' | 'managed') => {
    window.localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-0 inset-x-0 z-[200] px-4 pb-4 md:px-8 md:pb-6"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0d0d0f]/90 p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl md:flex md:items-center md:gap-8 md:rounded-[1.4rem] md:p-6">
        <div className="mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/10 md:mb-0">
          <svg className="h-5 w-5 text-[#3B82F6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22C6.477 22 2 17.523 2 12a10 10 0 0 1 10-10c.5 0 .984.04 1.457.114A4 4 0 0 0 17 7a4 4 0 0 0 4.886 3.922A10 10 0 0 1 12 22z"/>
            <circle cx="13.5" cy="11.5" r="1"/><circle cx="8.5" cy="15" r="1"/>
          </svg>
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold leading-relaxed text-white/80">
            Utilizamos cookies para melhorar a tua experiência, analisar o tráfego e personalizar conteúdo.{' '}
            <a href="#" className="text-[#3B82F6] underline underline-offset-2 transition-colors hover:text-[#60a5fa]">
              Política de Privacidade
            </a>
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3 md:mt-0 md:shrink-0">
          <button
            type="button"
            onClick={() => dismiss('managed')}
            className="inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            Gerir preferências
          </button>
          <button
            type="button"
            onClick={() => dismiss('accepted')}
            className="inline-flex h-10 items-center rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-px hover:bg-[#2563EB]"
          >
            Aceitar todos
          </button>
          <button
            type="button"
            onClick={() => dismiss('accepted')}
            aria-label="Fechar"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/40 transition-all hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
