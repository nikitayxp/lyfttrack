"use client";

import { startTransition, useCallback, useEffect, useState } from 'react';
import {
  ACCEPT_ALL,
  ESSENTIAL_ONLY,
  readStoredConsent,
  writeConsent,
  type ConsentPreferences,
} from '@/lib/cookie-consent';

export const OPEN_COOKIE_PREFERENCES_EVENT = 'lyfttrack:open-cookie-preferences';

type CategoryCopy = {
  key: 'essential' | 'analytics' | 'marketing';
  title: string;
  description: string;
  locked: boolean;
};

// Copy states what the site does today rather than what a template banner
// usually claims. The site currently loads no analytics or marketing scripts.
const CATEGORIES: CategoryCopy[] = [
  {
    key: 'essential',
    title: 'Essenciais',
    description:
      'Necessários para o site funcionar: guardam o idioma escolhido e esta própria decisão de cookies. Não podem ser desligados e não te identificam.',
    locked: true,
  },
  {
    key: 'analytics',
    title: 'Analytics',
    description:
      'Mediriam páginas vistas e origem do tráfego. Neste momento o site não carrega nenhuma ferramenta de analytics — se isso mudar, só passa a correr com esta opção ligada.',
    locked: false,
  },
  {
    key: 'marketing',
    title: 'Marketing',
    description:
      'Serviriam para publicidade e medição de campanhas. Neste momento o site não usa nenhum cookie de marketing.',
    locked: false,
  },
];

export function CookieConsentBanner() {
  // Always start hidden to match SSR; localStorage is only readable after mount.
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentPreferences>(ESSENTIAL_ONLY);

  useEffect(() => {
    const stored = readStoredConsent();

    // startTransition keeps this off the synchronous post-mount path, which is
    // what react-hooks/set-state-in-effect asks for. The original banner did
    // the same for the same reason.
    startTransition(() => {
      if (stored) {
        setDraft(stored.preferences);
        return;
      }

      setIsBannerVisible(true);
    });
  }, []);

  // Lets the footer reopen preferences so a decision can be withdrawn later.
  useEffect(() => {
    function handleOpenRequest() {
      setDraft(readStoredConsent()?.preferences ?? ESSENTIAL_ONLY);
      setIsPanelOpen(true);
    }

    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleOpenRequest);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleOpenRequest);
  }, []);

  const decide = useCallback((preferences: ConsentPreferences) => {
    writeConsent(preferences);
    setDraft(preferences);
    setIsPanelOpen(false);
    setIsBannerVisible(false);
  }, []);

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPanelOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen]);

  if (!isBannerVisible && !isPanelOpen) {
    return null;
  }

  return (
    <>
      {isBannerVisible && !isPanelOpen ? (
        <div
          role="dialog"
          aria-label="Consentimento de cookies"
          className="fixed bottom-0 inset-x-0 z-[200] px-4 pb-4 md:px-8 md:pb-6"
        >
          <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0d0d0f]/95 p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl md:rounded-[1.4rem] md:p-6">
            <p className="text-sm font-semibold leading-relaxed text-white/80">
              Usamos cookies e armazenamento local estritamente necessários para o site funcionar (idioma e esta
              escolha). Não usamos analytics nem marketing sem o teu consentimento.{' '}
              <a
                href="/privacidade"
                className="text-[#3B82F6] underline underline-offset-2 transition-colors hover:text-[#60a5fa]"
              >
                Política de Privacidade
              </a>
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => decide(ESSENTIAL_ONLY)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                Apenas essenciais
              </button>
              <button
                type="button"
                onClick={() => setIsPanelOpen(true)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                Definições
              </button>
              <button
                type="button"
                onClick={() => decide(ACCEPT_ALL)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-px hover:bg-[#2563EB]"
              >
                Aceitar todos
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPanelOpen ? (
        <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/70 px-4 pb-4 backdrop-blur-sm md:items-center md:pb-0">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Preferências de cookies"
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0f] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
          >
            <h2 className="text-lg font-bold text-white">Preferências de cookies</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Escolhe que categorias autorizas. Podes voltar aqui a qualquer momento pelo link no rodapé.{' '}
              <a
                href="/privacidade"
                className="text-[#3B82F6] underline underline-offset-2 transition-colors hover:text-[#60a5fa]"
              >
                Política de Privacidade
              </a>
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {CATEGORIES.map((category) => {
                const isEnabled = category.locked || draft[category.key];

                return (
                  <label
                    key={category.key}
                    className={`flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 ${
                      category.locked ? 'cursor-default' : 'cursor-pointer hover:bg-white/[0.06]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={category.locked}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [category.key]: event.target.checked }))
                      }
                      className="mt-1 h-4 w-4 shrink-0 accent-[#3B82F6] disabled:opacity-60"
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-2 text-sm font-bold text-white">
                        {category.title}
                        {category.locked ? (
                          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                            sempre ativo
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-white/55">{category.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => decide(ESSENTIAL_ONLY)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                Apenas essenciais
              </button>
              <button
                type="button"
                onClick={() => decide(draft)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                Guardar preferências
              </button>
              <button
                type="button"
                onClick={() => decide(ACCEPT_ALL)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-px hover:bg-[#2563EB]"
              >
                Aceitar todos
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Footer entry point so consent can be reviewed or withdrawn after the fact. */
export function CookiePreferencesLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT))}
      className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-white/70 transition hover:text-white"
    >
      {label}
    </button>
  );
}
