// MP-17 surfaces (AC4, AC6, AC8, AC11, AC13): the browse routes never wore wizard chrome and must
// not start; the 404s and /verify keep their words, links and one heading; the flow opens on
// Dates as step 1 of 3; no phantom step chrome survives in source; and no chrome file mounts a
// consent control or an analytics call. Renders go through react-dom/server; source scans read
// the repo's own files (app/ and components/, the legacy components/marketplace/ excluded).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/analytics/PostHogInit', () => ({
  useCookieConsent: () => ({ ready: false, visibility: 'hidden', choice: { analytics: false, marketing: false }, gpc: false, choose() {}, activeDetails: null, setActiveDetails() {} }),
}));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'font-vars' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
  usePathname: () => '/',
  notFound: () => { throw new Error('notFound'); },
}));

import NotFound from '@/app/not-found';
import BookingNotFound from '@/app/booking/[bookingId]/not-found';
import VerifyRoute from '@/app/verify/page';
import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { BookingFlow } from '@/components/drive-exotiq/BookingFlow';
import { stripComments } from '../design/lib/scan.mjs';
import { type El, byAttr, classes, elements, norm, parseHtml, textOf, NOW_ISO, OPERATOR, VEHICLE } from '../fees/fixtures';
import { openTags } from '../restraint/restraintScan';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const src = (rel: string) => stripComments(read(rel));

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

/** Repo-relative source files under `dir` (recursive), tests and the legacy marketplace mockup skipped. */
function sources(dir: string, re = /\.(tsx?|mts|m?js|css)$/): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(join(REPO, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) { if (rel !== 'components/marketplace' && e.name !== 'node_modules') walk(rel); }
      else if (re.test(e.name) && !/\.test\./.test(e.name)) out.push(rel);
    }
  };
  walk(dir);
  return out.sort();
}

/** Wizard chrome anywhere in a render: a Back control, the Close link, a progress element, a step bar. */
function wizardChrome(html: string): string[] {
  const root = parseHtml(html);
  const all = elements(root);
  const found: string[] = [];
  if (all.some((e) => e.attrs['aria-label'] === 'Back' || ((e.tag === 'button' || e.tag === 'a') && norm(textOf(e)) === 'Back'))) found.push('a Back control');
  if (all.some((e) => e.attrs['aria-label'] === 'Close booking flow')) found.push('a Close booking flow link');
  if (byAttr(root, 'data-chrome', 'progress').length) found.push('a progress element');
  if (all.some((e) => classes(e).includes('h-[3px]'))) found.push('a step bar');
  return found;
}

/** The accessible name of a link: its aria-label, else its text plus the alt of the images in it. */
const accessibleName = (a: El): string => a.attrs['aria-label'] ?? norm(`${textOf(a)} ${elements(a).filter((e) => e.tag === 'img').map((i) => i.attrs.alt ?? '').join(' ')}`);
/** Every link with this accessible name. */
const linksNamed = (root: El, name: string) => elements(root).filter((e) => e.tag === 'a' && accessibleName(e) === name);

/** AC11: the phantom step-chrome phrases. Comments are NOT stripped, so a comment may not quote them. */
const PHANTOM: [string, RegExp][] = [
  ['StepIndicator', /\bStepIndicator\b/],
  ['stepStyle', /\bstepStyle\b/],
  ['StepStyle', /\bStepStyle\b/],
  ['stepTotal', /\bstepTotal\b/],
  ["'numbered'", /['"`]numbered['"`]/],
  ['the six-label array', /\[\s*['"`]Vehicle['"`]\s*,\s*['"`]Dates['"`]\s*,\s*['"`]Driver['"`]\s*,\s*['"`]Review['"`]\s*,\s*['"`]Pay['"`]\s*,\s*['"`]Done['"`]\s*\]/],
  ['layout="phone"', /layout=(?:"phone"|'phone'|\{\s*['"`]phone['"`]\s*\})/],
  ['step={6}', /\bstep=\{\s*6\s*\}/],
  ['step={1}', /\bstep=\{\s*1\s*\}/],
];
export const phantomHits = (text: string): string[] => PHANTOM.filter(([, re]) => re.test(text)).map(([name]) => name);

/** AC13: the files this ticket's chrome lives in; none may mount a consent control or analytics. */
const CHROME_FILES = [
  'components/drive-exotiq/BookingChrome.tsx',
  'components/browse/PageFrame.tsx',
  'app/not-found.tsx',
  'app/booking/[bookingId]/not-found.tsx',
  'app/verify/page.tsx',
];
/** The six CookieControls mounts outside components/analytics/ (verbatim pins live in restraint.preserve). */
const MOUNTS: Record<string, number> = {
  'app/[operatorSlug]/page.tsx': 2,
  'components/drive-exotiq/VehicleEntryPage.tsx': 2,
  'components/drive-exotiq/flow/shared.tsx': 1,
  'app/privacy/page.tsx': 1,
};
export function analyticsInChrome(text: string): string[] {
  const found: string[] = [];
  if (/<CookieControls\b/.test(text)) found.push('a <CookieControls> mount');
  if (/\bTrackView\b/.test(text)) found.push('TrackView');
  if (/from\s+['"]@\/components\/analytics(?:\/|['"])/.test(text) || /from\s+['"](?:\.\.\/)+analytics\//.test(text)) found.push('an analytics import');
  if (/\btrack\(/.test(text) || /\bposthog\b/i.test(text)) found.push('an analytics call');
  return found;
}

describe('MP-17 surfaces', () => {
  it('browse chrome has no wizard chrome and its routes never import it', () => {
    const problems: string[] = [];
    const routes = sources('app', /^page\.tsx$/).filter((rel) => /import[^;]*\b(?:BrowseChrome|LegalPage)\b[^;]*from/.test(read(rel)));
    const want = ['app/browse/page.tsx', 'app/saved/page.tsx', 'app/terms/page.tsx', 'app/privacy/page.tsx', 'app/renters/confirm/page.tsx', 'app/renters/confirmed/page.tsx', 'app/renters/unsubscribe/page.tsx', 'app/renters/unsubscribed/page.tsx'];
    for (const rel of want) if (!routes.includes(rel)) problems.push(`${rel}: no longer found as a BrowseChrome route`);
    for (const rel of [...routes, 'components/browse/BrowseChrome.tsx', 'components/browse/LegalPage.tsx']) {
      const text = read(rel);
      for (const name of ['BookingChrome', 'PhoneViewport']) if (new RegExp(`\\b${name}\\b`).test(text)) problems.push(`${rel}: names ${name}`);
    }
    for (const view of ['browse_view', null] as const) {
      problems.push(...wizardChrome(renderToStaticMarkup(createElement(BrowseChrome, { view, children: createElement('p', null, 'x') }))).map((p) => `BrowseChrome (${view}): ${p}`));
    }
    // Planted: a route importing the booking frame is caught by the same scan.
    expect(/\bPhoneViewport\b/.test("import { PhoneViewport } from '@/components/drive-exotiq/BookingChrome';")).toBe(true);
    expect(problems).toEqual([]);
  });

  it('404 and verify keep their copy, links and single heading', async () => {
    const problems: string[] = [];
    const check = (label: string, html: string, heading: string, cta: string, href: string) => {
      const root = parseHtml(html);
      const h1 = elements(root).filter((e) => e.tag === 'h1');
      if (h1.length !== 1) problems.push(`${label}: ${h1.length} <h1>`);
      else if (norm(textOf(h1[0])) !== heading) problems.push(`${label}: heading "${norm(textOf(h1[0]))}"`);
      const links = linksNamed(root, cta);
      if (links.length !== 1) problems.push(`${label}: ${links.length} links named "${cta}"`);
      else if (links[0].attrs.href !== href) problems.push(`${label}: "${cta}" goes to ${links[0].attrs.href}, expected ${href}`);
    };
    const verify = async () => renderToStaticMarkup(await VerifyRoute({ searchParams: Promise.resolve({}) }));

    // Booking mode, default team.
    vi.stubEnv('NEXT_PUBLIC_SITE_MODE', 'booking');
    vi.stubEnv('NEXT_PUBLIC_DEFAULT_TEAM_SLUG', undefined);
    check('NotFound', renderToStaticMarkup(createElement(NotFound)), 'This page took a wrong turn.', 'Continue browsing', '/exotiq');
    check('BookingNotFound', renderToStaticMarkup(createElement(BookingNotFound)), 'This booking needs its secure link.', 'Continue browsing', '/exotiq');
    check('/verify', await verify(), 'This link is incomplete', 'Back to the booking site', '/exotiq');

    // A custom default team flows into all three.
    vi.stubEnv('NEXT_PUBLIC_DEFAULT_TEAM_SLUG', 'acme');
    check('NotFound acme', renderToStaticMarkup(createElement(NotFound)), 'This page took a wrong turn.', 'Continue browsing', '/acme');
    check('BookingNotFound acme', renderToStaticMarkup(createElement(BookingNotFound)), 'This booking needs its secure link.', 'Continue browsing', '/acme');
    check('/verify acme', await verify(), 'This link is incomplete', 'Back to the booking site', '/acme');

    // Marketplace mode flips the 404's CTA home.
    vi.stubEnv('NEXT_PUBLIC_SITE_MODE', 'marketplace');
    check('NotFound marketplace', renderToStaticMarkup(createElement(NotFound)), 'This page took a wrong turn.', 'Back to Drive Exotiq', '/');
    const marketplace = parseHtml(renderToStaticMarkup(createElement(NotFound)));
    if (linksNamed(marketplace, 'Continue browsing').length) problems.push('NotFound marketplace: still offers "Continue browsing"');

    expect(problems).toEqual([]);
  });

  it('booking flow opens on Dates as step 1 of 3', () => {
    vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'mock');
    vi.stubEnv('NEXT_PUBLIC_RENTER_CAPTURE', 'on');
    const problems: string[] = [];
    const root = parseHtml(renderToStaticMarkup(createElement(BookingFlow, { operator: OPERATOR, vehicle: VEHICLE })));
    const navs = byAttr(root, 'data-chrome', 'progress');
    if (navs.length !== 1) problems.push(`${navs.length} progress elements`);
    const current = elements(root).filter((e) => e.attrs['aria-current'] === 'step');
    if (current.length !== 1) problems.push(`${current.length} current items`);
    else if (norm(textOf(current[0])) !== 'Dates') problems.push(`current item reads "${norm(textOf(current[0]))}"`);
    if (navs[0] && current[0] && !elements(navs[0]).includes(current[0])) problems.push('the current item is not inside the progress');
    const header = elements(root).find((e) => e.tag === 'div' && classes(e).join(' ') === 'mb-4');
    const eyebrow = header?.children.find((c): c is El => typeof c !== 'string');
    if (!eyebrow || norm(textOf(eyebrow)) !== 'Step 1 of 3') problems.push(`eyebrow "${eyebrow ? norm(textOf(eyebrow)) : ''}"`);

    // Source: the chrome gets the flow's own step, nothing added, no total.
    const flow = src('components/drive-exotiq/BookingFlow.tsx');
    const tags = openTags(flow, 'BookingChrome');
    if (tags.length !== 1) problems.push(`${tags.length} BookingChrome tags in BookingFlow`);
    for (const t of tags) {
      if (!/\bstep=\{step\}/.test(t)) problems.push(`BookingChrome is not given step={step}: ${t}`);
      if (/\bstepTotal\b/.test(t)) problems.push(`BookingChrome still gets a stepTotal: ${t}`);
    }
    if (/step=\{\s*step\s*\+\s*1\s*\}/.test(flow)) problems.push('BookingFlow hands step + 1 to the chrome');
    expect(problems).toEqual([]);
  });

  it('no phantom step chrome remains in source', () => {
    const hits: string[] = [];
    for (const rel of [...sources('app'), ...sources('components')]) {
      const found = phantomHits(read(rel));
      if (found.length) hits.push(`${rel}: ${found.join(', ')}`);
    }
    // Planted: each phrase is caught by the same scan.
    expect(phantomHits("function StepIndicator() {}\nconst labels = ['Vehicle', 'Dates', 'Driver', 'Review', 'Pay', 'Done'];\n<PhoneViewport step={6} stepStyle=\"numbered\" stepTotal={3} layout=\"phone\" /><X step={1} />\ntype StepStyle = 'bars';")).toHaveLength(PHANTOM.length);
    expect(phantomHits('<BookingChrome step={step} closeHref="/x" />')).toEqual([]);
    expect(hits).toEqual([]);
  });

  it('no chrome file mounts a consent control or an analytics call', () => {
    const problems: string[] = [];
    // The six mounts stay exactly where they were (verbatim props: restraint.preserve).
    const counts: Record<string, number> = {};
    for (const rel of [...sources('app', /\.tsx$/), ...sources('components', /\.tsx$/)]) {
      if (rel.startsWith('components/analytics/')) continue;
      const n = (src(rel).match(/<CookieControls\b/g) ?? []).length;
      if (n) counts[rel] = n;
    }
    if (JSON.stringify(counts, Object.keys(counts).sort()) !== JSON.stringify(MOUNTS, Object.keys(MOUNTS).sort())) problems.push(`CookieControls mounts ${JSON.stringify(counts)}, expected ${JSON.stringify(MOUNTS)}`);
    for (const rel of CHROME_FILES) {
      if (!existsSync(join(REPO, rel))) { problems.push(`${rel}: does not exist`); continue; }
      problems.push(...analyticsInChrome(src(rel)).map((p) => `${rel}: ${p}`));
    }
    // Planted: a mount, a view tracker and an analytics import are each caught.
    expect(analyticsInChrome("import { CookieControls } from '@/components/analytics/CookieControls';\n<CookieControls />\n<TrackView event=\"x\" />")).toEqual(['a <CookieControls> mount', 'TrackView', 'an analytics import']);
    expect(analyticsInChrome("import { track } from '@/components/analytics/posthog';\ntrack('x');")).toEqual(['an analytics import', 'an analytics call']);
    expect(problems).toEqual([]);
  });
});
