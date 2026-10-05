// MP-16 B1 (auto-review, attempt 2): the Dates sticky bar drew two hairlines 13px apart whenever
// CookieControls rendered nothing (every pre-hydration paint, and first visits off the production
// host): the bar's own top border, then the flattened RunningTotalCard's top rule.
//
// This renders the real Sticky / RunningTotalCard / PrimaryButton markup with react-dom/server
// (node env, no DOM library in the repo), with and without a cookie row, rebuilds the element tree
// and counts the elements that draw a top rule. The one conditional rule is taken from the real
// Tailwind compile: the test asserts its selector shape, then applies exactly that selector.
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import config from '../../tailwind.config';
import { compileWith } from '../design/lib/scan.mjs';

const cookie = vi.hoisted(() => ({ renders: false }));
// vitest has no `@/` alias (vitest.config.mts is frozen), so the app's aliased imports are stubbed
// here; tokens stay real. The cookie row is the one switch under test.
vi.mock('@/components/analytics/CookieControls', () => ({
  CookieControls: () => (cookie.renders ? <div data-cookie-controls="row" className="relative -mt-1 mb-1.5">Privacy preferences</div> : null),
}));
vi.mock('@/components/browse/tokens', () => import('../../components/browse/tokens'));
vi.mock('@/components/browse/SiteBar', () => ({ SiteBar: () => null }));
vi.mock('@/components/renters/SavedLink', () => ({ SavedLink: () => null }));
vi.mock('@/domain/booking/config', () => ({ browseEnabled: () => false }));

import { PrimaryButton } from '../../components/drive-exotiq/BookingChrome';
import { RunningTotalCard, Sticky } from '../../components/drive-exotiq/flow/shared';

type El = { tag: string; cls: string[]; children: El[]; parent: El | null };
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);

/** The element tree of server-rendered markup (enough for our own components: no comments, no raw text tags). */
function tree(html: string): El {
  const root: El = { tag: '#root', cls: [], children: [], parent: null };
  let cur = root;
  for (const m of Array.from(html.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g))) {
    const [, close, tag, attrs, self] = m;
    if (close) { cur = cur.parent ?? root; continue; }
    const el: El = { tag, cls: (/class="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean), children: [], parent: cur };
    cur.children.push(el);
    if (!self && !VOID.has(tag)) cur = el;
  }
  return root;
}
const walk = (el: El): El[] => [el, ...el.children.flatMap(walk)];
const isFirstChild = (el: El | null): boolean => Boolean(el?.parent && el.parent.children[0] === el);

const render = (children: ReactNode, withCookieRow: boolean) => {
  cookie.renders = withCookieRow;
  return tree(renderToStaticMarkup(<Sticky>{children}</Sticky>)).children[0];
};

/** The conditional rule-dropper as Tailwind compiles it: `:first-child > .<cls>` with the given declaration. */
async function dropper(candidates: string[], decl: string): Promise<string | undefined> {
  const { rules } = await compileWith(config, candidates);
  const hit = rules.find((r) => r.decls.includes(decl) && /^:first-child > \./.test(r.selector));
  if (!hit) return undefined;
  return candidates.find((c) => hit.selector === `:first-child > .${c.replace(/[[\]:>&]/g, (ch) => `\\${ch}`)}`);
}

/** Elements that draw a top rule, after the conditional dropper (whose parent must be a first child) is applied. */
function topRules(bar: El, dropBorder: string | undefined): El[] {
  return walk(bar).filter((el) => {
    const drawn = el.cls.some((c) => c === 'border-t' || c === 'border-y');
    const dropped = dropBorder !== undefined && el.cls.includes(dropBorder) && isFirstChild(el.parent);
    return drawn && !dropped;
  });
}

describe('MP-16 B1: one rule at the top of the Dates bar', () => {
  it('the dates bar draws one rule when the cookie row renders nothing', async () => {
    const total = <RunningTotalCard label="Oct 12–15 · 3 days" detail="$1,199/day × 3" amountCents={359700} />;
    const button = <PrimaryButton>Continue</PrimaryButton>;

    // The total's own classes, and the dropper Tailwind actually emits for them.
    const noRow = render(<>{total}{button}</>, false);
    const totalEl = walk(noRow).find((el) => el.cls.includes('pt-3') && el.cls.includes('border-t'));
    expect(totalEl, 'RunningTotalCard root').toBeDefined();
    const dropBorder = await dropper(totalEl!.cls, 'border-top-width:0px');
    const dropPad = await dropper(totalEl!.cls, 'padding-top:0px');
    expect(dropBorder, 'a `:first-child > .x { border-top-width: 0 }` rule on the total').toBeDefined();
    expect(dropPad, 'a `:first-child > .x { padding-top: 0 }` rule on the total').toBeDefined();

    // No cookie row (pre-hydration, first visit off the production host): the bar's border only.
    expect(noRow.cls).toContain('border-t');
    expect(topRules(noRow, dropBorder)).toEqual([noRow]);

    // Cookie row rendered: Sticky's first child is the row, and the total keeps its hairline (AC8)
    // between the row and the figure; CookieControls stays the first child (AC13g).
    const withRow = render(<>{total}{button}</>, true);
    expect(withRow.children[0].cls.join(' ')).toContain('mb-1.5');
    expect(topRules(withRow, dropBorder).length).toBe(2);

    // The other steps put PrimaryButton first: nothing on it is dropped (its py-4 and borders stay).
    const buttonOnly = render(button, false);
    const buttonEl = walk(buttonOnly).find((el) => el.tag === 'button')!;
    expect(buttonEl.cls).toContain('py-4');
    expect(buttonEl.cls.some((c) => c.startsWith('[:first-child>&]') || c.startsWith('first:'))).toBe(false);
    expect(topRules(buttonOnly, dropBorder)).toEqual([buttonOnly]);

    // Planted: a total without the dropper doubles the rule with the row absent.
    const planted = tree('<div class="absolute border-t border-line"><div class="space-y-3"><div class="border-t border-line pt-3">x</div></div></div>').children[0];
    expect(topRules(planted, dropBorder)).toHaveLength(2);
  });
});
