import type { Driver } from './types';

/**
 * The Driver step's completeness rules and the Review step's terms gate as pure functions (MP-18).
 * A disabled button fires no event, so it cannot explain itself: the steps keep their Continue and
 * Request buttons tappable (aria-disabled) and route every attempt through attemptContinue, which
 * either proceeds or reports what is missing. Every decision lives here; the steps only render it.
 */

export type DriverField = 'name' | 'dob' | 'phone' | 'email';
export type Missing<F extends string = string> = { field: F; message: string };
type DriverFields = Pick<Driver, 'name' | 'dob' | 'phone' | 'email'>;

export const TERMS_MESSAGE = 'Please accept the Rental Terms & Conditions to continue.';

/** Form order. The rules are EXACTLY the ones DriverStep used before MP-18: none tightened or loosened. */
const RULES: { field: DriverField; label: string; message: string; ok: (d: DriverFields) => boolean }[] = [
  { field: 'name', label: 'full name', message: 'Enter your full name as it appears on your license.', ok: (d) => d.name.trim().length > 1 },
  { field: 'dob', label: 'date of birth', message: 'Enter your date of birth.', ok: (d) => Boolean(d.dob) },
  { field: 'phone', label: 'phone', message: 'Enter a phone number with at least 10 digits.', ok: (d) => d.phone.replace(/\D/g, '').length >= 10 },
  { field: 'email', label: 'email', message: 'Enter an email address, like name@example.com.', ok: (d) => (d.email ?? '').includes('@') },
];
const ORDER = RULES.map((r) => r.field);

/** The incomplete fields, in form order, each with the one line shown under it. */
export function driverMissing(driver: DriverFields): Missing<DriverField>[] {
  return RULES.filter((r) => !r.ok(driver)).map(({ field, message }) => ({ field, message }));
}

/** The Review step's one gate the renter can fix: the unticked terms box. */
export function termsMissing(accepted: boolean): Missing<'terms'>[] {
  return accepted ? [] : [{ field: 'terms', message: TERMS_MESSAGE }];
}

/** next() exactly once when nothing is missing; otherwise onBlocked(missing) once and never next(). */
export function attemptContinue<M>(missing: readonly M[], next: () => void, onBlocked: (missing: readonly M[]) => void): void {
  if (missing.length === 0) next();
  else onBlocked(missing);
}

/**
 * The operator's age floor is not one of the four field rules, and a soft-disabled button has no
 * `disabled` to enforce it, so a too-young driver joins the blockers on the date of birth (form
 * order kept, an existing date-of-birth gap not doubled).
 */
export function withAgeBlock(missing: Missing<DriverField>[], ageMessage: string | null): Missing<DriverField>[] {
  if (!ageMessage || missing.some((m) => m.field === 'dob')) return missing;
  return [...missing, { field: 'dob' as const, message: ageMessage }].sort((a, b) => ORDER.indexOf(a.field) - ORDER.indexOf(b.field));
}

/** Per-field messages: none before the first attempt; afterwards exactly the fields still incomplete, so a message goes as its field becomes valid. */
export function fieldMessages(missing: readonly Missing<DriverField>[], attempted: boolean): Partial<Record<DriverField, string>> {
  return attempted ? Object.fromEntries(missing.map((m) => [m.field, m.message])) : {};
}

/** The one sentence for the polite status region: the missing fields by name, else the age rule, else nothing. */
export function missingSummary(missing: readonly Missing<DriverField>[], ageMessage: string | null = null): string {
  const labels = missing.map((m) => RULES.find((r) => r.field === m.field)!.label);
  if (labels.length === 0) return ageMessage ?? '';
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Please complete your ${list}.`;
}
