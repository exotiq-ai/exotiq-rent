/**
 * Availability alerts (MP-14): the pure decision behind the daily job.
 * An alert asks "tell me when <car | any car of operator | any car> is free
 * for [start, end]". Given today's busy set for that window, decide which
 * alerts to notify, which have expired, and which keep waiting.
 */
import type { AlertRow } from './store';

export type AlertDecision = { alert: AlertRow; action: 'notify' | 'expire' | 'skip' | 'wait'; freeKeys: string[] };

export type CatalogKey = { team_slug: string; vehicle_slug: string };

export function decideAlerts(
  alerts: AlertRow[],
  today: string,
  /** Listed cars, marketplace-wide. */
  catalog: CatalogKey[],
  /** team/vehicle keys busy for the alert's window — one set per alert id. */
  busyByAlert: Map<string, Set<string>>,
): AlertDecision[] {
  return alerts.map((alert) => {
    if (alert.start_on < today) return { alert, action: 'expire', freeKeys: [] };
    const r = alert.renters;
    // Unconfirmed or unsubscribed addresses never receive an alert; the row waits (or was cancelled at unsubscribe).
    if (!r || !r.confirmed_at || r.unsubscribed_at) return { alert, action: 'skip', freeKeys: [] };
    const busy = busyByAlert.get(alert.id);
    if (!busy) return { alert, action: 'wait', freeKeys: [] };
    const candidates = catalog.filter((c) => (alert.team_slug ? c.team_slug === alert.team_slug : true) && (alert.vehicle_slug ? c.vehicle_slug === alert.vehicle_slug : true));
    const free = candidates.filter((c) => !busy.has(`${c.team_slug}/${c.vehicle_slug}`)).map((c) => `${c.team_slug}/${c.vehicle_slug}`);
    return free.length > 0 ? { alert, action: 'notify', freeKeys: free } : { alert, action: 'wait', freeKeys: [] };
  });
}
