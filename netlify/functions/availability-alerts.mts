/**
 * Availability alerts, daily (MP-14). For every active alert: ask the live
 * fleet whether the car (or any car of the operator, or any car at all) is
 * free for the renter's window; e-mail once when it is; expire alerts whose
 * pickup day has passed. Runs at 15:00 UTC = 8 am Phoenix.
 *
 * Relative imports on purpose: Netlify bundles this file outside Next, where
 * the `@/` alias does not exist.
 */
import { siteUrl } from '../../domain/booking/config';
import { formatRangeLabel } from '../../domain/booking/dates';
import { fetchFleetBusy, fetchMarketplaceFleet } from '../../domain/booking/rpcClient';
import { decideAlerts, type CatalogKey } from '../../domain/renters/alerts';
import { renterCaptureEnabled, rentersTokenSecret } from '../../domain/renters/config';
import { carListHtml, layout, sendMail } from '../../domain/renters/email';
import { listActiveAlerts, updateAlert, type AlertRow } from '../../domain/renters/store';
import { unsubscribeToken } from '../../domain/renters/tokens';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function bookHref(alert: AlertRow, key?: string): string {
  const q = `?start=${alert.start_on}&end=${alert.end_on}`;
  if (key) return `${siteUrl()}/${key}${q}`;
  if (alert.team_slug) return `${siteUrl()}/${alert.team_slug}${q}`;
  return `${siteUrl()}/browse${q}`;
}

export default async function run(): Promise<Response> {
  if (!renterCaptureEnabled()) return new Response('renter capture not configured', { status: 200 });
  const today = todayIso();
  const alerts = await listActiveAlerts();
  if (alerts.length === 0) return new Response('no active alerts', { status: 200 });

  const fleet = await fetchMarketplaceFleet();
  const catalog: CatalogKey[] = fleet.map((row) => ({ team_slug: row.team_slug, vehicle_slug: row.vehicle_slug }));
  const names = new Map(fleet.map((row) => [`${row.team_slug}/${row.vehicle_slug}`, row.name ?? row.vehicle_slug]));

  // One busy read per distinct (operator, window); an alert for "any car" reads marketplace-wide.
  const busyByAlert = new Map<string, Set<string>>();
  const cache = new Map<string, Promise<Set<string>>>();
  for (const alert of alerts) {
    if (alert.start_on < today) continue;
    const cacheKey = `${alert.team_slug ?? '*'}|${alert.start_on}|${alert.end_on}`;
    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, fetchFleetBusy(alert.start_on, alert.end_on, alert.team_slug ?? undefined).then((rows) => new Set(rows.map((r) => `${r.team_slug}/${r.vehicle_slug}`))));
    }
    try {
      busyByAlert.set(alert.id, await cache.get(cacheKey)!);
    } catch (error) {
      console.error('[alerts] busy read failed', cacheKey, error instanceof Error ? error.message : error);
    }
  }

  const decisions = decideAlerts(alerts, today, catalog, busyByAlert);
  let notified = 0;
  let expired = 0;
  for (const d of decisions) {
    const now = new Date().toISOString();
    try {
      if (d.action === 'expire') {
        await updateAlert(d.alert.id, { status: 'expired', last_checked_at: now });
        expired += 1;
      } else if (d.action === 'notify' && d.alert.renters) {
        const range = formatRangeLabel(d.alert.start_on, d.alert.end_on);
        const cars = d.freeKeys.slice(0, 12).map((key) => ({ name: names.get(key) ?? key, meta: key.split('/')[0].replace(/-/g, ' '), href: bookHref(d.alert, key) }));
        const single = d.alert.vehicle_slug ? cars[0] : undefined;
        const unsubscribeHref = `${siteUrl()}/api/renters/unsubscribe?r=${d.alert.renter_id}&token=${unsubscribeToken(d.alert.renter_id, rentersTokenSecret())}`;
        const { html, text } = layout({
          title: single ? `${single.name} is free ${range}.` : `${cars.length === 1 ? 'A car is' : `${cars.length} cars are`} free ${range}.`,
          intro: single ? 'Your dates opened up. Book before someone else does; the link carries your dates.' : 'The dates you asked about opened up. Each link carries your dates.',
          body: single ? undefined : carListHtml(cars),
          cta: { label: single ? 'Book these dates' : 'See what is free', href: single ? single.href : bookHref(d.alert) },
          unsubscribeHref,
          why: 'You set an availability alert on Drive Exotiq. This is the one e-mail it sends.',
        });
        await sendMail({ to: d.alert.renters.email, subject: single ? `${single.name} is free ${range}` : `Cars are free ${range}`, html, text, kind: 'alert_free', renterId: d.alert.renter_id });
        await updateAlert(d.alert.id, { status: 'notified', notified_at: now, last_checked_at: now });
        notified += 1;
      } else {
        await updateAlert(d.alert.id, { last_checked_at: now });
      }
    } catch (error) {
      console.error('[alerts] failed for', d.alert.id, error instanceof Error ? error.message : error);
    }
  }
  const summary = `alerts=${alerts.length} notified=${notified} expired=${expired}`;
  console.log('[alerts]', summary);
  return new Response(summary, { status: 200 });
}

export const config = { schedule: '0 15 * * *' };
