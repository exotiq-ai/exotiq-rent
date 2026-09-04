'use client';

import { useId, useState, type FormEvent } from 'react';
import { track } from '@/components/analytics/posthog';
import { renterCaptureUiEnabled } from '@/domain/renters/config';
import type { CaptureSource } from '@/domain/renters/validate';
import type { SavedCar } from './savedStore';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; status: 'confirm_sent' | 'delivered' | 'recorded' } | { kind: 'error'; message: string };

/**
 * One form for every capture surface (MP-14): e-mail, an optional consent
 * line, a hidden honeypot. `consentImplied` is for the footer, where the
 * thing signed up for IS the marketing e-mail, so the button is the consent.
 */
export function EmailCaptureForm({
  source,
  cta,
  placeholder = 'you@example.com',
  consentImplied = false,
  saved,
  alert,
  teamSlug,
  vehicleSlug,
  compact = false,
  className = '',
}: {
  source: CaptureSource;
  cta: string;
  placeholder?: string;
  consentImplied?: boolean;
  saved?: () => SavedCar[];
  alert?: { team_slug: string | null; vehicle_slug: string | null; start: string; end: string };
  teamSlug?: string;
  vehicleSlug?: string;
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [consent, setConsent] = useState(false);
  if (!renterCaptureUiEnabled()) return null;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const website = (form.elements.namedItem('website') as HTMLInputElement).value;
    if (!email) return;
    setStatus({ kind: 'sending' });
    track('capture_start', { source });
    try {
      const res = await fetch('/api/renters/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          website,
          source,
          consent: consentImplied || consent,
          path: window.location.pathname,
          team_slug: teamSlug,
          vehicle_slug: vehicleSlug,
          saved: saved ? saved().map((c) => ({ team_slug: c.team_slug, vehicle_slug: c.vehicle_slug })) : undefined,
          alert,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: 'confirm_sent' | 'delivered' | 'recorded'; error?: string };
      if (!res.ok || !data.status) {
        setStatus({ kind: 'error', message: data.error ?? 'Something went wrong. Try again in a moment.' });
        return;
      }
      track('capture_sent', { source, status: data.status });
      if (alert) track('alert_created', { team: alert.team_slug ?? '', vehicle: alert.vehicle_slug ?? '' });
      setStatus({ kind: 'done', status: data.status });
    } catch {
      setStatus({ kind: 'error', message: 'No connection. Try again in a moment.' });
    }
  };

  if (status.kind === 'done') {
    const copy =
      status.status === 'confirm_sent'
        ? 'Check your inbox and tap the confirmation link. That is the only e-mail until you do.'
        : status.status === 'delivered'
          ? 'Sent. It should be in your inbox in a moment.'
          : 'Done.';
    return (
      <p className={`flex items-center gap-2.5 text-[13px] text-[#9BA1B0] ${className}`} role="status">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A664]" aria-hidden />
        {copy}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className} aria-busy={status.kind === 'sending'}>
      <div className={compact ? 'flex flex-nowrap items-stretch gap-2' : 'flex flex-col gap-2 sm:flex-row sm:items-stretch'}>
        <label htmlFor={`${id}-email`} className="sr-only">E-mail address</label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 text-[13px] text-[#F0F2F5] outline-none transition placeholder:text-[#5C6272] hover:border-[#3A3F4D] focus:border-[#C8A664]/70 focus-visible:ring-2 focus-visible:ring-[#C8A664]/60"
        />
        {/* Honeypot: hidden from people, filled by bots. */}
        <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <button type="submit" disabled={status.kind === 'sending'} className="h-10 shrink-0 rounded-lg bg-[#C8A664] px-4 text-[13px] font-semibold text-[#1A1308] transition hover:brightness-105 disabled:cursor-progress disabled:opacity-60">
          {status.kind === 'sending' ? 'Sending…' : cta}
        </button>
      </div>
      {!consentImplied && (
        <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-[12px] leading-5 text-[#9BA1B0]">
          <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="control-check mt-0.5" />
          <span>Also send me first looks at new cars and early access from Drive Exotiq. Unsubscribe any time.</span>
        </label>
      )}
      {consentImplied && <p className="mt-2 text-[11px] leading-5 text-[#848A9A]">Occasional e-mail from Drive Exotiq. Unsubscribe any time.</p>}
      {status.kind === 'error' && <p className="mt-2 text-[12px] text-[#FFB84D]" role="alert">{status.message}</p>}
    </form>
  );
}
