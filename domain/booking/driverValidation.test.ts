// MP-18 AC8 (and the decisions behind AC9/AC10): the Driver step's completeness rules and the
// Review step's terms gate as pure functions. The rules are EXACTLY the ones DriverStep used at
// a73d09b: the sweep compares against that predicate copied verbatim, so no rule is tightened or
// loosened. Every UI decision (block, message, focus target, announcement) is a function here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { stripComments } from '../../tests/design/lib/scan.mjs';

type Field = 'name' | 'dob' | 'phone' | 'email';
type Missing<F extends string = string> = { field: F; message: string };
type Driver = { name: string; dob: string; phone: string; email?: string };
/** Guarded, so a missing module fails each test for its own reason instead of the whole file. */
const v = (await import('./driverValidation').catch(() => ({}))) as unknown as {
  TERMS_MESSAGE?: string;
  driverMissing?: (d: Driver) => Missing<Field>[];
  termsMissing?: (accepted: boolean) => Missing<'terms'>[];
  attemptContinue?: <M>(missing: readonly M[], next: () => void, onBlocked: (missing: readonly M[]) => void) => void;
  withAgeBlock?: (missing: Missing<Field>[], ageMessage: string | null) => Missing<Field>[];
  fieldMessages?: (missing: readonly Missing<Field>[], attempted: boolean) => Partial<Record<Field, string>>;
  missingSummary?: (missing: readonly Missing<Field>[], ageMessage?: string | null) => string;
};

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

/** components/drive-exotiq/flow/DriverStep.tsx at a73d09b, `fieldsComplete`, verbatim. */
const legacyComplete = (d: Driver) =>
  d.name.trim().length > 1 &&
  Boolean(d.dob) &&
  d.phone.replace(/\D/g, '').length >= 10 &&
  (d.email ?? '').includes('@');

const COMPLETE: Driver = { name: 'Alex Quinn', dob: '1990-01-01', phone: '(555) 555-0100', email: 'alex@example.com' };
const fields = (m: Missing[] | undefined) => (m ?? []).map((x) => x.field);

describe('MP-18 driver and terms validation (AC8)', () => {
  it('driverMissing lists incomplete fields in form order', () => {
    const empty = v.driverMissing?.({ name: '', dob: '', phone: '', email: '' });
    expect(fields(empty)).toEqual(['name', 'dob', 'phone', 'email']);
    for (const m of empty ?? []) expect(m.message.length, m.field).toBeGreaterThan(10);
    expect(new Set((empty ?? []).map((m) => m.message)).size).toBe(4);
    expect(v.driverMissing?.(COMPLETE)).toEqual([]);
    // Each unhappy value is flagged on its own field and nowhere else.
    const one: [Partial<Driver>, Field][] = [
      [{ name: '   ' }, 'name'],
      [{ name: 'A' }, 'name'],
      [{ name: ' A ' }, 'name'],
      [{ dob: '' }, 'dob'],
      [{ phone: '555 555 010' }, 'phone'],
      [{ phone: '123456789' }, 'phone'],
      [{ email: 'alex.example.com' }, 'email'],
      [{ email: undefined }, 'email'],
    ];
    for (const [patch, field] of one) expect(fields(v.driverMissing?.({ ...COMPLETE, ...patch })), JSON.stringify(patch)).toEqual([field]);
    // Edge values the rules accept (unchanged from today).
    for (const patch of [{ name: 'Al' }, { phone: '+1 (555) 555-0100' }, { email: '@' }]) expect(v.driverMissing?.({ ...COMPLETE, ...patch }), JSON.stringify(patch)).toEqual([]);
  });

  it('driverMissing agrees with the legacy completeness rule on a sweep of inputs', () => {
    expect(v.driverMissing).toBeTypeOf('function');
    const names = ['', ' ', 'A', ' A ', 'Al', '  Al  ', 'Alex Q'];
    const dobs = ['', '1990-01-01'];
    const phones = ['', '123456789', '1234567890', '(555) 555-0100', '+1 (555) 555-010', 'abcdefghij'];
    const emails = [undefined, '', 'a', 'a@', '@', 'a@b.co'];
    const disagree: string[] = [];
    let rows = 0;
    for (const name of names) for (const dob of dobs) for (const phone of phones) for (const email of emails) {
      const d = { name, dob, phone, email };
      rows++;
      if ((v.driverMissing!(d).length === 0) !== legacyComplete(d)) disagree.push(JSON.stringify(d));
    }
    expect(rows).toBe(504);
    expect(disagree).toEqual([]);
  });

  it('attemptContinue never calls next while anything is missing', () => {
    expect(v.attemptContinue).toBeTypeOf('function');
    for (const missing of [v.driverMissing!({ name: '', dob: '', phone: '', email: '' }), v.driverMissing!({ ...COMPLETE, phone: '1' }), v.termsMissing!(false)]) {
      const next = vi.fn();
      const onBlocked = vi.fn();
      v.attemptContinue!(missing, next, onBlocked);
      expect(next).not.toHaveBeenCalled();
      expect(onBlocked).toHaveBeenCalledTimes(1);
      expect(onBlocked).toHaveBeenCalledWith(missing);
    }
  });

  it('attemptContinue calls next exactly once when complete', () => {
    expect(v.attemptContinue).toBeTypeOf('function');
    for (const missing of [v.driverMissing!(COMPLETE), v.termsMissing!(true)]) {
      const next = vi.fn();
      const onBlocked = vi.fn();
      v.attemptContinue!(missing, next, onBlocked);
      expect(next).toHaveBeenCalledTimes(1);
      expect(onBlocked).not.toHaveBeenCalled();
    }
  });

  it('termsMissing reports an unticked box', () => {
    expect(v.TERMS_MESSAGE).toBe('Please accept the Rental Terms & Conditions to continue.');
    expect(v.termsMissing?.(false)).toEqual([{ field: 'terms', message: 'Please accept the Rental Terms & Conditions to continue.' }]);
    expect(v.termsMissing?.(true)).toEqual([]);
  });

  it('withAgeBlock keeps a too-young driver blocked', () => {
    const age = 'Desert Exotic Rentals requires drivers to be 25+ on the pickup date for this rental.';
    // Complete fields, too young: still blocked, on the date of birth.
    const blocked = v.withAgeBlock?.(v.driverMissing!(COMPLETE), age);
    expect(blocked).toEqual([{ field: 'dob', message: age }]);
    const next = vi.fn();
    v.attemptContinue!(blocked!, next, () => {});
    expect(next).not.toHaveBeenCalled();
    // Old enough (no age message): unchanged.
    expect(v.withAgeBlock?.([], null)).toEqual([]);
    // Other gaps keep form order; an existing date-of-birth gap is not doubled.
    expect(fields(v.withAgeBlock?.(v.driverMissing!({ ...COMPLETE, name: '', email: '' }), age))).toEqual(['name', 'dob', 'email']);
    expect(fields(v.withAgeBlock?.(v.driverMissing!({ ...COMPLETE, dob: '' }), age))).toEqual(['dob']);
  });

  it('fieldMessages shows nothing before the first attempt, one message per incomplete field after it, and drops a field once valid', () => {
    const missing = v.driverMissing!({ name: '', dob: '', phone: '', email: '' });
    expect(v.fieldMessages?.(missing, false)).toEqual({});
    const after = v.fieldMessages?.(missing, true);
    expect(Object.keys(after ?? {})).toEqual(['name', 'dob', 'phone', 'email']);
    expect(after?.name).toBe(missing[0].message);
    // The renter fixes the name: its message goes, the others stay.
    const fixed = v.fieldMessages?.(v.driverMissing!({ name: 'Alex Quinn', dob: '', phone: '', email: '' }), true);
    expect(Object.keys(fixed ?? {})).toEqual(['dob', 'phone', 'email']);
    expect(v.fieldMessages?.([], true)).toEqual({});
  });

  it('missingSummary names the missing fields', () => {
    const summary = (patch: Partial<Driver>) => v.missingSummary?.(v.driverMissing!({ ...COMPLETE, ...patch }));
    expect(summary({ name: '' })).toBe('Please complete your full name.');
    expect(summary({ name: '', phone: '' })).toBe('Please complete your full name and phone.');
    expect(summary({ name: '', dob: '', phone: '', email: '' })).toBe('Please complete your full name, date of birth, phone and email.');
    expect(summary({})).toBe('');
    // Too young with every field filled: the summary is the operator's age rule.
    const age = 'Desert Exotic Rentals requires drivers to be 25+ on the pickup date for this rental.';
    expect(v.missingSummary?.([], age)).toBe(age);
    expect(v.missingSummary?.(v.driverMissing!({ ...COMPLETE, email: '' }), age)).toBe('Please complete your email.');
  });

  it('the steps use the shared rules and keep no second copy', () => {
    const driver = read('components/drive-exotiq/flow/DriverStep.tsx');
    expect(driver).toMatch(/from '@\/domain\/booking\/driverValidation'/);
    expect(driver).toContain('driverMissing(cart.driver)');
    expect(driver).toContain('attemptContinue(');
    for (const copy of ['.trim().length > 1', "replace(/\\D/g, '').length >= 10", ".includes('@')", 'fieldsComplete']) expect(driver, copy).not.toContain(copy);
    const review = read('components/drive-exotiq/flow/ReviewStep.tsx');
    expect(review).toMatch(/from '@\/domain\/booking\/driverValidation'/);
    expect(review).toContain('termsMissing(termsAccepted)');
    expect(review).toContain('attemptContinue(');
  });
});
