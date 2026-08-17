import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { ExotiqLockup } from './ExotiqLockup';

type StepStyle = 'bars' | 'numbered';

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
}: {
  step: number;
  children: ReactNode;
  onBack?: () => void;
  stepStyle?: StepStyle;
  className?: string;
}) {
  return (
    <main className={`min-h-screen bg-[radial-gradient(900px_560px_at_18%_-10%,rgba(200,166,100,0.07),transparent_58%),radial-gradient(760px_520px_at_90%_110%,rgba(200,166,100,0.045),transparent_60%),#06070a] text-[#F0F2F5] ${className}`}>
      {/* h-dvh (not min-h): the frame needs a definite height so flex-1 children
          scroll internally — with min-h alone the frame grows to content and
          the "sticky" footer lands below the fold on long steps. */}
      <div className="relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-[#0D0F14] shadow-[0_40px_90px_-20px_rgba(0,0,0,.72),0_18px_42px_-18px_rgba(200,166,100,.18)]">
        <div className="grid flex-shrink-0 grid-cols-[40px_1fr_40px] items-center px-4 pb-1 pt-[calc(env(safe-area-inset-top)+10px)]">
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
          <Link href="/" className="grid h-10 w-10 place-items-center rounded-lg text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5]" aria-label="Close booking flow">
            <X size={20} />
          </Link>
        </div>
        <StepIndicator step={step} variant={stepStyle} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </main>
  );
}

export function BookingChrome({ step, children, onBack }: { step: number; children: ReactNode; onBack?: () => void }) {
  return <PhoneViewport step={step} onBack={onBack}>{children}</PhoneViewport>;
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
