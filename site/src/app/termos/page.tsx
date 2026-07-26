import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/legal-document-view';
import { TERMS_OF_SERVICE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Termos de Uso | LyftTrack',
  description: 'Termos de Uso da aplicação e website LyftTrack.',
};

type PageProps = {
  searchParams?: { lang?: string };
};

export default function TermsPage({ searchParams }: PageProps) {
  const initialLanguage = searchParams?.lang === 'en' ? 'en' : 'pt';
  return <LegalDocumentView document={TERMS_OF_SERVICE} initialLanguage={initialLanguage} />;
}
