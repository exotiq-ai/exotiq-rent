/**
 * The one renter-capture setting the browser may read (MP-14). Kept apart
 * from config.ts so no client component ever imports the module that holds
 * the service-role key and the Resend key.
 */
export function renterCaptureUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RENTER_CAPTURE === 'on';
}
