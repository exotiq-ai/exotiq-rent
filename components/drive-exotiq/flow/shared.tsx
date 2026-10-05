'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { HTitle, Money } from '../BookingChrome';
import { microLabelClassName } from '@/components/browse/tokens';
import { CookieControls } from '@/components/analytics/CookieControls';

export function StepHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <div className={`${microLabelClassName} text-faint`}>{eyebrow}</div>
      <HTitle className="mt-2">{title}</HTitle>
      {sub && <p className="mt-2 text-body-sm leading-5 text-muted">{sub}</p>}
    </div>
  );
}

export function ScreenShell({ children, stickySafe = true }: { children: ReactNode; stickySafe?: boolean }) {
  return (
    <div
      // min-h-0 is load-bearing: without it this flex child grows to its
      // content instead of scrolling, pushing the "sticky" footer below the
      // fold on long steps (review/pay).
      className={`min-h-0 flex-1 overflow-y-auto px-4 pt-2 [scrollbar-width:none] ${stickySafe ? 'pb-64' : 'pb-20'}`}
      style={{ fontFamily: 'var(--font-drive-inter), system-ui, sans-serif' }}
    >
      {children}
    </div>
  );
}

export function Sticky({ children }: { children: ReactNode }) {
  return (
    <div className="absolute bottom-4 left-0 right-0 z-10 border-t border-line bg-panel px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)] md:bottom-5">
      <CookieControls />
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** The running total in the Dates bar: a hairline row, the gold on the figure, not the frame (MP-16, D2). */
export function RunningTotalCard({
  label,
  detail,
  amountCents,
}: {
  label: string;
  detail?: string;
  amountCents: number;
}) {
  return (
    <div className="border-t border-line pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-body-sm font-medium text-ink">{label}</div>
          {detail && <div className="mt-1 text-label text-muted">{detail}</div>}
        </div>
        <span className="text-gold"><Money cents={amountCents} large /></span>
      </div>
    </div>
  );
}

/**
 * Shown in place of money when the server quote is pending or unavailable.
 * Deliberately renders no figures: a stale or invented number that looks
 * plausible is worse than an honest absence, because the renter would agree
 * to it.
 */
export function QuoteNotice({
  pending,
  message,
  onRetry,
}: {
  pending?: boolean;
  message?: string;
  onRetry?: () => void;
}) {
  if (pending) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-surface p-4" aria-busy="true">
        <div className="text-body font-medium text-ink">Confirming final pricing…</div>
        <p className="mt-1 text-body-sm leading-5 text-faint">Checking today&apos;s rate and availability with the operator.</p>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <div className="animate-shimmer h-3 w-1/2 rounded bg-surface2" />
              <div className="animate-shimmer h-3 w-16 rounded bg-surface2" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-danger/45 bg-danger/10 p-4">
      <div className="text-body font-medium text-danger">We couldn&apos;t confirm final pricing</div>
      <p className="mt-1 text-body-sm leading-5 text-ink">{message ?? 'Please try again in a moment.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-danger/45 px-4 py-2 text-body-sm font-semibold text-ink">
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Damage-deposit disclosure (FINAL decision, docs/rent/DECISION_MEMO_DEPOSIT_HOLD.md
 * 2026-07-26). Exotiq never touches the deposit: no hold, no charge, no card on
 * file, no Stripe object. The renter settles it with the operator at pickup, by
 * whatever method that operator accepts — which is the point, since keeping it
 * offline is what lets operators take methods a card-only flow would exclude.
 *
 * Quotes NO amount, by design. Operators set and vary their own figures, so a
 * number here is a promise Exotiq cannot keep and would be argued back at us
 * when the counter asks for something different.
 *
 * Rendered UNCONDITIONALLY, not gated on a value. The previous card was gated on
 * `depositHoldCents > 0`, so the moment the backend started returning 0 the whole
 * disclosure silently vanished — leaving renters to discover a five-figure
 * deposit at handoff with no warning. Verified that had already happened in
 * production. An expectation this consequential must not hinge on a number.
 *
 * Still names the operator but does not contrast them against Exotiq: the pilot
 * tenant is itself called "Drive Exotiq", which turned "not Exotiq" phrasing
 * into "Drive Exotiq, not Exotiq".
 */
export function DepositDisclosure({ operatorName }: { operatorName: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-dim2 bg-field p-4 text-body">
      <div className="text-ink">Damage deposit at pickup</div>
      <p className="mt-2 text-body-sm leading-5 text-faint">
        {operatorName} collects a refundable deposit at pickup. Amount and accepted methods
        vary by operator. Separate from the total you pay Exotiq today.
      </p>
    </div>
  );
}

export function Breakdown({
  title,
  note,
  rows,
  total,
}: {
  title: string;
  note: string;
  rows: [string, string, number, (() => void)?][];
  total: number;
}) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-3 flex justify-between">
        <div>
          <div className="text-body font-medium">{title}</div>
          <div className="mt-1 text-label text-faint">{note}</div>
        </div>
        <FileText size={16} className="text-faint" />
      </div>
      {rows.map(([label, detail, amount, action]) => (
        <button key={label} type="button" onClick={action} className="flex w-full justify-between border-t border-line py-3 text-left text-body">
          <span>
            <span className="block">{label}</span>
            <span className="text-label text-muted">{detail}</span>
          </span>
          <Money cents={amount} />
        </button>
      ))}
      <div className="flex justify-between border-t border-line pt-3 text-body font-medium">
        <span>Total</span>
        <Money cents={total} />
      </div>
    </div>
  );
}

export function VerifiedPill() {
  return <CheckCircle2 size={20} className="text-verified" />;
}
