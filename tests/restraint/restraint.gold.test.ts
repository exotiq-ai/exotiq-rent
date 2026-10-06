// MP-16 AC1-AC5: gold is punctuation. Source scans over the renter tree (node env, no DOM):
// the census and its budget (AC1), neutral roles (AC2), hover and press (AC3), selected and
// status states (AC4), price and total figures (AC5). Every clause collects its findings into
// one `problems` list, so a red run names each offending site. Fixtures are built from parts
// or from `tone`, never as a literal tone hex.
import { describe, expect, it } from 'vitest';
import { cardShellClassName, datePillClassName, priceClassName, tone } from '../../components/browse/tokens';
import {
  STAT_TILE,
  around,
  between,
  classOf,
  contrast,
  goldByFile,
  goldCount,
  hoverGoldTokens,
  literals,
  missing,
  mix,
  openTags,
  prepare,
  present,
  read,
  renterFiles,
  sliceFunction,
  statTileCount,
} from './restraintScan';

const TOKENS = 'components/browse/tokens.ts';
const CSS = 'app/globals.css';
const SF = 'app/[operatorSlug]/page.tsx';
const BROWSE = 'app/browse/page.tsx';
const SHARE = 'app/share/[operatorSlug]/[vehicleSlug]/page.tsx';
const NOTFOUND = 'app/not-found.tsx';
const BNOTFOUND = 'app/booking/[bookingId]/not-found.tsx';
const CHROME = 'components/drive-exotiq/BookingChrome.tsx';
const VEP = 'components/drive-exotiq/VehicleEntryPage.tsx';
const GALLERY = 'components/drive-exotiq/VehicleGallery.tsx';
const FLOW = 'components/drive-exotiq/BookingFlow.tsx';
const CONF = 'components/drive-exotiq/ConfirmationScreen.tsx';
const ACTIONS = 'components/drive-exotiq/ConfirmationActions.tsx';
const IDV = 'components/drive-exotiq/IdentityVerificationCard.tsx';
const PAYCARD = 'components/drive-exotiq/PaymentCard.tsx';
const SHARED = 'components/drive-exotiq/flow/shared.tsx';
const DATES = 'components/drive-exotiq/flow/DatesStep.tsx';
const DRIVER = 'components/drive-exotiq/flow/DriverStep.tsx';
const REVIEW = 'components/drive-exotiq/flow/ReviewStep.tsx';
const FEE = 'components/drive-exotiq/FeeCard.tsx';
const FEEGROUPS = 'components/drive-exotiq/feeGroups.ts';
const CARD = 'components/browse/ListingCard.tsx';
const FILTERBAR = 'components/browse/FilterBar.tsx';
const FILTERFORM = 'components/browse/FilterForm.tsx';
const EMPTY = 'components/browse/EmptyState.tsx';
const SAVEBTN = 'components/renters/SaveButton.tsx';
const SAVEDLINK = 'components/renters/SavedLink.tsx';
const SAVEDLIST = 'components/renters/SavedList.tsx';
const EMAIL = 'components/renters/EmailCaptureForm.tsx';

/** Prepared source: comments out (and the CSS mirror fence skipped). */
const src = (rel: string): string => prepare(rel, read(rel));
/** Every literal in a file that contains `needle`. */
const lits = (rel: string, needle: string): string[] => literals(src(rel)).filter((s) => s.includes(needle));

/**
 * The Gold budget table (spec), set to the exact post-change counts. Ceilings: no file may
 * exceed its row; every renter file not listed must be zero. The two untouched files (D6) are
 * pinned exactly. The MP-15 tone-mirror fence is skipped (LD2).
 *
 * One row the spec's table omits: ConfirmationScreen keeps 1, the confirmation sheen element
 * itself (MOMENT). Its class name matches the spec's own pattern (the gold-sheen utility, the
 * same name the table counts twice in globals.css), and AC13(b) requires the element exactly
 * once. So the floor is the spec's 43 plus that one: total ceiling 44 (build finding, handoff).
 *
 * MP-26: PayStep is deleted and its one gold figure became the merged Review & Request step's
 * single total, which ReviewStep's row of 3 (switch ON fill, switch focus ring, total) already
 * counts. The ceiling comes down by that one: 43.
 */
export const GOLD_BUDGET: Record<string, number> = {
  [TOKENS]: 9,
  [CSS]: 6,
  [CONF]: 1,
  [DATES]: 7,
  [REVIEW]: 3,
  [DRIVER]: 2,
  [EMAIL]: 2,
  [SHARED]: 1,
  [PAYCARD]: 1,
  [VEP]: 1,
  [GALLERY]: 1,
  [FILTERBAR]: 1,
};
export const GOLD_UNTOUCHED: Record<string, number> = {
  'app/share/[operatorSlug]/[vehicleSlug]/opengraph-image.tsx': 4,
  'app/preview/page.tsx': 4,
};
export const GOLD_TOTAL_CEILING = 43;

/** Budget findings for a census map: unlisted files, files over their row, untouched files moved, the total. */
export function goldBudgetProblems(byFile: Record<string, number>): string[] {
  const problems: string[] = [];
  for (const [file, n] of Object.entries(byFile)) {
    if (file in GOLD_UNTOUCHED) continue;
    if (!(file in GOLD_BUDGET)) problems.push(`${file}: ${n} gold reference(s), file is not in the budget (must be 0)`);
    else if (n > GOLD_BUDGET[file]) problems.push(`${file}: ${n} gold reference(s), ceiling ${GOLD_BUDGET[file]}`);
  }
  for (const [file, n] of Object.entries(GOLD_UNTOUCHED)) {
    if ((byFile[file] ?? 0) !== n) problems.push(`${file}: ${byFile[file] ?? 0} gold reference(s), must stay exactly ${n} (untouched, D6)`);
  }
  const total = Object.values(byFile).reduce((a, b) => a + b, 0);
  if (total > GOLD_TOTAL_CEILING) problems.push(`total: ${total} gold references, ceiling ${GOLD_TOTAL_CEILING}`);
  return problems;
}

/** Icon list (AC2e): file, JSX tag, the class every classed occurrence must carry. */
const ICONS: [string, string, string][] = [
  [VEP, 'spec.icon', 'text-muted'],
  [VEP, 'CalendarDays', 'text-muted'],
  [VEP, 'MapPin', 'text-muted'],
  [VEP, 'ShieldCheck', 'text-muted'],
  [GALLERY, 'MapPin', 'text-muted'],
  [CONF, 'LockKeyhole', 'text-muted'],
  [CONF, 'Sparkles', 'text-muted'],
  [ACTIONS, 'CalendarPlus', 'text-muted'],
  [DATES, 'ChevronDown', 'text-muted'],
  [FILTERBAR, 'CalendarDays', 'text-muted'],
  [FILTERBAR, 'SlidersHorizontal', 'text-muted'],
  [FILTERFORM, 'CalendarDays', 'text-muted'],
  [FILTERFORM, 'ChevronDown', 'text-muted'],
  [BROWSE, 'SlidersHorizontal', 'text-muted'],
  [SF, 'FileCheck2', 'text-muted'],
  [SF, 'ShieldCheck', 'text-muted'],
  [REVIEW, 'LockKeyhole', 'text-muted'],
  [DRIVER, 'IdCard', 'text-muted'],
  [IDV, 'BadgeCheck', 'text-ink'],
  [IDV, 'ShieldCheck', 'text-muted'],
  [SHARED, 'CheckCircle2', 'text-verified'],
];
/** Circle wrappers (`grid h-14 w-14 …`) whose icon has no class of its own. */
const CIRCLE_FILES = [CONF, EMPTY, SAVEDLIST, NOTFOUND, BNOTFOUND, SF];

/** Findings for one icon: any classed occurrence with gold or without the expected class; none classed at all. */
export function iconProblems(label: string, text: string, tag: string, expected: string): string[] {
  const classed = openTags(text, tag).map(classOf).filter(Boolean);
  if (classed.length === 0) return [`${label} <${tag}>: no classed occurrence`];
  return classed.flatMap((c) => [
    ...(goldCount(c) ? [`${label} <${tag}>: gold in "${c}"`] : []),
    ...(c.includes(expected) ? [] : [`${label} <${tag}>: "${c}" lacks ${expected}`]),
  ]);
}

const MONEY_BASE = `export function Money({ cents, large = false }: { cents: number; large?: boolean }) {
  // Statement parity (T-7): an amount that will be charged as $1,730.66 must
  // render as $1,730.66 — rounding here meant "Total due" never matched the
  // renter's card statement. Whole dollars keep the clean display.
  const digits = cents % 100 === 0 ? 0 : 2;
  const value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
  return <span className={large ? 'text-heading font-medium tabular-nums' : 'tabular-nums'}>{value}</span>;
}`;

describe('MP-16 gold is punctuation (AC1-AC5)', () => {
  it('gold references stay within the per-file budget', () => {
    // The scanner is alive: it reads the tree, finds known references, and counts a planted one.
    expect(renterFiles().length).toBeGreaterThanOrEqual(50);
    const byFile = goldByFile();
    expect(byFile[TOKENS] ?? 0).toBeGreaterThanOrEqual(1);
    expect(byFile[DATES] ?? 0).toBeGreaterThanOrEqual(1);
    expect(goldCount('text-gold')).toBe(1);
    expect(goldCount('hover:border-gold/45')).toBe(1);
    expect(goldCount(`shadow-[0_0_0_1px_var(--tone-gold),0_0_24px_rgba(${[200, 166, 100].join(',')},.10)]`)).toBe(2);
    expect(goldCount(`border:1px solid ${tone.gold}`)).toBe(1);
    // (The spec's pattern would also count the gold-ink CSS var by its hyphen; no renter file uses it outside the fenced mirror.)
    expect(goldCount('text-goldInk bg-goldWash tone.goldInk')).toBe(0);
    expect(goldCount(prepare('x.tsx', 'a /* text-gold */ b {/* bg-gold */} c'))).toBe(0);
    expect(goldCount(prepare('x.css', `/* tone-mirror:begin */ --tone-gold: ${tone.gold}; /* tone-mirror:end */`))).toBe(0);
    // Planted budget violations are named with their counts.
    expect(goldBudgetProblems({ ...GOLD_BUDGET, ...GOLD_UNTOUCHED })).toEqual([]);
    const planted = goldBudgetProblems({ ...GOLD_BUDGET, ...GOLD_UNTOUCHED, 'components/x/Planted.tsx': 2, [TOKENS]: 10 });
    expect(planted).toContain('components/x/Planted.tsx: 2 gold reference(s), file is not in the budget (must be 0)');
    expect(planted).toContain(`${TOKENS}: 10 gold reference(s), ceiling 9`);
    expect(planted).toContain('total: 46 gold references, ceiling 43');
    // The sheen element is the one reference ConfirmationScreen keeps (AC13b), and nothing else there is gold.
    expect(goldCount(prepare(CONF, read(CONF)).replace(/\banimate-gold-sheen\b/, ''))).toBe(0);

    expect(goldBudgetProblems(byFile)).toEqual([]);
  });

  it('chips eyebrows stat figures progress and icons carry no gold', () => {
    const problems: string[] = [];

    // (a) no class string that interpolates the eyebrow or micro-label recipe also carries gold.
    for (const rel of renterFiles()) {
      for (const s of literals(src(rel))) {
        if ((s.includes('${eyebrowClassName}') || s.includes('${microLabelClassName}')) && goldCount(s)) problems.push(`(a) ${rel}: "${s}"`);
      }
    }

    // (b) the min-rental chip is ink on line2; Verified is the only coloured chip on a card.
    const chip = lits(CARD, 'absolute left-3 top-3');
    if (chip.length !== 1) problems.push(`(b) min-rental chip literal count ${chip.length}`);
    for (const s of chip) problems.push(...missing('(b) min-rental chip', s, 'border-line2', 'text-ink'), ...(goldCount(s) ? [`(b) min-rental chip: gold in "${s}"`] : []));
    const verified = lits(CARD, 'border-verified/35');
    if (verified.length !== 1 || !verified[0].includes('text-verified')) problems.push('(b) the Verified chip lost text-verified');

    // (c) stat figures are ink, never tiles: storefront About and the vehicle phone preview.
    const about = sliceFunction(src(SF), 'AboutCard');
    const aboutFigures = literals(about).filter((s) => s.includes('font-medium leading-none tabular-nums'));
    if (aboutFigures.length !== 3) problems.push(`(c) AboutCard: ${aboutFigures.length} figure literals, expected 3`);
    for (const s of aboutFigures) if (!s.includes('text-ink') || goldCount(s)) problems.push(`(c) AboutCard figure: "${s}"`);
    problems.push(...present('(c) AboutCard', about, 'bg-surface2'));
    const preview = between(src(VEP), 'Booking preview', 'Pickup');
    const previewFigures = literals(preview).filter((s) => s.includes('font-medium leading-none'));
    if (previewFigures.length !== 3) problems.push(`(c) Booking preview: ${previewFigures.length} figure literals, expected 3`);
    for (const s of previewFigures) if (!s.includes('text-ink') || goldCount(s)) problems.push(`(c) Booking preview figure: "${s}"`);
    problems.push(...present('(c) Booking preview', preview, 'bg-surface2'));
    // ...and no stat tile is left anywhere in the renter tree.
    const tiles = statTileCount();
    if (tiles !== 0) problems.push(`(c) ${tiles} stat tile(s) left (${STAT_TILE})`);

    // (d) FlowProgress (MP-17): the flow's named three-step progress is neutral: ink and line, never gold.
    const progress = sliceFunction(src(CHROME), 'FlowProgress');
    if (goldCount(progress)) problems.push('(d) FlowProgress carries gold');
    problems.push(...missing('(d) FlowProgress', progress, 'bg-ink', 'bg-line'));

    // (e) icons in the Icon list, and the circle wrappers of icons with no class of their own.
    for (const [rel, tag, expected] of ICONS) problems.push(...iconProblems(`(e) ${rel}`, src(rel), tag, expected));
    for (const rel of CIRCLE_FILES) {
      const circles = lits(rel, 'h-14 w-14');
      if (circles.length === 0) problems.push(`(e) ${rel}: no circle wrapper found`);
      for (const s of circles) if (goldCount(s) || !s.includes('text-muted')) problems.push(`(e) ${rel} circle: "${s}"`);
    }
    for (const s of lits(CONF, 'h-10 w-10 items-center justify-center rounded-full')) problems.push(...missing('(e) operator avatar', s, 'bg-surface2', 'text-ink'), ...(goldCount(s) ? ['(e) operator avatar: gold'] : []));
    const contact = lits(CONF, 'rounded-full border').filter((s) => /(^|\s)p-2(\s|$)/.test(s));
    if (contact.length !== 2) problems.push(`(e) operator contact buttons: ${contact.length}, expected 2`);
    for (const s of contact) problems.push(...missing('(e) contact button', s, 'border-line2', 'text-muted', 'hover:text-ink'), ...(goldCount(s) ? ['(e) contact button: gold'] : []));

    // Planted: a gold icon and a stat tile are caught by the same functions.
    expect(iconProblems('planted', '<Heart className="text-gold" />', 'Heart', 'text-muted')).toHaveLength(2);
    expect(literals('<div className="rounded-lg bg-surface2 p-3">x</div>').filter((s) => s.includes(STAT_TILE))).toHaveLength(1);

    expect(problems).toEqual([]);
  });

  it('hover and press states name no gold and keep the lift', () => {
    const problems: string[] = [];
    for (const rel of renterFiles()) for (const t of hoverGoldTokens(src(rel))) problems.push(`${rel}: ${t}`);

    // The card keeps its lift, its keyboard ring and one neutral hover shadow.
    problems.push(...missing('cardShellClassName', cardShellClassName, 'hover:border-line2', 'hover:-translate-y-1', 'motion-reduce:hover:translate-y-0', 'has-[a:focus-visible]:ring-gold/70'));
    const shadows = cardShellClassName.split(/\s+/).filter((t) => t.includes('shadow-['));
    if (shadows.length !== 1 || shadows[0] !== 'hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,.75)]') problems.push(`cardShellClassName shadow: ${shadows.join(' ')}`);
    problems.push(...missing('datePillClassName', datePillClassName, 'hover:border-faint'));

    // Per site: the neutral hover borders and the ink hover text.
    for (const s of lits(SAVEBTN, 'inline-flex items-center justify-center gap-2 rounded-xl border')) problems.push(...missing('SaveButton pill', s, 'hover:border-line2'));
    const iconBtn = lits(SAVEBTN, 'grid h-9 w-9 place-items-center rounded-full');
    if (iconBtn.length !== 1) problems.push(`SaveButton icon literal count ${iconBtn.length}`);
    // Attempt 2 (review N2): the spec's hover:text-ink on these two was a no-op (their text is already
    // ink), so it is gone; the border carries the icon button's hover.
    for (const s of iconBtn) problems.push(...missing('SaveButton icon', s, 'border-line2', 'hover:border-faint'), ...present('SaveButton icon', s, 'hover:text-ink'));
    for (const s of lits(SAVEDLINK, 'inline-flex items-center gap-1.5 rounded-full')) problems.push(...missing('SavedLink', s, 'hover:border-line2', 'hover:text-ink'));
    for (const s of lits(SAVEDLIST, 'grid h-9 w-9 shrink-0 place-items-center rounded-full')) problems.push(...missing('SavedList remove', s, 'hover:border-faint', 'hover:text-ink'));
    for (const s of lits(SAVEDLIST, 'block truncate text-title-sm')) problems.push(...missing('SavedList name', s, 'text-ink'), ...present('SavedList name', s, 'hover:text-ink'));
    const pager = lits(BROWSE, 'rounded-lg border border-line px-4 py-2 text-ink');
    if (pager.length !== 2) problems.push(`/browse pager literal count ${pager.length}`);
    for (const s of pager) problems.push(...missing('/browse pager', s, 'hover:border-line2'));
    const face = between(src(FILTERBAR), 'const face =', ';');
    problems.push(...missing('FilterBar face', face, 'active:bg-surface2', 'hover:border-faint', 'hover:text-ink', 'active:scale-[0.97]'));
    for (const s of lits(FILTERBAR, 'flex w-fit cursor-pointer items-center gap-2 rounded-full')) problems.push(...missing('FilterBar Filters & sort pill', s, 'hover:border-faint'));

    // Planted: a gold hover is caught; a gold focus ring is not a hover.
    expect(hoverGoldTokens('hover:border-gold/45 focus-visible:ring-gold/60 active:bg-gold/15 hover:brightness-110')).toEqual(['hover:border-gold/45', 'active:bg-gold/15']);

    expect(problems).toEqual([]);
  });

  it('selected and status states are ink except calendar and protect', () => {
    const problems: string[] = [];

    // Filter chips: ink selection on surface2, focus ring unchanged; pending hairlines ink.
    const face = between(src(FILTERBAR), 'const face =', ';');
    problems.push(...missing('FilterBar face', face, 'peer-checked:border-ink', 'peer-checked:bg-surface2', 'peer-checked:font-semibold', 'peer-focus-visible:ring-gold/60'));
    problems.push(...face.split(/\s+/).filter((t) => t.startsWith('peer-checked:') && goldCount(t)).map((t) => `FilterBar face: ${t}`));
    for (const rel of [FILTERBAR, FILTERFORM]) {
      const pending = lits(rel, 'pointer-events-none absolute -top-2 left-0 h-px w-full');
      if (pending.length !== 1) problems.push(`${rel} pending hairline literal count ${pending.length}`);
      for (const s of pending) problems.push(...missing(`${rel} pending hairline`, s, 'bg-ink', 'motion-reduce:animate-none'), ...(goldCount(s) ? [`${rel} pending hairline: gold`] : []));
    }
    for (const s of lits(FILTERBAR, 'px-1.5 py-0.5')) problems.push(...missing('FilterBar active-count badge', s, 'bg-surface2', 'text-ink'), ...(goldCount(s) ? ['FilterBar badge: gold'] : []));

    // Gallery thumbnail: an ink ring, no glow.
    const thumb = between(src(GALLERY), 'style={{', '}}');
    problems.push(...missing('VehicleGallery thumbnail', thumb, '1.5px solid ${tone.ink}'), ...present('VehicleGallery thumbnail', thumb, 'boxShadow'));
    if (goldCount(thumb)) problems.push('VehicleGallery thumbnail: gold');

    // Hearts: saved is an ink fill, unsaved muted.
    const heart = between(src(SAVEBTN), 'const heart =', '\n');
    problems.push(...missing('SaveButton heart', heart, "'fill-ink text-ink'", "'text-muted'"));
    const linkHeart = openTags(src(SAVEDLINK), 'Heart').map(classOf).join(' ');
    problems.push(...missing('SavedLink heart', linkHeart, "'fill-ink text-ink'", "'text-muted'"));
    if (goldCount(heart) || goldCount(linkHeart)) problems.push('hearts: gold');

    // Checkbox/radio: faint hover, ink checked; the goldInk tick unchanged.
    const css = src(CSS);
    const control = between(css, '.control-radio {', '}');
    problems.push(...missing('.control-check/.control-radio', control, 'hover:border-faint', 'checked:border-ink', 'checked:bg-ink'));
    if (goldCount(control)) problems.push('.control-check/.control-radio: gold');
    problems.push(...missing('.control-check:checked tick', between(css, '.control-check:checked {', '}'), `%23${tone.goldInk.slice(1)}`));

    // Status dots are faint.
    for (const [rel, needle] of [[SF, 'h-1.5 w-1.5 shrink-0 rounded-full'], [BROWSE, 'h-1.5 w-1.5 shrink-0 rounded-full'], [EMAIL, 'h-1.5 w-1.5 shrink-0 rounded-full'], [DATES, 'h-1.5 w-1.5 -translate-x-1/2']] as const) {
      const dots = lits(rel, needle);
      if (dots.length !== 1) problems.push(`${rel} status dot literal count ${dots.length}`);
      for (const s of dots) problems.push(...missing(`${rel} status dot`, s, 'bg-faint'), ...(goldCount(s) ? [`${rel} status dot: gold`] : []));
    }

    // Reserved chip and its pulse dot; the terminal badge unchanged; the share chip dot.
    const reserved = lits(CONF, 'animate-reserve-pop');
    if (reserved.length !== 1) problems.push(`Reserved chip literal count ${reserved.length}`);
    for (const s of reserved) problems.push(...missing('Reserved chip', s, "'bg-line/60 text-muted'", 'bg-panel', 'border-line2', 'text-ink'), ...(goldCount(s) ? ['Reserved chip: gold'] : []));
    for (const rel of [CONF, SHARE]) for (const s of lits(rel, 'animate-pulse rounded-full')) problems.push(...missing(`${rel} pulse dot`, s, 'bg-ink'));

    // ReturnNotice: neutral good tone, warn tone unchanged.
    const notice = sliceFunction(src(CONF), 'ReturnNotice');
    problems.push(...missing('ReturnNotice', notice, 'border-line bg-surface', "'text-ink'", 'border-warn/45 bg-warn/10', "'text-warn'"));
    if (goldCount(notice)) problems.push('ReturnNotice: gold');

    // Action cards: neutral, no tiles, no glow; the countdown pill neutral, urgent warn.
    for (const rel of [IDV, PAYCARD]) problems.push(...present(rel, src(rel), 'border-gold', 'bg-goldWash', 'bg-gold/10', 'shadow-['));
    const pill = lits(PAYCARD, 'flex shrink-0 items-center gap-1 rounded-full');
    if (pill.length !== 1) problems.push(`PaymentCard pill literal count ${pill.length}`);
    for (const s of pill) problems.push(...missing('PaymentCard pill', s, "'bg-warn/15 text-warn'", "'bg-surface2 text-ink'"));
    for (const s of lits(PAYCARD, 'animate-pulse rounded-full')) problems.push(...missing('PaymentCard finalizing dot', s, 'bg-ink'));

    // The two selected states the contract keeps gold.
    const dates = src(DATES);
    if ((dates.match(/\bbg-gold\/10\b/g) ?? []).length !== 3) problems.push('DatesStep: the range tint must stay gold (3)');
    if ((dates.match(/\bbg-gold(?![A-Za-z0-9/-])/g) ?? []).length !== 1) problems.push('DatesStep: the selected disc must stay gold (1)');
    if (!/protectionOn \? 'bg-gold' : 'bg-line'/.test(src(REVIEW))) problems.push('ReviewStep: the Protect switch ON must stay gold');

    // Planted: a gold selected chip is caught by the same filter.
    expect('peer-checked:border-gold/70 peer-checked:bg-gold/10'.split(/\s+/).filter((t) => t.startsWith('peer-checked:') && goldCount(t))).toHaveLength(2);

    expect(problems).toEqual([]);
  });

  // Attempt 2, driver-ruled a11y floor (review S1): over a bright photo the icon button's 70% panel
  // backing composites to about #56575B, where a muted heart is 2.79:1, under WCAG 1.4.11's 3:1.
  it('the unsaved heart over a photo keeps 3:1 on the chip backing', () => {
    const problems: string[] = [];
    const heart = between(src(SAVEBTN), 'const heart =', '\n');
    // Over photos (the icon variant) the unsaved heart takes the photo chips' ink; the labelled pill on a solid surface stays muted.
    if (!/saved \? 'fill-ink text-ink' : variant === 'pill' \? 'text-muted' : 'text-ink'/.test(heart)) problems.push(`SaveButton heart: ${heart.trim()}`);
    if (goldCount(heart)) problems.push('SaveButton heart: gold');
    // Its backing is the same translucent pill the min-rental chip uses on the photo.
    const pill = lits(SAVEBTN, 'grid h-9 w-9 place-items-center rounded-full');
    const chip = lits(CARD, 'absolute left-3 top-3');
    for (const [label, s] of [['icon button', pill[0] ?? ''], ['min-rental chip', chip[0] ?? '']] as const) problems.push(...missing(label, s, 'border-line2', 'bg-panel/70', 'text-ink', 'backdrop-blur'));
    // Worst case: the 70% panel over pure white (a sky, white paint).
    const backdrop = mix(tone.panel, '#ffffff', 0.7);
    const ink = contrast(tone.ink, backdrop);
    if (ink < 3) problems.push(`ink heart on the backing over white: ${ink.toFixed(2)}`);
    // Planted: the muted heart is caught on the same backdrop.
    expect(contrast(tone.muted, backdrop)).toBeLessThan(3);
    expect(problems).toEqual([]);
  });

  it('price and total figures are gold on neutral frames', () => {
    const problems: string[] = [];
    if (priceClassName !== 'shrink-0 text-title-sm font-medium leading-none text-gold') problems.push(`priceClassName changed: ${priceClassName}`);

    // Vehicle page: aside rate gold; the hero eyebrow faint with only the price span gold.
    const rate = lits(VEP, 'mt-3 flex items-baseline gap-2');
    if (rate.length !== 1 || !rate[0].includes('text-gold')) problems.push('VEP aside rate is not text-gold');
    for (const s of lits(GALLERY, '${eyebrowClassName}')) {
      if (!s.includes('text-faint') || goldCount(s)) problems.push(`VehicleGallery eyebrow: "${s}"`);
    }
    if (!/<span className="text-gold">From <Money cents=\{dailyRateCents\} \/>\/day<\/span>/.test(src(GALLERY))) problems.push('VehicleGallery: the price span is not text-gold');

    // The headline totals: gold figure, neutral frame (MP-26: Review & Request carries the flow's one total).
    const frames: [string, string, RegExp][] = [
      ['RunningTotalCard', sliceFunction(src(SHARED), 'RunningTotalCard'), /<span className="text-gold"><Money cents=\{amountCents\} large \/><\/span>/],
      ['ReviewStep Total once approved', around(src(REVIEW), 'Total once approved', 260), /className="text-gold"><Money cents=\{m\.grandTotalCents\} large \/>/],
      ['PaymentCard Total due', around(src(PAYCARD), '<span>Total due</span>', 200), /<span className="text-gold"><Money cents=\{rentalCents \+ exotiqCents\} large \/><\/span>/],
    ];
    for (const [label, text, figure] of frames) {
      if (!figure.test(text)) problems.push(`${label}: the figure is not text-gold`);
      problems.push(...present(label, text, 'border-gold', 'bg-goldWash', 'tone.goldWash', 'shadow-['));
    }
    problems.push(...present('RunningTotalCard', sliceFunction(src(SHARED), 'RunningTotalCard'), 'accent'));

    // Line items, subtotals, receipts, the rail rate and the D5 stat figures stay ink.
    for (const rel of [FEE, FEEGROUPS]) if (goldCount(src(rel))) problems.push(`${rel} (the two-party money card) carries gold`);
    if (goldCount(src(CONF).replace(/\banimate-gold-sheen\b/, ''))) problems.push('ConfirmationScreen (receipt rows, totals) carries gold beyond the sheen');
    const rail = between(src(FLOW), 'Daily rate', '</div>');
    if (goldCount(rail) || !rail.includes('text-ink')) problems.push('BookingFlow rail Daily rate is not ink');
    if (goldCount(sliceFunction(src(SF), 'AboutCard'))) problems.push('AboutCard (Lowest rate) carries gold');
    if (goldCount(between(src(VEP), 'Booking preview', 'Pickup'))) problems.push('Booking preview (Per day) carries gold');

    // Money's formatting is untouched (statement parity).
    if (sliceFunction(read(CHROME), 'Money').trimEnd() !== MONEY_BASE) problems.push('Money changed');

    expect(problems).toEqual([]);
  });
});
