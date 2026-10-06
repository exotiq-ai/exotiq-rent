// MP-17 AC12 (negative): MP-14's e-mail marketing consent is untouched by the chrome work. The
// versioned wording is pinned literally here (copied from domain/renters/consentText.ts at efff2bb),
// the Review-step opt-in renders the booking wording unchecked and outside Sticky, and the capture
// form keeps its unchecked box while the footer variant keeps its implied-consent line.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));

import { ReviewStep } from '@/components/drive-exotiq/flow/ReviewStep';
import { EmailCaptureForm } from '@/components/renters/EmailCaptureForm';
import { CONSENT_TEXT } from '@/domain/renters/consentText';
import { stripComments } from '../design/lib/scan.mjs';
import { type El, NOW_ISO, elements, fixture, norm, parseHtml, quoteOf, reviewCartOf, textOf } from '../fees/fixtures';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const noop = () => {};
const Review = ReviewStep as unknown as ComponentType<Record<string, unknown>>;

/** The MP-14 wording, versions included, exactly as it stands at the branch base. */
const PINNED = {
  form: {
    version: 'form-2026-09-04',
    text: 'Also send me first looks at new cars and early access from Drive Exotiq. Unsubscribe any time.',
  },
  footer: {
    version: 'footer-2026-09-04',
    text: 'Keep me posted: occasional e-mail from Drive Exotiq about new cars and early access. Unsubscribe any time.',
  },
  booking: {
    version: 'review-2026-09-04',
    text: 'Keep me posted on new cars and early access from Drive Exotiq. Occasional e-mail, unsubscribe any time.',
  },
  confirm: {
    version: 'confirm-2026-09-04',
    text: 'first looks at new cars and early access (occasional e-mail, unsubscribe any time)',
    button: 'Confirm and send me first looks',
  },
};

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW_ISO));
});
afterAll(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** The checkboxes inside the <label> whose text includes `wording`. */
function boxesFor(root: El, wording: string): El[] {
  const label = elements(root).find((e) => e.tag === 'label' && norm(textOf(e)).includes(wording));
  return label ? elements(label).filter((e) => e.tag === 'input' && e.attrs.type === 'checkbox') : [];
}

/** The body of every <Sticky>...</Sticky> in a source text. */
export const stickyBodies = (text: string): string[] => Array.from(text.matchAll(/<Sticky\b[^>]*>([\s\S]*?)<\/Sticky>/g), (m) => m[1]);

describe('MP-17 consent (AC12)', () => {
  it('MP-14 consent surfaces keep their wording, versions and unchecked defaults', () => {
    vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
    vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'mock');
    const problems: string[] = [];
    if (JSON.stringify(CONSENT_TEXT) !== JSON.stringify(PINNED)) problems.push(`CONSENT_TEXT changed: ${JSON.stringify(CONSENT_TEXT)}`);

    // Review step: the booking opt-in renders its wording, unchecked.
    const c = fixture('FX-T1S1P1');
    const review = parseHtml(renderToStaticMarkup(createElement(Review, { cart: reviewCartOf(c), goTo: noop, onRequest: noop, quote: quoteOf(c), onProtectionChange: noop, onMarketingConsentChange: noop })));
    const opt = boxesFor(review, PINNED.booking.text);
    if (opt.length !== 1) problems.push(`Review: ${opt.length} checkboxes beside the booking wording`);
    else if ('checked' in opt[0].attrs) problems.push('Review: the opt-in renders checked');
    // ...and outside Sticky, in every flow file.
    const flowDir = 'components/drive-exotiq/flow';
    for (const f of readdirSync(join(REPO, flowDir)).filter((n) => n.endsWith('.tsx'))) {
      for (const body of stickyBodies(stripComments(read(`${flowDir}/${f}`)))) {
        for (const word of ['CONSENT_TEXT', 'marketingConsent', 'onConsent', 'onMarketingConsentChange']) if (body.includes(word)) problems.push(`${flowDir}/${f}: ${word} inside <Sticky>`);
      }
    }
    if (stickyBodies(stripComments(read(`${flowDir}/ReviewStep.tsx`))).length === 0) problems.push('ReviewStep: no <Sticky> found to check (the scan would be vacuous)');

    // The capture form: an unchecked consent box with the form wording.
    const form = parseHtml(renderToStaticMarkup(createElement(EmailCaptureForm, { source: 'alert', cta: 'Notify me' })));
    const box = boxesFor(form, PINNED.form.text);
    if (box.length !== 1) problems.push(`EmailCaptureForm: ${box.length} consent checkboxes`);
    else if ('checked' in box[0].attrs) problems.push('EmailCaptureForm: the consent box renders checked');
    // The footer variant: the implied-consent line and no checkbox.
    const footer = parseHtml(renderToStaticMarkup(createElement(EmailCaptureForm, { source: 'footer', cta: 'Keep me posted', consentImplied: true })));
    if (!norm(textOf(footer)).includes(PINNED.footer.text)) problems.push('EmailCaptureForm footer: the implied-consent line is gone');
    if (elements(footer).some((e) => e.tag === 'input' && e.attrs.type === 'checkbox')) problems.push('EmailCaptureForm footer: a checkbox appeared');

    // Planted: an opt-in moved into Sticky is caught by the same scan.
    expect(stickyBodies('<Sticky><label><input checked={cart.driver.marketingConsent} /></label></Sticky>')[0]).toContain('marketingConsent');
    expect(problems).toEqual([]);
  });
});
