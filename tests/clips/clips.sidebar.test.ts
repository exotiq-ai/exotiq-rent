// MP-24 AC2 and AC3: the storefront sidebar's source contract, as source scans. The storefront
// page is an async server component that cannot be rendered without mocking its service, so the
// real fit (five policy rows inside the AC2 window, the 4px clearance at scroll end, the other two
// consumers' computed values) is the browser probe's job; this file pins what makes the probe's
// answer stay true. Every assertion here is green at the base by design.
//
// AC2: the aside still composes the shared cap, keeps its quiet scroll and its end allowance, holds
//      its four children, and no second copy of the cap exists anywhere under app/ or components/.
// AC3: the shared recipe is byte for byte today's literal, and its other two consumers keep their
//      class strings.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../design/lib/scan.mjs';
import { classOf, openTags } from '../restraint/restraintScan';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const PAGE = 'app/[operatorSlug]/page.tsx';
const TOKENS = 'components/browse/tokens.ts';
const BROWSE = 'app/browse/page.tsx';
const VEHICLE = 'components/drive-exotiq/VehicleEntryPage.tsx';

/** The shared recipe, character for character (93 characters on the base this ticket was cut from). */
const STICKY = 'lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:[scrollbar-width:thin]';
const COMPOSED = '${stickyBelowBarClassName}';
/** The other two consumers' class strings as the base has them. */
const BROWSE_RAIL = `scroll-quiet rounded-2xl border border-line bg-panel p-5 ${COMPOSED}`;
const VEHICLE_ASIDE = `hidden lg:block ${COMPOSED}`;
const CAP_COPY = /100dvh\s*-\s*7rem/;
const REQUIRED_ASIDE_TOKENS = ['scroll-quiet', 'hidden', 'lg:block', 'lg:-mx-1', 'lg:-my-1', 'lg:px-1'];
const ASIDE_CHILDREN = ['<AboutCard', '<CallLink', '<PolicyCard', '<WhyCard'];

type Src = { rel: string; text: string };
type Files = { page: string; tokens: string; browse: string; vehicle: string; others: Src[] };

/** app/ and components/ sources, tests and the legacy components/marketplace/ skipped. */
function sources(): Src[] {
  const out: Src[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(join(REPO, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) { if (rel !== 'components/marketplace' && e.name !== 'node_modules') walk(rel); }
      else if (/\.(tsx?|css|mjs|cjs|js)$/.test(e.name) && !/\.test\./.test(e.name)) out.push({ rel, text: readFileSync(join(REPO, rel), 'utf8') });
    }
  };
  walk('app');
  walk('components');
  return out;
}
const realFiles = (): Files => ({ page: read(PAGE), tokens: read(TOKENS), browse: read(BROWSE), vehicle: read(VEHICLE), others: sources() });

/** Bottom padding the aside's own classes give the end of its scroll, in px (Tailwind spacing: n x 4px). */
const bottomPx = (tokens: string[]): number =>
  Math.max(0, ...tokens.map((t) => /^lg:(?:py|pb)-(\d+(?:\.\d+)?)$/.exec(t)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[1]) * 4));

/** AC2: every way the storefront aside can lose the cap, the quiet scroll, the end allowance or a card. */
export function sidebarProblems(files: Files): string[] {
  const problems: string[] = [];
  const page = stripComments(files.page);
  const tags = openTags(page, 'aside');
  if (tags.length !== 1) return [`the storefront page has ${tags.length} <aside> tags, expected exactly one (the desktop sidebar)`];
  const cls = classOf(tags[0]);
  if (!cls.includes(COMPOSED)) problems.push('the aside no longer composes ${stickyBelowBarClassName}');
  const tokens = cls.replace(COMPOSED, ' ').split(/\s+/).filter(Boolean);
  for (const t of REQUIRED_ASIDE_TOKENS) if (!tokens.includes(t)) problems.push(`the aside lost ${t}`);
  if (bottomPx(tokens) < 4) problems.push(`the aside's end allowance is ${bottomPx(tokens)}px, must stay at least 4px (lg:py-1)`);
  const from = page.indexOf(tags[0]);
  const body = page.slice(from, page.indexOf('</aside>', from));
  for (const child of ASIDE_CHILDREN) if (!body.includes(child)) problems.push(`the aside no longer renders ${child}`);
  // The cap lives in one place. Raw text, comments included: Tailwind scans comments too.
  const copies = files.others.filter((s) => CAP_COPY.test(s.text)).map((s) => s.rel).filter((rel) => rel !== TOKENS);
  if (copies.length) problems.push(`a private copy of the cap exists in: ${copies.join(', ')}`);
  return problems;
}

/** AC3: the recipe and its other two consumers. */
export function consumerProblems(files: Files): string[] {
  const problems: string[] = [];
  const literal = /export const stickyBelowBarClassName = '([^']*)'/.exec(files.tokens)?.[1];
  if (literal !== STICKY) problems.push(`stickyBelowBarClassName is ${JSON.stringify(literal)}, must stay ${JSON.stringify(STICKY)}`);
  const only = (rel: string, text: string, tag: string, want: string) => {
    const hits = openTags(stripComments(text), tag).map(classOf).filter((c) => c.includes(COMPOSED));
    if (hits.length !== 1) problems.push(`${rel}: ${hits.length} <${tag}> tags compose the recipe, expected one`);
    else if (hits[0] !== want) problems.push(`${rel}: class is ${JSON.stringify(hits[0])}, must stay ${JSON.stringify(want)}`);
  };
  only(BROWSE, files.browse, 'div', BROWSE_RAIL);
  only(VEHICLE, files.vehicle, 'aside', VEHICLE_ASIDE);
  const users = files.others.filter((s) => s.rel !== TOKENS && s.text.includes(COMPOSED)).map((s) => s.rel).sort();
  const want = [BROWSE, PAGE, VEHICLE].sort();
  if (JSON.stringify(users) !== JSON.stringify(want)) problems.push(`the recipe's consumers are ${JSON.stringify(users)}, expected ${JSON.stringify(want)}`);
  return problems;
}

/** A copy of `files` with one text rewritten (planted-defect helper). */
const edit = (files: Files, key: 'page' | 'tokens' | 'browse' | 'vehicle', from: string, to: string): Files => {
  if (!files[key].includes(from)) throw new Error(`planted: "${from}" not found in ${key}`);
  return { ...files, [key]: files[key].replace(from, to) };
};

describe('MP-24 sidebar (AC2, AC3)', () => {
  it('storefront sidebar keeps the shared cap, its end allowance and its quiet scroll', () => {
    const files = realFiles();
    const planted: [string, Files][] = [
      ['the aside drops the shared cap', edit(files, 'page', `lg:py-1 ${COMPOSED}`, 'lg:py-1')],
      ['the aside loses scroll-quiet', edit(files, 'page', 'scroll-quiet hidden lg:-mx-1', 'hidden lg:-mx-1')],
      ['the aside loses lg:px-1', edit(files, 'page', 'lg:px-1 lg:py-1', 'lg:py-1')],
      ['the aside loses its end allowance', edit(files, 'page', 'lg:px-1 lg:py-1', 'lg:px-1 lg:py-0')],
      ['a card leaves the aside', edit(files, 'page', '              <WhyCard />\n            </aside>', '            </aside>')],
      ['a private copy of the cap appears', { ...files, others: [...files.others, { rel: 'components/browse/Rail.tsx', text: '<div className="lg:max-h-[calc(100dvh-7rem)]" />' }] }],
    ];
    for (const [what, bad] of planted) expect(sidebarProblems(bad).length, `planted "${what}" was not caught`).toBeGreaterThan(0);
    // Planted, allowed: a different vertical rhythm on the aside is not this scan's business (the probe measures the fit).
    expect(sidebarProblems({ ...files, page: files.page.replace(/lg:space-y-\d+/, 'lg:space-y-2') })).toEqual([]);

    expect(sidebarProblems(files)).toEqual([]);
  });

  it('the shared sticky recipe and its other two call sites are unchanged', () => {
    const files = realFiles();
    const planted: [string, Files][] = [
      ['one character of the recipe changes', edit(files, 'tokens', 'lg:top-24', 'lg:top-20')],
      ['the recipe loses its overflow', edit(files, 'tokens', ' lg:overflow-y-auto', '')],
      ['the browse rail changes padding', edit(files, 'browse', 'bg-panel p-5', 'bg-panel p-4')],
      ['the vehicle aside shows below lg', edit(files, 'vehicle', `\`hidden lg:block ${COMPOSED}\``, `\`block ${COMPOSED}\``)],
    ];
    for (const [what, bad] of planted) expect(consumerProblems(bad).length, `planted "${what}" was not caught`).toBeGreaterThan(0);

    expect(consumerProblems(files)).toEqual([]);
  });
});
