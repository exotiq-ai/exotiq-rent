/**
 * Capture orchestration (MP-14, review round 3). One entry point for every
 * surface: the consent line at booking, "e-mail me my list", an availability
 * alert, the footer. Rules:
 * - A person is recorded once per e-mail; later requests add to the record.
 * - Nothing a bare POST says is trusted about the address. Every request
 *   records what was asked (its SCOPE) and the confirmation click applies
 *   exactly the scope named in the mail that carried the link: address,
 *   list, alert, consent. A stranger's consent request can only ever reach
 *   the mailbox owner as a mail that says "first looks" on it.
 * - A booking counts as proof of the address only when the tenant DB binds
 *   the booking to it (customer_email_hash — pending a Lovable change); until
 *   then a booking capture takes the same click path as everything else.
 * - Once confirmed and not paused, requested e-mail is delivered at once with
 *   per-address cooldowns; unsubscribe pauses alerts and retires pending
 *   links; per-IP and per-address limits apply before anything else.
 */
import { createHash } from 'node:crypto';
import { getDataMode, siteUrl } from '../booking/config';
import { formatRangeLabel } from '../booking/dates';
import { parseMarketplaceQuery } from '../booking/marketplaceQuery';
import { fetchBookingByRef, fetchPublicVehicle } from '../booking/rpcClient';
import { getMarketplaceListings } from '../booking/service';
import type { MarketplaceListing } from '../booking/publicContracts';
import { rentersTokenSecret, rentersTokenSecretPrevious } from './config';
import { CONSENT_TEXT, consentVersionFor } from './consentText';
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
export type CaptureStatus = 'confirm_sent' | 'delivered' | 'alert_set' | 'recorded' | 'cooldown' | 'mail_failed';
export type CaptureOutcome = { status: CaptureStatus; renterId: string | null };

/** Thrown for a 429; the message is renter-facing. */
export class RateLimitedError extends Error {}
/** Thrown for a 400 the validator could not know about (needs the store); renter-facing message. */
export class CaptureRefusedError extends Error {}

export type Scope = 'address' | 'list' | 'alert' | 'consent';

const CONFIRM_RESEND_AFTER_MS = 10 * 60 * 1000;
const CONFIRM_REUSE_MS = 24 * 60 * 60 * 1000;
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CONFIRM_DAILY_CAP = 5;
const CONFIRM_DAILY_CAP_PAUSED = 1;
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

export function parseScope(raw: string | null | undefined): Set<Scope> {
  return new Set((raw ?? '').split(',').filter((s): s is Scope => s === 'address' || s === 'list' || s === 'alert' || s === 'consent'));
}

async function catalogByKey(): Promise<Map<string, MarketplaceListing>> {
  try {
    const page = await getMarketplaceListings({ ...parseMarketplaceQuery({}), limit: 1000, offset: 0 });
    return new Map(page.listings.map((l) => [`${l.team.slug}/${l.vehicle.slug}`, l]));
  } catch {
    return new Map();
  }
}

/** A car's public name, from the marketplace catalog or the storefront read — never from the request. */
async function resolveVehicleName(catalog: Map<string, MarketplaceListing>, teamSlug: string, vehicleSlug: string): Promise<string | null> {
  const hit = catalog.get(`${teamSlug}/${vehicleSlug}`);
  if (hit) return hit.vehicle.name;
  if (getDataMode() !== 'supabase') return null;
  try {
    const row = await fetchPublicVehicle(teamSlug, vehicleSlug);
    return row?.name ?? null;
  } catch {
    return null;
  }
}

function dollars(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

/** What a scope means, in words, for the mail and the confirm page. */
export function describeScope(scope: Set<Scope>, alertRange?: string): string[] {
  const out: string[] = [];
  if (scope.has('list')) out.push('your saved cars');
  if (scope.has('alert')) out.push(alertRange ? `an availability alert for ${alertRange}` : 'your availability alert');
  if (scope.has('consent')) out.push(CONSENT_TEXT.confirm.text);
  if (out.length === 0) out.push('this e-mail address');
  return out;
}

function joinWords(what: string[]): string {
  return what.length === 1 ? what[0] : `${what.slice(0, -1).join(', ')} and ${what[what.length - 1]}`;
}

/**
 * Send (or re-use) the confirmation link for a scope. A live pending link
 * whose scope already covers the ask is re-used: nothing is sent inside ten
 * minutes of its mail. Any other ask mints a fresh link naming exactly that
 * ask (latest ask wins: a stranger's request can never be folded into the
 * owner's mail, and an earlier link then stops working).
 */
async function sendConfirmation(renter: RenterRow, want: Set<Scope>, alertRange: string | undefined): Promise<{ status: CaptureStatus; renter: RenterRow }> {
  const paused = Boolean(renter.alerts_paused_at);
  const issued = renter.confirm_issued_at ? Date.parse(renter.confirm_issued_at) : 0;
  const live = Boolean(renter.confirm_token_hash) && Date.now() - issued < CONFIRM_REUSE_MS;
  const existing = parseScope(renter.confirm_scope);
  const covered = live && Array.from(want).every((s) => existing.has(s));
  // The ten-minute gate counts only a mail that carried THIS link (a failed mint after an earlier send must not hide behind the old stamp).
  const sentThisLink = Boolean(renter.confirm_sent_at && renter.confirm_issued_at && Date.parse(renter.confirm_sent_at) >= Date.parse(renter.confirm_issued_at));
  if (covered && sentThisLink && Date.now() - Date.parse(renter.confirm_sent_at!) < CONFIRM_RESEND_AFTER_MS) return { status: 'confirm_sent', renter };
  if ((await countRecentEmails(renter.email, ['confirm'], agoIso(24 * 60 * 60 * 1000))) >= (paused ? CONFIRM_DAILY_CAP_PAUSED : CONFIRM_DAILY_CAP)) return { status: 'cooldown', renter };

  const scope = new Set<Scope>(['address'].concat(Array.from(want)) as Scope[]);
  let token: string | null = null;
  let current = renter;
  if (!covered) {
    // Hash first so the link works the moment the mail lands; the sent stamp only after Resend accepts.
    token = newToken();
    current = await patchRenter(renter.id, { confirm_token_hash: hashToken(token), confirm_scope: Array.from(scope).join(','), confirm_issued_at: nowIso() });
  }
  // Re-sending an existing link needs its plaintext, which is not stored: mint anew (the old link keeps working
  // only inside the ten-minute window above, which is the case that matters — a double tap).
  if (!token) {
    token = newToken();
    current = await patchRenter(renter.id, { confirm_token_hash: hashToken(token), confirm_scope: Array.from(scope).join(','), confirm_issued_at: nowIso() });
  }
  const href = `${siteUrl()}/api/renters/confirm?token=${token}`;
  const what = joinWords(describeScope(scope, alertRange));
  const resuming = Boolean(renter.confirmed_at);
  const { html, text } = layout({
    title: resuming ? 'Confirm this request.' : 'Confirm your e-mail.',
    intro: `One tap confirms ${what}. If this wasn't you, ignore this e-mail and nothing happens.`,
    cta: { label: scope.has('consent') ? CONSENT_TEXT.confirm.button : resuming ? 'Confirm' : 'Confirm my e-mail', href },
    unsubscribeHref: unsubscribeHref(renter.id),
    why: 'You asked for this on Drive Exotiq.',
  });
  try {
    await sendMail({ to: renter.email, subject: resuming ? 'Confirm your request on Drive Exotiq' : 'Confirm your e-mail for Drive Exotiq', html, text, kind: 'confirm', renterId: renter.id, unsubscribeHref: unsubscribeHref(renter.id) });
  } catch (error) {
    console.error('[renters] confirmation mail failed', error instanceof Error ? error.message : 'error');
    return { status: 'mail_failed', renter: current };
  }
  return { status: 'confirm_sent', renter: await patchRenter(renter.id, { confirm_sent_at: nowIso() }) };
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
    return { name: s.vehicle_name ?? 'A saved car', meta: s.team_slug.replace(/-/g, ' '), href };
  });
  const { html, text } = layout({
    title: `Your ${cars.length === 1 ? 'saved car' : `${cars.length} saved cars`}.`,
    intro: 'Here they are, with a link back to each. Prices are per day and can change with the season.',
    body: carListHtml(cars),
    cta: { label: 'Browse the fleet', href: `${siteUrl()}/browse` },
    unsubscribeHref: unsubscribeHref(renter.id),
    why: 'You asked us to e-mail your saved cars from Drive Exotiq.',
  });
  await sendMail({ to: renter.email, subject: 'Your saved cars on Drive Exotiq', html, text: `${text}\n\n${cars.map((c) => `${c.name} — ${c.meta}\n${c.href}`).join('\n\n')}`, kind: 'saved_list', renterId: renter.id, unsubscribeHref: unsubscribeHref(renter.id) });
  return 'delivered';
}

async function sendAlertSet(renter: RenterRow, alert: NonNullable<CaptureRequest['alert']>): Promise<'delivered' | 'alert_set'> {
  if ((await countRecentEmails(renter.email, ['alert_set'], agoIso(DELIVERY_COOLDOWN_MS))) > 0) return 'alert_set';
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

/**
 * A booking proves the address only when the tenant DB returns the e-mail
 * hash for an authorized ref + token and it matches. Until the backend ships
 * that column, this always returns null and the booking takes the click path.
 */
async function verifyBooking(req: CaptureRequest): Promise<VerifiedBooking | null> {
  if (!req.booking_ref || !req.booking_token) return null;
  if (getDataMode() !== 'supabase') return null;
  try {
    const row = await fetchBookingByRef(req.booking_ref, req.booking_token);
    if (!row || !row.authorized || !row.customer_email_hash) return null;
    const expected = createHash('sha256').update(req.email.trim().toLowerCase()).digest('hex');
    if (!safeEqual(row.customer_email_hash, expected)) return null;
    if (req.team_slug && row.team_slug && row.team_slug !== req.team_slug) return null;
    if (req.vehicle_slug && row.vehicle_slug && row.vehicle_slug !== req.vehicle_slug) return null;
    return { ref: row.booking_ref, team_slug: row.team_slug, vehicle_slug: row.vehicle_slug };
  } catch {
    return null;
  }
}

async function enforceIpLimit(ipHash: string): Promise<void> {
  if (ipHash && (await countRecentEvents({ ip_hash: ipHash }, agoIso(10 * 60 * 1000))) >= IP_EVENTS_PER_10_MIN) throw new RateLimitedError('Too many requests from your connection. Try again in a few minutes.');
}

async function enforceRenterLimit(renter: RenterRow): Promise<void> {
  if ((await countRecentEvents({ renter_id: renter.id }, agoIso(10 * 60 * 1000))) >= RENTER_EVENTS_PER_10_MIN) throw new RateLimitedError('Too many requests for that address. Try again in a few minutes.');
}

export async function handleCapture(req: CaptureRequest, meta: CaptureMeta): Promise<CaptureOutcome> {
  const secret = rentersTokenSecret();
  const ipHash = meta.ip ? hashIp(meta.ip, secret) : '';
  await enforceIpLimit(ipHash);
  const verified = req.source === 'booking' ? await verifyBooking(req) : null;

  let renter = await findRenterByEmail(req.email);
  if (renter) await enforceRenterLimit(renter);
  const evidence = { consent_source: req.source, consent_text_version: consentVersionFor(req.source), consent_ip_hash: ipHash || null, consent_user_agent: meta.userAgent.slice(0, 300) };
  const wantsConsent = req.consent;

  // Refuse before writing anything the renter would have to undo.
  if (renter && req.alert) {
    const scope = { team_slug: req.alert.team_slug, vehicle_slug: req.alert.vehicle_slug, start_on: req.alert.start, end_on: req.alert.end };
    if (!(await findActiveAlert(renter.id, scope)) && (await countActiveAlerts(renter.id)) >= MAX_ACTIVE_ALERTS) {
      await logEvent({ renter_id: renter.id, kind: 'capture:alert:refused', source: req.source, path: req.path ?? null, ip_hash: ipHash }).catch(() => undefined);
      throw new CaptureRefusedError(`You already have ${MAX_ACTIVE_ALERTS} alerts running. One of them has to fire or expire before you can add another.`);
    }
  }

  if (!renter) {
    try {
      renter = await insertRenter({ email: req.email, first_source: req.source, first_path: req.path ?? null, first_team_slug: req.team_slug ?? null, first_vehicle_slug: req.vehicle_slug ?? null });
    } catch (error) {
      // Two first captures for one address at once: the loser continues on the winner's row below.
      if (!(error instanceof StoreError && error.status === 409)) throw error;
      renter = await findRenterByEmail(req.email);
      if (!renter) throw error;
    }
  }

  const patch: Record<string, unknown> = {};
  let pendingConsent = false;
  if (verified) {
    if (req.name && !renter.name) patch.name = req.name;
    if (!renter.confirmed_at) patch.confirmed_at = nowIso();
    if (renter.last_booking_ref !== verified.ref) {
      patch.last_booking_ref = verified.ref;
      patch.bookings_count = renter.bookings_count + 1;
      if (!renter.first_booking_ref) patch.first_booking_ref = verified.ref;
    }
    if (wantsConsent && (!renter.marketing_consent || renter.unsubscribed_at)) Object.assign(patch, { marketing_consent: true, consented_at: nowIso(), unsubscribed_at: null, alerts_paused_at: null, consent_requested_at: null, ...evidence });
  } else if (wantsConsent && (!renter.marketing_consent || renter.unsubscribed_at)) {
    // Recorded as a request only; the evidence of the eventual consent is the click.
    Object.assign(patch, { consent_requested_at: nowIso(), ...evidence });
    pendingConsent = true;
  }
  if (Object.keys(patch).length > 0) renter = await patchRenter(renter.id, patch);

  if (req.saved?.length) {
    const catalog = await catalogByKey();
    const named = await Promise.all(req.saved.map(async (s) => ({ ...s, vehicle_name: await resolveVehicleName(catalog, s.team_slug, s.vehicle_slug) })));
    // A car nothing public knows about is not saved: no request-supplied text ever reaches a mail.
    await addSavedCars(renter.id, named.filter((s) => s.vehicle_name !== null));
  }
  if (req.alert) {
    const scope = { team_slug: req.alert.team_slug, vehicle_slug: req.alert.vehicle_slug, start_on: req.alert.start, end_on: req.alert.end };
    if (!(await findActiveAlert(renter.id, scope))) {
      try {
        await addAlert(renter.id, scope);
      } catch (error) {
        if (!(error instanceof StoreError && error.status === 409)) throw error;
      }
    }
  }
  await logEvent({ renter_id: renter.id, kind: `capture:${req.source}`, source: req.source, path: req.path ?? null, ip_hash: ipHash, meta: { consent_requested: pendingConsent, consent_verified: Boolean(verified && wantsConsent), saved: req.saved?.length ?? 0, alert: Boolean(req.alert), booking: Boolean(verified), booking_claimed: req.source === 'booking' && !verified } }).catch(() => undefined);

  // What must be confirmed by a click, and what can go out now.
  const want = new Set<Scope>();
  if (req.source === 'save_list') want.add('list');
  if (req.alert) want.add('alert');
  if (pendingConsent) want.add('consent');
  const alertRange = req.alert ? formatRangeLabel(req.alert.start, req.alert.end) : undefined;
  const needsClick = want.size > 0 && (!renter.confirmed_at || Boolean(renter.alerts_paused_at) || pendingConsent);
  try {
    if (needsClick) return { status: (await sendConfirmation(renter, want, alertRange)).status, renterId: renter.id };
    if (req.source === 'save_list') return { status: await sendSavedList(renter), renterId: renter.id };
    if (req.alert) return { status: await sendAlertSet(renter, req.alert), renterId: renter.id };
  } catch (error) {
    console.error('[renters] mail failed after capture', error instanceof Error ? error.message : 'error');
    return { status: 'mail_failed', renterId: renter.id };
  }
  return { status: 'recorded', renterId: renter.id };
}

export type ConfirmOutcome = { ok: true; delivered: 'saved_list' | 'none'; marketing: boolean; alerts: boolean; renterId: string } | { ok: false };

/** The pending link's scope, for the confirm page (read-only; unknown tokens learn nothing). */
export async function pendingScopeForToken(token: string): Promise<Set<Scope> | null> {
  const renter = await findRenterByConfirmHash(hashToken(token));
  if (!renter || !renter.confirm_issued_at || Date.now() - Date.parse(renter.confirm_issued_at) > CONFIRM_TTL_MS) return null;
  return parseScope(renter.confirm_scope);
}

/** The confirmation click (POST). Applies exactly the link's scope; single use; seven-day life. */
export async function confirmByToken(token: string, meta: CaptureMeta): Promise<ConfirmOutcome> {
  const hash = hashToken(token);
  const renter = await findRenterByConfirmHash(hash);
  if (!renter || !renter.confirm_token_hash || !safeEqual(renter.confirm_token_hash, hash)) return { ok: false };
  const issued = renter.confirm_issued_at ? Date.parse(renter.confirm_issued_at) : 0;
  if (Date.now() - issued > CONFIRM_TTL_MS) {
    await patchRenter(renter.id, { confirm_token_hash: null, confirm_scope: null });
    return { ok: false };
  }
  const scope = parseScope(renter.confirm_scope);
  const patch: Record<string, unknown> = { confirmed_at: renter.confirmed_at ?? nowIso(), confirm_token_hash: null, confirm_scope: null };
  // Alerts nobody clicked for (an address still unconfirmed, or paused since) must not ride a click whose mail did not name them.
  if (!scope.has('alert') && (!renter.confirmed_at || renter.alerts_paused_at)) await cancelAlertsForRenter(renter.id);
  if (scope.has('alert')) patch.alerts_paused_at = null;
  const marketing = scope.has('consent') && Boolean(renter.consent_requested_at);
  if (marketing) {
    const ipHash = meta.ip ? hashIp(meta.ip, rentersTokenSecret()) : null;
    // The click is the consent event: its evidence replaces the request's. It grants marketing only — alerts have their own scope.
    Object.assign(patch, { marketing_consent: true, consented_at: nowIso(), unsubscribed_at: null, consent_requested_at: null, consent_ip_hash: ipHash, consent_user_agent: meta.userAgent.slice(0, 300) });
  }
  const confirmed = await patchRenter(renter.id, patch);
  await logEvent({ renter_id: renter.id, kind: marketing ? 'confirmed:with-consent' : 'confirmed', ip_hash: meta.ip ? hashIp(meta.ip, rentersTokenSecret()) : null, meta: { scope: Array.from(scope), confirm_text_version: CONSENT_TEXT.confirm.version } }).catch(() => undefined);
  let delivered: 'saved_list' | 'none' = 'none';
  if (scope.has('list')) {
    try {
      if ((await sendSavedList(confirmed)) === 'delivered') delivered = 'saved_list';
    } catch (error) {
      console.error('[renters] saved-list mail failed after confirm', error instanceof Error ? error.message : 'error');
    }
  }
  return { ok: true, delivered, marketing: confirmed.marketing_consent, alerts: scope.has('alert'), renterId: renter.id };
}

/**
 * Unsubscribe (POST): no marketing and no alerts, and any pending
 * confirmation link is retired. The person stays on record with the date.
 */
export async function unsubscribeByToken(renterId: string, token: string): Promise<boolean> {
  if (!unsubscribeTokenValid(renterId, token, rentersTokenSecret(), rentersTokenSecretPrevious())) return false;
  const renter = await findRenterById(renterId);
  if (!renter) return false;
  await patchRenter(renter.id, { marketing_consent: false, unsubscribed_at: nowIso(), alerts_paused_at: nowIso(), consent_requested_at: null, confirm_token_hash: null, confirm_scope: null });
  await cancelAlertsForRenter(renter.id);
  await logEvent({ renter_id: renter.id, kind: 'unsubscribed' }).catch(() => undefined);
  return true;
}
