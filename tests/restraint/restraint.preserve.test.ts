// MP-16 AC13: nothing else moves. The gold focus ring (the a11y signature), the confirmation
// sheen, the Verified chip, the 13 focus-scoped gold recipes, the six frozen CookieControls
// mounts and the forbidden paths. Its value is in the negative cases: each guard is also run on
// a planted violation. The live changed-file check runs only with RESTRAINT_BASE_REF set (LD7:
// an unconditional merge-base diff goes red on the next ticket), and then a missing git or ref throws.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { classOf, goldCount, literals, openTags, prepare, read, root, sliceFunction } from './restraintScan';

const src = (rel: string): string => prepare(rel, read(rel));
const BASE_REF = process.env.RESTRAINT_BASE_REF ?? '';

/** `selector { … }` up to its closing brace, as MP-15's tokens test reads it. */
function ruleText(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return '';
  return css.slice(start, css.indexOf('}', start) + 1);
}
const declarations = (rule: string): string[] => rule.slice(rule.indexOf('{') + 1, rule.lastIndexOf('}')).split(';').map((d) => d.trim()).filter(Boolean);

/** The frozen blocks of app/globals.css, verbatim from 8497c31. */
const FROZEN_CSS = [
  `  @keyframes goldSheen {
    from { transform: translateX(-160%) skewX(-18deg); }
    to { transform: translateX(420%) skewX(-18deg); }
  }`,
  `  .animate-gold-sheen {
    background: linear-gradient(100deg, transparent 10%, rgba(200,166,100,0.16) 45%, rgba(255,240,214,0.28) 50%, rgba(200,166,100,0.16) 55%, transparent 90%);
    animation: goldSheen 1.3s cubic-bezier(0.4, 0, 0.2, 1) 0.45s 1 both;
  }`,
  `  .animate-reserve-pop {
    animation: reservePop 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) 0.25s both;
  }`,
  `  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    .animate-gold-sheen { animation: none; opacity: 0; }
    .animate-reserve-pop { animation: none; }
  }`,
];

/** The 13 focus-scoped gold recipes at base (role FOCUS), per file. */
const FOCUS: Record<string, number> = {
  'components/browse/tokens.ts': 4,
  'components/drive-exotiq/flow/DatesStep.tsx': 3,
  'components/drive-exotiq/flow/DriverStep.tsx': 2,
  'components/renters/EmailCaptureForm.tsx': 2,
  'components/browse/FilterBar.tsx': 1,
  'components/drive-exotiq/flow/ReviewStep.tsx': 1,
};
/** Utilities whose variant chain is focus-scoped and that name gold. */
export const focusGold = (text: string): string[] =>
  text.split(/[\s'"`{}]+/).filter((t) => t.lastIndexOf(':') > 0 && t.slice(0, t.lastIndexOf(':')).includes('focus') && goldCount(t) > 0);

/** The six <CookieControls> mounts, verbatim, in source order per file (AC13g). */
const MOUNTS: Record<string, string[]> = {
  'app/[operatorSlug]/page.tsx': [`<CookieControls viewport={hasPhone ? 'desktop' : 'all'} className="mt-6 max-w-sm border-t border-line" />`, '<CookieControls viewport="mobile" />'],
  'components/drive-exotiq/VehicleEntryPage.tsx': ['<CookieControls viewport="desktop" className="border-t border-line" />', '<CookieControls viewport="mobile" />'],
  'components/drive-exotiq/flow/shared.tsx': ['<CookieControls />'],
  'app/privacy/page.tsx': ['<CookieControls manual className="mt-4 max-w-sm border-t border-line" />'],
};

/** AC13e: paths MP-16 may never change (spec list, plus the configs the plan freezes). */
const FORBIDDEN_PREFIXES = ['domain/', 'supabase/', 'netlify/', 'scripts/canary/', 'components/marketplace/', 'components/analytics/', 'docs/analytics/', 'app/privacy/', 'app/api/', 'scripts/analytics-'];
const FORBIDDEN_FILES = ['scripts/compact-cookie-qa.cjs', 'vitest.config.mts', 'package.json', 'package-lock.json', 'tailwind.config.ts', 'next.config.js', 'tsconfig.json'];
export const forbidden = (path: string): boolean => FORBIDDEN_PREFIXES.some((p) => path.startsWith(p)) || FORBIDDEN_FILES.includes(path);

const git = (...args: string[]): string[] =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);

describe('MP-16 preservation (AC13)', () => {
  it('focus ring sheen verified blue and domain are untouched', () => {
    const problems: string[] = [];
    const css = read('app/globals.css');

    // (a) the two focus rules declare exactly the shipped gold ring; the sheen, pop and reduced-motion blocks verbatim.
    for (const selector of [':-moz-focusring', ':where(*:focus-visible)']) {
      const decl = declarations(ruleText(css, selector));
      if (JSON.stringify(decl) !== JSON.stringify(['outline: 2px solid rgba(200, 166, 100, 0.7)', 'outline-offset: 2px'])) problems.push(`(a) ${selector}: ${decl.join('; ')}`);
    }
    for (const block of FROZEN_CSS) if (!css.includes(block)) problems.push(`(a) globals.css frozen block changed: ${block.split('\n')[0].trim()}`);

    // (b) the one confirmation moment renders exactly once.
    const sheen = (src('components/drive-exotiq/ConfirmationScreen.tsx').match(/\banimate-gold-sheen\b/g) ?? []).length;
    if (sheen !== 1) problems.push(`(b) animate-gold-sheen renders ${sheen} time(s)`);

    // (c) Verified keeps blue, its icon and its corner; the min chip keeps its corner.
    const card = src('components/browse/ListingCard.tsx');
    const verified = literals(card).filter((s) => s.includes('text-verified'));
    if (verified.length !== 1 || !verified[0].includes('right-3 top-3') || !verified[0].includes('border-verified/35')) problems.push('(c) the Verified chip moved or lost its colour');
    if (!card.includes('<BadgeCheck size={11} strokeWidth={2.25} aria-hidden />')) problems.push('(c) the Verified BadgeCheck changed');
    if (literals(card).filter((s) => s.includes('absolute left-3 top-3')).length !== 1) problems.push('(c) the min-rental chip left its corner');

    // (d) the 13 focus-scoped gold recipes.
    for (const [rel, n] of Object.entries(FOCUS)) {
      const found = focusGold(src(rel));
      if (found.length !== n) problems.push(`(d) ${rel}: ${found.length} focus gold recipe(s), expected ${n} (${found.join(' ')})`);
    }

    // (g) the six CookieControls mounts: count, props and className text, order; Sticky's first child.
    for (const [rel, mounts] of Object.entries(MOUNTS)) {
      const text = read(rel);
      const tags = openTags(text, 'CookieControls');
      if (JSON.stringify(tags) !== JSON.stringify(mounts)) problems.push(`(g) ${rel}: mounts ${JSON.stringify(tags)}`);
    }
    const sticky = sliceFunction(src('components/drive-exotiq/flow/shared.tsx'), 'Sticky');
    const outer = openTags(sticky, 'div')[0] ?? '';
    if (!sticky.slice(sticky.indexOf(outer) + outer.length).trimStart().startsWith('<CookieControls />')) problems.push('(g) Sticky: CookieControls is not the first child');
    // The privacy page renders the consent dialog inside LegalPage's prose: its anchor rules must not reach it (LD4).
    const legal = classOf(openTags(src('components/browse/LegalPage.tsx'), 'div').find((t) => t.includes('[&_h2]')) ?? '');
    if (/\[&_a\]:/.test(legal)) problems.push('(g) LegalPage: a bare anchor rule cascades into the consent dialog');
    if (!legal.includes('[&_a:not([data-cookie-controls]_a)]:')) problems.push('(g) LegalPage: the anchor rules are not scoped away from [data-cookie-controls]');

    // (e) the forbidden-path matcher, unit-checked on a synthetic list.
    expect(['domain/booking/totals.ts', 'components/analytics/CookieControls.tsx', 'package.json', 'package-lock.json', 'vitest.config.mts', 'scripts/analytics-live-smoke.cjs', 'scripts/compact-cookie-qa.cjs', 'app/privacy/page.tsx', 'app/api/renters/route.ts', 'docs/analytics/x.md'].filter((p) => !forbidden(p))).toEqual([]);
    expect(['tests/restraint/x.ts', 'scripts/restraint-matrix.mjs', 'components/browse/tokens.ts', 'app/globals.css', 'tests/design/tokens.test.ts'].filter(forbidden)).toEqual([]);

    // Planted: an edited focus rule, a second sheen, a moved mount and a focus recipe removed are each caught.
    expect(declarations('x { outline: 2px solid rgba(255, 255, 255, 0.7); outline-offset: 2px; }')).not.toEqual(['outline: 2px solid rgba(200, 166, 100, 0.7)', 'outline-offset: 2px']);
    expect(focusGold('focus:border-gold/70 focus-visible:ring-gold/60 hover:border-gold/40 peer-focus-visible:ring-gold/60')).toHaveLength(3);
    expect(openTags('<CookieControls viewport="mobile" /><CookieControls />', 'CookieControls')).not.toEqual(['<CookieControls viewport="mobile" />']);

    expect(problems).toEqual([]);
  });

  it.skipIf(!BASE_REF)('changed files since RESTRAINT_BASE_REF touch no forbidden path (live diff; set RESTRAINT_BASE_REF=8497c31)', () => {
    const changed = git('diff', '--name-only', `${BASE_REF}...HEAD`).concat(git('diff', '--name-only'), git('diff', '--name-only', '--cached'), git('ls-files', '--others', '--exclude-standard'));
    expect(changed.filter((p, i) => changed.indexOf(p) === i).filter(forbidden)).toEqual([]);
  });
});
