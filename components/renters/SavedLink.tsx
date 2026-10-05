'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';
import { useSaved } from './savedStore';
import { eyebrowClassName } from '@/components/browse/tokens';

/** Header link to /saved with a live count (MP-14). Hidden on hosts without capture. */
export function SavedLink({ className = '', enabled = true }: { className?: string; /** /saved exists only where browsing does; the server passes browseEnabled(). */ enabled?: boolean }) {
  const { saved, ready } = useSaved();
  if (!renterCaptureUiEnabled() || !enabled) return null;
  const n = ready ? saved.length : 0;
  return (
    <Link href="/saved" className={`inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 ${eyebrowClassName} text-muted transition hover:border-gold/45 hover:text-ink ${className}`} aria-label={n > 0 ? `Saved cars, ${n}` : 'Saved cars'}>
      <Heart size={14} className={n > 0 ? 'fill-ink text-ink' : 'text-muted'} aria-hidden />
      Saved{n > 0 && <span className="tabular-nums text-ink">{n}</span>}
    </Link>
  );
}
