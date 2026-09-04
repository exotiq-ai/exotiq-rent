import { cache } from 'react';
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
import { getMockMarketplaceFacets, getMockMarketplaceListings } from './mockMarketplaceService';
import { getSupabaseMarketplaceFacets, getSupabaseMarketplaceListings } from './marketplaceService';
import type {
  BookingLookupResult,
  CreateBookingResult,
  IdentityVerificationStart,
  IdentityVerificationState,
  MarketplaceFacets,
  MarketplacePage,
  MarketplaceQuery,
  PublicTeamStorefront,
  PublicVehicleContext,
} from './publicContracts';
import type { BookingCart, ExtraSelection, Operator, Vehicle } from './types';

// React.cache exists in the server build Next runs this module in; vitest
// loads the client React build, which lacks it. Identity is a correct
// substitute there — the tests don't exercise per-request dedupe.
const perRequest: typeof cache = typeof cache === 'function' ? cache : (fn) => fn;

/**
 * Stable Exotiq Rent frontend service facade.
 *
 * Today these methods use local mocks. Future implementation should swap this
 * facade to public-safe Supabase RPCs / edge functions without changing route
 * components or booking-flow UI internals.
 */
/**
 * Marketplace reads (MP-2). Supabase mode reads the two cross-tenant RPCs
 * (MP-7 / M7f) — a tenant appears by opting in via the Command Center, no
 * env var; the /browse route (MP-3) stays env-guarded so no production host
 * serves the grid until launch flips the flag.
 */
export async function getMarketplaceListings(query: MarketplaceQuery): Promise<MarketplacePage> {
  if (getDataMode() === 'supabase') return getSupabaseMarketplaceListings(query);
  return getMockMarketplaceListings(query);
}

export async function getMarketplaceFacets(): Promise<MarketplaceFacets> {
  if (getDataMode() === 'supabase') return getSupabaseMarketplaceFacets();
  return getMockMarketplaceFacets();
}

export async function getPublicTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null> {
  if (getDataMode() === 'supabase') return getSupabaseTeamStorefront(teamSlug);
  return getMockPublicTeamStorefront(teamSlug);
}

// React cache(): generateMetadata and the page body both call this per
// request, and the signed-media fetch inside is deliberately uncacheable
// (see fetchSignedVehicleMedia) — dedupe within the request so the vehicle
// route costs one context load, not two.
export const getPublicVehicleContext = perRequest(
  async (teamSlug: string, vehicleSlug: string): Promise<PublicVehicleContext | null> => {
    if (getDataMode() === 'supabase') return getSupabaseVehicleContext(teamSlug, vehicleSlug);
    return getMockPublicVehicleContext(teamSlug, vehicleSlug);
  },
);

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
  options: { confirmationToken?: string; email?: string } = {},
): Promise<IdentityVerificationStart> {
  if (getDataMode() === 'supabase') {
    // The token is the credential (D4). Without it the backend returns 400,
    // so fail here with copy the card can actually show a renter rather than
    // surfacing a raw validation error from the edge function.
    if (!options.confirmationToken) {
      throw new Error(
        'This verification link is incomplete. Open the link from your confirmation email to verify your ID.',
      );
    }
    return createLiveIdentitySession({
      bookingRef,
      confirmationToken: options.confirmationToken,
      email: options.email,
    });
  }
  return startMockIdentityVerification(bookingRef);
}

export async function getIdentityVerificationState(sessionId: string): Promise<IdentityVerificationState> {
  if (getDataMode() === 'supabase') {
    return getLiveIdentityState(sessionId);
  }
  return getMockIdentityVerificationState(sessionId);
}
