import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/legal-document-view';
import { PRIVACY_POLICY } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Política de Privacidade | LyftTrack',
  description: 'Política de Privacidade da aplicação e website LyftTrack (RGPD).',
};

type PageProps = {
  searchParams?: { lang?: string };
};

export default function PrivacyPage({ searchParams }: PageProps) {
  const initialLanguage = searchParams?.lang === 'en' ? 'en' : 'pt';
  return <LegalDocumentView document={PRIVACY_POLICY} initialLanguage={initialLanguage} />;
}
