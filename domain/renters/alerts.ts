/**
 * Availability alerts (MP-14): the pure decision behind the daily job.
 * An alert asks "tell me when <car | any car of operator | any car> is free
 * for [start, end]". Given the candidate cars in scope and today's busy set
 * for that window, decide which alerts to notify, which have expired, and
 * which keep waiting. Candidates carry what the grid checks app-side: the
 * minimum stay (a free car the calendar would refuse is not a match) and
 * whether the car is shown at all (hero gate).
 */
import { daysBetween } from '../booking/marketplaceQuery';
import type { AlertRow } from './store';

export type AlertDecision = { alert: AlertRow; action: 'notify' | 'expire' | 'skip' | 'wait'; freeKeys: string[] };

export type CatalogKey = { team_slug: string; vehicle_slug: string; min_rental_days: number; listed: boolean };

export function decideAlerts(
  alerts: AlertRow[],
  today: string,
  /** Cars in the alert's scope (the operator's fleet, or the marketplace). */
  catalogFor: (alert: AlertRow) => CatalogKey[],
  /** team/vehicle keys busy for the alert's window — one set per alert id. */
  busyByAlert: Map<string, Set<string>>,
): AlertDecision[] {
  return alerts.map((alert) => {
    if (alert.start_on < today) return { alert, action: 'expire', freeKeys: [] };
    const r = alert.renters;
    // Unconfirmed or paused (unsubscribed) addresses never receive an alert.
    if (!r || !r.confirmed_at || r.alerts_paused_at) return { alert, action: 'skip', freeKeys: [] };
    const busy = busyByAlert.get(alert.id);
    if (!busy) return { alert, action: 'wait', freeKeys: [] };
    const days = daysBetween(alert.start_on, alert.end_on);
    const candidates = catalogFor(alert).filter(
      (c) => c.listed && c.min_rental_days <= days && (alert.team_slug ? c.team_slug === alert.team_slug : true) && (alert.vehicle_slug ? c.vehicle_slug === alert.vehicle_slug : true),
    );
    const free = candidates.filter((c) => !busy.has(`${c.team_slug}/${c.vehicle_slug}`)).map((c) => `${c.team_slug}/${c.vehicle_slug}`);
    return free.length > 0 ? { alert, action: 'notify', freeKeys: free } : { alert, action: 'wait', freeKeys: [] };
  });
}
