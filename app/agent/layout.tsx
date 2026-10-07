import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Customer authorization | Exotiq',
  description: 'Secure customer review and authorization.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false, noarchive: true, nocache: true, googleBot: { index: false, follow: false, nosnippet: true, noimageindex: true } },
  openGraph: null,
  twitter: null,
};
export default function AgentCustomerLayout({ children }: { children: React.ReactNode }) { return children; }
