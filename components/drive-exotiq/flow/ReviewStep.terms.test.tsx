// MP-18 AC7 and AC10 on the Review & Request step.
// AC7: the words "Rental Terms & Conditions" link to /terms in a new tab ONLY where /terms resolves
// (browseEnabled(), BrowseChrome's footer pattern); elsewhere today's plain text, never a link to a
// 404. The "(opens in a new tab)" hint sits OUTSIDE the label text (driver errata #2: the fee-matrix
// harness and fees.surfaces find the checkbox by the exact label text).
// AC10 (driver errata #2: the renamed "Request this booking" button): soft-disabled with an
// always-mounted polite region while the ONLY blocker is the unticked box; the real `disabled`
// stays while sending and on the blocked branch. Clicks are proven by the pure functions
// (driverValidation.test.ts) and the verify lane's browser transcript; no DOM here.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/CookieControls', () => ({ CookieControls: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => '/' }));

import { ReviewStep } from './ReviewStep';
import { type El, byId, elements, norm, parseHtml, textOf } from '../../../tests/fees/fixtures';
import { fixture, quoteOf, reviewCartOf } from '../../../tests/fees/fixtures';

const noop = () => {};
const LABEL = 'I agree to the Rental Terms & Conditions.';

function render(props: Record<string, unknown> = {}) {
  const c = fixture('FX-T1S1P1');
  return parseHtml(renderToStaticMarkup(<ReviewStep cart={reviewCartOf(c)} goTo={noop} onRequest={noop} quote={quoteOf(c)} onProtectionChange={noop} {...props} />));
}
const termsLabel = (root: El) => elements(root).find((e) => e.tag === 'label' && norm(textOf(e)) === LABEL);
const checkbox = (root: El) => termsLabel(root) && elements(termsLabel(root)!).find((e) => e.tag === 'input' && e.attrs.type === 'checkbox');
const requestButton = (root: El) => elements(root).filter((e) => e.tag === 'button').find((b) => ['Request this booking', 'Sending request…', 'Getting final pricing…'].includes(norm(textOf(b))));

afterEach(() => vi.unstubAllEnvs());

describe('MP-18 Terms link (AC7)', () => {
  it('terms label is a new tab link when legal pages are published', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_MODE', 'booking');
    vi.stubEnv('NEXT_PUBLIC_MARKETPLACE_BROWSE', 'on');
    const root = render();
    const label = termsLabel(root);
    expect(label, `no label reading exactly "${LABEL}"`).toBeDefined();
    const anchors = elements(label!).filter((e) => e.tag === 'a');
    expect(anchors).toHaveLength(1);
    const [a] = anchors;
    expect(a.attrs.href).toBe('/terms');
    expect(a.attrs.target).toBe('_blank');
    expect(a.attrs.rel).toBe('noopener noreferrer');
    expect(norm(textOf(a))).toBe('Rental Terms & Conditions');
    // The new-tab hint: visually hidden, referenced by the link, and outside the label's text.
    const hint = byId(root, a.attrs['aria-describedby'] ?? '');
    expect(hint, 'the link has no aria-describedby hint').toBeDefined();
    expect(norm(textOf(hint!))).toBe('(opens in a new tab)');
    expect(hint!.attrs.class?.split(/\s+/)).toContain('sr-only');
    for (let n: El | null = hint!; n; n = n.parent) expect(n).not.toBe(label);
    // The checkbox is still the label's control; the link is the only anchor to /terms on the step.
    expect(checkbox(root)).toBeDefined();
    expect(elements(root).filter((e) => e.tag === 'a' && e.attrs.href === '/terms')).toHaveLength(1);
  });

  it('terms label is plain text when legal pages are not published', () => {
    for (const env of [{ NEXT_PUBLIC_SITE_MODE: 'booking', NEXT_PUBLIC_MARKETPLACE_BROWSE: '' }, { NEXT_PUBLIC_SITE_MODE: 'marketplace', NEXT_PUBLIC_MARKETPLACE_BROWSE: 'on' }]) {
      vi.unstubAllEnvs();
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      const root = render();
      const label = termsLabel(root);
      expect(label, JSON.stringify(env)).toBeDefined();
      expect(elements(label!).filter((e) => e.tag === 'a'), JSON.stringify(env)).toEqual([]);
      expect(elements(root).filter((e) => e.attrs.href === '/terms'), JSON.stringify(env)).toEqual([]);
      expect(norm(textOf(root))).not.toContain('opens in a new tab');
      // Today's styled words, unchanged.
      const span = elements(label!).find((e) => e.tag === 'span' && norm(textOf(e)) === 'Rental Terms & Conditions');
      expect(span?.attrs.class).toBe('text-ink underline decoration-faint underline-offset-2');
    }
  });
});

describe('MP-18 unticked terms explain themselves (AC10)', () => {
  it('proceed is soft disabled with a polite status region while terms are unticked', () => {
    const root = render();
    const cta = requestButton(root);
    expect(norm(textOf(cta!))).toBe('Request this booking');
    expect(cta!.attrs['aria-disabled']).toBe('true');
    expect('disabled' in cta!.attrs).toBe(false);
    expect(cta!.attrs.tabindex).toBeUndefined();
    // The polite region is mounted and empty on first paint; no message and no aria-invalid yet.
    const status = byId(root, 'review-terms-status');
    expect(status, 'no #review-terms-status region').toBeDefined();
    expect(status!.attrs.role).toBe('status');
    expect(status!.attrs['aria-live']).toBe('polite');
    expect(norm(textOf(status!))).toBe('');
    expect(byId(root, 'review-terms-error')).toBeUndefined();
    expect(norm(textOf(root))).not.toContain('Please accept the Rental Terms');
    const box = checkbox(root)!;
    expect(box.attrs.id).toBe('review-terms');
    expect(box.attrs['aria-invalid']).toBeUndefined();
    expect(box.attrs['aria-describedby']).toBeUndefined();
  });

  it('blocked branch and an in-flight request keep the true disabled button', () => {
    for (const [label, props, want] of [
      ['blocked', { blocked: true }, 'Request this booking'],
      ['blocked + pending', { blocked: true, quotePending: true }, 'Getting final pricing…'],
      ['in flight', { requesting: true }, 'Sending request…'],
    ] as const) {
      const cta = requestButton(render(props));
      expect(norm(textOf(cta!)), label).toBe(want);
      expect('disabled' in cta!.attrs, label).toBe(true);
      expect(cta!.attrs['aria-disabled'], label).toBeUndefined();
    }
  });
});
