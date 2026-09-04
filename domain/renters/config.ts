/**
 * Renter capture (MP-14): configuration.
 *
 * The renter store is a separate, Exotiq-owned Supabase project — never the
 * tenant command center's database. Every secret here is server-only; the
 * one public flag tells the client whether to render the capture controls at
 * all, so a host without the store shows no heart, no forms, no consent line.
 */

/** Client-visible switch: render save/alert/consent controls. */
export function renterCaptureUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RENTER_CAPTURE === 'on';
}

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

/** Secret behind the unsubscribe links and the consent IP hash. Rotating it invalidates old unsubscribe links. */
export function rentersTokenSecret(): string {
  return process.env.RENTERS_TOKEN_SECRET ?? '';
}

/** Server-side readiness: store + mail + secret. Route handlers 503 without it. */
export function renterCaptureEnabled(): boolean {
  return Boolean(rentersSupabaseUrl() && rentersServiceRoleKey() && resendApiKey() && rentersTokenSecret());
}
