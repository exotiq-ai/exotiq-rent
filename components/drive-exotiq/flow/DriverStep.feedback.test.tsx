// MP-18 AC9: an incomplete Driver form explains itself. Continue stays tappable but aria-disabled;
// activating it never calls next, shows a message under each incomplete field, focuses the first
// one and writes a summary into an always-mounted polite region.
// Driver errata #2: that region mounts in BookingFlow, OUTSIDE the MP-26 driver-step golden, and
// the Driver step writes to it through `announce`. Static markup cannot click, focus or show the
// post-attempt state: those decisions are the pure functions in driverValidation.test.ts, and the
// verify lane's browser transcript (AC9-driver-attempt.json) proves the wiring end to end.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/CookieControls', () => ({ CookieControls: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }), usePathname: () => '/' }));

import { BookingFlow } from '../BookingFlow';
import { PrimaryButton } from '../BookingChrome';
import { DriverStep } from './DriverStep';
import { createInitialCart } from '@/domain/booking/mockData';
import type { BookingCart, Driver } from '@/domain/booking/types';
import { type El, byId, elements, norm, parseHtml, textOf } from '../../../tests/fees/fixtures';
import { OPERATOR, VEHICLE } from '../../../tests/fees/fixtures';
import { stripComments } from '../../../tests/design/lib/scan.mjs';
import { openTags } from '../../../tests/restraint/restraintScan';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const noop = () => {};
const EMPTY: Driver = { name: '', dob: '', phone: '', email: '' };
const MESSAGE_IDS = ['driver-name-error', 'driver-phone-error', 'driver-email-error'];

beforeAll(() => vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'mock'));
afterAll(() => vi.unstubAllEnvs());

const cartWith = (driver: Partial<Driver>): BookingCart => {
  const cart = createInitialCart({ operator: OPERATOR, vehicle: VEHICLE });
  return { ...cart, driver: { ...cart.driver, ...driver } };
};
const renderDriver = (driver: Partial<Driver>) => parseHtml(renderToStaticMarkup(<DriverStep cart={cartWith(driver)} setCart={noop} next={noop} announce={noop} />));
const continueButton = (root: El) => elements(root).find((e) => e.tag === 'button' && norm(textOf(e)) === 'Continue');

describe('MP-18 Driver step feedback (AC9)', () => {
  it('first paint shows no errors and an empty polite status region', () => {
    // The flow's region: mounted from the flow's first paint (so it exists, empty, before the
    // Driver step and before any attempt), polite, visually hidden, outside every step.
    const flow = parseHtml(renderToStaticMarkup(<BookingFlow operator={OPERATOR} vehicle={VEHICLE} />));
    const status = byId(flow, 'flow-status');
    expect(status, 'BookingFlow renders no #flow-status region').toBeDefined();
    expect(status!.attrs.role).toBe('status');
    expect(status!.attrs['aria-live']).toBe('polite');
    expect(status!.attrs.class?.split(/\s+/)).toContain('sr-only');
    expect(norm(textOf(status!))).toBe('');
    const shell = elements(flow).find((e) => ['min-h-0', 'flex-1', 'overflow-y-auto'].every((k) => e.attrs.class?.split(/\s+/).includes(k)));
    for (let n: El | null = status!; n; n = n.parent) expect(n, 'the region sits inside a step').not.toBe(shell);
    // Mounted unconditionally in source, and the Driver step is handed the writer.
    const src = stripComments(readFileSync(join(ROOT, 'components/drive-exotiq/BookingFlow.tsx'), 'utf8'));
    const driverTag = openTags(src, 'DriverStep');
    expect(driverTag).toHaveLength(1);
    expect(driverTag[0]).toMatch(/announce=\{setAnnouncement\}/);

    // The Driver step itself, empty form, first paint: no message, no aria-invalid, and no live
    // region of its own beyond the existing #dob-error (the golden-pinned markup stays as it was).
    const root = renderDriver(EMPTY);
    expect(elements(root).filter((e) => e.attrs['aria-invalid'] === 'true')).toEqual([]);
    for (const id of MESSAGE_IDS) expect(byId(root, id), id).toBeUndefined();
    expect(norm(textOf(byId(root, 'dob-error')!))).toBe('');
    expect(elements(root).filter((e) => e.attrs.role === 'status').map((e) => e.attrs.id)).toEqual(['dob-error']);
    expect(norm(textOf(root))).not.toMatch(/Please complete|Enter your/);
  });

  it('continue is aria disabled and focusable, not disabled, while incomplete', () => {
    for (const [label, driver] of [
      ['empty', EMPTY],
      ['one field short', { phone: '555 010' }],
      ['too young, every field filled', { dob: '2015-01-01' }],
    ] as const) {
      const cta = continueButton(renderDriver(driver));
      expect(cta, label).toBeDefined();
      expect(cta!.attrs['aria-disabled'], label).toBe('true');
      expect('disabled' in cta!.attrs, label).toBe(false);
      expect(cta!.attrs.tabindex, label).toBeUndefined();
    }
    const done = continueButton(renderDriver({}));
    expect(done!.attrs['aria-disabled']).toBeUndefined();
    expect('disabled' in done!.attrs).toBe(false);
  });

  it('primary button soft disabled keeps onClick and drops the disabled attribute', () => {
    const onClick = vi.fn();
    const el = PrimaryButton({ softDisabled: true, onClick, children: 'Continue' } as Parameters<typeof PrimaryButton>[0]) as ReactElement<{ onClick?: () => void; disabled?: boolean }>;
    expect(el.props.onClick).toBe(onClick);
    expect(el.props.disabled).toBeFalsy();
    const btn = elements(parseHtml(renderToStaticMarkup(el))).find((e) => e.tag === 'button')!;
    expect(btn.attrs['aria-disabled']).toBe('true');
    expect('disabled' in btn.attrs).toBe(false);
    // A real disable wins over a soft one: never both attributes.
    const both = elements(parseHtml(renderToStaticMarkup(<PrimaryButton {...({ softDisabled: true, disabled: true } as object)}>x</PrimaryButton>))).find((e) => e.tag === 'button')!;
    expect('disabled' in both.attrs).toBe(true);
    expect(both.attrs['aria-disabled']).toBeUndefined();
  });

  it('primary button disabled is unchanged', () => {
    const markup = (props: object) => renderToStaticMarkup(<PrimaryButton onClick={noop} {...props}>Continue</PrimaryButton>);
    const disabled = elements(parseHtml(markup({ disabled: true }))).find((e) => e.tag === 'button')!;
    expect('disabled' in disabled.attrs).toBe(true);
    expect(disabled.attrs['aria-disabled']).toBeUndefined();
    // The default render is byte-identical to before (the Dates step and every other caller).
    const plain = markup({});
    expect(plain).not.toContain('aria-disabled=');
    expect(plain).not.toContain('disabled=""');
    expect(markup({ softDisabled: false })).toBe(plain);
    expect(plain).toBe('<button type="button" class="w-full rounded-xl px-5 py-4 text-body font-semibold disabled:cursor-not-allowed disabled:opacity-45 bg-gold text-goldInk transition hover:brightness-110 active:scale-[0.98] active:brightness-95 disabled:hover:brightness-100 disabled:active:scale-100 disabled:active:brightness-100 aria-disabled:hover:brightness-100 aria-disabled:active:scale-100 aria-disabled:active:brightness-100 motion-reduce:transition-none motion-reduce:active:scale-100">Continue</button>');
  });
});
