'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { renterCaptureUiEnabled } from '@/domain/renters/config';
import { useSaved } from './savedStore';

/** Header link to /saved with a live count (MP-14). Hidden on hosts without capture. */
export function SavedLink({ className = '' }: { className?: string }) {
  const { saved, ready } = useSaved();
  if (!renterCaptureUiEnabled()) return null;
  const n = ready ? saved.length : 0;
  return (
    <Link href="/saved" className={`inline-flex items-center gap-1.5 rounded-full border border-[#2A2E3A] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#9BA1B0] transition hover:border-[#C8A664]/45 hover:text-[#F0F2F5] ${className}`} aria-label={n > 0 ? `Saved cars, ${n}` : 'Saved cars'}>
      <Heart size={12} className={n > 0 ? 'fill-[#C8A664] text-[#C8A664]' : 'text-[#C8A664]'} aria-hidden />
      Saved{n > 0 && <span className="tabular-nums text-[#F0F2F5]">{n}</span>}
    </Link>
  );
}
