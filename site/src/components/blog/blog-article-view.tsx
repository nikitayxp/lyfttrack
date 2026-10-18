'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { BlogPost, LanguageCode } from '@/lib/blog-data';
import { useSiteLanguage } from '@/lib/use-site-language';

function formatDate(value: string, language: LanguageCode): string {
  return new Date(value).toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function BlogArticleView({ post, initialLanguage }: { post: BlogPost; initialLanguage: LanguageCode }) {
  const [language, setLanguage] = useSiteLanguage(initialLanguage);
  const localizedTitle = post.title[language];
  const localizedExcerpt = post.excerpt[language];

  const backLabel = language === 'pt' ? 'Voltar ao início' : 'Back to home';
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
        <Link href={`/?lang=${language}`} className="btn-outline no-underline">
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
