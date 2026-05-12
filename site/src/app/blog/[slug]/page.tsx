import { notFound } from 'next/navigation';
import { BlogArticleView } from '@/components/blog/blog-article-view';
import { BLOG_POSTS, getBlogPostBySlug, type LanguageCode } from '@/lib/blog-data';

type BlogPageProps = {
  params: {
    slug: string;
  };
  searchParams?: {
    lang?: string;
  };
};

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export default function BlogPostPage({ params, searchParams }: BlogPageProps) {
  const post = getBlogPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const initialLanguage: LanguageCode = searchParams?.lang === 'en' ? 'en' : 'pt';

  return <BlogArticleView post={post} initialLanguage={initialLanguage} />;
}
