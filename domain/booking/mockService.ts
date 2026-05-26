import { mockOperator, mockVehicle } from './mockData';
import type { PublicBookingConfirmation, PublicTeamStorefront, PublicVehicleContext } from './publicContracts';

export async function getMockPublicTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null> {
  if (teamSlug !== mockOperator.slug) return null;
  return { team: mockOperator, vehicles: [mockVehicle] };
}

export async function getMockPublicVehicleContext(teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> {
  if (teamSlug === mockOperator.slug && vehicleSlug === mockVehicle.slug) {
    return { team: mockOperator, vehicle: mockVehicle };
  }
  return null;
}

export async function getMockBookingConfirmation(bookingRef: string): Promise<PublicBookingConfirmation | null> {
  if (!bookingRef.startsWith('BK-') && !bookingRef.startsWith('EXQ-')) return null;
  return { bookingRef, team: mockOperator, vehicle: mockVehicle };
}
