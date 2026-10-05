// MP-16 AC6-AC9: de-boxing and elevation. The box census (spec De-box budget) and the shadow
// allowlist (spec Elevation budget) are source scans; "one elevated element per surface" is a
// class-string pairing (lg:hidden bar vs hidden lg:block card), a heuristic whose backstop is
// the S03/S04/S07 screenshots at both widths (AC14).
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import * as tokens from '../../components/browse/tokens';
import { compileWith } from '../design/lib/scan.mjs';
import {
  STAT_TILE,
  between,
  boxesByFile,
  goldCount,
  isBox,
  literals,
  missing,
  openTags,
  classOf,
  prepare,
  present,
  read,
  renterFiles,
  sliceFunction,
  statTileCount,
  wrapperOf,
} from './restraintScan';

const TOKENS = 'components/browse/tokens.ts';
const CSS = 'app/globals.css';
const SF = 'app/[operatorSlug]/page.tsx';
const BROWSE = 'app/browse/page.tsx';
const SHARE = 'app/share/[operatorSlug]/[vehicleSlug]/page.tsx';
const PREVIEW = 'app/preview/page.tsx';
const VERIFY = 'app/verify/page.tsx';
const CHROME = 'components/drive-exotiq/BookingChrome.tsx';
const VEP = 'components/drive-exotiq/VehicleEntryPage.tsx';
const FLOW = 'components/drive-exotiq/BookingFlow.tsx';
const CONF = 'components/drive-exotiq/ConfirmationScreen.tsx';
const IDV = 'components/drive-exotiq/IdentityVerificationCard.tsx';
const PAYCARD = 'components/drive-exotiq/PaymentCard.tsx';
const CANCEL = 'components/drive-exotiq/CancelBookingCard.tsx';
const SHARED = 'components/drive-exotiq/flow/shared.tsx';
const DATES = 'components/drive-exotiq/flow/DatesStep.tsx';
const DRIVER = 'components/drive-exotiq/flow/DriverStep.tsx';
const REVIEW = 'components/drive-exotiq/flow/ReviewStep.tsx';
const PAY = 'components/drive-exotiq/flow/PayStep.tsx';
const CARD = 'components/browse/ListingCard.tsx';
const FILTERBAR = 'components/browse/FilterBar.tsx';
const LEGAL = 'components/browse/LegalPage.tsx';
const SAVEBTN = 'components/renters/SaveButton.tsx';
const SAVEDLIST = 'components/renters/SavedList.tsx';

const src = (rel: string): string => prepare(rel, read(rel));
const lits = (rel: string, needle: string): string[] => literals(src(rel)).filter((s) => s.includes(needle));
const recipes = tokens as unknown as Record<string, string>;

/** De-box budget (spec): per-file ceilings; files not listed must hold no box. Repo total 28. */
export const BOX_BUDGET: Record<string, number> = {
  [SF]: 2,
  [VEP]: 4,
  [REVIEW]: 0,
  [PAY]: 0,
  [SHARED]: 1,
  [CONF]: 2,
  [IDV]: 2,
  [PAYCARD]: 2,
  [DRIVER]: 1,
  [DATES]: 1,
  [FILTERBAR]: 1,
  [FLOW]: 1,
  [CANCEL]: 1,
  [BROWSE]: 3,
  [SAVEDLIST]: 2,
  [LEGAL]: 1,
  [CARD]: 1,
  [SAVEBTN]: 1,
  [PREVIEW]: 1,
  [VERIFY]: 1,
};
export const BOX_TOTAL_CEILING = 28;

export function boxBudgetProblems(byFile: Record<string, number>): string[] {
  const problems: string[] = [];
  for (const [file, n] of Object.entries(byFile)) {
    const ceiling = BOX_BUDGET[file] ?? 0;
    if (n > ceiling) problems.push(`${file}: ${n} box(es), ceiling ${ceiling}`);
  }
  const total = Object.values(byFile).reduce((a, b) => a + b, 0);
  if (total > BOX_TOTAL_CEILING) problems.push(`total: ${total} boxes, ceiling ${BOX_TOTAL_CEILING}`);
  return problems;
}

/**
 * Elevation budget (spec): every resting or hover shadow string allowed in the renter tree,
 * by file. The CookieControls popover is in the frozen analytics zone, outside this scan.
 */
export const SHADOW_ALLOWLIST = [
  `${TOKENS} hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,.75)]`, // cardShellClassName, hover only
  `${TOKENS} after:shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]`, // photoFrameClassName inset hairline
  `${TOKENS} shadow-[0_-24px_42px_rgba(13,15,20,.96)]`, // stickyBarClassName
  `${TOKENS} shadow-[0_24px_60px_-20px_rgba(0,0,0,.8)]`, // elevatedClassName
  `${REVIEW} shadow-[0_1px_2px_rgba(0,0,0,.4)]`, // the Protect switch thumb
  `${CSS} checked:shadow-[inset_0_0_0_3px_var(--tone-field)]`, // .control-radio checked state ring
];

/** Every arbitrary shadow utility and every inline boxShadow in the prepared renter tree, as "file token". */
export function shadowSites(): string[] {
  const out: string[] = [];
  for (const rel of renterFiles()) {
    const text = src(rel);
    for (const t of text.split(/[\s'"`{};]+/)) if (t.includes('shadow-[')) out.push(`${rel} ${t}`);
    for (const _ of Array.from(text.matchAll(/\bboxShadow\b/g))) out.push(`${rel} boxShadow`);
  }
  return out;
}

describe('MP-16 de-box and elevation (AC6-AC9)', () => {
  it('storefront sidebar sections are hairlines not boxes', () => {
    const problems: string[] = [];
    const page = src(SF);
    for (const name of ['AboutCard', 'PolicyCard', 'WhyCard']) {
      const body = sliceFunction(page, name);
      const boxes = literals(body).filter(isBox);
      if (boxes.length) problems.push(`${name}: box literal(s) ${boxes.map((b) => `"${b}"`).join(', ')}`);
      problems.push(...present(name, body, 'bg-surface2'), ...missing(name, body, 'border-t border-line'));
      if (goldCount(body)) problems.push(`${name}: gold`);
    }
    const about = sliceFunction(page, 'AboutCard');
    problems.push(...missing('AboutCard', about, 'divide-x divide-line'));
    const figures = literals(about).filter((s) => s.includes('font-medium leading-none tabular-nums'));
    if (figures.length !== 3 || figures.some((s) => !s.includes('text-ink'))) problems.push(`AboutCard: ink figures ${figures.filter((s) => s.includes('text-ink')).length}/3`);
    if (literals(about).filter((s) => s.includes('mt-1.5 text-faint')).length !== 3) problems.push('AboutCard: three text-faint captions expected');
    for (const name of ['PolicyCard', 'WhyCard']) {
      const heading = literals(sliceFunction(page, name)).filter((s) => s.includes('mb-3 flex items-center gap-2'));
      if (heading.length !== 1 || !heading[0].includes('text-ink')) problems.push(`${name}: heading is not text-ink`);
      const icon = openTags(sliceFunction(page, name), name === 'PolicyCard' ? 'FileCheck2' : 'ShieldCheck').map(classOf);
      if (icon.length !== 1 || !icon[0].includes('text-muted')) problems.push(`${name}: heading icon is not text-muted`);
    }
    // Both render sites still exist: the phone column (lg:hidden) and the desktop aside.
    for (const name of ['AboutCard', 'PolicyCard', 'WhyCard']) {
      const sites = openTags(page, name);
      if (sites.length !== 2) problems.push(`<${name}>: ${sites.length} render sites, expected 2`);
      if (sites.filter((t) => t.includes('lg:hidden')).length !== 1) problems.push(`<${name}>: the phone instance lost lg:hidden`);
    }
    // Both Call links (the sidebar CallLink and the empty-fleet one) sit on line2.
    const calls = lits(SF, 'bg-surface px-5');
    if (calls.length !== 2) problems.push(`Call link literal count ${calls.length}, expected 2`);
    for (const s of calls) problems.push(...missing('Call link', s, 'border-line2'));
    const n = boxesByFile()[SF] ?? 0;
    if (n > 2) problems.push(`${SF}: ${n} boxes, ceiling 2`);
    expect(problems).toEqual([]);
  });

  it('vehicle page booking preview tiles are flattened', () => {
    const problems: string[] = [];
    const tiles = statTileCount();
    if (tiles !== 0) problems.push(`${tiles} stat tile(s) (${STAT_TILE}) left in the renter tree`);
    const page = src(VEP);
    const n = boxesByFile()[VEP] ?? 0;
    if (n > 4) problems.push(`${VEP}: ${n} boxes, ceiling 4`);

    // The phone Booking preview: a hairline section, one divided three-up row, ink figures.
    const wrapper = wrapperOf(page, 'Booking preview');
    if (isBox(wrapper)) problems.push(`Booking preview wrapper is still a box: "${wrapper}"`);
    problems.push(...missing('Booking preview wrapper', wrapper, 'border-t border-line', 'lg:hidden'));
    const preview = between(page, 'Booking preview', 'Pickup');
    problems.push(...missing('Booking preview', preview, 'divide-x divide-line'), ...present('Booking preview', preview, 'bg-surface2'));
    const figures = literals(preview).filter((s) => s.includes('font-medium leading-none'));
    if (figures.length !== 3 || figures.some((s) => !s.includes('text-ink'))) problems.push(`Booking preview: ink figures ${figures.filter((s) => s.includes('text-ink')).length}/3`);
    if (!/<span className="text-faint">0\{index \+ 1\}<\/span>/.test(page)) problems.push('How it works numerals are not text-faint');

    // D10: the spec tiles, Pickup, How it works and the desktop aside keep their boxes.
    if (!lits(VEP, 'p-[14px]').some(isBox)) problems.push('spec tiles lost their box');
    if (!isBox(wrapperOf(page, '>Pickup</h2>'))) problems.push('Pickup lost its box');
    if (!isBox(wrapperOf(page, '>How it works</h2>'))) problems.push('How it works lost its box');
    if (!lits(VEP, 'rounded-2xl border border-line bg-surface p-6').some(isBox)) problems.push('the desktop aside card lost its box');
    expect(problems).toEqual([]);
  });

  it('review pay and confirmation panels are flattened within the box budget', () => {
    const problems = boxBudgetProblems(boxesByFile());

    // Each flattened body separates its sections with a hairline.
    const hair = (label: string, text: string) => (/border-[ty] border-line|divide-line/.test(text) ? [] : [`${label}: no hairline`]);
    const shared = src(SHARED);
    for (const name of ['RunningTotalCard', 'Breakdown']) {
      const body = sliceFunction(shared, name);
      problems.push(...hair(name, body));
      if (literals(body).some(isBox)) problems.push(`${name}: still boxed`);
    }
    for (const rel of [REVIEW, PAY]) problems.push(...hair(rel, src(rel)));
    // Summary grids take a top rule only: the hairline section that follows supplies the one
    // below (a border-y there drew a double rule 16px apart, seen in the S06 and S08 captures).
    const review = src(REVIEW);
    const grids: [string, string[]][] = [
      ['ReviewStep summary grid', literals(review).filter((x) => x.includes('grid grid-cols-3'))],
      ['ConfirmationScreen detail grid', literals(src(CONF)).filter((x) => x.includes('grid grid-cols-2 gap-3'))],
    ];
    for (const [label, found] of grids) {
      if (found.length !== 1) problems.push(`${label}: ${found.length} literal(s)`);
      for (const s of found) problems.push(...missing(label, s, 'border-t border-line'), ...present(label, s, 'border-y', 'border-b'));
    }
    // The verification row is the hairline section that opens just before the ID icon. Attempt 2
    // (review N6): the separate "Verification" micro-label above it is gone (it floated over the rule).
    const driver = src(DRIVER);
    const idAt = driver.indexOf('<IdCard');
    const verification = idAt < 0 ? '' : driver.slice(driver.lastIndexOf('<div', idAt), idAt);
    problems.push(...hair('DriverStep verification row', verification), ...present('DriverStep', driver, '>Verification<'));
    if (literals(verification).some(isBox)) problems.push('DriverStep verification row: still boxed');

    // No tinted icon tile is left in Driver, Pay or Confirmation.
    for (const rel of [DRIVER, PAY, CONF]) {
      problems.push(...present(rel, src(rel), 'bg-gold/10'));
      for (const s of literals(src(rel))) if (/(^|\s)h-10 w-10(\s|$)/.test(s) && /rounded-lg/.test(s)) problems.push(`${rel}: icon tile "${s}"`);
    }

    // Confirmation keeps exactly the hero card and ReturnNotice as boxes.
    const conf = src(CONF);
    const confBoxes = literals(conf).filter(isBox);
    const hero = confBoxes.filter((s) => s.includes('relative overflow-hidden rounded-2xl'));
    const notice = literals(sliceFunction(conf, 'ReturnNotice')).filter(isBox);
    if (confBoxes.length !== 2 || hero.length !== 1 || notice.length !== 1) problems.push(`ConfirmationScreen boxes: ${confBoxes.map((s) => `"${s}"`).join(', ')}`);
    for (const label of ['Charges', 'What happens next', 'Paid — your receipt', 'Operator rental total']) {
      const at = conf.indexOf(label);
      if (at < 0) problems.push(`ConfirmationScreen: ${label} not found`);
      else problems.push(...hair(`ConfirmationScreen ${label}`, conf.slice(Math.max(0, conf.lastIndexOf('<div', conf.lastIndexOf('<div', at) - 1)), at)));
    }

    // Planted: an extra panel is caught by the same census rule and budget.
    expect(isBox('mt-4 rounded-xl border border-line bg-surface p-4')).toBe(true);
    expect(isBox('mt-4 border-t border-line pt-4')).toBe(false);
    expect(boxBudgetProblems({ [REVIEW]: 1 })).toEqual([`${REVIEW}: 1 box(es), ceiling 0`]);

    expect(problems).toEqual([]);
  });

  it('one elevated element per surface and no gold shadow', async () => {
    const problems: string[] = [];
    const sites = shadowSites();
    for (const site of sites) {
      if (!SHADOW_ALLOWLIST.includes(site)) problems.push(`shadow not in the Elevation budget: ${site}`);
      if (goldCount(site)) problems.push(`gold in a shadow: ${site}`);
    }
    for (const allowed of SHADOW_ALLOWLIST) if (!sites.includes(allowed)) problems.push(`allowlisted shadow missing: ${allowed}`);

    // The two shared recipes.
    if (recipes.elevatedClassName !== 'shadow-[0_24px_60px_-20px_rgba(0,0,0,.8)]') problems.push(`elevatedClassName: ${recipes.elevatedClassName}`);
    problems.push(...missing('stickyBarClassName', recipes.stickyBarClassName ?? '', 'absolute left-0 right-0 z-10 border-t border-line bg-panel px-4 pb-4 pt-3', 'shadow-[0_-24px_42px_rgba(13,15,20,.96)]'));
    for (const rel of renterFiles()) if (rel !== TOKENS && src(rel).includes('0_-24px_42px')) problems.push(`${rel}: a private copy of the sticky-bar shadow`);

    // The flow frame: no shadow, a hairline where it stops filling the viewport.
    const frame = lits(CHROME, 'relative mx-auto flex h-dvh');
    if (frame.length !== 1) problems.push(`BookingChrome frame literal count ${frame.length}`);
    for (const s of frame) problems.push(...present('BookingChrome frame', s, 'shadow-['), ...missing('BookingChrome frame', s, 'min-[481px]:border-x', 'min-[481px]:border-line'));
    const pageLayout = lits(CHROME, 'lg:h-auto lg:max-w-[1200px]');
    if (pageLayout.length !== 1 || !pageLayout[0].includes('lg:border-0')) problems.push("BookingChrome 'page' layout must cancel the hairline at lg");

    // The vehicle page Book links carry no shadow.
    const book = openTags(src(VEP), 'Link').filter((t) => t.includes('bookHref'));
    if (book.length !== 2) problems.push(`VEP Book links: ${book.length}`);
    for (const t of book) if (classOf(t).includes('shadow-')) problems.push(`VEP Book link shadow: ${classOf(t)}`);

    // The three sticky bars share the recipe and keep their CookieControls child.
    const sticky = sliceFunction(src(SHARED), 'Sticky');
    problems.push(...missing('Sticky', sticky, '${stickyBarClassName} bottom-4 md:bottom-5', '<CookieControls />'));
    for (const [rel, child] of [[VEP, '<CookieControls viewport="mobile" />'], [SF, '<CookieControls viewport="mobile" />']] as const) {
      const bar = lits(rel, '${stickyBarClassName}');
      if (bar.length !== 1) problems.push(`${rel}: sticky bar literal count ${bar.length}`);
      for (const s of bar) problems.push(...missing(`${rel} sticky bar`, s, 'bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+8px))]', 'lg:hidden'));
      if (bar.length) problems.push(...missing(`${rel} sticky bar child`, between(src(rel), '${stickyBarClassName}', '</div>'), child));
    }

    // One elevated element per surface: VEP bar below lg, aside card from lg; storefront flat on desktop.
    const aside = lits(VEP, 'hidden lg:block');
    if (aside.length !== 1) problems.push('VEP aside is not hidden below lg');
    for (const [rel, needle] of [[VEP, 'rounded-2xl border border-line bg-surface p-6'], [BROWSE, 'absolute right-0 z-30'], [SHARE, 'relative mt-6 overflow-hidden rounded-2xl']] as const) {
      const el = lits(rel, needle);
      if (el.length !== 1 || !el[0].includes('${elevatedClassName}')) problems.push(`${rel}: the elevated element does not use elevatedClassName`);
    }
    for (const rel of [SF, FLOW, CONF]) if (src(rel).includes('${elevatedClassName}')) problems.push(`${rel}: an elevated card beside the surface's sticky bar or on a flat surface`);

    // Compiled with the real config: the 'page' frame cancels the hairline after it is drawn.
    const { css } = await compileWith(config, ['min-[481px]:border-x', 'min-[481px]:border-line', 'lg:border-0']);
    const drawn = css.indexOf('min-\\[481px\\]\\:border-x');
    const cancelled = css.indexOf('lg\\:border-0');
    if (drawn < 0 || cancelled < 0 || cancelled < drawn) problems.push(`compiled order: border-x at ${drawn}, lg:border-0 at ${cancelled}`);

    // Planted: a gold glow is caught twice (not allowlisted, gold).
    const planted = `x.tsx shadow-[0_0_24px_rgba(${[200, 166, 100].join(',')},.1)]`;
    expect(SHADOW_ALLOWLIST.includes(planted)).toBe(false);
    expect(goldCount(planted)).toBe(1);

    expect(problems).toEqual([]);
  });
});
