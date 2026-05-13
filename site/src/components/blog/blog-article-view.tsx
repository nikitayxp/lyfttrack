'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { BlogPost, LanguageCode } from '@/lib/blog-data';

type ThemeMode = 'dark' | 'light';

const STORAGE_KEYS = {
  language: 'lyfttrack.site.language',
  theme: 'lyfttrack.site.theme',
};

function readStorageValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function formatDate(value: string, language: LanguageCode): string {
  return new Date(value).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function BlogArticleView({ post, initialLanguage }: { post: BlogPost; initialLanguage: LanguageCode }) {
  const [language, setLanguage] = useState<LanguageCode>(() => readStorageValue(STORAGE_KEYS.language, initialLanguage));
  const [theme, setTheme] = useState<ThemeMode>(() => readStorageValue(STORAGE_KEYS.theme, 'dark'));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.language, JSON.stringify(language));
  }, [language]);

  const localizedTitle = post.title[language];
  const localizedExcerpt = post.excerpt[language];

  const backLabel = language === 'pt' ? 'Voltar \u00E0 Comunidade' : 'Back to Community';
  const readLabel = language === 'pt' ? 'min de leitura' : 'min read';

  const sectionRows = useMemo(() => {
    return post.sections.map((section) => ({
      heading: section.heading[language],
      paragraphs: section.paragraphs.map((paragraph) => paragraph[language]),
    }));
  }, [language, post.sections]);

  return (
    <div className="article-shell">
      <header className="article-topbar">
        <Link href={`/?lang=${language}#community`} className="btn-outline no-underline">
          {backLabel}
        </Link>

        <div className="article-controls">
          <div className="segmented">
            <button
              type="button"
              className={`segment ${language === 'pt' ? 'active' : ''}`}
              onClick={() => setLanguage('pt')}
            >
              PT
            </button>
            <button
              type="button"
              className={`segment ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((currentValue) => (currentValue === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? (language === 'pt' ? 'Claro' : 'Light') : language === 'pt' ? 'Escuro' : 'Dark'}
          </button>
        </div>
      </header>

      <main className="article-main">
        <p className="article-meta">
          {post.tag} · {formatDate(post.publishedAt, language)} · {post.readTimeMinutes} {readLabel}
        </p>
        <h1 className="article-title">{localizedTitle}</h1>
        <p className="article-lead">{localizedExcerpt}</p>

        <div className="article-content">
          {sectionRows.map((section) => (
            <section key={section.heading} className="article-section">
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
