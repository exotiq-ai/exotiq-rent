/**
 * The exact words a person agreed to, versioned (MP-14 review). The client
 * renders these strings and the server records the version with the consent,
 * so an audit can say which wording applied. Bump a version whenever its
 * text changes; never edit a version in place.
 */
export const CONSENT_TEXT = {
  /** Checkbox on the saved-list and alert forms. */
  form: {
    version: 'form-2026-09-04',
    text: 'Also send me first looks at new cars and early access from Drive Exotiq. Unsubscribe any time.',
  },
  /** The footer signup, where the button is the consent. */
  footer: {
    version: 'footer-2026-09-04',
    text: 'Keep me posted: occasional e-mail from Drive Exotiq about new cars and early access. Unsubscribe any time.',
  },
  /** Checkbox at the Review step of a booking. */
  booking: {
    version: 'review-2026-09-04',
    text: 'Keep me posted on new cars and early access from Drive Exotiq. Occasional e-mail, unsubscribe any time.',
  },
} as const;

export type ConsentTextKey = keyof typeof CONSENT_TEXT;

export function consentVersionFor(source: string): string {
  if (source === 'booking') return CONSENT_TEXT.booking.version;
  if (source === 'footer') return CONSENT_TEXT.footer.version;
  return CONSENT_TEXT.form.version;
}
