/**
 * Availability alerts, daily (MP-14). For every active alert whose renter is
 * confirmed and not paused: ask the live fleet whether the car (or any car
 * of the operator, or any listed car) is free for the renter's window;
 * e-mail once when it is; expire alerts whose pickup day has passed, and
 * alerts whose address never confirmed within a week. Runs at 15:00 UTC =
 * 8 am Phoenix.
 *
 * Candidates come from the operator's own storefront fleet for operator- and
 * car-scoped alerts (storefronts exist for tenants that opted out of the
 * marketplace), and from the marketplace fleet for "any car". A candidate
 * must be shown on the grid (public hero) and its minimum stay must fit the
 * window — the same rules the grid applies. A row is claimed (notifying)
 * before the send so a retry can never double-send.
 *
 * Relative imports on purpose: Netlify bundles this file outside Next, where
 * the `@/` alias does not exist.
 */
import { publicImageUrl } from '../../domain/booking/adapters';
import { siteUrl } from '../../domain/booking/config';
import { formatRangeLabel } from '../../domain/booking/dates';
import { fetchFleetBusy, fetchMarketplaceFleet, fetchPublicTeamFleet, type RpcFleetVehicleRow } from '../../domain/booking/rpcClient';
import { decideAlerts, type CatalogKey } from '../../domain/renters/alerts';
import { renterCaptureEnabled } from '../../domain/renters/config';
import { unsubscribeHref } from '../../domain/renters/capture';
import { carListHtml, layout, sendMail } from '../../domain/renters/email';
import { claimAlert, expireUnconfirmedAlerts, listActiveAlerts, updateAlert, type AlertRow } from '../../domain/renters/store';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function bookHref(alert: AlertRow, key?: string): string {
  const q = `?start=${alert.start_on}&end=${alert.end_on}`;
  if (key) return `${siteUrl()}/${key}${q}`;
  if (alert.team_slug) return `${siteUrl()}/${alert.team_slug}${q}`;
  return `${siteUrl()}/browse${q}`;
}

function toKey(teamSlug: string, row: RpcFleetVehicleRow): CatalogKey {
  return { team_slug: teamSlug, vehicle_slug: row.vehicle_slug, min_rental_days: Math.max(1, Number(row.min_rental_days ?? 1) || 1), listed: Boolean(publicImageUrl(row.hero_image_url)) };
}

export default async function run(): Promise<Response> {
  if (!renterCaptureEnabled()) return new Response('renter capture not configured', { status: 200 });
  const today = todayIso();
  const expiredUnconfirmed = await expireUnconfirmedAlerts(new Date(Date.now() - 7 * 86400000).toISOString()).catch((error) => {
    console.error('[alerts] expiring unconfirmed failed', error instanceof Error ? error.message : 'error');
    return 0;
  });
  const alerts = await listActiveAlerts();
  if (alerts.length === 0) return new Response(`no active alerts (expired unconfirmed=${expiredUnconfirmed})`, { status: 200 });

  // Catalogs: one marketplace read, one storefront read per operator with an alert.
  const names = new Map<string, string>();
  const teamCatalogs = new Map<string, Promise<CatalogKey[]>>();
  const marketplaceCatalog = (async () => {
    const fleet = await fetchMarketplaceFleet();
    for (const row of fleet) names.set(`${row.team_slug}/${row.vehicle_slug}`, row.name ?? row.vehicle_slug);
    return fleet.map((row) => toKey(row.team_slug, row));
  })();
  const catalogFor = async (alert: AlertRow): Promise<CatalogKey[]> => {
    if (!alert.team_slug) return marketplaceCatalog;
    const team = alert.team_slug;
    if (!teamCatalogs.has(team)) {
      teamCatalogs.set(team, fetchPublicTeamFleet(team).then((fleet) => {
        for (const row of fleet) names.set(`${team}/${row.vehicle_slug}`, row.name ?? row.vehicle_slug);
        return fleet.map((row) => toKey(team, row));
      }));
    }
    return teamCatalogs.get(team)!;
  };

  // One busy read per distinct (operator, window); an alert for "any car" reads marketplace-wide.
  const busyByAlert = new Map<string, Set<string>>();
  const catalogByAlert = new Map<string, CatalogKey[]>();
  const busyCache = new Map<string, Promise<Set<string>>>();
  for (const alert of alerts) {
    if (alert.start_on < today) continue;
    const cacheKey = `${alert.team_slug ?? '*'}|${alert.start_on}|${alert.end_on}`;
    if (!busyCache.has(cacheKey)) {
      busyCache.set(cacheKey, fetchFleetBusy(alert.start_on, alert.end_on, alert.team_slug ?? undefined).then((rows) => new Set(rows.map((r) => `${r.team_slug}/${r.vehicle_slug}`))));
    }
    try {
      catalogByAlert.set(alert.id, await catalogFor(alert));
      busyByAlert.set(alert.id, await busyCache.get(cacheKey)!);
    } catch (error) {
      console.error('[alerts] read failed', cacheKey, error instanceof Error ? error.message : 'error');
    }
  }

  const decisions = decideAlerts(alerts, today, (alert) => catalogByAlert.get(alert.id) ?? [], busyByAlert);
  let notified = 0;
  let expired = 0;
  for (const d of decisions) {
    const now = new Date().toISOString();
    try {
      if (d.action === 'expire') {
        await updateAlert(d.alert.id, { status: 'expired', last_checked_at: now });
        expired += 1;
      } else if (d.action === 'notify' && d.alert.renters) {
        if (!(await claimAlert(d.alert.id))) continue; // another run got it first
        const range = formatRangeLabel(d.alert.start_on, d.alert.end_on);
        const cars = d.freeKeys.slice(0, 12).map((key) => ({ name: names.get(key) ?? key, meta: key.split('/')[0].replace(/-/g, ' '), href: bookHref(d.alert, key) }));
        const single = d.alert.vehicle_slug ? cars[0] : undefined;
        const unsub = unsubscribeHref(d.alert.renter_id);
        const { html, text } = layout({
          title: single ? `${single.name} is free ${range}.` : `${cars.length === 1 ? 'A car is' : `${cars.length} cars are`} free ${range}.`,
          intro: single ? 'Your dates opened up. Book before someone else does; the link carries your dates.' : 'The dates you asked about opened up. Each link carries your dates.',
          body: single ? undefined : carListHtml(cars),
          cta: { label: single ? 'Book these dates' : 'See what is free', href: single ? single.href : bookHref(d.alert) },
          unsubscribeHref: unsub,
          why: 'You set an availability alert on Drive Exotiq. This is the one e-mail it sends.',
        });
        try {
          await sendMail({ to: d.alert.renters.email, subject: single ? `${single.name} is free ${range}` : `Cars are free ${range}`, html, text, kind: 'alert_free', renterId: d.alert.renter_id, unsubscribeHref: unsub });
        } catch (error) {
          await updateAlert(d.alert.id, { status: 'active', last_checked_at: now });
          throw error;
        }
        await updateAlert(d.alert.id, { status: 'notified', notified_at: now, last_checked_at: now });
        notified += 1;
      } else {
        await updateAlert(d.alert.id, { last_checked_at: now });
      }
    } catch (error) {
      console.error('[alerts] failed for', d.alert.id, error instanceof Error ? error.message : 'error');
    }
  }
  const summary = `alerts=${alerts.length} notified=${notified} expired=${expired} expiredUnconfirmed=${expiredUnconfirmed}`;
  console.log('[alerts]', summary);
  return new Response(summary, { status: 200 });
}

export const config = { schedule: '0 15 * * *' };
