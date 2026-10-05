import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDataMode, getSiteMode } from '@/domain/booking/config';
import { tone } from '@/components/browse/tokens';

export const metadata: Metadata = {
  title: 'Drive Exotiq Preview | Booking Flow',
  description: 'Preview links for the Drive Exotiq renter-facing booking flow scaffold.',
};

const links = [
  {
    label: 'Vehicle screen',
    href: '/desert-exotic-rentals/mclaren-750s-spider',
    description: 'Step 01 · McLaren vehicle detail entry point',
  },
  {
    label: 'Booking flow',
    href: '/desert-exotic-rentals/mclaren-750s-spider/book',
    description: 'Steps 02–07 · Dates, driver, extras, protect, review, pay',
    primary: true,
  },
  {
    label: 'Confirmation',
    href: '/booking/EXQ-2026-K7P4',
    description: 'Step 08 · Confirmed booking payoff screen',
  },
];

export default function PreviewPage() {
  // Marketplace-mode deploys (exotiq.rent) do not route the booking flow, and
  // this index links the MOCK demo routes — on a live (supabase) deploy those
  // teams do not exist, so the page would just be a wall of 404s.
  if (getSiteMode() === 'marketplace' || getDataMode() === 'supabase') notFound();
  return (
    <main className="min-h-screen bg-ground px-5 py-8 text-ink" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section className="mx-auto max-w-[460px] rounded-[28px] border border-line bg-panel p-5 shadow-2xl shadow-black/40">
        <div className="text-micro uppercase tracking-[0.16em] text-gold">Branch Preview</div>
        <h1 className="mt-3 text-title font-medium leading-tight" style={{ fontFamily: 'Newsreader, Georgia, serif', letterSpacing: '-0.018em' }}>
          Drive Exotiq renter flow
        </h1>
        <p className="mt-3 text-body leading-6 text-muted">
          Use these links to review the new Gold + Editorial Type booking scaffold. The old marketplace homepage remains untouched on this branch, so do not use the tunnel root URL for design review.
        </p>

        <div className="mt-6 space-y-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-2xl border p-4 transition hover:translate-y-[-1px]"
              style={{
                borderColor: link.primary ? tone.gold : tone.line,
                backgroundColor: link.primary ? 'rgba(200,166,100,0.10)' : tone.surface,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-body font-semibold text-ink">{link.label}</div>
                  <div className="mt-1 text-body-sm leading-5 text-muted">{link.description}</div>
                </div>
                <span className="text-title-sm text-gold">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-4 text-body-sm leading-5 text-muted">
          Current pass: canonical-style phone shell, Drive Exotiq chrome, gold/editorial route visuals, split billing, and mocked payment boundaries are ready for review.
        </div>
      </section>
    </main>
  );
}
