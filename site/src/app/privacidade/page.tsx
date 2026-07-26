import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/legal-document-view';
import { PRIVACY_POLICY } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Política de Privacidade | LyftTrack',
  description: 'Política de Privacidade da aplicação e website LyftTrack (RGPD).',
};

type PageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export default async function PrivacyPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const initialLanguage = params.lang === 'en' ? 'en' : 'pt';
  return <LegalDocumentView document={PRIVACY_POLICY} initialLanguage={initialLanguage} />;
}
