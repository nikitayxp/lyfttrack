import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blog-data';

export default async function BlogPage({ searchParams }: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const language = (await searchParams)?.lang === 'en' ? 'en' : 'pt';
  const isPortuguese = language === 'pt';
  const tags = isPortuguese
    ? { Training: 'Treino', Programming: 'Planeamento', Product: 'Produto' }
    : { Training: 'Training', Programming: 'Programming', Product: 'Product' };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 text-white sm:px-8 sm:py-12">
      <nav aria-label={isPortuguese ? 'Navegação dos artigos' : 'Article navigation'} className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <Link href={`/?lang=${language}`} className="rounded text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">
          {isPortuguese ? '← Voltar ao início' : '← Back to home'}
        </Link>
        <div className="flex gap-4" aria-label={isPortuguese ? 'Idioma' : 'Language'}>
          {(['pt', 'en'] as const).map((option) => (
            <Link key={option} href={`/blog?lang=${option}`} hrefLang={option} aria-current={language === option ? 'page' : undefined} className={`rounded px-2 py-2 font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 ${language === option ? 'text-blue-400' : 'text-white/60 hover:text-white'}`}>
              {option}
            </Link>
          ))}
        </div>
      </nav>
      <header className="mb-10 mt-16">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-blue-400">LyftTrack</p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{isPortuguese ? 'Artigos' : 'Articles'}</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60">
          {isPortuguese ? 'Ideias práticas para registar os teus treinos e acompanhar a tua evolução.' : 'Practical ideas for logging workouts and following your progress.'}
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-3">
        {BLOG_POSTS.map((post) => (
          <article key={post.slug} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs font-semibold text-blue-400">{tags[post.tag]} · {post.readTimeMinutes} {isPortuguese ? 'min de leitura' : 'min read'}</p>
            <h2 className="mt-5 text-xl font-bold leading-snug">
              <Link href={`/blog/${post.slug}?lang=${language}`} className="rounded hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">
                {post.title[language]}
              </Link>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/60">{post.excerpt[language]}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
