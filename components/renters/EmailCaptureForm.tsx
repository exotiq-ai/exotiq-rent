'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { track } from '@/components/analytics/posthog';
import { CONSENT_TEXT } from '@/domain/renters/consentText';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';
import type { CaptureSource } from '@/domain/renters/validate';
import type { SavedCar } from './savedStore';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; status: string } | { kind: 'error'; message: string };

const DONE_COPY: Record<string, string> = {
  confirm_sent: 'Check your inbox and tap the confirmation link. That is the only e-mail until you do.',
  delivered: 'Sent. It should be in your inbox in a moment.',
  recorded: 'Done.',
  cooldown: 'We e-mailed you about this recently. Check your inbox, including spam.',
};

/**
 * One form for every capture surface (MP-14): e-mail, an optional consent
 * line, a hidden honeypot. The form stays mounted after submit so focus is
 * never dropped and the address can be corrected; the status line is an
 * always-present live region. `consentImplied` is for the footer, where
 * the thing signed up for IS the marketing e-mail, so the button is the
 * consent and its text is the versioned footer consent text.
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
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [consent, setConsent] = useState(false);
  if (!renterCaptureUiEnabled()) return null;

  const announce = (next: Status) => {
    setStatus(next);
    // Move focus to the live line so the outcome is read out and the field stays reachable.
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status.kind === 'sending') return;
    const form = event.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const hp = (form.elements.namedItem('hp_field') as HTMLInputElement).value;
    if (!email) return;
    setStatus({ kind: 'sending' });
    track('capture_start', { source });
    try {
      const res = await fetch('/api/renters/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          hp_field: hp,
          source,
          consent: consentImplied || consent,
          path: window.location.pathname,
          team_slug: teamSlug,
          vehicle_slug: vehicleSlug,
          saved: saved ? saved().map((c) => ({ team_slug: c.team_slug, vehicle_slug: c.vehicle_slug, name: c.name })) : undefined,
          alert,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.status === 502 || data.status === 'mail_failed') {
        announce({ kind: 'error', message: 'Saved, but we could not send the e-mail just now. Try again in a minute.' });
        return;
      }
      if (!res.ok || !data.status) {
        announce({ kind: 'error', message: data.error ?? 'Something went wrong. Try again in a moment.' });
        return;
      }
      track('capture_sent', { source, status: data.status });
      if (alert) track('alert_created', { team: alert.team_slug ?? '', vehicle: alert.vehicle_slug ?? '' });
      announce({ kind: 'done', status: data.status });
    } catch {
      announce({ kind: 'error', message: 'No connection. Try again in a moment.' });
    }
  };

  const done = status.kind === 'done';
  const sending = status.kind === 'sending';
  return (
    <form onSubmit={onSubmit} className={className} aria-busy={sending}>
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
          className="h-10 min-w-0 flex-1 rounded-lg border border-[#2A2E3A] bg-[#10131A] px-3 text-[13px] text-[#F0F2F5] outline-none transition placeholder:text-[#848A9A] hover:border-[#3A3F4D] focus:border-[#C8A664]/70 focus-visible:ring-2 focus-visible:ring-[#C8A664]/60"
        />
        {/* Honeypot: hidden from people and named so contact autofill leaves it alone. */}
        <input name="hp_field" type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <button type="submit" aria-disabled={sending} className="h-10 shrink-0 rounded-lg bg-[#C8A664] px-4 text-[13px] font-semibold text-[#1A1308] transition hover:brightness-105 aria-disabled:cursor-progress aria-disabled:opacity-60">
          {sending ? 'Sending…' : done ? 'Send again' : cta}
        </button>
      </div>
      {!consentImplied && (
        <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-[12px] leading-5 text-[#9BA1B0]">
          <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="control-check mt-0.5" />
          <span>{CONSENT_TEXT.form.text}</span>
        </label>
      )}
      {consentImplied && <p className="mt-2 text-[11px] leading-5 text-[#848A9A]">{CONSENT_TEXT.footer.text}</p>}
      <p
        ref={statusRef}
        tabIndex={-1}
        role={status.kind === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        className={`mt-2 flex items-start gap-2.5 text-[12px] leading-5 outline-none ${status.kind === 'error' ? 'text-[#FFB84D]' : 'text-[#9BA1B0]'} ${status.kind === 'idle' || sending ? 'sr-only' : ''}`}
      >
        {done && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A664]" aria-hidden />}
        {done ? DONE_COPY[status.status] ?? 'Done.' : status.kind === 'error' ? status.message : ''}
      </p>
    </form>
  );
}
