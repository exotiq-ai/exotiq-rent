import Link from 'next/link';
import type { Metadata } from 'next';

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
  return (
    <main className="min-h-screen bg-[#06070a] px-5 py-8 text-[#F0F2F5]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section className="mx-auto max-w-[460px] rounded-[28px] border border-[#2A2E3A] bg-[#0D0F14] p-5 shadow-2xl shadow-black/40">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#C8A664]">Branch Preview</div>
        <h1 className="mt-3 text-2xl font-medium leading-tight" style={{ fontFamily: 'Newsreader, Georgia, serif', letterSpacing: '-0.018em' }}>
          Drive Exotiq renter flow
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#9BA1B0]">
          Use these links to review the new Gold + Editorial Type booking scaffold. The old marketplace homepage remains untouched on this branch, so do not use the tunnel root URL for design review.
        </p>

        <div className="mt-6 space-y-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-2xl border p-4 transition hover:translate-y-[-1px]"
              style={{
                borderColor: link.primary ? '#C8A664' : '#2A2E3A',
                backgroundColor: link.primary ? 'rgba(200,166,100,0.10)' : '#161922',
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#F0F2F5]">{link.label}</div>
                  <div className="mt-1 text-xs leading-5 text-[#9BA1B0]">{link.description}</div>
                </div>
                <span className="text-lg text-[#C8A664]">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-[#2A2E3A] bg-[#161922] p-4 text-xs leading-5 text-[#9BA1B0]">
          Current pass: canonical-style phone shell, Drive Exotiq chrome, gold/editorial route visuals, split billing, and mocked payment boundaries are ready for review.
        </div>
      </section>
    </main>
  );
}
