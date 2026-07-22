import { getDataMode } from './config';
import { createLiveIdentitySession, getLiveIdentityState } from './identityClient';
import {
  createSupabaseRenterBooking,
  getSupabaseBookingConfirmation,
  getSupabaseTeamStorefront,
  getSupabaseVehicleContext,
} from './supabaseService';
import { createInitialCart, curatedExtras } from './mockData';
import {
  getMockBookingConfirmation,
  getMockIdentityVerificationState,
  getMockPublicTeamStorefront,
  getMockPublicVehicleContext,
  startMockIdentityVerification,
} from './mockService';
import type {
  BookingLookupResult,
  CreateBookingResult,
  IdentityVerificationStart,
  IdentityVerificationState,
  PublicTeamStorefront,
  PublicVehicleContext,
} from './publicContracts';
import type { BookingCart, ExtraSelection, Operator, Vehicle } from './types';

/**
 * Stable Exotiq Rent frontend service facade.
 *
 * Today these methods use local mocks. Future implementation should swap this
 * facade to public-safe Supabase RPCs / edge functions without changing route
 * components or booking-flow UI internals.
 */
export async function getPublicTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null> {
  if (getDataMode() === 'supabase') return getSupabaseTeamStorefront(teamSlug);
  return getMockPublicTeamStorefront(teamSlug);
}

export async function getPublicVehicleContext(teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> {
  if (getDataMode() === 'supabase') return getSupabaseVehicleContext(teamSlug, vehicleSlug);
  return getMockPublicVehicleContext(teamSlug, vehicleSlug);
}

export async function getBookingStartContext(teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> {
  return getPublicVehicleContext(teamSlug, vehicleSlug);
}

export async function getBookingConfirmation(bookingRef: string, accessToken?: string): Promise<BookingLookupResult> {
  if (getDataMode() === 'supabase') return getSupabaseBookingConfirmation(bookingRef, accessToken);
  return getMockBookingConfirmation(bookingRef);
}

/**
 * M5 booking creation. Supabase mode calls rent-create-booking (server-side
 * re-quote + transactional overlap guard); mock mode keeps the demo's fixed
 * confirmation ref.
 */
export async function createRenterBooking(cart: BookingCart): Promise<CreateBookingResult> {
  if (getDataMode() === 'supabase') return createSupabaseRenterBooking(cart);
  return { bookingRef: 'BK-01001', status: 'pending_documents' };
}

export function createBookingCart(overrides: { operator?: Operator; vehicle?: Vehicle } = {}): BookingCart {
  return createInitialCart(overrides);
}

export function getCuratedExtras(): ExtraSelection[] {
  return curatedExtras;
}

/**
 * Identity verification (ID plan V3). Post-payment: verification confirms
 * the booking. Supabase mode calls the identity-create-session /
 * identity-session-status edge functions; mock mode (default, no env)
 * simulates the same shape.
 */
export async function startIdentityVerification(
  bookingRef: string,
  email?: string,
): Promise<IdentityVerificationStart> {
  if (getDataMode() === 'supabase') {
    if (!email) throw new Error('email is required to start verification');
    return createLiveIdentitySession({ email, bookingRef });
  }
  return startMockIdentityVerification(bookingRef);
}

export async function getIdentityVerificationState(sessionId: string): Promise<IdentityVerificationState> {
  if (getDataMode() === 'supabase') {
    return getLiveIdentityState(sessionId);
  }
  return getMockIdentityVerificationState(sessionId);
}
