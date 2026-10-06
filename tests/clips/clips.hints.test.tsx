// MP-24 AC1: on the Driver step the empty Date of birth and Phone fields show hints that fit a
// 360px phone, and nothing else about those two inputs moves. The browser probe (not this file) is
// the proof of fit; this file is the regression guard that follows from it: a hint of at most 12
// characters (108px for 12, against a budget of about 115px at 360), or the input carries the
// ellipsis class so a longer hint ends in an ellipsis instead of a hard cut. It also holds the pins
// the MP-26 golden used to hold for these two inputs (type, classes, seeded value), because that
// golden now cuts both inputs out whole (AC4).
//
// Not a browser test: renderToStaticMarkup, the same mocks and cart as tests/fees/fees.golden.test.tsx.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
  usePathname: () => '/',
  notFound: () => { throw new Error('notFound'); },
}));

import { DriverStep } from '@/components/drive-exotiq/flow/DriverStep';
import { createInitialCart } from '@/domain/booking/mockData';
import { stripComments } from '../design/lib/scan.mjs';
import { NOW_ISO, OPERATOR, VEHICLE, type El, classes, elements, parseHtml } from '../fees/fixtures';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DRIVER = 'components/drive-exotiq/flow/DriverStep.tsx';
const noop = () => {};

// The fieldClass literal as it stands on the base this ticket was cut from (sha256). tests/design/typeScale.test.ts
// and the focus-gold count read this literal, so this ticket must not change a character of it.
const FIELD_CLASS_SHA256 = 'e2421714656d6ff87e4e129f80b3d4f4518af86c9d3046a79ce9cbf81ea7dc41';
const MAX_HINT_CHARS = 12;
const ELLIPSIS = ['text-ellipsis', 'truncate'];

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW_ISO));
  vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'mock');
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const renderDriver = (): string => {
  const cart = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE });
  return renderToStaticMarkup(<DriverStep cart={cart} setCart={noop} next={noop} />);
};

type Which = 'name' | 'dob' | 'phone' | 'email';
const AUTOCOMPLETE: Record<Which, string> = { name: 'name', dob: 'bday', phone: 'tel', email: 'email' };
const pick = (root: El, which: Which): El[] => elements(root).filter((e) => e.tag === 'input' && e.attrs.autoComplete === AUTOCOMPLETE[which]);

/** What must not move about the four inputs (the attributes the spec names, plus the seeded values the golden used to pin). */
const PINNED: Record<Which, Record<string, string | undefined>> = {
  name: { type: 'text', autoComplete: 'name', placeholder: 'Name as it appears on your license' },
  dob: { type: 'text', inputMode: 'numeric', autoComplete: 'bday', 'aria-describedby': 'dob-hint dob-error', value: '06 / 14 / 1985' },
  phone: { type: 'tel', inputMode: undefined, autoComplete: 'tel', value: '+13035550184' },
  email: { type: 'email', autoComplete: 'email', placeholder: 'Where we send your confirmation' },
};

const READS_AS_DATE = /^MM\s?\/\s?DD\s?\/\s?YYYY$/;
const READS_AS_PHONE = /^(?:\+1 )?(?:\(\d{3}\) |\d{3}-)\d{3}-\d{4}$/;

/** Every way the rendered Driver step can break AC1. Pure: takes markup, returns problems. */
export function hintProblems(html: string): string[] {
  const root = parseHtml(html);
  const problems: string[] = [];
  const found = {} as Record<Which, El>;
  for (const which of Object.keys(PINNED) as Which[]) {
    const hits = pick(root, which);
    if (hits.length !== 1) { problems.push(`${which}: expected one input with autocomplete="${AUTOCOMPLETE[which]}", found ${hits.length}`); continue; }
    found[which] = hits[0];
    for (const [attr, want] of Object.entries(PINNED[which])) {
      if (found[which].attrs[attr] !== want) problems.push(`${which}: ${attr} is ${JSON.stringify(found[which].attrs[attr])}, must stay ${JSON.stringify(want)}`);
    }
  }
  if (problems.length) return problems;

  const nameClass = classes(found.name);
  for (const which of ['dob', 'phone'] as const) {
    const el = found[which];
    const own = classes(el);
    const extra = own.filter((t) => !nameClass.includes(t));
    const lost = nameClass.filter((t) => !own.includes(t));
    const ellipsis = extra.length === 1 && ELLIPSIS.includes(extra[0]);
    if (lost.length || (extra.length && !ellipsis)) problems.push(`${which}: classes drifted from the shared field classes (lost ${JSON.stringify(lost)}, extra ${JSON.stringify(extra)}); only one of ${ELLIPSIS.join(' / ')} may be added`);
    const hint = el.attrs.placeholder ?? '';
    if (hint.length > MAX_HINT_CHARS && !ellipsis) problems.push(`${which}: hint "${hint}" is ${hint.length} characters (limit ${MAX_HINT_CHARS}) and the input has no ${ELLIPSIS.join(' / ')} class`);
    if (!(which === 'dob' ? READS_AS_DATE : READS_AS_PHONE).test(hint)) problems.push(`${which}: hint "${hint}" no longer reads as ${which === 'dob' ? 'a date' : 'a phone number'}`);
  }
  return problems;
}

/** A copy of `html` with one attribute of the one `which` input rewritten (null removes it); planted-defect helper. */
function plant(html: string, which: Which, attr: string, value: string | null): string {
  const el = pick(parseHtml(html), which)[0];
  const tag = html.slice(el.start, el.end);
  const re = new RegExp(`\\s${attr.replace(/[-]/g, '\\-')}="[^"]*"`);
  if (!re.test(tag)) throw new Error(`planted: ${attr} is not on the ${which} input`);
  return html.slice(0, el.start) + tag.replace(re, value === null ? '' : ` ${attr}="${value}"`) + html.slice(el.end);
}
const addClass = (html: string, which: Which, token: string): string => {
  const el = pick(parseHtml(html), which)[0];
  return plant(html, which, 'class', `${el.attrs.class} ${token}`);
};

describe('MP-24 hints (AC1)', () => {
  it('Driver-step phone and DOB hints fit the 360px field budget and nothing else about the two inputs moves', () => {
    const html = renderDriver();

    // Planted first, on a known-good copy (the shortened hints written into today's render), so the
    // checks are proven able to see each unhappy case whether or not DriverStep has been edited yet.
    const good = plant(plant(html, 'phone', 'placeholder', '555-555-0100'), 'dob', 'placeholder', 'MM/DD/YYYY');
    expect(hintProblems(good), 'the known-good copy must pass').toEqual([]);
    const planted: [string, string, RegExp][] = [
      ['the old phone hint, no ellipsis class', plant(good, 'phone', 'placeholder', '+1 (555) 555-0100'), /phone: hint .* characters/],
      ['the old DOB hint, no ellipsis class', plant(good, 'dob', 'placeholder', 'MM / DD / YYYY'), /dob: hint .* characters/],
      ['the trimmed phone hint (14 characters), no ellipsis class', plant(good, 'phone', 'placeholder', '(555) 555-0100'), /phone: hint .* characters/],
      ['a hint that no longer reads as a phone number', plant(good, 'phone', 'placeholder', 'Phone'), /no longer reads as a phone number/],
      ['a hint that no longer reads as a date', plant(good, 'dob', 'placeholder', 'Birthday'), /no longer reads as a date/],
      ['phone type changed', plant(good, 'phone', 'type', 'text'), /phone: type/],
      ['phone autocomplete changed', plant(good, 'phone', 'autoComplete', 'off'), /expected one input with autocomplete="tel"/],
      ['DOB inputMode changed', plant(good, 'dob', 'inputMode', 'text'), /dob: inputMode/],
      ['DOB aria-describedby changed', plant(good, 'dob', 'aria-describedby', 'dob-hint'), /dob: aria-describedby/],
      ['Name placeholder changed', plant(good, 'name', 'placeholder', 'Your name'), /name: placeholder/],
      ['Email placeholder changed', plant(good, 'email', 'placeholder', 'Email'), /email: placeholder/],
      ['a class beyond the ellipsis pair added to the phone input', addClass(good, 'phone', 'rounded-full'), /phone: classes drifted/],
      ['two ellipsis classes on the DOB input', addClass(addClass(good, 'dob', 'truncate'), 'dob', 'text-ellipsis'), /dob: classes drifted/],
    ];
    for (const [what, bad, want] of planted) {
      const got = hintProblems(bad);
      expect(got.some((p) => want.test(p)), `planted "${what}" was not caught: ${JSON.stringify(got)}`).toBe(true);
    }
    // Planted, allowed: the ellipsis route accepts a long hint, and only with the class.
    expect(hintProblems(addClass(plant(good, 'phone', 'placeholder', '+1 (555) 555-0100'), 'phone', 'truncate'))).toEqual([]);
    expect(hintProblems(addClass(plant(good, 'dob', 'placeholder', 'MM / DD / YYYY'), 'dob', 'text-ellipsis'))).toEqual([]);

    // The real render (red at the base by design: the old strings are the unhappy case).
    expect(hintProblems(html)).toEqual([]);
  });

  it('DriverStep keeps its field classes, its blur message and its screen-reader hint copy', () => {
    const raw = readFileSync(join(REPO, DRIVER), 'utf8');
    const src = stripComments(raw);
    const problems: string[] = [];
    const field = /const fieldClass = '([^']*)'/.exec(src)?.[1];
    if (!field) problems.push('fieldClass literal not found');
    else if (createHash('sha256').update(field).digest('hex') !== FIELD_CLASS_SHA256) problems.push('the fieldClass literal changed (typeScale.test.ts and the focus-gold count pin it)');
    // The DOB blur message repeats the hint text; a search-and-replace of the hint would corrupt it.
    for (const copy of ["setDobError('Finish the date as MM / DD / YYYY.')", 'Type the digits of your date of birth: month, day, year.', 'aria-describedby="dob-hint dob-error"']) {
      if (!src.includes(copy)) problems.push(`DriverStep.tsx no longer contains: ${copy}`);
    }
    expect(problems).toEqual([]);

    // Planted: the same three checks see a changed literal and a corrupted blur message.
    expect(createHash('sha256').update(String(field).replace('py-2.5', 'py-2')).digest('hex')).not.toBe(FIELD_CLASS_SHA256);
    expect(src.replace('Finish the date as MM / DD / YYYY.', 'Finish the date as MM/DD/YYYY.').includes("setDobError('Finish the date as MM / DD / YYYY.')")).toBe(false);
  });
});
