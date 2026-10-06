import type { ProtectionTier } from './types';

// TODO(PROTECT_ENABLED): Exotiq Protect is OFF in the renter flow (MP-30; Gregory's compliance handoff,
// 2026-10-06, section 2.1: "Flip off now"). NEXT_PUBLIC_PROTECT_ENABLED must not be set to 'true' on any
// deploy until Protect meets the re-enable requirements:
//   - toggle defaults OFF, never pre-selected;
//   - label 'Exotiq Protect · optional damage waiver' (never 'coverage' or 'insurance' — today's 'Premium coverage' label violates this);
//   - price, maximum protected amount, renter participation amount and a Protect-terms link must show before selection.
// 'true' restores the pre-MP-30 flow exactly (the pre-selected switch, "Premium coverage"): it is the rollback
// lever and the restoration proof, not a compliant state. This is the ONE reader of the flag; a literal member
// read, per call, so Next inlines it into the server and the client bundles alike. MP-31 rebuilds Protect.
export function protectEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PROTECT_ENABLED === 'true';
}

/** The tier a new cart starts with: today's premium when Protect is on, declined when it is off. */
export function defaultProtection(): ProtectionTier {
  return protectEnabled() ? 'premium' : 'decline';
}

/**
 * The tier both request bodies carry. Off: always an explicit 'decline', never an omitted key (both
 * backend endpoints treat a missing tier as premium). On: the cart's own tier, unchanged.
 */
export function protectionForRequest(tier: ProtectionTier): ProtectionTier {
  return protectEnabled() ? tier : 'decline';
}

/**
 * Whether snapshot copy may name Protect: the flag is on, or the booking already carries a Protect charge
 * (made before the flip; hiding a charge that will still be collected would break cent parity).
 */
export function mentionProtect(chargedCents?: number): boolean {
  return protectEnabled() || (chargedCents ?? 0) > 0;
}
