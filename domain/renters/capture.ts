/**
 * Capture orchestration (MP-14, review round). One entry point for every
 * surface: the consent line at booking, "e-mail me my list", an availability
 * alert, the footer. Rules:
 * - A person is recorded once per e-mail; later requests add to the record.
 * - Marketing consent is never written from a bare POST. A request records a
 *   PENDING consent; the confirmation click turns it on. The one exception
 *   is a booking verified by its confirmation token — the renter proved the
 *   address and ticked the box on the same screen.
 * - Nothing but the confirmation e-mail goes out until the address is
 *   confirmed, and again after an unsubscribe (alerts pause until the person
 *   clicks). Once confirmed, the thing they asked for is delivered at once,
 *   with per-address cooldowns so a stranger cannot make us mail someone.
 * - Per-IP and per-address rate limits, a cap on active alerts, no duplicate
 *   alerts, and honest outcomes: a failed send is reported, not swallowed.
 */
import { getDataMode, siteUrl } from '../booking/config';
import { formatRangeLabel } from '../booking/dates';
import { parseMarketplaceQuery } from '../booking/marketplaceQuery';
import { fetchBookingByRef } from '../booking/rpcClient';
import { getMarketplaceListings } from '../booking/service';
import type { MarketplaceListing } from '../booking/publicContracts';
import { rentersTokenSecret, rentersTokenSecretPrevious } from './config';
import { consentVersionFor } from './consentText';
import { carListHtml, layout, sendMail } from './email';
import {
  StoreError,
  addAlert,
  addSavedCars,
  cancelAlertsForRenter,
  countActiveAlerts,
  countRecentEmails,
  countRecentEvents,
  findActiveAlert,
  findRenterByConfirmHash,
  findRenterByEmail,
  findRenterById,
  insertRenter,
  listSavedCars,
  logEvent,
  patchRenter,
  type RenterRow,
} from './store';
import { hashIp, hashToken, newToken, safeEqual, unsubscribeToken, unsubscribeTokenValid } from './tokens';
import type { CaptureRequest } from './validate';

export type CaptureMeta = { ip: string; userAgent: string };
export type CaptureStatus = 'confirm_sent' | 'delivered' | 'recorded' | 'cooldown' | 'mail_failed';
export type CaptureOutcome = { status: CaptureStatus; renterId: string | null };

/** Thrown for a 429; the message is renter-facing. */
export class RateLimitedError extends Error {}
/** Thrown for a 400 the validator could not know about (needs the store); renter-facing message. */
export class CaptureRefusedError extends Error {}

const CONFIRM_RESEND_AFTER_MS = 10 * 60 * 1000;
const CONFIRM_DAILY_CAP = 5;
const DELIVERY_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_ACTIVE_ALERTS = 5;
const IP_EVENTS_PER_10_MIN = 30;
const RENTER_EVENTS_PER_10_MIN = 6;

function nowIso(): string {
  return new Date().toISOString();
}

function agoIso(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

export function unsubscribeHref(renterId: string): string {
  return `${siteUrl()}/api/renters/unsubscribe?r=${renterId}&token=${unsubscribeToken(renterId, rentersTokenSecret())}`;
}

async function catalogByKey(): Promise<Map<string, MarketplaceListing>> {
  try {
    const page = await getMarketplaceListings({ ...parseMarketplaceQuery({}), limit: 1000, offset: 0 });
    return new Map(page.listings.map((l) => [`${l.team.slug}/${l.vehicle.slug}`, l]));
  } catch {
    return new Map();
  }
}

function dollars(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

/** What this request asked for, in words for the confirmation e-mail. */
function purposes(req: CaptureRequest, renter: RenterRow, pendingConsent: boolean): string[] {
  const out: string[] = [];
  if (req.source === 'save_list') out.push('your saved cars');
  if (req.source === 'alert' && req.alert) out.push(`an alert for ${formatRangeLabel(req.alert.start, req.alert.end)}`);
  if (pendingConsent || renter.consent_requested_at) out.push('first looks at new cars and early access (occasional e-mail, unsubscribe any time)');
  if (out.length === 0) out.push('e-mail from Drive Exotiq');
  return out;
}

async function sendConfirmation(renter: RenterRow, req: CaptureRequest, pendingConsent: boolean): Promise<CaptureStatus> {
  const recent = renter.confirm_sent_at && Date.now() - Date.parse(renter.confirm_sent_at) < CONFIRM_RESEND_AFTER_MS && renter.confirm_token_hash;
  if (recent) return 'confirm_sent';
  if ((await countRecentEmails(renter.email, ['confirm'], agoIso(24 * 60 * 60 * 1000))) >= CONFIRM_DAILY_CAP) return 'cooldown';
  const token = newToken();
  // Hash first so the link works the moment the mail lands; the sent stamp
  // only after Resend accepts it, so a failed send can be retried at once.
  await patchRenter(renter.id, { confirm_token_hash: hashToken(token) });
  const href = `${siteUrl()}/api/renters/confirm?token=${token}`;
  const what = purposes(req, renter, pendingConsent);
  const list = what.length === 1 ? what[0] : `${what.slice(0, -1).join(', ')} and ${what[what.length - 1]}`;
  const resuming = Boolean(renter.confirmed_at);
  const { html, text } = layout({
    title: resuming ? 'Confirm this request.' : 'Confirm your e-mail.',
    intro: `One tap confirms ${list}. If this wasn't you, ignore this e-mail and nothing happens.`,
    cta: { label: resuming ? 'Confirm' : 'Confirm my e-mail', href },
    unsubscribeHref: unsubscribeHref(renter.id),
    why: 'You asked for this on Drive Exotiq.',
  });
  try {
    await sendMail({ to: renter.email, subject: resuming ? 'Confirm your request on Drive Exotiq' : 'Confirm your e-mail for Drive Exotiq', html, text, kind: 'confirm', renterId: renter.id, unsubscribeHref: unsubscribeHref(renter.id) });
  } catch (error) {
    console.error('[renters] confirmation mail failed', error instanceof Error ? error.message : 'error');
    return 'mail_failed';
  }
  await patchRenter(renter.id, { confirm_sent_at: nowIso() });
  return 'confirm_sent';
}

async function sendSavedList(renter: RenterRow): Promise<'delivered' | 'cooldown' | 'recorded'> {
  const saved = await listSavedCars(renter.id);
  if (saved.length === 0) return 'recorded';
  if ((await countRecentEmails(renter.email, ['saved_list'], agoIso(DELIVERY_COOLDOWN_MS))) > 0) return 'cooldown';
  const catalog = await catalogByKey();
  const cars = saved.map((s) => {
    const l = catalog.get(`${s.team_slug}/${s.vehicle_slug}`);
    const href = `${siteUrl()}/${s.team_slug}/${s.vehicle_slug}`;
    if (l) return { name: l.vehicle.name, meta: `${dollars(l.vehicle.dailyRateCents)} per day · ${l.team.name}, ${l.team.city}`, href };
    return { name: s.vehicle_name ?? 'A saved car', meta: s.vehicle_name ? s.team_slug.replace(/-/g, ' ') : 'Listing details unavailable right now', href };
  });
  const { html, text } = layout({
    title: `Your ${cars.length === 1 ? 'saved car' : `${cars.length} saved cars`}.`,
    intro: 'Here they are, with a link back to each. Prices are per day and can change with the season.',
    body: carListHtml(cars),
    cta: { label: 'Browse the fleet', href: `${siteUrl()}/browse` },
    unsubscribeHref: unsubscribeHref(renter.id),
    why: 'You asked us to e-mail your saved cars from Drive Exotiq.',
  });
  await sendMail({ to: renter.email, subject: cars.length === 1 ? `Your saved car: ${cars[0].name}` : `Your ${cars.length} saved cars`, html, text: `${text}\n\n${cars.map((c) => `${c.name} — ${c.meta}\n${c.href}`).join('\n\n')}`, kind: 'saved_list', renterId: renter.id, unsubscribeHref: unsubscribeHref(renter.id) });
  return 'delivered';
}

async function sendAlertSet(renter: RenterRow, alert: NonNullable<CaptureRequest['alert']>): Promise<'delivered' | 'cooldown'> {
  if ((await countRecentEmails(renter.email, ['alert_set'], agoIso(DELIVERY_COOLDOWN_MS))) > 0) return 'cooldown';
  const range = formatRangeLabel(alert.start, alert.end);
  const scope = alert.vehicle_slug ? 'this car' : alert.team_slug ? 'a car from this operator' : 'a car';
  const { html, text } = layout({
    title: `We're watching ${range}.`,
    intro: `The moment ${scope} is free for those dates, you'll get one e-mail with a link to book. We check every morning.`,
    unsubscribeHref: unsubscribeHref(renter.id),
    why: 'You set an availability alert on Drive Exotiq.',
  });
  await sendMail({ to: renter.email, subject: `Alert set for ${range}`, html, text, kind: 'alert_set', renterId: renter.id, unsubscribeHref: unsubscribeHref(renter.id) });
  return 'delivered';
}

type VerifiedBooking = { ref: string; team_slug: string | null; vehicle_slug: string | null };

/** A booking counts only when the tenant DB confirms the ref + token pair the renter was handed. */
async function verifyBooking(req: CaptureRequest): Promise<VerifiedBooking | null> {
  if (!req.booking_ref || !req.booking_token) return null;
  if (getDataMode() !== 'supabase') return null;
  try {
    const row = await fetchBookingByRef(req.booking_ref, req.booking_token);
    if (!row || !row.authorized) return null;
    if (req.team_slug && row.team_slug && row.team_slug !== req.team_slug) return null;
    if (req.vehicle_slug && row.vehicle_slug && row.vehicle_slug !== req.vehicle_slug) return null;
    return { ref: row.booking_ref, team_slug: row.team_slug, vehicle_slug: row.vehicle_slug };
  } catch {
    return null;
  }
}

async function enforceRateLimits(ipHash: string, renter: RenterRow | null): Promise<void> {
  const since = agoIso(10 * 60 * 1000);
  if (ipHash && (await countRecentEvents({ ip_hash: ipHash }, since)) >= IP_EVENTS_PER_10_MIN) throw new RateLimitedError('Too many requests from your connection. Try again in a few minutes.');
  if (renter && (await countRecentEvents({ renter_id: renter.id }, since)) >= RENTER_EVENTS_PER_10_MIN) throw new RateLimitedError('Too many requests for that address. Try again in a few minutes.');
}

export async function handleCapture(req: CaptureRequest, meta: CaptureMeta): Promise<CaptureOutcome> {
  const secret = rentersTokenSecret();
  const ipHash = meta.ip ? hashIp(meta.ip, secret) : '';
  const verified = req.source === 'booking' ? await verifyBooking(req) : null;
  // An unverifiable booking claim is not evidence of anything: record the attempt, touch nothing.
  if (req.source === 'booking' && !verified) {
    await logEvent({ kind: 'capture:booking:unverified', source: req.source, path: req.path ?? null, ip_hash: ipHash }).catch(() => undefined);
    return { status: 'recorded', renterId: null };
  }

  let renter = await findRenterByEmail(req.email);
  await enforceRateLimits(ipHash, renter);

  const consentEvidence = { consent_source: req.source, consent_text_version: consentVersionFor(req.source), consent_ip_hash: ipHash || null, consent_user_agent: meta.userAgent.slice(0, 300) };
  const wantsConsent = req.consent;
  let pendingConsent = false;

  if (!renter) {
    const fields: Record<string, unknown> = {
      email: req.email,
      name: verified ? req.name ?? null : null,
      phone: verified ? req.phone ?? null : null,
      first_source: req.source,
      first_path: req.path ?? null,
      first_team_slug: req.team_slug ?? null,
      first_vehicle_slug: req.vehicle_slug ?? null,
      first_booking_ref: verified?.ref ?? null,
      last_booking_ref: verified?.ref ?? null,
      bookings_count: verified ? 1 : 0,
      confirmed_at: verified ? nowIso() : null,
    };
    if (wantsConsent && verified) Object.assign(fields, { marketing_consent: true, consented_at: nowIso(), ...consentEvidence });
    else if (wantsConsent) {
      Object.assign(fields, { consent_requested_at: nowIso(), ...consentEvidence });
      pendingConsent = true;
    }
    try {
      renter = await insertRenter(fields as { email: string } & Record<string, unknown>);
    } catch (error) {
      // Two first captures for one address at once: the loser re-reads the winner's row.
      if (error instanceof StoreError && error.status === 409) renter = await findRenterByEmail(req.email);
      if (!renter) throw error;
    }
  } else {
    const patch: Record<string, unknown> = {};
    if (verified) {
      if (req.name && !renter.name) patch.name = req.name;
      if (req.phone && !renter.phone) patch.phone = req.phone;
      if (!renter.confirmed_at) patch.confirmed_at = nowIso();
      if (renter.last_booking_ref !== verified.ref) {
        patch.last_booking_ref = verified.ref;
        patch.bookings_count = renter.bookings_count + 1;
        if (!renter.first_booking_ref) patch.first_booking_ref = verified.ref;
      }
      if (wantsConsent && (!renter.marketing_consent || renter.unsubscribed_at)) Object.assign(patch, { marketing_consent: true, consented_at: nowIso(), unsubscribed_at: null, consent_requested_at: null, ...consentEvidence });
    } else if (wantsConsent && (!renter.marketing_consent || renter.unsubscribed_at)) {
      Object.assign(patch, { consent_requested_at: nowIso(), ...consentEvidence });
      pendingConsent = true;
    }
    if (Object.keys(patch).length > 0) renter = await patchRenter(renter.id, patch);
  }

  if (req.saved?.length) {
    const catalog = await catalogByKey();
    await addSavedCars(renter.id, req.saved.map((s) => ({ ...s, vehicle_name: catalog.get(`${s.team_slug}/${s.vehicle_slug}`)?.vehicle.name ?? s.name ?? null })));
  }
  if (req.alert) {
    const scope = { team_slug: req.alert.team_slug, vehicle_slug: req.alert.vehicle_slug, start_on: req.alert.start, end_on: req.alert.end };
    if (!(await findActiveAlert(renter.id, scope))) {
      if ((await countActiveAlerts(renter.id)) >= MAX_ACTIVE_ALERTS) throw new CaptureRefusedError(`You already have ${MAX_ACTIVE_ALERTS} alerts running. One of them has to fire or expire before you can add another.`);
      try {
        await addAlert(renter.id, scope);
      } catch (error) {
        if (!(error instanceof StoreError && error.status === 409)) throw error;
      }
    }
  }
  await logEvent({ renter_id: renter.id, kind: `capture:${req.source}`, source: req.source, path: req.path ?? null, ip_hash: ipHash, meta: { consent_requested: pendingConsent, consent_verified: Boolean(verified && wantsConsent), saved: req.saved?.length ?? 0, alert: Boolean(req.alert), booking: Boolean(verified) } }).catch(() => undefined);

  // A click is needed when the address is unconfirmed, alerts are paused by an
  // unsubscribe, or marketing consent is being asked for on a confirmed address.
  const needsClick = !renter.confirmed_at || Boolean(renter.alerts_paused_at) || pendingConsent;
  try {
    if (needsClick) return { status: await sendConfirmation(renter, req, pendingConsent), renterId: renter.id };
    if (req.source === 'save_list') return { status: await sendSavedList(renter), renterId: renter.id };
    if (req.source === 'alert' && req.alert) return { status: await sendAlertSet(renter, req.alert), renterId: renter.id };
  } catch (error) {
    console.error('[renters] mail failed after capture', error instanceof Error ? error.message : 'error');
    return { status: 'mail_failed', renterId: renter.id };
  }
  return { status: 'recorded', renterId: renter.id };
}

export type ConfirmOutcome = { ok: true; delivered: 'saved_list' | 'none'; marketing: boolean; renterId: string } | { ok: false };

/** The confirmation click (POST). Single use: the hash is cleared on success. */
export async function confirmByToken(token: string): Promise<ConfirmOutcome> {
  const hash = hashToken(token);
  const renter = await findRenterByConfirmHash(hash);
  if (!renter || !renter.confirm_token_hash || !safeEqual(renter.confirm_token_hash, hash)) return { ok: false };
  const patch: Record<string, unknown> = { confirmed_at: renter.confirmed_at ?? nowIso(), confirm_token_hash: null, alerts_paused_at: null };
  const marketing = Boolean(renter.consent_requested_at);
  if (marketing) Object.assign(patch, { marketing_consent: true, consented_at: nowIso(), unsubscribed_at: null, consent_requested_at: null });
  const confirmed = await patchRenter(renter.id, patch);
  await logEvent({ renter_id: renter.id, kind: marketing ? 'confirmed:with-consent' : 'confirmed' }).catch(() => undefined);
  let delivered: 'saved_list' | 'none' = 'none';
  try {
    if ((await sendSavedList(confirmed)) === 'delivered') delivered = 'saved_list';
  } catch (error) {
    console.error('[renters] saved-list mail failed after confirm', error instanceof Error ? error.message : 'error');
  }
  return { ok: true, delivered, marketing: confirmed.marketing_consent, renterId: renter.id };
}

/**
 * Unsubscribe (POST): no marketing and no alerts, and any pending
 * confirmation link is retired. The person stays on record with the date.
 */
export async function unsubscribeByToken(renterId: string, token: string): Promise<boolean> {
  if (!unsubscribeTokenValid(renterId, token, rentersTokenSecret(), rentersTokenSecretPrevious())) return false;
  const renter = await findRenterById(renterId);
  if (!renter) return false;
  await patchRenter(renter.id, { marketing_consent: false, unsubscribed_at: nowIso(), alerts_paused_at: nowIso(), consent_requested_at: null, confirm_token_hash: null });
  await cancelAlertsForRenter(renter.id);
  await logEvent({ renter_id: renter.id, kind: 'unsubscribed' }).catch(() => undefined);
  return true;
}
