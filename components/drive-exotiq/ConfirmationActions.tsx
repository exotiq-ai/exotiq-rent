'use client';

import { useState } from 'react';
import { CalendarPlus, Check, Share2 } from 'lucide-react';

/**
 * Share + calendar actions on the confirmation page.
 *
 * Share deliberately links the public share card (/share/{team}/{vehicle}) —
 * hype only, no booking ref, dates, or money. The renter's own details stay
 * on this page; a details-forwarding share can come later if wanted.
 */
export function ConfirmationActions({
  bookingRef,
  vehicleName,
  teamSlug,
  vehicleSlug,
  startDate,
  endDate,
  pickupTime,
  location,
}: {
  bookingRef: string;
  vehicleName: string;
  teamSlug: string;
  vehicleSlug: string;
  /** YYYY-MM-DD, inclusive range. */
  startDate: string;
  endDate: string;
  pickupTime: string;
  location: string;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/share/${teamSlug}/${vehicleSlug}`;
    const text = `Just reserved the ${vehicleName} on Drive Exotiq.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Drive Exotiq', text, url });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // Renter dismissed the share sheet.
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };

  const addToCalendar = () => {
    // All-day range keeps the invite correct regardless of the renter's or
    // team's timezone; the exact pickup time travels in the description.
    const compact = (iso: string) => iso.replaceAll('-', '');
    const dayAfter = (iso: string) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10).replaceAll('-', '');
    };
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Drive Exotiq//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${bookingRef}@exotiq.rent`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(startDate)}`,
      `DTEND;VALUE=DATE:${dayAfter(endDate)}`,
      `SUMMARY:${escape(`${vehicleName} — Drive Exotiq`)}`,
      `LOCATION:${escape(location)}`,
      `DESCRIPTION:${escape(`Booking ${bookingRef}. Pickup ${pickupTime}.`)}\\n${escape(window.location.href)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `drive-exotiq-${bookingRef}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <>
      <button type="button" onClick={share} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8A664] px-5 py-4 text-sm font-semibold text-[#1A1308] transition active:scale-[0.99]">
        {copied ? <Check size={16} /> : <Share2 size={16} />}
        {copied ? 'Link copied' : 'Share your Exotiq'}
      </button>
      <button type="button" onClick={addToCalendar} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#2A2E3A] px-5 py-4 text-sm font-semibold text-[#F0F2F5] transition active:scale-[0.99]">
        <CalendarPlus size={16} className="text-[#C8A664]" />
        Add to calendar
      </button>
    </>
  );
}
