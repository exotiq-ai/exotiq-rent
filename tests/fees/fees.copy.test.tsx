// MP-26 AC15: the how-it-works order and the identity copy match the real lifecycle. Identity is
// offered from the moment a booking exists (ConfirmationScreen renders IdentityVerificationCard for
// every non-terminal booking), so it is step 03 and the payment link 04; DriverStep stops promising
// verification "right after payment". Renders with react-dom/server; the copy sweep reads source
// with comments stripped.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

import { VehicleEntryPage } from '@/components/drive-exotiq/VehicleEntryPage';
import { DriverStep } from '@/components/drive-exotiq/flow/DriverStep';
import { stripComments } from '../design/lib/scan.mjs';
import { NOW_ISO, OPERATOR, VEHICLE, type El, classes, elements, fixture, norm, parseHtml, reviewCartOf, textOf } from './fixtures';
import { REPO } from './goldens';

const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const VEP = 'components/drive-exotiq/VehicleEntryPage.tsx';
const DRIVER = 'components/drive-exotiq/flow/DriverStep.tsx';
const SENTENCE = "You'll verify your identity right after you request the booking — takes about two minutes, have your license ready.";
const ORDER = ['Choose your dates and pickup time.', `${OPERATOR.name} reviews your request.`, 'Verify your identity — about two minutes.', 'We email your payment link once approved.'];

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW_ISO));
  vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'mock');
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** The how-it-works rows as rendered: [numeral, text]. */
export function howItWorks(html: string): [string, string][] {
  const root = parseHtml(html);
  const heading = elements(root).find((e) => e.tag === 'h2' && norm(textOf(e)) === 'How it works');
  const box = heading?.parent;
  if (!box) return [];
  return box.children
    .filter((c): c is El => typeof c !== 'string' && c.tag === 'div')
    .map((row) => {
      const numeral = row.children.find((c): c is El => typeof c !== 'string' && c.tag === 'span');
      const rest = row.children.filter((c) => c !== numeral).map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
      return [numeral ? `${textOf(numeral)}|${classes(numeral).join(' ')}` : '', norm(rest)] as [string, string];
    });
}

/** "after payment" anywhere in the renter tree's comment-stripped source (literals and JSX text alike). */
export function afterPaymentHits(files: Record<string, string>): string[] {
  return Object.entries(files).filter(([, text]) => /after payment/i.test(stripComments(text))).map(([rel]) => rel);
}

function renterSources(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(join(REPO, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (rel !== 'components/marketplace' && rel !== 'components/analytics') walk(rel); } else if (/\.tsx?$/.test(e.name)) out[rel] = read(rel);
    }
  };
  walk('components');
  walk('app');
  return out;
}

describe('MP-26 lifecycle copy (AC15)', () => {
  it('how it works puts identity at 03 and the payment link at 04 and the driver step stops saying after payment', async () => {
    const problems: string[] = [];

    // The vehicle page as rendered (mock mode).
    const page = renderToStaticMarkup(await VehicleEntryPage({ operatorSlug: OPERATOR.slug, vehicleSlug: VEHICLE.slug }));
    const rows = howItWorks(page);
    const want = ORDER.map((t, i) => [`0${i + 1}|text-faint`, t]);
    if (JSON.stringify(rows) !== JSON.stringify(want)) problems.push(`how it works: ${JSON.stringify(rows)}`);
    // The numerals keep MP-16's pinned shape.
    if (!/<span className="text-faint">0\{index \+ 1\}<\/span>/.test(stripComments(read(VEP)))) problems.push('how it works numerals are not <span className="text-faint">0{index + 1}</span>');

    // The driver step: heading unchanged, the identity sentence true.
    const driver = parseHtml(renderToStaticMarkup(<DriverStep cart={reviewCartOf(fixture('FX-T1S1P1'))} setCart={() => {}} next={() => {}} />));
    const heading = elements(driver).find((e) => e.tag === 'div' && norm(textOf(e)) === 'ID check comes after booking');
    if (!heading) problems.push('DriverStep: the heading "ID check comes after booking" changed');
    const sentence = heading?.parent?.children.find((c): c is El => typeof c !== 'string' && c.tag === 'p');
    if (!sentence || norm(textOf(sentence)) !== SENTENCE) problems.push(`DriverStep: identity sentence "${sentence ? norm(textOf(sentence)) : ''}"`);
    if (/post-payment/i.test(read(DRIVER))) problems.push('DriverStep: a comment still says identity is post-payment');

    // No "after payment" left in the renter tree (marketplace and analytics excluded).
    for (const rel of afterPaymentHits(renterSources())) problems.push(`${rel}: says "after payment"`);

    // Planted: 03 and 04 swapped back, a changed numeral span, "after payment" in a literal.
    const list = (items: string[]) => `<div><h2>How it works</h2>${items.map((t, i) => `<div class="flex"><span class="text-faint">0${i + 1}</span>${t}</div>`).join('')}</div>`;
    expect(howItWorks(list(ORDER))).toEqual(want);
    expect(howItWorks(list([ORDER[0], ORDER[1], ORDER[3], ORDER[2]]))).not.toEqual(want);
    expect(/<span className="text-faint">0\{index \+ 1\}<\/span>/.test('<span className="text-muted">0{index + 1}</span>')).toBe(false);
    expect(afterPaymentHits({ 'x.tsx': "const a = 'Verify right after payment';", 'y.tsx': '// after payment, in a comment' })).toEqual(['x.tsx']);
    expect(afterPaymentHits({ 'z.tsx': '<p>You&apos;ll verify your identity right after payment</p>' })).toEqual(['z.tsx']);

    expect(problems).toEqual([]);
  });
});
