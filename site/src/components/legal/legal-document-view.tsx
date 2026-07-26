'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { LegalDocument, LegalLang } from '@/lib/legal';

type LegalDocumentViewProps = {
  document: LegalDocument;
  initialLanguage?: LegalLang;
};

function formatUpdated(value: string, language: LegalLang): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function LegalDocumentView({ document, initialLanguage = 'pt' }: LegalDocumentViewProps) {
  const [language, setLanguage] = useState<LegalLang>(initialLanguage);

  const sections = useMemo(
    () =>
      document.sections.map((section) => ({
        title: section.title[language],
        paragraphs: section.paragraphs.map((paragraph) => paragraph[language]),
      })),
    [document.sections, language]
  );

  const updatedLabel = language === 'pt' ? 'Última atualização' : 'Last updated';
  const backLabel = language === 'pt' ? 'Voltar ao início' : 'Back to home';

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-16 pt-8 md:px-8 md:pt-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 no-underline transition hover:bg-white/10 hover:text-white"
        >
          {backLabel}
        </Link>

        <div className="inline-flex overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <button
            type="button"
            className={`px-3 py-2 text-sm font-bold ${language === 'pt' ? 'bg-[#3B82F6] text-white' : 'text-white/60'}`}
            onClick={() => setLanguage('pt')}
          >
            PT
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm font-bold ${language === 'en' ? 'bg-[#3B82F6] text-white' : 'text-white/60'}`}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </div>
      </div>

      <header className="mb-10 border-b border-white/10 pb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">LyftTrack</p>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl">{document.title[language]}</h1>
        <p className="text-sm text-white/50">
          {updatedLabel}: {formatUpdated(document.lastUpdated, language)}
        </p>
        <p className="mt-4 text-base leading-relaxed text-white/75">{document.intro[language]}</p>
      </header>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-xl font-bold text-white">{section.title}</h2>
            <div className="space-y-3">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="text-[15px] leading-7 text-white/70">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
