// MP-36 AC1–AC6 (component halves) and AC5(c): the storefront bar renders without its facets by default and
// byte-identically with the flag on, a deep-linked hidden facet stays escapable, the zero state is unchanged, and
// the facet_applied emitter is wired exactly once on the navigation path. react-dom/server (no DOM library in the
// repo), next/navigation and the analytics emitter mocked, the clock frozen so localTodayIso() and the date inputs'
// min/max are stable. The on-state golden is recorded from the UNMODIFIED component (MP36_RECORD, never overwrites)
// before any FilterBar edit on the branch. Every checker runs on a planted fault first.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {} }),
}));
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/components/analytics/posthog', () => ({ track: analytics.track }));

import { FilterBar } from '@/components/browse/FilterBar';
import { EmptyState } from '@/components/browse/EmptyState';
import { changedFacet } from '@/components/browse/facetChange';
import { parseMarketplaceQuery } from '@/domain/booking/marketplaceQuery';
import type { MarketplaceFacets, MarketplaceQuery } from '@/domain/booking/publicContracts';
import { stripComments } from '../design/lib/scan.mjs';
import { NOW_ISO, byAttr, elements, parseHtml, textOf, type El } from '../fees/fixtures';
import { between, read } from './restraintScan';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GOLDEN = fileURLToPath(new URL('./golden/filterbar-facets-on.html', import.meta.url));
const BAR = 'components/browse/FilterBar.tsx';
const ACTION = '/exotiq';
// Production's shape on 2026-11-01: 52 cars, 15 makes, four non-empty bands (Any + 4 = 5 band radios) and one
// classified type (3 < 52, so the Type row renders with facets on and must not without them: A1).
const MAKES = ['Lamborghini', 'Ferrari', 'McLaren', 'Porsche', 'Rolls-Royce', 'Bentley', 'Aston Martin', 'Mercedes-Benz', 'BMW', 'Audi', 'Maserati', 'Koenigsegg', 'Bugatti', 'Lotus', 'Cadillac'];
const FACETS: MarketplaceFacets = {
  cities: [],
  makes: MAKES.map((m, i) => ({ value: m, label: m, count: (i % 4) + 1 })),
  types: [{ value: 'supercar', label: 'Supercar', count: 3 }],
  priceBands: [
    { value: 'under-500', label: 'Under $500/day', count: 2 },
    { value: '500-999', label: '$500 – $999', count: 16 },
    { value: '1000-1999', label: '$1,000 – $1,999', count: 21 },
    { value: '2000-plus', label: '$2,000 and up', count: 13 },
  ],
};
const BASE_QUERY: MarketplaceQuery = parseMarketplaceQuery({});
const UNDER_500 = { minDailyRateCents: 0, maxDailyRateCents: 49_999 };

// Props are read loosely so the file compiles on the base (no facetsEnabled yet) and on the branch.
const Bar = FilterBar as unknown as ComponentType<Record<string, unknown>>;
type Opts = { facetsEnabled?: boolean; query?: Partial<MarketplaceQuery> };
const render = ({ facetsEnabled, query }: Opts = {}): string =>
  renderToStaticMarkup(createElement(Bar, { facets: FACETS, query: { ...BASE_QUERY, ...query }, action: ACTION, ...(facetsEnabled === undefined ? {} : { facetsEnabled }) }));

/** Visible controls with this attribute: a hidden input (a carried deep-link facet, fix round F1) is not a control. */
const count = (root: El, name: string, value: string): number => byAttr(root, name, value).filter((e) => e.attrs.type !== 'hidden').length;
const ancestors = (el: El): El[] => (el.parent ? [el.parent, ...ancestors(el.parent)] : []);
const hasClass = (el: El, cls: string): boolean => (el.attrs.class ?? '').split(/\s+/).includes(cls);
const kids = (el: El): El[] => el.children.filter((c): c is El => typeof c !== 'string');
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** Hidden by its own class or by any ancestor's (fix round N4: the element itself counts). */
const wrapped = (el: El): boolean => [el, ...ancestors(el)].some((a) => hasClass(a, 'hidden') || hasClass(a, 'lg:block'));
const SORT_OPEN = 'class="flex flex-wrap items-center gap-2" role="group" aria-labelledby="sf-sort-label"';

/**
 * The search navigate() would push for this rendered form, mimicking FormData order: every successful control
 * (hidden input, checked radio/checkbox, filled date), empty values and sort=featured dropped. `overrides` stands
 * in for the renter's gesture (a new sort, a picked date pair) and replaces that control's value once.
 */
function formSearch(html: string, overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  const overridden = new Set<string>();
  for (const el of elements(parseHtml(html)).filter((e) => e.tag === 'input' && e.attrs.name)) {
    const name = el.attrs.name;
    const type = el.attrs.type ?? 'text';
    let value: string;
    if (name in overrides) { if (overridden.has(name)) continue; overridden.add(name); value = overrides[name]; }
    else if (type === 'hidden' || type === 'date') value = el.attrs.value ?? '';
    else if ('checked' in el.attrs) value = el.attrs.value ?? '';
    else continue;
    if (value === '') continue;
    if (name === 'sort' && value === 'featured') continue;
    params.append(name, value);
  }
  return params.toString();
}

/** AC1 + AC6 (structure): what the hidden bar must and must not hold. */
function hiddenProblems(html: string): string[] {
  const p: string[] = [];
  const root = parseHtml(html);
  for (const [name, want] of [['make', 0], ['band', 0], ['type', 0], ['sort', 4]] as const) {
    const n = count(root, 'name', name);
    if (n !== want) p.push(`${n} name="${name}" inputs, expected ${want}`);
  }
  const sorts = byAttr(root, 'name', 'sort');
  const values = sorts.map((i) => i.attrs.value);
  if (JSON.stringify(values) !== JSON.stringify(['featured', 'price_asc', 'price_desc', 'newest'])) p.push(`sort values ${values.join(',')}`);
  const labels = sorts.map((i) => (i.parent ? norm(textOf(i.parent)) : ''));
  if (JSON.stringify(labels) !== JSON.stringify(['Featured', 'Lowest price', 'Highest price', 'Newest'])) p.push(`sort labels ${labels.join(',')}`);
  if (count(root, 'type', 'date') !== 2) p.push(`${count(root, 'type', 'date')} date inputs, expected 2`);
  if (/Filters (?:&amp;|&) sort/.test(html)) p.push('the Filters & sort text is rendered');
  if (byAttr(root, 'aria-controls', 'sf-more-filters').length) p.push('a control still targets sf-more-filters');
  if (byAttr(root, 'id', 'sf-more-filters').length) p.push('the sf-more-filters wrapper is rendered');
  if (byAttr(root, 'type', 'button').length) p.push('a type="button" (the pill) is rendered');
  const form = byAttr(root, 'aria-label', 'Filter the fleet')[0];
  const dates = byAttr(root, 'aria-labelledby', 'sf-dates-label')[0];
  const sort = byAttr(root, 'aria-labelledby', 'sf-sort-label')[0];
  if (!form || !dates || !sort) return [...p, 'form, Dates group or Sort group not found'];
  if (wrapped(sort)) p.push('the Sort group sits inside a hidden / lg:block wrapper');
  const siblings = kids(form);
  if (sort.parent !== form) p.push('the Sort group is not a direct child of the form');
  else if (siblings.indexOf(sort) !== siblings.indexOf(dates) + 1) p.push(`the Sort group is not immediately after the Dates group: ${siblings.map((s) => s.tag + (s.attrs['aria-labelledby'] ? `[${s.attrs['aria-labelledby']}]` : '')).join(' ')}`);
  return p;
}

/** AC3: the Clear link's text and its problems for one query, facets hidden. */
function clearOf(html: string): { text: string; problems: string[] } {
  const root = parseHtml(html);
  const links = elements(root).filter((e) => e.tag === 'a' && e.attrs.href === ACTION);
  if (links.length !== 1) return { text: '', problems: [`${links.length} links to ${ACTION}`] };
  const problems: string[] = [];
  if (wrapped(links[0])) problems.push('the Clear link sits inside a hidden wrapper');
  if (count(root, 'name', 'make') || count(root, 'name', 'band') || count(root, 'name', 'type')) problems.push('a facet input is rendered');
  return { text: norm(textOf(links[0])), problems };
}

/** AC5(c): the emitter, read from source (comments stripped). `others` = every other file under components/browse. */
function wiringProblems(src: string, others: [string, string][]): string[] {
  const p: string[] = [];
  const calls = src.match(/\btrack\(/g) ?? [];
  if (calls.length !== 1) p.push(`${calls.length} track( calls in FilterBar.tsx, expected 1`);
  if (!src.includes("import { track } from '@/components/analytics/posthog';")) p.push('track is not imported from @/components/analytics/posthog');
  if (!src.includes("import { changedFacet } from './facetChange';")) p.push('changedFacet is not imported from ./facetChange');
  const nav = between(src, 'const navigate = () => {', 'const onSubmit');
  const guard = nav.indexOf("if ((start === '') !== (end === '')) return;");
  const decide = nav.indexOf('const facet = changedFacet(query, params);');
  const emit = nav.indexOf("if (facet) track('facet_applied', { facet });");
  const push = nav.indexOf('startTransition(');
  if (!(guard >= 0 && decide > guard && emit > decide && push > emit)) p.push(`navigate() order: guard ${guard}, changedFacet ${decide}, track ${emit}, startTransition ${push}`);
  if ((nav.match(/\btrack\(/g) ?? []).length !== 1) p.push('track( is not inside navigate() exactly once');
  for (const [name, text] of others) if (/\btrack\(/.test(text)) p.push(`${name} calls track(`);
  return p;
}

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW_ISO)); });
afterAll(() => { vi.useRealTimers(); });

describe('MP-36 on-state golden (recorded from the unmodified FilterBar)', () => {
  it.skipIf(!process.env.MP36_RECORD)('records the on-state golden from the unmodified FilterBar (MP36_RECORD, never overwrites)', () => {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    const base = git('merge-base', 'origin/main', 'HEAD');
    expect(git('diff', '--name-only', base, 'HEAD', '--', BAR), 'FilterBar.tsx is unmodified on the branch').toBe('');
    expect(git('status', '--porcelain', '--', BAR), 'FilterBar.tsx has no working-tree edits').toBe('');
    expect(existsSync(GOLDEN), 'the golden exists: never overwritten').toBe(false);
    mkdirSync(dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, render({ facetsEnabled: true }));
  });
});

describe('MP-36 storefront facets (AC1–AC6, AC5c)', () => {
  it('facets hidden: dates and four inline sort pills, no make, type, band or Filters & sort control', () => {
    // Planted: the on-state bar must fail the hidden checker (make inputs, the pill, the sheet).
    expect(hiddenProblems(render({ facetsEnabled: true }))).not.toEqual([]);
    // Planted (fix round N4): a hidden class on the Sort row ITSELF, not only on an ancestor, must fail too.
    const hiddenSort = render({ facetsEnabled: false }).replace(SORT_OPEN, SORT_OPEN.replace('class="', 'class="hidden '));
    expect(hiddenSort).not.toBe(render({ facetsEnabled: false }));
    expect(hiddenProblems(hiddenSort)).not.toEqual([]);
    expect(hiddenProblems(render({ facetsEnabled: false })), 'facetsEnabled false').toEqual([]);
    expect(hiddenProblems(render()), 'prop omitted').toEqual([]);
  });

  it('facets on: the bar is byte-identical to the golden recorded from the unmodified component', () => {
    expect(existsSync(GOLDEN), 'record the golden first: MP36_RECORD=1 npx vitest run tests/restraint/restraint.facets.test.tsx').toBe(true);
    const golden = readFileSync(GOLDEN, 'utf8');
    const root = parseHtml(golden);
    const problems: string[] = [];
    for (const [name, want] of [['make', 15], ['band', 5], ['type', 1], ['sort', 4]] as const) if (count(root, 'name', name) !== want) problems.push(`golden: ${count(root, 'name', name)} name="${name}" inputs, expected ${want}`);
    if (!byAttr(root, 'aria-controls', 'sf-more-filters').length) problems.push('golden: no Filters & sort pill');
    if (!byAttr(root, 'id', 'sf-more-filters').length) problems.push('golden: no sheet wrapper');
    const band = byAttr(root, 'aria-labelledby', 'sf-band-label')[0];
    if (!band || !elements(band).some((e) => e.tag === 'noscript')) problems.push('golden: the noscript Apply is not inside the Daily-rate row');
    if (golden.includes('\n')) problems.push('golden: not a single line');
    expect(problems).toEqual([]);
    const now = render({ facetsEnabled: true });
    let i = 0;
    while (i < now.length && i < golden.length && now[i] === golden[i]) i++;
    const at = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 60), i + 60));
    expect(now === golden ? '' : `differs at offset ${i} (got ${now.length} bytes, golden ${golden.length}): got ${at(now)} golden ${at(golden)}`).toBe('');
  });

  it('facets hidden with a make or band in the URL: the Clear control still escapes the state', () => {
    // Planted: nothing active = no Clear link; the on-state puts it inside the hidden sheet next to the make inputs.
    expect(clearOf(render()).problems).toEqual([`0 links to ${ACTION}`]);
    expect(clearOf(render({ facetsEnabled: true, query: { makes: ['Lamborghini'] } })).problems).not.toEqual([]);
    const cases: [string, Partial<MarketplaceQuery>, string][] = [
      ['make', { makes: ['Lamborghini'] }, 'Clear filter'],
      ['band', UNDER_500, 'Clear filter'],
      ['make + band', { makes: ['Lamborghini'], ...UNDER_500 }, 'Clear filters'],
      ['dates', { start: '2026-11-10', end: '2026-11-12' }, 'Clear dates'],
    ];
    const problems: string[] = [];
    for (const [label, query, want] of cases) {
      const got = clearOf(render({ facetsEnabled: false, query }));
      problems.push(...got.problems.map((x) => `${label}: ${x}`));
      if (got.text !== want) problems.push(`${label}: Clear reads "${got.text}", expected "${want}"`);
    }
    expect(problems).toEqual([]);
  });

  it('facets hidden with a make in the URL: a sort change keeps the make', () => {
    // Planted: with nothing in the URL a sort change pushes the sort alone (no phantom facet).
    expect(formSearch(render({ facetsEnabled: false }), { sort: 'price_asc' })).toBe('sort=price_asc');
    const cases: [string, Partial<MarketplaceQuery>, string[]][] = [
      ['make', { makes: ['Lamborghini'] }, ['make=Lamborghini']],
      ['two makes', { makes: ['Lamborghini', 'Ferrari'] }, ['make=Lamborghini', 'make=Ferrari']],
      ['type', { types: ['supercar'] }, ['type=supercar']],
      ['band', UNDER_500, ['band=under-500']],
      ['min', { minDailyRateCents: 60_000 }, ['min=600']],
      ['max', { maxDailyRateCents: 40_000 }, ['max=400']],
      ['min + max', { minDailyRateCents: 60_000, maxDailyRateCents: 90_000 }, ['min=600', 'max=900']],
      ['make + band', { makes: ['Lamborghini'], ...UNDER_500 }, ['make=Lamborghini', 'band=under-500']],
    ];
    const problems: string[] = [];
    for (const [label, query, want] of cases) {
      const html = render({ facetsEnabled: false, query });
      const root = parseHtml(html);
      // Carried as hidden inputs, never as visible controls.
      for (const name of ['make', 'type', 'band', 'min', 'max']) if (count(root, 'name', name)) problems.push(`${label}: a visible ${name} control`);
      const sorted = formSearch(html, { sort: 'price_asc' }).split('&');
      const dated = formSearch(html, { start: '2026-11-10', end: '2026-11-12' }).split('&');
      for (const pair of want) {
        if (!sorted.includes(pair)) problems.push(`${label}: a sort change lost ${pair} (${sorted.join('&')})`);
        if (!dated.includes(pair)) problems.push(`${label}: a date pick lost ${pair} (${dated.join('&')})`);
      }
      if (!sorted.includes('sort=price_asc')) problems.push(`${label}: the new sort is missing`);
      // A submit with nothing changed names no facet: the carried inputs equal the query.
      const facet = changedFacet({ ...BASE_QUERY, ...query }, new URLSearchParams(formSearch(html)));
      if (facet !== null) problems.push(`${label}: an unchanged submit names ${facet}`);
    }
    expect(problems).toEqual([]);
  });

  it('facets hidden with min or max in the URL: the Clear control still escapes the state', () => {
    // Planted: the on-state offers no Clear for a bare bound (today's bar, unchanged); the hidden state must.
    expect(clearOf(render({ facetsEnabled: true, query: { minDailyRateCents: 60_000 } })).problems).toEqual([`0 links to ${ACTION}`]);
    const cases: [string, Partial<MarketplaceQuery>, string, string[]][] = [
      ['min', { minDailyRateCents: 60_000 }, 'Clear filter', ['min=600']],
      ['max', { maxDailyRateCents: 40_000 }, 'Clear filter', ['max=400']],
      ['min + max', { minDailyRateCents: 60_000, maxDailyRateCents: 90_000 }, 'Clear filter', ['min=600', 'max=900']],
      ['make + min', { makes: ['Lamborghini'], minDailyRateCents: 60_000 }, 'Clear filters', ['make=Lamborghini', 'min=600']],
      ['dates + min', { start: '2026-11-10', end: '2026-11-12', minDailyRateCents: 60_000 }, 'Clear filters', ['min=600']],
    ];
    const problems: string[] = [];
    for (const [label, query, want, carried] of cases) {
      const html = render({ facetsEnabled: false, query });
      const got = clearOf(html);
      problems.push(...got.problems.map((x) => `${label}: ${x}`));
      if (got.text !== want) problems.push(`${label}: Clear reads "${got.text}", expected "${want}"`);
      const same = formSearch(html).split('&');
      for (const pair of carried) if (!same.includes(pair)) problems.push(`${label}: the bound is not carried (${same.join('&')})`);
    }
    expect(problems).toEqual([]);
  });

  it('the storefront zero state still offers Show all M', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { totalInCatalog: 52, ownerName: 'Exotiq', clearHref: ACTION, alertTeamSlug: 'exotiq', headingLevel: 'h3' }));
    const root = parseHtml(html);
    const heading = elements(root).find((e) => e.tag === 'h3');
    const link = elements(root).find((e) => e.tag === 'a' && e.attrs.href === ACTION);
    expect(heading ? norm(textOf(heading)) : '(no h3)').toBe('No cars match those filters.');
    expect(link ? norm(textOf(link)) : '(no link)').toBe('Show all 52');
    expect(elements(root).filter((e) => e.tag === 'h2')).toHaveLength(0);
  });

  it('facet_applied is wired once on the navigation path and never carries a value', () => {
    const src = stripComments(read(BAR));
    const dir = join(ROOT, 'components/browse');
    const others: [string, string][] = readdirSync(dir).filter((n) => n !== 'FilterBar.tsx' && /\.tsx?$/.test(n)).map((n) => [n, stripComments(readFileSync(join(dir, n), 'utf8'))]);
    // Planted: a value in the call, a second call site and a sibling file calling track are each caught.
    const good = src.includes("track('facet_applied', { facet })") ? src : '';
    if (good) {
      expect(wiringProblems(good.replace("track('facet_applied', { facet })", "track('facet_applied', { facet, value: 'x' })"), others)).not.toEqual([]);
      expect(wiringProblems(`${good}\ntrack('x', {});`, others)).not.toEqual([]);
      expect(wiringProblems(good, [...others, ['planted.tsx', "track('x', {})"]])).not.toEqual([]);
    }
    expect(wiringProblems(src, others)).toEqual([]);
  });
});
