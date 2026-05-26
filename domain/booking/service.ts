import { createInitialCart, curatedExtras } from './mockData';
import { getMockBookingConfirmation, getMockPublicTeamStorefront, getMockPublicVehicleContext } from './mockService';
import type { PublicBookingConfirmation, PublicTeamStorefront, PublicVehicleContext } from './publicContracts';
import type { BookingCart, ExtraSelection, Operator, Vehicle } from './types';

/**
 * Stable Exotiq Rent frontend service facade.
 *
 * Today these methods use local mocks. Future implementation should swap this
 * facade to public-safe Supabase RPCs / edge functions without changing route
 * components or booking-flow UI internals.
 */
export async function getPublicTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null> {
  return getMockPublicTeamStorefront(teamSlug);
}

export async function getPublicVehicleContext(teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> {
  return getMockPublicVehicleContext(teamSlug, vehicleSlug);
}

export async function getBookingStartContext(teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> {
  return getPublicVehicleContext(teamSlug, vehicleSlug);
}

export async function getBookingConfirmation(bookingRef: string): Promise<PublicBookingConfirmation | null> {
  return getMockBookingConfirmation(bookingRef);
}

export function createBookingCart(overrides: { operator?: Operator; vehicle?: Vehicle } = {}): BookingCart {
  return createInitialCart(overrides);
}

export function getCuratedExtras(): ExtraSelection[] {
  return curatedExtras;
}
