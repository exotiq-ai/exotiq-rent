'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Heart, X } from 'lucide-react';
import { track } from '@/components/analytics/posthog';
import { serifStyle } from '@/components/browse/tokens';
import { EmailCaptureForm } from './EmailCaptureForm';
import { readSaved, useSaved } from './savedStore';

function dollars(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

/** /saved (MP-14): the browser's list, with the one moment it may leave the device. */
export function SavedList() {
  const { saved, ready, remove } = useSaved();
  useEffect(() => {
    if (ready) track('saved_view', { count: saved.length });
    // Once, on mount — the count at arrival is the interesting number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  if (!ready) return <div className="h-40" aria-busy />;
  if (saved.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#2A2E3A] px-6 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><Heart size={24} /></div>
        <h2 className="mt-5 text-[24px] text-[#F0F2F5]" style={serifStyle}>Nothing saved yet.</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#9BA1B0]">Tap the heart on any car and it lands here. Saved cars stay in this browser until you e-mail yourself the list.</p>
        <Link href="/browse" className="mt-6 rounded-xl bg-[#C8A664] px-6 py-3.5 text-sm font-semibold text-[#1A1308]">Browse the fleet</Link>
      </div>
    );
  }
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
      <ul className="divide-y divide-[#2A2E3A] rounded-2xl border border-[#2A2E3A] bg-[#0D0F14]">
        {saved.map((car) => (
          <li key={`${car.team_slug}/${car.vehicle_slug}`} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <Link href={car.href} className="block truncate text-[17px] text-[#F0F2F5] transition hover:text-[#C8A664]" style={serifStyle}>{car.name}</Link>
              <div className="mt-0.5 text-[12px] text-[#9BA1B0]">{car.priceCents !== undefined ? `${dollars(car.priceCents)} per day · ` : ''}{car.team_slug.replace(/-/g, ' ')}</div>
            </div>
            <button type="button" onClick={() => remove(car.team_slug, car.vehicle_slug)} aria-label={`Remove ${car.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#2A2E3A] text-[#848A9A] transition hover:border-[#C8A664]/45 hover:text-[#F0F2F5]"><X size={14} /></button>
          </li>
        ))}
      </ul>
      <aside className="mt-6 rounded-2xl border border-[#2A2E3A] bg-[#0D0F14] p-5 lg:sticky lg:top-24 lg:mt-0">
        <h2 className="text-[20px] text-[#F0F2F5]" style={serifStyle}>E-mail me this list.</h2>
        <p className="mt-2 text-[13px] leading-5 text-[#9BA1B0]">A copy with a link to each car, so it is not stuck in this browser.</p>
        <EmailCaptureForm source="save_list" cta="Send my list" saved={readSaved} className="mt-4" />
      </aside>
    </div>
  );
}
