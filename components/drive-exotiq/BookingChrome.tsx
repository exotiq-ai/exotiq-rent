'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { ExotiqLockup } from './ExotiqLockup';
import { groundClassName } from '@/components/browse/tokens';

type StepStyle = 'bars' | 'numbered';

/**
 * How the frame behaves from `lg` (1024px) up. Below `lg` every layout is the
 * phone frame exactly as it shipped before M7d — the mobile DOM and classes
 * are unchanged, so mobile is pixel-identical.
 *
 * - 'phone': the 480px cage at every width. Default; not-found and restricted
 *   views keep it.
 * - 'page':  storefront and vehicle detail. The cage opens into a 1200px page:
 *   the phone header row and step bar hide, a quiet site bar takes over, and
 *   the page owns its desktop grid.
 * - 'panel': booking flow and confirmation. The cage stays 480px — every step
 *   component renders unchanged — centered as a rounded panel, with an optional
 *   summary rail beside it.
 */
export type FrameLayout = 'phone' | 'page' | 'panel';

// 6, not 8: Extras and Protect were removed from the flow. `total` and `labels`
// must stay the same length or the bar fills to a fraction the renter is not on
// and the label lookup runs off the end.
function StepIndicator({ step, total = 6, variant = 'bars' }: { step: number; total?: number; variant?: StepStyle }) {
  if (variant === 'numbered') {
    const pct = `${Math.max(0, Math.min(1, step / total)) * 100}%`;
    const labels = ['Vehicle', 'Dates', 'Driver', 'Review', 'Pay', 'Done'];

    return (
      <div className="flex items-center gap-3 px-6 pb-4 pt-1 text-[11px] uppercase tracking-[0.16em] text-[#848A9A]">
        <div className="tabular-nums"><b className="font-semibold text-[#C8A664]">{String(step).padStart(2, '0')}</b><span> / {String(total).padStart(2, '0')}</span></div>
        <div className="relative h-px flex-1 overflow-hidden rounded bg-[#2A2E3A]">
          <span className="absolute inset-y-0 left-0 bg-[#C8A664]" style={{ width: pct }} />
        </div>
        <div className="text-[10px] tracking-[0.22em]">{labels[step - 1]}</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-1 px-4 pb-2 pt-0">
      {Array.from({ length: total }).map((_, index) => {
        const current = index + 1;
        return <span key={current} className="h-[3px] w-8 rounded-full" style={{ backgroundColor: current <= step ? '#C8A664' : '#2A2E3A' }} />;
      })}
    </div>
  );
}

export function PhoneViewport({
  step,
  children,
  onBack,
  stepStyle = 'bars',
  className = '',
  closeHref = '/',
  layout = 'phone',
  rail,
  desktopNav,
}: {
  step: number;
  children: ReactNode;
  onBack?: () => void;
  stepStyle?: StepStyle;
  className?: string;
  /** Where the X lands. `/` 307s to the DEFAULT tenant's storefront, which for
   * a third-party operator's renter is a different business — callers with an
   * operator in scope must pass that operator's storefront instead (T-8). */
  closeHref?: string;
  layout?: FrameLayout;
  /** 'panel' only: summary column shown beside the panel from `lg` up. */
  rail?: ReactNode;
  /** 'page' only: right-hand links in the desktop site bar. */
  desktopNav?: ReactNode;
}) {
  const page = layout === 'page';
  const panel = layout === 'panel';
  const frameDesktop = page
    ? 'lg:h-auto lg:max-w-[1200px] lg:overflow-visible lg:bg-transparent lg:shadow-none'
    : panel
      ? 'lg:mx-0 lg:h-[min(900px,calc(100dvh-5rem))] lg:rounded-2xl lg:border lg:border-[#2A2E3A]'
      : '';

  const stepBar = <StepIndicator step={step} variant={stepStyle} />;

  // MP-11: the ground + vignette as two utilities — the single
  // `bg-[radial-gradient(...),#06070a]` value never compiled, so this main
  // was transparent and the desktop storefront sat on the body's #000.
  return (
    <main className={`min-h-screen ${groundClassName} text-[#F0F2F5] ${className}`}>
      {page && (
        <div className="hidden border-b border-[#2A2E3A]/70 lg:block">
          <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-8">
            <Link href={closeHref} className="flex items-center" aria-label="Home">
              <ExotiqLockup height={24} className="opacity-95" />
            </Link>
            {desktopNav && <nav className="flex items-center gap-7 text-[11px] uppercase tracking-[0.18em] text-[#9BA1B0]">{desktopNav}</nav>}
          </div>
        </div>
      )}
      <div className={panel ? 'lg:mx-auto lg:flex lg:w-full lg:max-w-[1200px] lg:items-start lg:justify-center lg:gap-10 lg:px-8 lg:py-10' : ''}>
        {panel && rail && <aside className="hidden lg:sticky lg:top-10 lg:block lg:w-80 lg:shrink-0">{rail}</aside>}
        {/* h-dvh (not min-h): the frame needs a definite height so flex-1 children
            scroll internally — with min-h alone the frame grows to content and
            the "sticky" footer lands below the fold on long steps. */}
        <div className={`relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-[#0D0F14] shadow-[0_40px_90px_-20px_rgba(0,0,0,.72),0_18px_42px_-18px_rgba(200,166,100,.18)] ${frameDesktop}`}>
          <div className={`grid flex-shrink-0 grid-cols-[40px_1fr_40px] items-center px-4 pb-1 pt-[calc(env(safe-area-inset-top)+10px)] ${page ? 'lg:hidden' : ''}`}>
            <button type="button" onClick={onBack} disabled={!onBack} className="grid h-10 w-10 place-items-center rounded-lg text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5] disabled:opacity-30" aria-label="Back">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center justify-center">
              {/* 26px, not the old wordmark's 18: the lockup carries a circular
                  mark, so the word is ~2/3 of total height — at 18px it becomes
                  illegible. 26px keeps the word at the old optical size inside
                  the 40px header row. */}
              <ExotiqLockup height={26} className="opacity-95" />
            </div>
            <Link href={closeHref} className="grid h-10 w-10 place-items-center rounded-lg text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5]" aria-label="Close booking flow">
              <X size={20} />
            </Link>
          </div>
          {page ? <div className="lg:hidden">{stepBar}</div> : stepBar}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function BookingChrome({ step, children, onBack, closeHref, rail }: { step: number; children: ReactNode; onBack?: () => void; closeHref?: string; rail?: ReactNode }) {
  return <PhoneViewport step={step} onBack={onBack} closeHref={closeHref} layout="panel" rail={rail}>{children}</PhoneViewport>;
}

export function HTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`text-[22px] leading-[1.12] text-[#F0F2F5] ${className}`}
      style={{ fontFamily: 'var(--font-drive-newsreader), Georgia, serif', fontWeight: 500, letterSpacing: '-0.018em', fontVariationSettings: "'opsz' 32" }}
    >
      {children}
    </h1>
  );
}

export function PrimaryButton({ children, onClick, disabled = false }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl px-5 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
      style={{ backgroundColor: '#C8A664', color: '#1A1308' }}
    >
      {children}
    </button>
  );
}

export function Money({ cents, large = false }: { cents: number; large?: boolean }) {
  // Statement parity (T-7): an amount that will be charged as $1,730.66 must
  // render as $1,730.66 — rounding here meant "Total due" never matched the
  // renter's card statement. Whole dollars keep the clean display.
  const digits = cents % 100 === 0 ? 0 : 2;
  const value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
  return <span className={large ? 'text-[28px] font-medium tabular-nums' : 'tabular-nums'}>{value}</span>;
}
