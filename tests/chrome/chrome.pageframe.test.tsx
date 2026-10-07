// MP-17 AC5: PageFrame is a plain page (the full-width lit ground, SiteBar on top, a centred
// content slot, natural document scroll) with no phone cage, and both 404s and every /verify
// state render inside it. /verify's service is mocked so all four states render for real.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ lookup: null as unknown }));
vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
  usePathname: () => '/',
  notFound: () => { throw new Error('notFound'); },
}));
vi.mock('@/domain/booking/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/booking/service')>();
  return { ...actual, getBookingConfirmation: async () => svc.lookup };
});

import { PageFrame } from '@/components/browse/PageFrame';
import NotFound from '@/app/not-found';
import BookingNotFound from '@/app/booking/[bookingId]/not-found';
import VerifyRoute from '@/app/verify/page';
import { HEX, RGBA, SIZE, stripComments } from '../design/lib/scan.mjs';
import { type El, BOOKING_REF, NOW_ISO, byAttr, classes, confirmationOf, elements, fixture, norm, parseHtml, textOf } from '../fees/fixtures';
import { goldCount, isBox, literals, openTags } from '../restraint/restraintScan';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const ROUTES = ['app/not-found.tsx', 'app/booking/[bookingId]/not-found.tsx', 'app/verify/page.tsx'];

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW_ISO));
});
afterAll(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllEnvs();
  svc.lookup = null;
});

/** The cage, box and width findings on a page-frame root's class tokens. */
export function cageTokens(tokens: string[]): string[] {
  const found: string[] = [];
  for (const t of ['max-w-[480px]', 'max-w-[430px]', 'h-dvh', 'h-screen', 'overflow-hidden', 'min-[481px]:border-x', 'bg-panel', 'fixed']) if (tokens.includes(t)) found.push(t);
  for (const t of tokens) {
    const bare = t.replace(/^(?:[a-z0-9-[\]]+:)+/, '');
    if (/^(?:shadow|rounded|border|max-w-|overflow-)/.test(bare) && !found.includes(t)) found.push(t);
  }
  return found;
}

/** The page-frame root of a render: the outermost element, which must carry the hook. */
function frameRoot(html: string): El | undefined {
  const root = parseHtml(html);
  const first = root.children.find((c): c is El => typeof c !== 'string');
  return first && first.attrs['data-chrome'] === 'page-frame' ? first : undefined;
}

describe('MP-17 PageFrame (AC5)', () => {
  it('page frame is the full-width ground with a site bar and no cage', async () => {
    const problems: string[] = [];
    const html = renderToStaticMarkup(<PageFrame homeHref="/exotiq"><p data-probe>child</p></PageFrame>);
    const frame = frameRoot(html);
    if (!frame) problems.push('the outermost element is not [data-chrome="page-frame"]');
    else {
      const tokens = classes(frame);
      for (const t of ['min-h-dvh', 'bg-ground']) if (!tokens.includes(t)) problems.push(`frame lacks ${t}`);
      problems.push(...cageTokens(tokens).map((t) => `frame carries ${t}`));
      const headers = elements(frame).filter((e) => e.tag === 'header');
      if (headers.length !== 1) problems.push(`${headers.length} site bars`);
      else if (elements(headers[0]).find((e) => e.tag === 'a')?.attrs.href !== '/exotiq') problems.push('the site bar does not link to homeHref');
      const mains = elements(frame).filter((e) => e.tag === 'main');
      if (mains.length !== 1) problems.push(`${mains.length} <main>`);
      else {
        if (!elements(mains[0]).some((e) => 'data-probe' in e.attrs)) problems.push('the child is not inside <main>');
        if (!classes(mains[0]).includes('mx-auto')) problems.push('the content slot is not centred');
      }
    }

    // Source: no consent or analytics, no shadow, no hex, no rgba, no off-scale type, no gold, no box.
    const source = stripComments(read('components/browse/PageFrame.tsx'));
    for (const [label, re] of [['CookieControls', /CookieControls/], ['TrackView', /TrackView/], ['an analytics import', /@\/components\/analytics/], ['a shadow', /shadow-\[/]] as const) if (re.test(source)) problems.push(`PageFrame.tsx: ${label}`);
    if (Array.from(source.matchAll(HEX)).length) problems.push('PageFrame.tsx: a hex colour');
    if (Array.from(source.matchAll(RGBA)).length) problems.push('PageFrame.tsx: an rgba()');
    if (Array.from(source.matchAll(SIZE)).length) problems.push('PageFrame.tsx: an off-scale type size');
    if (goldCount(source)) problems.push('PageFrame.tsx: gold');
    if (literals(source).some(isBox)) problems.push('PageFrame.tsx: a box');

    // The three routes use it and nothing of the old cages.
    for (const rel of ROUTES) {
      const text = read(rel);
      if (!/from\s+['"]@\/components\/browse\/PageFrame['"]/.test(text)) problems.push(`${rel}: does not import PageFrame`);
      for (const old of ['PhoneViewport', 'VerifyShell', 'max-w-[430px]']) if (text.includes(old)) problems.push(`${rel}: still names ${old}`);
    }

    // Every route state renders inside the frame.
    const verify = stripComments(read('app/verify/page.tsx'));
    if (openTags(verify, 'PageFrame').length !== 4) problems.push(`/verify: ${openTags(verify, 'PageFrame').length} PageFrame returns, expected 4 (incomplete, not found, expired, ready)`);
    const states: [string, string, unknown, Record<string, string>][] = [
      ['incomplete', 'This link is incomplete', null, {}],
      ['not found', 'We couldn’t find that booking', null, { ref: BOOKING_REF, token: 'tok' }],
      ['expired', 'This verification link has expired', { restricted: true, bookingRef: BOOKING_REF, status: 'requested' }, { ref: BOOKING_REF, token: 'tok' }],
      ['ready', 'One last step.', confirmationOf(fixture('FX-T1S1P1'), 'paid'), { ref: BOOKING_REF, token: 'tok' }],
    ];
    vi.stubEnv('NEXT_PUBLIC_SITE_MODE', 'booking');
    for (const [label, heading, lookup, searchParams] of states) {
      svc.lookup = lookup;
      const page = renderToStaticMarkup(await VerifyRoute({ searchParams: Promise.resolve(searchParams) }));
      const root = frameRoot(page);
      if (!root) { problems.push(`/verify ${label}: not inside the page frame`); continue; }
      const h1 = elements(root).filter((e) => e.tag === 'h1').map((e) => norm(textOf(e)));
      if (h1.length !== 1 || h1[0].replace(/['’]/g, "'") !== heading.replace(/['’]/g, "'")) problems.push(`/verify ${label}: headings ${JSON.stringify(h1)}`);
    }
    for (const [label, Page] of [['NotFound', NotFound], ['BookingNotFound', BookingNotFound]] as const) {
      const root = frameRoot(renderToStaticMarkup(createElement(Page)));
      if (!root) problems.push(`${label}: not inside the page frame`);
      else if (byAttr(root, 'data-chrome', 'page-frame').length) problems.push(`${label}: a nested page frame`);
    }

    // Planted: each cage token is caught by the same check.
    expect(cageTokens(['min-h-dvh', 'max-w-[480px]', 'lg:shadow-xl', 'rounded-2xl', 'min-[481px]:border-x', 'overflow-hidden'])).toEqual(['max-w-[480px]', 'overflow-hidden', 'min-[481px]:border-x', 'lg:shadow-xl', 'rounded-2xl']);
    expect(cageTokens(['flex', 'min-h-dvh', 'flex-col', 'bg-ground', 'text-ink'])).toEqual([]);
    expect(problems).toEqual([]);
  });
});
