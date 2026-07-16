import { mockOperators, mockVehicles } from './mockData';
import type { PublicBookingConfirmation, PublicTeamStorefront, PublicVehicleContext } from './publicContracts';

export async function getMockPublicTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null> {
  const team = mockOperators.find((operator) => operator.slug === teamSlug);
  if (!team) return null;
  // Hidden vehicles are excluded here, not in the UI — mirrors server-side
  // marketplace visibility (the future RPCs never return non-visible rows).
  const vehicles = mockVehicles.filter((vehicle) => vehicle.operatorId === team.id && !vehicle.hidden);
  return { team, vehicles };
}

export async function getMockPublicVehicleContext(teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> {
  const storefront = await getMockPublicTeamStorefront(teamSlug);
  if (!storefront) return null;
  const vehicle = storefront.vehicles.find((candidate) => candidate.slug === vehicleSlug);
  if (!vehicle) return null;
  return { team: storefront.team, vehicle };
}

export async function getMockBookingConfirmation(bookingRef: string): Promise<PublicBookingConfirmation | null> {
  if (!bookingRef.startsWith('BK-') && !bookingRef.startsWith('EXQ-')) return null;
  const team = mockOperators[0];
  const vehicle = mockVehicles[0];
  return { bookingRef, team, vehicle };
}
