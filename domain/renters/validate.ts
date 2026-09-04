/**
 * Request validation for the capture endpoint (MP-14). Pure: unit-tested
 * without a store. Anything this does not accept is a 400 before any I/O.
 */
import { MAX_WINDOW_DAYS, daysBetween, todayIso } from '../booking/marketplaceQuery';
import { addDays } from '../booking/dates';

export type CaptureSource = 'booking' | 'save_list' | 'alert' | 'footer';
const SOURCES: CaptureSource[] = ['booking', 'save_list', 'alert', 'footer'];
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Pragmatic e-mail shape: one @, no spaces, a dot in the domain. Resend does the real check. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SavedCarInput = { team_slug: string; vehicle_slug: string; name?: string };
export type AlertInput = { team_slug: string | null; vehicle_slug: string | null; start: string; end: string };

export type CaptureRequest = {
  email: string;
  name?: string;
  phone?: string;
  source: CaptureSource;
  /** Explicit marketing opt-in request. Becomes consent only on the confirmation click or a verified booking. */
  consent: boolean;
  path?: string;
  booking_ref?: string;
  /** The booking's confirmation token — the only proof that the caller made that booking. */
  booking_token?: string;
  team_slug?: string;
  vehicle_slug?: string;
  saved?: SavedCarInput[];
  alert?: AlertInput;
};

export type ValidationResult = { ok: true; value: CaptureRequest } | { ok: false; error: string };

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length === 0 ? undefined : s.slice(0, max);
}

export function validateCapture(body: unknown, today: string = todayIso()): ValidationResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Expected a JSON object.' };
  const b = body as Record<string, unknown>;
  // Honeypot: real forms never fill it (the field is named so contact autofill ignores it).
  if (typeof b.hp_field === 'string' && b.hp_field.trim() !== '') return { ok: false, error: 'Rejected.' };
  const email = str(b.email, 254)?.toLowerCase();
  if (!email || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid e-mail address.' };
  const source = str(b.source, 20) as CaptureSource | undefined;
  if (!source || !SOURCES.includes(source)) return { ok: false, error: 'Unknown source.' };
  const consent = b.consent === true;
  const name = str(b.name, 120);
  const phone = str(b.phone, 40);
  const path = str(b.path, 300);
  const booking_ref = str(b.booking_ref, 40);
  if (booking_ref && !/^[A-Za-z0-9-]+$/.test(booking_ref)) return { ok: false, error: 'Bad booking reference.' };
  const booking_token = str(b.booking_token, 200);
  if (booking_token && !/^[A-Za-z0-9._-]+$/.test(booking_token)) return { ok: false, error: 'Bad booking token.' };
  if (source === 'booking' && (!booking_ref || !booking_token)) return { ok: false, error: 'A booking capture needs its reference and token.' };
  const team_slug = str(b.team_slug, 80);
  const vehicle_slug = str(b.vehicle_slug, 80);
  if (team_slug && !SLUG.test(team_slug)) return { ok: false, error: 'Bad operator.' };
  if (vehicle_slug && !SLUG.test(vehicle_slug)) return { ok: false, error: 'Bad car.' };

  let saved: SavedCarInput[] | undefined;
  if (b.saved !== undefined) {
    if (!Array.isArray(b.saved) || b.saved.length > 60) return { ok: false, error: 'Bad saved list.' };
    saved = [];
    for (const item of b.saved) {
      if (!item || typeof item !== 'object') return { ok: false, error: 'Bad saved list.' };
      const it = item as Record<string, unknown>;
      const ts = str(it.team_slug, 80); const vs = str(it.vehicle_slug, 80);
      if (!ts || !vs || !SLUG.test(ts) || !SLUG.test(vs)) return { ok: false, error: 'Bad saved list.' };
      saved.push({ team_slug: ts, vehicle_slug: vs, name: str(it.name, 120) });
    }
  }

  let alert: AlertInput | undefined;
  if (b.alert !== undefined) {
    if (!b.alert || typeof b.alert !== 'object') return { ok: false, error: 'Bad alert.' };
    const a = b.alert as Record<string, unknown>;
    const start = str(a.start, 10); const end = str(a.end, 10);
    if (!start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end)) return { ok: false, error: 'Alert needs pickup and drop-off dates.' };
    if (end <= start) return { ok: false, error: 'Drop-off must be after pickup.' };
    // One day of grace for a renter west of UTC tapping "today" in the evening — same rule as parseDateWindow.
    if (start < addDays(today, -1)) return { ok: false, error: 'Those dates have passed.' };
    if (daysBetween(today, end) > MAX_WINDOW_DAYS) return { ok: false, error: 'Alerts cover the next six months.' };
    const ats = str(a.team_slug, 80) ?? null; const avs = str(a.vehicle_slug, 80) ?? null;
    if ((ats && !SLUG.test(ats)) || (avs && !SLUG.test(avs))) return { ok: false, error: 'Bad alert.' };
    if (avs && !ats) return { ok: false, error: 'A car alert needs its operator.' };
    alert = { team_slug: ats, vehicle_slug: avs, start, end };
  }

  if (source === 'save_list' && (!saved || saved.length === 0)) return { ok: false, error: 'Nothing saved yet.' };
  if (source === 'alert' && !alert) return { ok: false, error: 'Alert needs dates.' };
  return { ok: true, value: { email, name, phone, source, consent, path, booking_ref, booking_token, team_slug, vehicle_slug, saved, alert } };
}
