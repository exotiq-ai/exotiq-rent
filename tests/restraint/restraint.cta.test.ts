// MP-16 AC10-AC11: one gold CTA recipe with hover and press states (D7), and one gold-filled
// button per surface state (D3). Hover/press are proven by the recipe text and by compiling it
// with the real Tailwind config (the repo has no DOM harness); the S15 screenshots show it.
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import * as tokens from '../../components/browse/tokens';
import { compileWith } from '../design/lib/scan.mjs';
import { classOf, goldCount, missing, openTags, prepare, read, renterFiles, sliceFunction } from './restraintScan';

const recipes = tokens as unknown as Record<string, string | undefined>;
const src = (rel: string): string => prepare(rel, read(rel));

const CHROME = 'components/drive-exotiq/BookingChrome.tsx';
const VEP = 'components/drive-exotiq/VehicleEntryPage.tsx';
const PAYCARD = 'components/drive-exotiq/PaymentCard.tsx';
const IDV = 'components/drive-exotiq/IdentityVerificationCard.tsx';
const CANCEL = 'components/drive-exotiq/CancelBookingCard.tsx';
const CONF = 'components/drive-exotiq/ConfirmationScreen.tsx';
const ACTIONS = 'components/drive-exotiq/ConfirmationActions.tsx';
const EMPTY = 'components/browse/EmptyState.tsx';
const FILTERBAR = 'components/browse/FilterBar.tsx';
const FILTERFORM = 'components/browse/FilterForm.tsx';
const SAVEDLIST = 'components/renters/SavedList.tsx';
const EMAIL = 'components/renters/EmailCaptureForm.tsx';
const NOTFOUND = 'app/not-found.tsx';
const BNOTFOUND = 'app/booking/[bookingId]/not-found.tsx';
const CONFIRMED = 'app/renters/confirmed/page.tsx';
const CONFIRM = 'app/renters/confirm/page.tsx';
const UNSUB = 'app/renters/unsubscribe/page.tsx';
const SHARE = 'app/share/[operatorSlug]/[vehicleSlug]/page.tsx';
const VERIFY = 'app/verify/page.tsx';

/** A site: file, the JSX tag, and a substring that picks the one opening tag. */
type Site = [label: string, rel: string, tag: string, anchor: string];

/**
 * The CTA list (spec): the 15 gold-fill sites, all on ctaClassName. PrimaryButton is checked by
 * its slice; the two VEP Book links (desktop aside, phone bar) share one anchor and count as 2.
 */
const CTA_SITES: Site[] = [
  ['VEP Book links (desktop aside + phone bar)', VEP, 'Link', 'bookHref'],
  ['PaymentCard Complete payment', PAYCARD, 'button', 'onClick={pay}'],
  ['Identity Verify identity', IDV, 'button', 'disabled={status'],
  ['Identity Continue to secure verification', IDV, 'a', 'href={hostedUrl}'],
  ['CancelBookingCard Keep booking', CANCEL, 'button', 'setConfirming(false)'],
  ['EmptyState Show all / Clear filters', EMPTY, 'Link', 'href={clearHref}'],
  ['SavedList Browse the fleet', SAVEDLIST, 'Link', 'href="/browse"'],
  ['not-found home', NOTFOUND, 'Link', 'href={home.href}'],
  ['booking not-found home', BNOTFOUND, 'Link', 'NEXT_PUBLIC_DEFAULT_TEAM_SLUG'],
  ['/renters/confirmed Browse the fleet', CONFIRMED, 'Link', 'href="/browse"'],
  ['/renters/confirm submit', CONFIRM, 'button', 'type="submit"'],
  ['/share See this car', SHARE, 'Link', 'params.vehicleSlug'],
  ['EmailCaptureForm submit', EMAIL, 'button', 'type="submit"'],
];

/** Secondary actions on ctaOutlineClassName (D3). */
const OUTLINE_SITES: Site[] = [
  ['ConfirmationActions Share your Exotiq', ACTIONS, 'button', 'onClick={share}'],
  ['ConfirmationActions Add to calendar', ACTIONS, 'button', 'onClick={addToCalendar}'],
  ['EmptyState Try again', EMPTY, 'Link', 'href="/browse"'],
  ['/renters/unsubscribe Unsubscribe', UNSUB, 'button', 'type="submit"'],
  ['FilterBar noscript Apply', FILTERBAR, 'button', 'type="submit"'],
  ['FilterForm Show results', FILTERFORM, 'button', 'type="submit"'],
];

/** Class expressions of every opening tag at a site (one site may match twice: the two VEP Book links). */
const siteClasses = ([, rel, tag, anchor]: Site): string[] => openTags(src(rel), tag).filter((t) => t.includes(anchor)).map(classOf);

/** Findings for a gold CTA recipe string (AC10). */
export function ctaRecipeProblems(recipe: string): string[] {
  const t = recipe.split(/\s+/).filter(Boolean);
  const problems: string[] = [];
  const has = (u: string) => t.includes(u);
  for (const u of ['bg-gold', 'text-goldInk', 'transition', 'motion-reduce:transition-none', 'motion-reduce:active:scale-100']) if (!has(u)) problems.push(`missing ${u}`);
  const num = (u: string | undefined, re: RegExp, scale: number) => {
    const m = u ? re.exec(u) : null;
    return m ? Number(m[1] ?? m[2]) / (m[1] !== undefined ? scale : 1) : NaN;
  };
  const hover = t.find((u) => /^hover:brightness-/.test(u));
  const lighten = num(hover, /^hover:brightness-(?:(\d+)|\[([\d.]+)\])$/, 100);
  if (!(lighten >= 1.04 && lighten <= 1.12)) problems.push(`hover lighten ${hover ?? 'missing'} (want a brightness between 1.04 and 1.12)`);
  const press = t.find((u) => /^active:scale-/.test(u));
  const compress = num(press, /^active:scale-(?:(\d+)|\[([\d.]+)\])$/, 100);
  if (!(compress >= 0.97 && compress <= 0.99)) problems.push(`active compress ${press ?? 'missing'} (want a scale between 0.97 and 0.99)`);
  const darken = num(t.find((u) => /^active:brightness-/.test(u)), /^active:brightness-(?:(\d+)|\[([\d.]+)\])$/, 100);
  if (!(darken < 1 && darken >= 0.9)) problems.push('active darken missing (want a brightness between 0.90 and 1)');
  for (const state of ['disabled', 'aria-disabled']) {
    for (const u of [`${state}:hover:brightness-100`, `${state}:active:scale-100`, `${state}:active:brightness-100`]) if (!has(u)) problems.push(`missing ${u} (hover and press inert while ${state})`);
  }
  if (t.some((u) => u.startsWith('enabled:'))) problems.push('uses enabled:, which never matches an anchor');
  return problems;
}

describe('MP-16 one CTA recipe, one primary per state (AC10-AC11)', () => {
  it('every gold CTA uses the shared recipe with hover and active states', async () => {
    const problems: string[] = [];
    const cta = recipes.ctaClassName ?? '';
    problems.push(...ctaRecipeProblems(cta).map((p) => `ctaClassName: ${p}`));

    // Compiled with the real config: hover only where hover exists; the neutralizers outrank
    // hover/press by specificity; the reduced-motion override lands after the press scale.
    expect(config.future).toMatchObject({ hoverOnlyWhenSupported: true });
    if (cta) {
      const { rules } = await compileWith(config, cta.split(/\s+/));
      const find = (prefix: string, ...parts: string[]) => rules.findIndex((r) => r.selector.startsWith(prefix) && parts.every((p) => r.selector.includes(p)));
      const parentParams = (i: number): string => (i >= 0 && rules[i].rule.parent?.type === 'atrule' ? String(rules[i].rule.parent.params) : '');
      const hover = find('.hover\\:brightness-', ':hover');
      if (hover < 0 || !/\(hover: hover\)/.test(parentParams(hover))) problems.push('compiled: the hover lighten is not under @media (hover: hover)');
      for (const state of ['disabled', 'aria-disabled']) {
        const guard = state === 'disabled' ? ':disabled' : '[aria-disabled="true"]';
        if (find(`.${state}\\:hover\\:brightness-100`, ':hover', guard) < 0) problems.push(`compiled: no ${state} hover neutralizer`);
        if (find(`.${state}\\:active\\:scale-100`, ':active', guard) < 0) problems.push(`compiled: no ${state} press neutralizer`);
      }
      const press = find('.active\\:scale-', ':active');
      const reduced = find('.motion-reduce\\:active\\:scale-100', ':active');
      if (press < 0 || reduced < press || !/prefers-reduced-motion/.test(parentParams(reduced))) problems.push(`compiled: the reduced-motion override (rule ${reduced}) does not follow the press scale (rule ${press})`);
    }

    // PrimaryButton: the recipe, no inline colour, its disabled affordances kept.
    const primary = sliceFunction(src(CHROME), 'PrimaryButton');
    problems.push(...missing('PrimaryButton', primary, '${ctaClassName}', 'type="button"', 'disabled={disabled}', 'disabled:opacity-45', 'disabled:cursor-not-allowed'));
    if (/style=|backgroundColor/.test(primary)) problems.push('PrimaryButton: inline style colour left');

    // The other 14 sites: the recipe, no private gold fill or state utilities.
    for (const site of CTA_SITES) {
      const classes = siteClasses(site);
      const want = site[1] === VEP ? 2 : 1;
      if (classes.length !== want) problems.push(`${site[0]}: ${classes.length} element(s) found, expected ${want}`);
      for (const c of classes) {
        if (!c.includes('ctaClassName')) problems.push(`${site[0]}: not on ctaClassName ("${c}")`);
        if (goldCount(c) || /brightness|active:scale|shadow-/.test(c)) problems.push(`${site[0]}: private recipe left ("${c}")`);
      }
    }

    // bg-gold lives in tokens.ts; outside it only the calendar's chosen disc and the Protect switch ON.
    const fills: Record<string, number> = {};
    for (const rel of renterFiles()) {
      if (rel === 'components/browse/tokens.ts') continue;
      const n = (src(rel).match(/\bbg-gold(?![A-Za-z0-9/-])/g) ?? []).length;
      if (n) fills[rel] = n;
    }
    const keep: Record<string, number> = { 'components/drive-exotiq/flow/DatesStep.tsx': 1, 'components/drive-exotiq/flow/ReviewStep.tsx': 1 };
    for (const [rel, n] of Object.entries(fills)) if (keep[rel] !== n) problems.push(`${rel}: ${n} private gold fill(s)`);
    for (const [rel, n] of Object.entries(keep)) if (fills[rel] !== n) problems.push(`${rel}: the kept gold fill is gone (${fills[rel] ?? 0}/${n})`);

    // Planted: each weakened recipe is caught.
    const good = 'bg-gold text-goldInk transition hover:brightness-110 active:scale-[0.98] active:brightness-95 disabled:hover:brightness-100 disabled:active:scale-100 disabled:active:brightness-100 aria-disabled:hover:brightness-100 aria-disabled:active:scale-100 aria-disabled:active:brightness-100 motion-reduce:transition-none motion-reduce:active:scale-100';
    expect(ctaRecipeProblems(good)).toEqual([]);
    expect(ctaRecipeProblems(good.replace('hover:brightness-110', ''))).toHaveLength(1);
    expect(ctaRecipeProblems(good.replace('hover:brightness-110', 'hover:brightness-150'))).toHaveLength(1);
    expect(ctaRecipeProblems(good.replace('active:scale-[0.98]', 'active:scale-90'))).toHaveLength(1);
    expect(ctaRecipeProblems(good.replace(/motion-reduce:\S+/g, ''))).toHaveLength(2);
    expect(ctaRecipeProblems(good.replace(/disabled:hover:brightness-100/g, ''))).toHaveLength(2);
    expect(ctaRecipeProblems(`${good} enabled:hover:brightness-110`)).toHaveLength(1);
    expect(/style=|backgroundColor/.test('<button style={{ backgroundColor: tone.gold }}>')).toBe(true);

    expect(problems).toEqual([]);
  });

  it('secondary actions are outline and identity yields to payment', () => {
    const problems: string[] = [];
    const outline = recipes.ctaOutlineClassName ?? '';
    for (const u of ['border', 'border-line2', 'text-ink', 'transition', 'hover:border-faint', 'hover:bg-surface2', 'active:scale-[0.98]', 'motion-reduce:transition-none', 'motion-reduce:active:scale-100', 'disabled:active:scale-100', 'aria-disabled:active:scale-100']) {
      if (!outline.split(/\s+/).includes(u)) problems.push(`ctaOutlineClassName: missing ${u}`);
    }
    if (goldCount(outline)) problems.push('ctaOutlineClassName: gold');

    for (const site of OUTLINE_SITES) {
      const classes = siteClasses(site);
      if (classes.length !== 1) problems.push(`${site[0]}: ${classes.length} element(s) found, expected 1`);
      for (const c of classes) {
        if (!c.includes('ctaOutlineClassName') || c.includes('ctaClassName')) problems.push(`${site[0]}: not on ctaOutlineClassName alone ("${c}")`);
        if (goldCount(c)) problems.push(`${site[0]}: gold ("${c}")`);
      }
    }
    // The compact alert form is secondary; the full form is the one gold submit.
    const submit = siteClasses(['EmailCaptureForm submit', EMAIL, 'button', 'type="submit"']).join(' ');
    if (!/compact \? ctaOutlineClassName : ctaClassName/.test(submit)) problems.push(`EmailCaptureForm submit: compact must take the outline ("${submit}")`);

    // Identity yields to payment: a primary prop (default true) picks the recipe for both buttons.
    const idv = src(IDV);
    if (!/primary = true/.test(idv) || !/primary\?: boolean/.test(idv)) problems.push('IdentityVerificationCard: no primary prop defaulting to true');
    for (const label of ['Identity Verify identity', 'Identity Continue to secure verification']) {
      const site = CTA_SITES.find((s) => s[0] === label)!;
      for (const c of siteClasses(site)) if (!/primary \? ctaClassName : ctaOutlineClassName/.test(c)) problems.push(`${label}: does not pick by primary ("${c}")`);
    }
    const call = openTags(src(CONF), 'IdentityVerificationCard');
    if (call.length !== 1 || !call[0].includes("primary={live?.status !== 'pending_payment'}")) problems.push('ConfirmationScreen: does not pass primary from the booking status');
    const verifyCall = openTags(src(VERIFY), 'IdentityVerificationCard');
    if (verifyCall.length !== 1 || verifyCall[0].includes('primary=')) problems.push('/verify: its IdentityVerificationCard call changed (it keeps the default)');

    expect(problems).toEqual([]);
  });
});
