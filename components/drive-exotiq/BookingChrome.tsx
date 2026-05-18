import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BatteryFull, Signal, Wifi, X } from 'lucide-react';

type StepStyle = 'bars' | 'numbered';

function StepIndicator({ step, total = 8, variant = 'bars' }: { step: number; total?: number; variant?: StepStyle }) {
  if (variant === 'numbered') {
    const pct = `${Math.max(0, Math.min(1, step / total)) * 100}%`;
    const labels = ['Vehicle', 'Dates', 'Driver', 'Extras', 'Protect', 'Review', 'Pay', 'Done'];

    return (
      <div className="flex items-center gap-3 px-6 pb-4 pt-1 text-[11px] uppercase tracking-[0.16em] text-[#5C6272]">
        <div className="tabular-nums"><b className="font-semibold text-[#C8A664]">{String(step).padStart(2, '0')}</b><span> / {String(total).padStart(2, '0')}</span></div>
        <div className="relative h-px flex-1 overflow-hidden rounded bg-[#2A2E3A]">
          <span className="absolute inset-y-0 left-0 bg-[#C8A664]" style={{ width: pct }} />
        </div>
        <div className="text-[10px] tracking-[0.22em]">{labels[step - 1]}</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-1 px-4 pb-4 pt-1">
      {Array.from({ length: total }).map((_, index) => {
        const current = index + 1;
        return <span key={current} className="h-[3px] w-8 rounded-full" style={{ backgroundColor: current <= step ? '#C8A664' : '#2A2E3A' }} />;
      })}
    </div>
  );
}

function StatusBar() {
  return (
    <div className="relative z-10 flex h-[50px] flex-shrink-0 items-center justify-between px-8 pt-4 text-[15px] font-semibold tabular-nums text-[#F0F2F5]">
      <span>9:41</span>
      <div className="flex items-center gap-1.5 text-[#F0F2F5]"><Signal size={14} /><Wifi size={14} /><BatteryFull size={17} /></div>
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
    <main className={`min-h-screen bg-[radial-gradient(900px_560px_at_18%_-10%,rgba(200,166,100,0.07),transparent_58%),radial-gradient(760px_520px_at_90%_110%,rgba(200,166,100,0.045),transparent_60%),#06070a] text-[#F0F2F5] md:py-10 ${className}`}>
      <div className="mx-auto w-full max-w-[393px] bg-[#050608] shadow-[0_40px_90px_-20px_rgba(0,0,0,.72),0_18px_42px_-18px_rgba(200,166,100,.18)] md:h-[818px] md:rounded-[54px] md:p-3 md:ring-1 md:ring-[#1a1c22]">
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0D0F14] md:min-h-0 md:h-full md:rounded-[42px]">
          <div className="pointer-events-none absolute left-1/2 top-0 z-30 hidden h-[34px] w-[122px] -translate-x-1/2 rounded-b-[22px] bg-[#050608] md:block" />
          <StatusBar />
          <div className="grid flex-shrink-0 grid-cols-[32px_1fr_32px] items-center px-4 pb-2 pt-3">
            <button type="button" onClick={onBack} disabled={!onBack} className="grid h-8 w-8 place-items-center rounded-lg text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5] disabled:opacity-30" aria-label="Back">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center justify-center">
              <Image src="/images/logos/drive-exotiq-logo-white.png" alt="Drive Exotiq" width={116} height={17} className="opacity-95" style={{ height: '17px', width: 'auto' }} priority />
            </div>
            <Link href="/" className="grid h-8 w-8 place-items-center rounded-lg text-[#9BA1B0] transition hover:bg-[#161922] hover:text-[#F0F2F5]" aria-label="Close booking flow">
              <X size={18} />
            </Link>
          </div>
          <StepIndicator step={step} variant={stepStyle} />
          <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100%-134px)]">{children}</div>
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 hidden h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-[#F0F2F5]/50 md:block" />
        </div>
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
  const value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
  return <span className={large ? 'text-[28px] font-medium tabular-nums' : 'tabular-nums'}>{value}</span>;
}
