/**
 * Renter capture (MP-14): configuration.
 *
 * The renter store is a separate, Exotiq-owned Supabase project — never the
 * tenant command center's database. Every secret here is server-only; the
 * one public flag tells the client whether to render the capture controls at
 * all, so a host without the store shows no heart, no forms, no consent line.
 */

// Server only. The public flag lives in flags.ts; this module must never be
// imported by a 'use client' file. (No `server-only` package: the Netlify
// scheduled function bundles this outside Next.)
if (typeof window !== 'undefined') throw new Error('domain/renters/config is server-only');

export function rentersSupabaseUrl(): string {
  return (process.env.RENTERS_SUPABASE_URL ?? '').replace(/\/+$/, '');
}

export function rentersServiceRoleKey(): string {
  return process.env.RENTERS_SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function resendApiKey(): string {
  return process.env.RESEND_API_KEY ?? '';
}

/** Sender for every renter e-mail. The domain must be verified in Resend. */
export function rentersFromEmail(): string {
  return process.env.RENTERS_FROM_EMAIL ?? 'Drive Exotiq <hello@exotiq.ai>';
}

export function rentersReplyTo(): string {
  return process.env.RENTERS_REPLY_TO ?? 'hello@exotiq.ai';
}

/** Postal address printed in the footer of marketing e-mail (CAN-SPAM). Empty until set. */
export function rentersPostalAddress(): string {
  return process.env.RENTERS_POSTAL_ADDRESS ?? '';
}

/** Secret behind the unsubscribe links. Rotate by moving the old value to RENTERS_TOKEN_SECRET_PREVIOUS for at least 30 days (CAN-SPAM: opt-out links must keep working). */
export function rentersTokenSecret(): string {
  return process.env.RENTERS_TOKEN_SECRET ?? '';
}

export function rentersTokenSecretPrevious(): string {
  return process.env.RENTERS_TOKEN_SECRET_PREVIOUS ?? '';
}

/** Server-side readiness: store + mail + secret. Route handlers 503 without it. */
export function renterCaptureEnabled(): boolean {
  return Boolean(rentersSupabaseUrl() && rentersServiceRoleKey() && resendApiKey() && rentersTokenSecret());
}
