'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import Image from 'next/image';
import { SiteBar } from '@/components/browse/SiteBar';
import { SavedLink } from '@/components/renters/SavedLink';
import { browseEnabled } from '@/domain/booking/config';
import { ctaClassName, eyebrowClassName, groundClassName, microLabelClassName, serifStyle } from '@/components/browse/tokens';
import { FLOW_STEPS } from './flow/steps';

/**
 * How the frame behaves. Below `lg` (1024px) both layouts are the 480px phone
 * frame; from `lg` up:
 *
 * - 'page':  storefront and vehicle detail, which are pages, not booking steps.
 *   Below lg a lockup-only bar links home; from lg the frame opens into a 1200px
 *   page, the site bar takes over, and the page owns its desktop grid.
 * - 'panel': booking flow and confirmation. The cage stays 480px — every step
 *   component renders unchanged — centered as a rounded panel, with an optional
 *   summary rail beside it. Only the flow passes a `step`, which renders the
 *   named progress; the confirmation passes none.
 */
export type FrameLayout = 'page' | 'panel';

/**
 * The booking flow's progress (MP-17): one named item per FLOW_STEPS entry, so the count and
 * the names are the flow's own and cannot drift from the step eyebrows. Neutral by design
 * (ink and line, no gold); the items shrink and their labels truncate, so the longest label
 * fits a 320px frame. A step outside the flow marks no item current.
 */
function FlowProgress({ step }: { step: number }) {
  const valid = Number.isInteger(step) && step >= 1 && step <= FLOW_STEPS.length;
  return (
    <nav data-chrome="progress" aria-label="Booking progress" className="px-4 pb-2 pt-1">
      <ol className="flex items-center gap-2">
        {FLOW_STEPS.map((s, index) => {
          const n = index + 1;
          const state = !valid || n > step ? 'upcoming' : n === step ? 'current' : 'done';
          return (
            <li key={s.key} data-state={state} aria-current={state === 'current' ? 'step' : undefined} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span aria-hidden="true" className={`h-[3px] w-full rounded-full ${state === 'upcoming' ? 'bg-line' : 'bg-ink'}`} />
              <span className={`truncate ${microLabelClassName} ${state === 'current' ? 'text-ink' : state === 'done' ? 'text-muted' : 'text-faint'}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PhoneViewport({
  step,
  children,
  onBack,
  className = '',
  closeHref = '/',
  layout,
  rail,
  desktopNav,
}: {
  /** 'panel' only: the flow step the progress marks current. Without it no progress renders. */
  step?: number;
  children: ReactNode;
  onBack?: () => void;
  className?: string;
  /** Where the X lands. `/` 307s to the DEFAULT tenant's storefront, which for
   * a third-party operator's renter is a different business — callers with an
   * operator in scope must pass that operator's storefront instead (T-8). */
  closeHref?: string;
  layout: FrameLayout;
  /** 'panel' only: summary column shown beside the panel from `lg` up. */
  rail?: ReactNode;
  /** 'page' only: right-hand links in the desktop site bar. */
  desktopNav?: ReactNode;
}) {
  const page = layout === 'page';
  const panel = layout === 'panel';
  // 'page' condenses its phone bar once the renter scrolls: the bar's padding
  // tightens, handing a few pixels back to the fleet. The window never scrolls
  // below lg — an inner section does — so the frame listens in the CAPTURE
  // phase (scroll does not bubble) like CookieControls. The bar sits outside
  // the scroll container, so tightening it never moves scrollTop and the
  // threshold cannot oscillate.
  const frameRef = useRef<HTMLDivElement>(null);
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    if (!page) return;
    const frame = frameRef.current;
    if (!frame) return;
    const onScroll = (event: Event) => {
      if (event.target instanceof HTMLElement) setCondensed(event.target.scrollTop > 40);
    };
    frame.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => frame.removeEventListener('scroll', onScroll, { capture: true });
  }, [page]);
  // The frame carries no shadow (MP-16: the sticky bar or aside card is each
  // surface's one elevated element). From 481px, where the 480px cage stops
  // filling the viewport, a side hairline frames it; 'page' cancels it from lg,
  // where the frame opens into the transparent 1200px page.
  const frameDesktop = page
    ? 'lg:h-auto lg:max-w-[1200px] lg:overflow-visible lg:border-0 lg:bg-transparent'
    : panel
      ? 'lg:mx-0 lg:h-[min(900px,calc(100dvh-5rem))] lg:rounded-2xl lg:border lg:border-line'
      : '';

  // MP-11: the ground + vignette as two utilities (see groundClassName) — the
  // old single background value compiled to an invalid background-color that
  // browsers dropped, so this main was transparent and the desktop storefront
  // sat on the body's #000.
  return (
    <main className={`min-h-screen ${groundClassName} text-ink ${className}`}>
      {page && (
        <SiteBar homeHref={closeHref} className="hidden lg:block">
          <div className="flex items-center gap-6">
            {desktopNav && <nav className={`flex items-center gap-7 ${eyebrowClassName} text-muted`}>{desktopNav}</nav>}
            {browseEnabled() && <SavedLink />}
          </div>
        </SiteBar>
      )}
      <div className={panel ? 'lg:mx-auto lg:flex lg:w-full lg:max-w-[1200px] lg:items-start lg:justify-center lg:gap-10 lg:px-8 lg:py-10' : ''}>
        {panel && rail && <aside className="hidden lg:sticky lg:top-10 lg:block lg:w-80 lg:shrink-0">{rail}</aside>}
        {/* A definite viewport height lets flex-1 children
            scroll internally — with min-h alone the frame grows to content and
            the "sticky" footer lands below the fold. Compact cookie controls
            are inside that footer, not above the frame. */}
        <div ref={frameRef} className={`relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-panel min-[481px]:border-x min-[481px]:border-line ${frameDesktop}`}>
          {page
            ? (
              // Below lg the storefront and vehicle detail are pages, not booking
              // steps: the lockup alone, linking home. No Back, no Close, no steps.
              // No `priority`: the bar is lg:hidden, and a preload for a 17KB logo
              // competes with the hero's LCP preload on every load.
              <div data-chrome="mobile-bar" className={`flex flex-shrink-0 items-center justify-center px-4 transition-[padding] duration-300 motion-reduce:transition-none ${condensed ? 'pb-0.5 pt-[calc(env(safe-area-inset-top)+4px)]' : 'pb-1 pt-[calc(env(safe-area-inset-top)+10px)]'} lg:hidden`}>
                <Link href={closeHref} className="flex h-10 items-center">
                  <Image src="/images/logos/drive-exotiq-lockup-transparent.png" alt="Drive Exotiq" width={110} height={22} style={{ height: 22, width: 'auto' }} className="opacity-95" />
                </Link>
              </div>
            )
            : (
              <div className={`grid flex-shrink-0 grid-cols-[40px_1fr_40px] items-center px-4 transition-[padding] duration-300 motion-reduce:transition-none ${page && condensed ? 'pb-0.5 pt-[calc(env(safe-area-inset-top)+4px)]' : 'pb-1 pt-[calc(env(safe-area-inset-top)+10px)]'} ${page ? 'lg:hidden' : ''}`}>
                <button type="button" onClick={onBack} disabled={!onBack} className="grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink disabled:opacity-30" aria-label="Back">
                  <ArrowLeft size={20} />
                </button>
                <div className="flex items-center justify-center">
                  {/* The Drive Exotiq lockup at 22px sits at the same optical size the
                      old 26px mark did inside the 40px header row (MP-12). */}
                  {/* No `priority`: a preload for a 17KB logo competes with the
                      hero's LCP preload on every load. */}
                  <Image src="/images/logos/drive-exotiq-lockup-transparent.png" alt="Drive Exotiq" width={110} height={22} style={{ height: 22, width: 'auto' }} className="opacity-95" />
                </div>
                <Link href={closeHref} className="grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink" aria-label="Close booking flow">
                  <X size={20} />
                </Link>
              </div>
            )}
          {panel && step !== undefined && <FlowProgress step={step} />}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function BookingChrome({ step, children, onBack, closeHref, rail }: { step: number; children: ReactNode; onBack?: () => void; closeHref?: string; rail?: ReactNode }) {
  return <PhoneViewport step={step} onBack={onBack} closeHref={closeHref} layout="panel" rail={rail}>{children}</PhoneViewport>;
}

/**
 * Page title on the booking surfaces: its own step is title, and a caller that
 * wants another size must pass it under a breakpoint variant. Two size steps
 * on one element do not resolve by className order or by scale: Tailwind emits
 * them sorted by name, so the alphabetically later step wins (MP-15). Variant
 * steps are emitted after base ones and always win.
 */
export function HTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`text-title leading-[1.12] text-ink ${className}`}
      style={serifStyle}
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
      className={`w-full rounded-xl px-5 py-4 text-body font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${ctaClassName}`}
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
  return <span className={large ? 'text-heading font-medium tabular-nums' : 'tabular-nums'}>{value}</span>;
}
