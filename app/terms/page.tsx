import type { Metadata } from 'next';
import { LegalPage } from '@/components/browse/LegalPage';
import { TermsDocument } from '@/components/browse/TermsDocument';
import { parseTermsMarkdown } from '@/domain/legal/termsMarkdown';
import { TERMS_BODY_MD } from '@/domain/legal/termsV2';

// Public in every site mode, like /privacy: no gate and no not-found. The text is the
// counsel-signed Terms body vendored in domain/legal/termsV2.ts and pinned by tests/legal; to
// publish a new version change the body, TERMS_DOC_VERSION and the pin together, under a new spec.
export function generateMetadata(): Metadata {
  return {
    title: 'Terms of service | Drive Exotiq',
    description: 'How booking through Drive Exotiq works: who you rent from, what you pay, and what Exotiq is responsible for.',
    robots: { index: false, follow: true },
  };
}

export default function TermsPage() {
  const { title, blocks } = parseTermsMarkdown(TERMS_BODY_MD);
  return (
    <LegalPage eyebrow="Drive Exotiq" title={title} updated="October 6, 2026">
      <TermsDocument blocks={blocks} />
    </LegalPage>
  );
}
