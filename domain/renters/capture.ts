/**
 * Capture orchestration (MP-14). One entry point for every surface: the
 * consent line at booking, "e-mail me my list", an availability alert, the
 * footer. Rules:
 * - A person is recorded once per e-mail; later requests add to the record.
 * - Marketing consent is only ever turned ON by an explicit `consent: true`;
 *   a later request without it never turns it off.
 * - Nothing but the confirmation e-mail goes out until the address is
 *   confirmed (double opt-in). Once confirmed, the thing they asked for is
 *   delivered immediately.
 * - Failures after the record is written are logged, not thrown: the renter
 *   never sees a 500 because Resend blinked.
 */
import { siteUrl } from '../booking/config';
import { formatRangeLabel } from '../booking/dates';
import { parseMarketplaceQuery } from '../booking/marketplaceQuery';
import { getMarketplaceListings } from '../booking/service';
import type { MarketplaceListing } from '../booking/publicContracts';
import { rentersTokenSecret } from './config';
import { carListHtml, layout, sendMail } from './email';
import { addAlert, addSavedCars, findRenterByConfirmHash, findRenterByEmail, insertRenter, listSavedCars, logEvent, patchRenter, cancelAlertsForRenter, findRenterById, type RenterRow } from './store';
import { hashIp, hashToken, newToken, safeEqual, unsubscribeToken } from './tokens';
import type { CaptureRequest } from './validate';

export type CaptureMeta = { ip: string; userAgent: string };
export type CaptureOutcome = { status: 'confirm_sent' | 'delivered' | 'recorded'; renterId: string };

const CONFIRM_RESEND_AFTER_MS = 10 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function unsubscribeHref(renterId: string): string {
  return `${siteUrl()}/api/renters/unsubscribe?r=${renterId}&token=${unsubscribeToken(renterId, rentersTokenSecret())}`;
}

async function catalogByKey(): Promise<Map<string, MarketplaceListing>> {
  const page = await getMarketplaceListings({ ...parseMarketplaceQuery({}), limit: 1000, offset: 0 });
  return new Map(page.listings.map((l) => [`${l.team.slug}/${l.vehicle.slug}`, l]));
}

function dollars(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function whatFor(req: Pick<CaptureRequest, 'source' | 'alert'>): string {
  if (req.source === 'save_list') return 'your saved cars';
  if (req.source === 'alert' && req.alert) return `an alert for ${formatRangeLabel(req.alert.start, req.alert.end)}`;
  return 'first looks at new cars';
}

async function sendConfirmation(renter: RenterRow, req: CaptureRequest): Promise<RenterRow> {
  // Reuse a fresh pending token so a double tap sends one link, not two.
  const recent = renter.confirm_sent_at && Date.now() - Date.parse(renter.confirm_sent_at) < CONFIRM_RESEND_AFTER_MS && renter.confirm_token_hash;
  if (recent) return renter;
  const token = newToken();
  const updated = await patchRenter(renter.id, { confirm_token_hash: hashToken(token), confirm_sent_at: nowIso() });
  const href = `${siteUrl()}/api/renters/confirm?token=${token}`;
  const what = whatFor(req);
  const { html, text } = layout({
    title: 'Confirm your e-mail.',
    intro: `One tap and we'll send ${what}. If this wasn't you, ignore this e-mail and nothing happens.`,
    cta: { label: 'Confirm my e-mail', href },
    unsubscribeHref: unsubscribeHref(renter.id),
    why: 'You asked for this on Drive Exotiq.',
  });
  await sendMail({ to: renter.email, subject: 'Confirm your e-mail for Drive Exotiq', html, text, kind: 'confirm', renterId: renter.id });
  return updated;
}

async function sendSavedList(renter: RenterRow): Promise<boolean> {
  const saved = await listSavedCars(renter.id);
  if (saved.length === 0) return false;
  const catalog = await catalogByKey();
  const cars = saved.map((s) => {
    const l = catalog.get(`${s.team_slug}/${s.vehicle_slug}`);
    const href = `${siteUrl()}/${s.team_slug}/${s.vehicle_slug}`;
    return l
      ? { name: l.vehicle.name, meta: `${dollars(l.vehicle.dailyRateCents)} per day · ${l.team.name}, ${l.team.city}`, href }
      : { name: s.vehicle_name ?? 'A car that is no longer listed', meta: 'Not listed right now', href };
  });
  const { html, text } = layout({
    title: `Your ${cars.length === 1 ? 'saved car' : `${cars.length} saved cars`}.`,
    intro: 'Here they are, with a link back to each. Prices are per day and can change with the season.',
    body: carListHtml(cars),
    cta: { label: 'Browse the fleet', href: `${siteUrl()}/browse` },
    unsubscribeHref: unsubscribeHref(renter.id),
    why: 'You asked us to e-mail your saved cars from Drive Exotiq.',
  });
  await sendMail({ to: renter.email, subject: cars.length === 1 ? `Your saved car: ${cars[0].name}` : `Your ${cars.length} saved cars`, html, text: `${text}\n\n${cars.map((c) => `${c.name} — ${c.meta}\n${c.href}`).join('\n\n')}`, kind: 'saved_list', renterId: renter.id });
  return true;
}

async function sendAlertSet(renter: RenterRow, alert: NonNullable<CaptureRequest['alert']>): Promise<void> {
  const range = formatRangeLabel(alert.start, alert.end);
  const scope = alert.vehicle_slug ? 'this car' : alert.team_slug ? 'a car from this operator' : 'a car';
  const { html, text } = layout({
    title: `We're watching ${range}.`,
    intro: `The moment ${scope} is free for those dates, you'll get one e-mail with a link to book. We check every morning.`,
    unsubscribeHref: unsubscribeHref(renter.id),
    why: 'You set an availability alert on Drive Exotiq.',
  });
  await sendMail({ to: renter.email, subject: `Alert set for ${range}`, html, text, kind: 'alert_set', renterId: renter.id });
}

export async function handleCapture(req: CaptureRequest, meta: CaptureMeta): Promise<CaptureOutcome> {
  const secret = rentersTokenSecret();
  const consentFields = req.consent
    ? { marketing_consent: true, consented_at: nowIso(), consent_source: req.source, consent_ip_hash: hashIp(meta.ip, secret), consent_user_agent: meta.userAgent.slice(0, 300), unsubscribed_at: null }
    : {};

  let renter = await findRenterByEmail(req.email);
  if (!renter) {
    renter = await insertRenter({
      email: req.email,
      name: req.name ?? null,
      phone: req.phone ?? null,
      first_source: req.source,
      first_path: req.path ?? null,
      first_team_slug: req.team_slug ?? null,
      first_vehicle_slug: req.vehicle_slug ?? null,
      first_booking_ref: req.booking_ref ?? null,
      last_booking_ref: req.booking_ref ?? null,
      bookings_count: req.booking_ref ? 1 : 0,
      ...consentFields,
    });
  } else {
    const patch: Record<string, unknown> = {};
    if (req.name && !renter.name) patch.name = req.name;
    if (req.phone && !renter.phone) patch.phone = req.phone;
    if (req.consent && (!renter.marketing_consent || renter.unsubscribed_at)) Object.assign(patch, consentFields);
    if (req.booking_ref && renter.last_booking_ref !== req.booking_ref) {
      patch.last_booking_ref = req.booking_ref;
      patch.bookings_count = renter.bookings_count + 1;
      // A booking made from a real e-mail is as good as a confirmation click.
      if (!renter.confirmed_at) patch.confirmed_at = nowIso();
    }
    if (Object.keys(patch).length > 0) renter = await patchRenter(renter.id, patch);
  }
  // Same rule for a brand-new renter arriving through a booking.
  if (req.booking_ref && !renter.confirmed_at) renter = await patchRenter(renter.id, { confirmed_at: nowIso() });

  if (req.saved?.length) {
    const catalog = await catalogByKey().catch(() => new Map<string, MarketplaceListing>());
    await addSavedCars(renter.id, req.saved.map((s) => ({ ...s, vehicle_name: catalog.get(`${s.team_slug}/${s.vehicle_slug}`)?.vehicle.name ?? null })));
  }
  if (req.alert) {
    await addAlert(renter.id, { team_slug: req.alert.team_slug, vehicle_slug: req.alert.vehicle_slug, start_on: req.alert.start, end_on: req.alert.end });
  }
  await logEvent({ renter_id: renter.id, kind: `capture:${req.source}`, source: req.source, path: req.path ?? null, meta: { consent: req.consent, saved: req.saved?.length ?? 0, alert: Boolean(req.alert), booking: Boolean(req.booking_ref) } }).catch(() => undefined);

  try {
    if (!renter.confirmed_at) {
      await sendConfirmation(renter, req);
      return { status: 'confirm_sent', renterId: renter.id };
    }
    if (req.source === 'save_list') {
      await sendSavedList(renter);
      return { status: 'delivered', renterId: renter.id };
    }
    if (req.source === 'alert' && req.alert) {
      await sendAlertSet(renter, req.alert);
      return { status: 'delivered', renterId: renter.id };
    }
  } catch (error) {
    console.error('[renters] mail failed after capture', error instanceof Error ? error.message : error);
  }
  return { status: 'recorded', renterId: renter.id };
}

export type ConfirmOutcome = { ok: true; delivered: 'saved_list' | 'none'; renterId: string } | { ok: false };

/** The link in the confirmation e-mail. Single use: the hash is cleared on success. */
export async function confirmByToken(token: string): Promise<ConfirmOutcome> {
  const renter = await findRenterByConfirmHash(hashToken(token));
  if (!renter || !renter.confirm_token_hash || !safeEqual(renter.confirm_token_hash, hashToken(token))) return { ok: false };
  const confirmed = await patchRenter(renter.id, { confirmed_at: renter.confirmed_at ?? nowIso(), confirm_token_hash: null, unsubscribed_at: null });
  await logEvent({ renter_id: renter.id, kind: 'confirmed' }).catch(() => undefined);
  let delivered: 'saved_list' | 'none' = 'none';
  try {
    if (await sendSavedList(confirmed)) delivered = 'saved_list';
  } catch (error) {
    console.error('[renters] saved-list mail failed after confirm', error instanceof Error ? error.message : error);
  }
  return { ok: true, delivered, renterId: renter.id };
}

/** Unsubscribe = no marketing and no alerts. The person stays on record with the date. */
export async function unsubscribeByToken(renterId: string, token: string): Promise<boolean> {
  if (!safeEqual(unsubscribeToken(renterId, rentersTokenSecret()), token)) return false;
  const renter = await findRenterById(renterId);
  if (!renter) return false;
  await patchRenter(renter.id, { marketing_consent: false, unsubscribed_at: nowIso() });
  await cancelAlertsForRenter(renter.id);
  await logEvent({ renter_id: renter.id, kind: 'unsubscribed' }).catch(() => undefined);
  return true;
}
