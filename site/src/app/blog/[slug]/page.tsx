import { notFound } from 'next/navigation';
import { BlogArticleView } from '@/components/blog/blog-article-view';
import { BLOG_POSTS, getBlogPostBySlug, type LanguageCode } from '@/lib/blog-data';

type BlogPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    lang?: string;
  }>;
};

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params, searchParams }: BlogPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const query = await searchParams;
  const initialLanguage: LanguageCode = query?.lang === 'en' ? 'en' : 'pt';

  return <BlogArticleView post={post} initialLanguage={initialLanguage} />;
}
