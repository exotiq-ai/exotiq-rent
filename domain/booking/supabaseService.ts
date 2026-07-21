import { adaptBusyRanges, adaptFleetVehicle, adaptTeam, adaptVehicleDetail } from './adapters';
import {
  fetchPublicTeam,
  fetchPublicTeamFleet,
  fetchPublicVehicle,
  fetchSignedVehicleMedia,
  fetchVehicleAvailability,
} from './rpcClient';
import type { PublicTeamStorefront, PublicVehicleContext } from './publicContracts';

/**
 * Supabase-mode reads (M4): real storefronts from the five public RPCs.
 * Server-side visibility gating (marketplace_visible, demo exclusion) is
 * enforced inside the RPCs — a null here is a true 404.
 */

const AVAILABILITY_WINDOW_DAYS = 180;

function availabilityWindow(): { start: string; end: string } {
  const start = new Date();
  const end = new Date(start.getTime() + AVAILABILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function getSupabaseTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null> {
  const teamRow = await fetchPublicTeam(teamSlug);
  if (!teamRow) return null;
  const team = adaptTeam(teamRow);
  const fleetRows = await fetchPublicTeamFleet(teamSlug);
  return { team, vehicles: fleetRows.map((row) => adaptFleetVehicle(row, team)) };
}

export async function getSupabaseVehicleContext(teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> {
  const teamRow = await fetchPublicTeam(teamSlug);
  if (!teamRow) return null;
  const team = adaptTeam(teamRow);

  const vehicleRow = await fetchPublicVehicle(teamSlug, vehicleSlug);
  if (!vehicleRow) return null;

  const window = availabilityWindow();
  // Media and availability are enhancements — fetch in parallel and degrade
  // to RPC photo URLs / an open calendar rather than failing the page.
  const [media, busyRows] = await Promise.all([
    fetchSignedVehicleMedia(teamSlug, vehicleSlug).catch(() => ({ photos: [], expiresIn: 0 })),
    fetchVehicleAvailability(teamSlug, vehicleSlug, window.start, window.end).catch(() => []),
  ]);

  const vehicle = adaptVehicleDetail(vehicleRow, team, media);
  return { team, vehicle: { ...vehicle, unavailableRanges: adaptBusyRanges(busyRows) } };
}
