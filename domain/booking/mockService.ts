import { mockOperators, mockVehicles } from './mockData';
import type {
  IdentityVerificationStart,
  IdentityVerificationState,
  PublicBookingConfirmation,
  PublicTeamStorefront,
  PublicVehicleContext,
} from './publicContracts';

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

// --- Identity verification (mock) ------------------------------------------
// Simulates the Stripe Identity flow shape (ID plan V1/V3): a session is
// started post-payment and the webhook-backed status endpoint flips it to
// verified. The mock verifies ~1.5s after start; live mode swaps this facade
// for the identity-create-session / identity-session-status edge functions.

const mockIdentitySessions = new Map<string, number>();

export async function startMockIdentityVerification(bookingRef: string): Promise<IdentityVerificationStart> {
  const sessionId = `vs_mock_${bookingRef}`;
  if (!mockIdentitySessions.has(sessionId)) {
    mockIdentitySessions.set(sessionId, Date.now());
  }
  return { sessionId, status: 'processing' };
}

export async function getMockIdentityVerificationState(sessionId: string): Promise<IdentityVerificationState> {
  const startedAt = mockIdentitySessions.get(sessionId);
  if (!startedAt) return { status: 'created', attemptsRemaining: 3 };
  const verified = Date.now() - startedAt > 1500;
  return { status: verified ? 'verified' : 'processing', attemptsRemaining: 3 };
}
