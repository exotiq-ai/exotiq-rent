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
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#5C6272]">{eyebrow}</div>
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
        <FileText size={18} className="text-[#5C6272]" />
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
