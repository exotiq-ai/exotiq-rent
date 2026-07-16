'use client';

import type { ReactNode } from 'react';
import { Check, CheckCircle2, ChevronRight, FileText, Plus, Upload } from 'lucide-react';
import { HTitle, Money } from '../BookingChrome';
import type { VerificationStatus } from '@/domain/booking/types';

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
    <div className="mb-5 pt-1">
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#5C6272]">{eyebrow}</div>
      <HTitle className="mt-2">{title}</HTitle>
      {sub && <p className="mt-2 text-[13px] leading-5 text-[#9BA1B0]">{sub}</p>}
    </div>
  );
}

export function ScreenShell({ children, stickySafe = true }: { children: ReactNode; stickySafe?: boolean }) {
  return (
    <div
      className={`flex-1 overflow-y-auto px-4 pt-6 [scrollbar-width:none] ${stickySafe ? 'pb-60' : 'pb-24'}`}
      style={{ fontFamily: 'var(--font-drive-inter), system-ui, sans-serif' }}
    >
      {children}
    </div>
  );
}

export function Sticky({ children }: { children: ReactNode }) {
  return (
    <div className="absolute bottom-5 left-0 right-0 z-10 border-t border-[#2A2E3A] bg-[#0D0F14] px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)] md:bottom-6">
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

export function UploadCard({
  title,
  subtitle,
  status,
  onClick,
  tone = 'gold',
}: {
  title: string;
  subtitle: string;
  status: VerificationStatus;
  onClick: () => void;
  tone?: 'gold' | 'slate';
}) {
  const verified = status === 'verified';
  const gradient = tone === 'gold'
    ? 'linear-gradient(160deg, rgba(200,166,100,0.18), rgba(200,166,100,0.04) 60%, rgba(0,0,0,0.35))'
    : 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 60%, rgba(0,0,0,0.35))';

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full overflow-hidden rounded-xl border text-left transition"
      style={{
        borderColor: verified ? '#C8A664' : '#2A2E3A',
        background: verified ? 'linear-gradient(180deg, rgba(200,166,100,0.06), rgba(200,166,100,0.015))' : '#161922',
        boxShadow: verified ? '0 0 0 1px #C8A664, 0 0 18px rgba(200,166,100,0.08)' : 'none',
      }}
    >
      <div className="relative h-[92px] border-b border-[#2A2E3A] bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.012)_0_12px,rgba(255,255,255,0.025)_12px_13px)]">
        {verified ? (
          <div className="absolute inset-y-[14px] left-[14px] right-[60px] flex items-end rounded-md border border-white/10 p-2" style={{ background: gradient }}>
            <div className="space-y-1">
              <div className="h-1 w-16 rounded bg-white/50" />
              <div className="h-[3px] w-10 rounded bg-white/30" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[#5C6272]">
            <div className="flex flex-col items-center gap-2">
              <Upload size={22} strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-[0.22em]">Tap to upload</span>
            </div>
          </div>
        )}
        {verified && <div className="absolute right-3 top-3 rounded-full bg-[#C8A664]/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#C8A664]"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#C8A664]" />Verified</div>}
      </div>
      <div className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[#F0F2F5]">{title}</div>
          <div className="mt-1 text-[11px] text-[#9BA1B0]">{subtitle}</div>
        </div>
        {verified ? <span className="text-[11px] uppercase tracking-[0.14em] text-[#5C6272]">Replace</span> : <span className="grid h-8 w-8 place-items-center rounded-full border border-[#2A2E3A] bg-[#1E2230] text-[#9BA1B0]"><Plus size={14} /></span>}
        <ChevronRight size={16} className="text-[#5C6272]" />
      </div>
    </button>
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
