"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import {
  ACCEPT_ALL,
  ESSENTIAL_ONLY,
  readStoredConsent,
  writeConsent,
  type ConsentPreferences,
} from '@/lib/cookie-consent';
import { useSiteLanguage } from '@/lib/use-site-language';

export const OPEN_COOKIE_PREFERENCES_EVENT = 'lyfttrack:open-cookie-preferences';

type CategoryCopy = {
  key: 'essential' | 'analytics' | 'marketing';
  title: string;
  description: string;
  locked: boolean;
};

const COPY = {
  pt: {
    consent: 'Consentimento de cookies', title: 'Preferências de cookies',
    banner: 'Usamos cookies e armazenamento local estritamente necessários para o site funcionar (idioma e esta escolha). Não usamos analytics nem marketing sem o teu consentimento.',
    intro: 'Escolhe que categorias autorizas. Podes voltar aqui a qualquer momento pelo link no rodapé.',
    privacy: 'Política de Privacidade', essential: 'Apenas essenciais', settings: 'Definições',
    accept: 'Aceitar todos', save: 'Guardar preferências', active: 'sempre ativo', close: 'Fechar',
    categories: [
      { key: 'essential', title: 'Essenciais', description: 'Necessários para o site funcionar: guardam o idioma escolhido e esta própria decisão de cookies. Não podem ser desligados e não te identificam.', locked: true },
      { key: 'analytics', title: 'Analytics', description: 'Mediriam páginas vistas e origem do tráfego. Neste momento o site não carrega nenhuma ferramenta de analytics — se isso mudar, só passa a correr com esta opção ligada.', locked: false },
      { key: 'marketing', title: 'Marketing', description: 'Serviriam para publicidade e medição de campanhas. Neste momento o site não usa nenhum cookie de marketing.', locked: false },
    ] satisfies CategoryCopy[],
  },
  en: {
    consent: 'Cookie consent', title: 'Cookie preferences',
    banner: 'We use strictly necessary cookies and local storage to run the site (language and this choice). We do not use analytics or marketing without your consent.',
    intro: 'Choose which categories you allow. You can return here at any time using the footer link.',
    privacy: 'Privacy Policy', essential: 'Essential only', settings: 'Settings',
    accept: 'Accept all', save: 'Save preferences', active: 'always active', close: 'Close',
    categories: [
      { key: 'essential', title: 'Essential', description: 'Required to run the site: they store your language and this cookie choice. They cannot be disabled and do not identify you.', locked: true },
      { key: 'analytics', title: 'Analytics', description: 'Would measure page views and traffic sources. The site currently loads no analytics tools. If this changes, they will only run with this option enabled.', locked: false },
      { key: 'marketing', title: 'Marketing', description: 'Would support advertising and campaign measurement. The site currently uses no marketing cookies.', locked: false },
    ] satisfies CategoryCopy[],
  },
};

export function CookieConsentBanner() {
  const [language] = useSiteLanguage();
  const copy = COPY[language];
  const panelRef = useRef<HTMLDialogElement>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentPreferences>(ESSENTIAL_ONLY);

  useEffect(() => {
    const stored = readStoredConsent();

    startTransition(() => {
      if (stored) {
        setDraft(stored.preferences);
        return;
      }

      setIsBannerVisible(true);
    });
  }, []);

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

    const panel = panelRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    panel?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      panel?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isPanelOpen]);

  if (!isBannerVisible && !isPanelOpen) {
    return null;
  }

  return (
    <>
      {isBannerVisible ? (
        <div
          role="dialog"
          aria-label={copy.consent}
          className="fixed bottom-0 inset-x-0 z-[200] px-4 pb-4 md:px-8 md:pb-6"
        >
          <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0d0d0f]/95 p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl md:rounded-[1.4rem] md:p-6">
            <p className="text-sm font-semibold leading-relaxed text-white/80">
              {copy.banner}{' '}
              <a
                href={`/privacidade?lang=${language}`}
                className="text-[#3B82F6] underline underline-offset-2 transition-colors hover:text-[#60a5fa]"
              >
                {copy.privacy}
              </a>
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => decide(ESSENTIAL_ONLY)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                {copy.essential}
              </button>
              <button
                type="button"
                onClick={() => setIsPanelOpen(true)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                {copy.settings}
              </button>
              <button
                type="button"
                onClick={() => decide(ACCEPT_ALL)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-px hover:bg-[#2563EB]"
              >
                {copy.accept}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPanelOpen ? (
        <dialog
            ref={panelRef}
            aria-labelledby="cookie-preferences-title"
            onCancel={() => setIsPanelOpen(false)}
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;
              const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])');
              const first = controls[0];
              const last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
            className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0f] p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="cookie-preferences-title" className="text-lg font-bold text-white">{copy.title}</h2>
              <button type="button" onClick={() => setIsPanelOpen(false)} className="min-h-11 rounded-lg border border-white/20 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{copy.close}</button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              {copy.intro}{' '}
              <a
                href={`/privacidade?lang=${language}`}
                className="text-[#3B82F6] underline underline-offset-2 transition-colors hover:text-[#60a5fa]"
              >
                {copy.privacy}
              </a>
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {copy.categories.map((category) => {
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
                            {copy.active}
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
                {copy.essential}
              </button>
              <button
                type="button"
                onClick={() => decide(draft)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                {copy.save}
              </button>
              <button
                type="button"
                onClick={() => decide(ACCEPT_ALL)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-px hover:bg-[#2563EB]"
              >
                {copy.accept}
              </button>
            </div>
        </dialog>
      ) : null}
    </>
  );
}

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
