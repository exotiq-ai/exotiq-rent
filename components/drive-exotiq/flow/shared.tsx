'use client';

import type { ReactNode } from 'react';
import { Check, CheckCircle2, FileText } from 'lucide-react';
import { HTitle, Money } from '../BookingChrome';

export function SelectableCard({
  children,
  selected = false,
  warning = false,
  dashed = false,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  warning?: boolean;
  dashed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl p-4 text-left transition"
      style={{
        backgroundColor: selected ? (warning ? 'rgba(255,184,77,0.08)' : 'rgba(200,166,100,0.10)') : '#161922',
        border: `${selected ? '1.5px' : '1px'} ${dashed ? 'dashed' : 'solid'} ${selected ? (warning ? '#FFB84D' : '#C8A664') : '#2A2E3A'}`,
        boxShadow: selected && !warning ? '0 0 0 1px #C8A664, 0 0 20px rgba(200,166,100,0.10)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

export function StepHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#848A9A]">{eyebrow}</div>
      <HTitle className="mt-2">{title}</HTitle>
      {sub && <p className="mt-2 text-[13px] leading-5 text-[#9BA1B0]">{sub}</p>}
    </div>
  );
}

export function ScreenShell({ children, stickySafe = true }: { children: ReactNode; stickySafe?: boolean }) {
  return (
    <div
      // min-h-0 is load-bearing: without it this flex child grows to its
      // content instead of scrolling, pushing the "sticky" footer below the
      // fold on long steps (review/pay).
      className={`min-h-0 flex-1 overflow-y-auto px-4 pt-2 [scrollbar-width:none] ${stickySafe ? 'pb-48' : 'pb-20'}`}
      style={{ fontFamily: 'var(--font-drive-inter), system-ui, sans-serif' }}
    >
      {children}
    </div>
  );
}

export function Sticky({ children }: { children: ReactNode }) {
  return (
    <div className="absolute bottom-4 left-0 right-0 z-10 border-t border-[#2A2E3A] bg-[#0D0F14] px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)] md:bottom-5">
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function RunningTotalCard({
  label,
  detail,
  amountCents,
  accent = true,
}: {
  label: string;
  detail?: string;
  amountCents: number;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-[#C8A664] bg-[#14130F] shadow-[0_0_0_1px_#C8A664,0_0_24px_rgba(200,166,100,.10)]' : 'border-[#2A2E3A] bg-[#161922]'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-[#F0F2F5]">{label}</div>
          {detail && <div className="mt-1 text-[11px] text-[#9BA1B0]">{detail}</div>}
        </div>
        <Money cents={amountCents} large />
      </div>
    </div>
  );
}

export function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${checked ? 'border-[#C8A664] bg-[#C8A664]/15 text-[#C8A664]' : 'border-[#2A2E3A] text-transparent'}`}>
      {checked && <Check size={12} />}
    </span>
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
      <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4" aria-busy="true">
        <div className="text-sm font-medium text-[#F0F2F5]">Confirming final pricing…</div>
        <p className="mt-1 text-xs leading-5 text-[#848A9A]">Checking today&apos;s rate and availability with the operator.</p>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <div className="animate-shimmer h-3 w-1/2 rounded bg-[#1E2230]" />
              <div className="animate-shimmer h-3 w-16 rounded bg-[#1E2230]" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-[#FFB84D]/45 bg-[#FFB84D]/10 p-4">
      <div className="text-sm font-medium text-[#FFB84D]">We couldn&apos;t confirm final pricing</div>
      <p className="mt-1 text-xs leading-5 text-[#F0F2F5]">{message ?? 'Please try again in a moment.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-[#FFB84D]/45 px-4 py-2 text-xs font-semibold text-[#F0F2F5]">
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
    <div className="mt-4 rounded-xl border border-dashed border-[#5C6272] bg-[#10131A] p-4 text-sm">
      <div className="text-[#F0F2F5]">Damage deposit at pickup</div>
      <p className="mt-2 text-xs leading-5 text-[#848A9A]">
        {operatorName} collects a refundable damage deposit at pickup. Amount and accepted
        payment methods vary by operator — they&apos;ll confirm before handoff.
      </p>
      <p className="mt-1 text-xs leading-5 text-[#848A9A]">
        Not included in the total below.
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
    <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
      <div className="mb-3 flex justify-between">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-1 text-[11px] text-[#C8A664]">{note}</div>
        </div>
        <FileText size={18} className="text-[#848A9A]" />
      </div>
      {rows.map(([label, detail, amount, action]) => (
        <button key={label} type="button" onClick={action} className="flex w-full justify-between border-t border-[#2A2E3A] py-3 text-left text-sm">
          <span>
            <span className="block">{label}</span>
            <span className="text-xs text-[#9BA1B0]">{detail}</span>
          </span>
          <Money cents={amount} />
        </button>
      ))}
      <div className="flex justify-between border-t border-[#2A2E3A] pt-3 text-sm font-medium">
        <span>Total</span>
        <Money cents={total} />
      </div>
    </div>
  );
}

export function VerifiedPill() {
  return <CheckCircle2 size={20} className="text-[#C8A664]" />;
}
