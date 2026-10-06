// MP-26 AC1: the display fold is exact and keeps the data. foldFees groups the charged figures
// into the operator's lines and Drive Exotiq's lines (Protect its own line, Trip fees = platform +
// state, card processing a subline), echoes the four components, and takes each subtotal from the
// charged input total, never from a re-sum of its lines. Expected values come from the fixture
// constants (tests/fees/fixtures.ts), not from the fold.
import { describe, expect, it } from 'vitest';
import { formatMoney } from '@/domain/booking/totals';
import { type Case, OPERATOR_NAME, STATE_LABEL, expected, fixtures, foldInputOf as inputOf, grid } from './fixtures';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../design/lib/scan.mjs';
import { REPO } from './goldens';

type Fold = typeof import('@/components/drive-exotiq/feeGroups');
async function fold(): Promise<Fold | null> {
  try {
    return await import('@/components/drive-exotiq/feeGroups');
  } catch {
    return null;
  }
}

/** Every AC1 rule, checked on one fold output against the case's constants. */
function foldProblems(c: Case, g: ReturnType<Fold['foldFees']>): string[] {
  const p: string[] = [];
  const e = expected(c);
  const opKeys = g.operator.lines.map((l) => l.key);
  const exKeys = g.exotiq.lines.map((l) => l.key);
  if (JSON.stringify(g.operator.lines.map((l) => ({ line: l.key, cents: l.cents }))) !== JSON.stringify(e.operator)) p.push(`${c.id} operator lines ${JSON.stringify(g.operator.lines.map((l) => [l.key, l.cents]))}`);
  if (JSON.stringify(g.exotiq.lines.map((l) => ({ line: l.key, cents: l.cents }))) !== JSON.stringify(e.exotiq)) p.push(`${c.id} exotiq lines ${JSON.stringify(g.exotiq.lines.map((l) => [l.key, l.cents]))}`);
  if (g.operator.lines[0]?.cents !== c.operatorTotalCents - c.taxCents) p.push(`${c.id} rental is not operator total minus tax`);
  if (opKeys.includes('operator-tax') !== c.taxCents > 0) p.push(`${c.id} operator-tax presence`);
  if (exKeys.includes('protect') !== c.protectionTotalCents > 0) p.push(`${c.id} protect presence`);
  if (exKeys.includes('processing') !== c.processingFeeCents > 0) p.push(`${c.id} processing presence`);
  const trip = g.exotiq.lines.find((l) => l.key === 'trip-fees');
  if (trip?.cents !== c.platformFeeCents + c.stateFeeCents) p.push(`${c.id} trip fees ${trip?.cents} != platform + state ${c.platformFeeCents + c.stateFeeCents}`);
  if (g.exotiq.tripFees.cents !== c.platformFeeCents + c.stateFeeCents) p.push(`${c.id} tripFees.cents ${g.exotiq.tripFees.cents}`);
  const comp = g.exotiq.tripFees.components;
  const wantComp = [{ key: 'platform-fee', cents: c.platformFeeCents }, ...(c.stateFeeCents > 0 ? [{ key: 'state-fee', cents: c.stateFeeCents }] : [])];
  if (JSON.stringify(comp.map((x) => ({ key: x.key, cents: x.cents }))) !== JSON.stringify(wantComp)) p.push(`${c.id} trip components ${JSON.stringify(comp.map((x) => [x.key, x.cents]))}`);
  if (comp.reduce((a, x) => a + x.cents, 0) !== trip?.cents) p.push(`${c.id} trip components do not sum to the line`);
  if (comp.some((x) => (x.key as string) === 'protect' || (x.key as string) === 'processing')) p.push(`${c.id} protect or processing inside Trip fees`);
  if (JSON.stringify(g.components) !== JSON.stringify({ platformFeeCents: c.platformFeeCents, protectionTotalCents: c.protectionTotalCents, stateFeeCents: c.stateFeeCents, processingFeeCents: c.processingFeeCents })) p.push(`${c.id} components ${JSON.stringify(g.components)}`);
  if (g.operator.subtotalCents !== c.operatorTotalCents || g.exotiq.subtotalCents !== c.exotiqTotalCents) p.push(`${c.id} subtotals ${g.operator.subtotalCents}/${g.exotiq.subtotalCents}`);
  if (g.operator.residualCents !== 0 || g.exotiq.residualCents !== 0) p.push(`${c.id} residual ${g.operator.residualCents}/${g.exotiq.residualCents}`);
  if (g.grandTotalCents !== c.grandTotalCents) p.push(`${c.id} grand ${g.grandTotalCents}`);
  if (g.operator.name !== OPERATOR_NAME) p.push(`${c.id} operator name ${g.operator.name}`);
  return p;
}

describe('MP-26 display fold (AC1)', () => {
  it('fold groups the four components into Trip fees, Protect and a processing subline', async () => {
    const f = await fold();
    expect(f, 'components/drive-exotiq/feeGroups.ts exports foldFees').not.toBeNull();
    const { foldFees } = f!;
    const problems: string[] = [];

    // The eight fixtures: exact lines, labels and details.
    for (const c of fixtures()) {
      const g = foldFees(inputOf(c));
      problems.push(...foldProblems(c, g));
      const want = [
        { key: 'rental', label: 'Rental', detail: `3 × ${formatMoney(100_000)}` },
        ...(c.taxCents ? [{ key: 'operator-tax', label: 'Tax', detail: '7.5%' }] : []),
      ];
      const got = g.operator.lines.map((l) => ({ key: l.key, label: l.label, detail: l.detail }));
      if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${c.id} operator copy ${JSON.stringify(got)}`);
      const wantEx = [
        ...(c.protect ? [{ key: 'protect', label: 'Exotiq Protect', detail: 'Premium · 3 days' }] : []),
        { key: 'trip-fees', label: 'Trip fees' },
        { key: 'processing', label: 'Card processing' },
      ];
      const gotEx = g.exotiq.lines.map((l) => ({ key: l.key, label: l.label, ...(l.detail ? { detail: l.detail } : {}) }));
      if (JSON.stringify(gotEx) !== JSON.stringify(wantEx)) problems.push(`${c.id} exotiq copy ${JSON.stringify(gotEx)}`);
      const wantComp = [{ key: 'platform-fee', label: 'Platform fee', detail: '10% of the rental' }, ...(c.stateFeeCents ? [{ key: 'state-fee', label: STATE_LABEL, detail: '3 days' }] : [])];
      const gotComp = g.exotiq.tripFees.components.map((x) => ({ key: x.key, label: x.label, detail: x.detail }));
      if (JSON.stringify(gotComp) !== JSON.stringify(wantComp)) problems.push(`${c.id} detail copy ${JSON.stringify(gotComp)}`);

      // The live surfaces know no percent, rate, days or state label: generic labels, no guesses (D5).
      const live = foldFees(inputOf(c, false));
      problems.push(...foldProblems(c, live));
      const liveComp = live.exotiq.tripFees.components.map((x) => ({ key: x.key, label: x.label, detail: x.detail }));
      const wantLive = [{ key: 'platform-fee', label: 'Platform fee', detail: undefined }, ...(c.stateFeeCents ? [{ key: 'state-fee', label: 'State rental fee', detail: undefined }] : [])];
      if (JSON.stringify(liveComp) !== JSON.stringify(wantLive)) problems.push(`${c.id} live detail ${JSON.stringify(liveComp)}`);
      if (live.operator.lines[0].detail !== undefined) problems.push(`${c.id} live rental detail "${live.operator.lines[0].detail}"`);
      if (c.taxCents && live.operator.lines[1].detail !== undefined) problems.push(`${c.id} live tax detail "${live.operator.lines[1].detail}"`);
      if (c.protect && live.exotiq.lines[0].detail !== 'Premium') problems.push(`${c.id} live protect detail "${live.exotiq.lines[0].detail}"`);
    }

    // The full 2,160-case grid on the pure fold.
    const all = grid();
    expect(all).toHaveLength(2160);
    for (const c of all) problems.push(...foldProblems(c, foldFees(inputOf(c))));

    // Planted inputs.
    const base = fixtures()[7]; // FX-T1S1P1
    const off = foldFees({ ...inputOf(base), exotiqTotalCents: base.exotiqTotalCents + 1 });
    expect(off.exotiq.subtotalCents, 'a non-reconciling input keeps the charged subtotal').toBe(base.exotiqTotalCents + 1);
    expect(off.exotiq.residualCents, 'and reports the residual').toBe(1);
    expect(foldFees({ ...inputOf(base), stateFeeCents: 0, exotiqTotalCents: base.exotiqTotalCents - base.stateFeeCents }).exotiq.tripFees.components.map((x) => x.key)).toEqual(['platform-fee']);
    expect(foldFees({ ...inputOf(base), protectionTotalCents: 0, exotiqTotalCents: base.exotiqTotalCents - base.protectionTotalCents }).exotiq.lines.map((l) => l.key)).toEqual(['trip-fees', 'processing']);
    expect(foldFees({ ...inputOf(base), operatorTaxCents: 0, operatorTotalCents: base.rentalCents }).operator.lines.map((l) => l.key)).toEqual(['rental']);
    expect(foldFees({ ...inputOf(base), processingFeeCents: 0, exotiqTotalCents: base.exotiqTotalCents - base.processingFeeCents }).exotiq.lines.map((l) => l.key)).toEqual(['protect', 'trip-fees']);
    // The checker itself catches the unhappy shapes (planted outputs).
    const good = foldFees(inputOf(base));
    expect(foldProblems(base, good)).toEqual([]);
    const folded = { ...good, exotiq: { ...good.exotiq, lines: good.exotiq.lines.filter((l) => l.key !== 'protect').map((l) => (l.key === 'trip-fees' ? { ...l, cents: l.cents + base.protectionTotalCents } : l)) } };
    expect(foldProblems(base, folded).join()).toContain('trip fees');
    const dropsState = { ...good, exotiq: { ...good.exotiq, lines: good.exotiq.lines.map((l) => (l.key === 'trip-fees' ? { ...l, cents: base.platformFeeCents } : l)) } };
    expect(foldProblems(base, dropsState).join()).toContain('trip fees');
    const resummed = { ...good, exotiq: { ...good.exotiq, subtotalCents: good.exotiq.lines.reduce((a, l) => a + l.cents, 0) - 1 } };
    expect(foldProblems(base, resummed).join()).toContain('subtotals');
    const zeroProtect = foldFees({ ...inputOf(fixtures()[6]) });
    expect(zeroProtect.exotiq.lines.some((l) => l.key === 'protect')).toBe(false);

    expect(problems).toEqual([]);
  });
});

describe('MP-26 residual warning (review S2)', () => {
  it('a non-reconciling fold is flagged for development and never shown silently', async () => {
    const f = await fold();
    const residualProblem = (f as unknown as { residualProblem?: (g: ReturnType<Fold['foldFees']>) => string | null } | null)?.residualProblem;
    expect(residualProblem, 'feeGroups.ts exports residualProblem').toBeTypeOf('function');
    const problems: string[] = [];
    // Reconciling input is never flagged: the fixtures and every 36th grid case (60).
    for (const c of [...fixtures(), ...grid().filter((_, i) => i % 36 === 0)]) {
      const got = residualProblem!(f!.foldFees(inputOf(c)));
      if (got !== null) problems.push(`${c.id}: ${got}`);
    }
    // A charged Exotiq total one cent above its lines, an operator subtotal one cent below its lines, both.
    const base = fixtures()[7];
    const short = f!.foldFees({ ...inputOf(base), exotiqTotalCents: base.exotiqTotalCents + 1 });
    expect(residualProblem!(short)).toBe('Drive Exotiq: lines fall short of the subtotal by 1 cents');
    const good = f!.foldFees(inputOf(base));
    const over = { ...good, operator: { ...good.operator, subtotalCents: good.operator.subtotalCents - 1, residualCents: -1 } };
    expect(residualProblem!(over)).toBe('operator: lines exceed the subtotal by 1 cents');
    expect(residualProblem!({ ...short, operator: over.operator })).toBe('operator: lines exceed the subtotal by 1 cents; Drive Exotiq: lines fall short of the subtotal by 1 cents');
    // The card warns in development only, once per message, after render (never on the server).
    const card = stripComments(readFileSync(join(REPO, 'components/drive-exotiq/FeeCard.tsx'), 'utf8'));
    const body = card.slice(card.indexOf('export function TwoPartyBreakdown('));
    if (!/residualProblem\(groups\)/.test(body)) problems.push('FeeCard: TwoPartyBreakdown does not call residualProblem(groups)');
    const effect = /useEffect\(\(\) => \{([\s\S]*?)\}, \[problem\]\);/.exec(body)?.[1] ?? '';
    if (!effect.includes('console.warn(') || !effect.includes("process.env.NODE_ENV !== 'production'")) problems.push('FeeCard: console.warn is not inside a useEffect behind NODE_ENV !== production');
    const walk = (dir: string): string[] => readdirSync(join(REPO, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
    for (const rel of walk('components/drive-exotiq')) {
      const n = (stripComments(readFileSync(join(REPO, rel), 'utf8')).match(/\bconsole\./g) ?? []).length;
      if (n !== (rel === 'components/drive-exotiq/FeeCard.tsx' ? 1 : 0)) problems.push(`${rel}: ${n} console call(s)`);
    }
    expect(problems).toEqual([]);
  });
});
