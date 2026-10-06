// MP-30 AC18: the QA scripts follow the build's Protect flag. Every query or click of the Protect
// switch in scripts/fee-matrix.mjs and scripts/restraint-matrix.mjs sits behind the scripts' own
// literal check of NEXT_PUBLIC_PROTECT_ENABLED; with the flag off, protect-off requires the switch to
// be absent and the in-flight probe records `switch: null`. The module-private `setup` is sliced out
// of each script's source and run against a fake page (no export is added for the test's sake).
// Red on the base by design. The recorded-probe check runs only with MP30_INFLIGHT_JSON.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stripComments } from '../design/lib/scan.mjs';
import { sliceFunction } from '../restraint/restraintScan';
import { STATES } from '../../scripts/restraint-matrix.mjs';
import { APP_STATES } from '../../scripts/fee-matrix.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const ENV = 'NEXT_PUBLIC_PROTECT_ENABLED';
const SCRIPTS = ['scripts/fee-matrix.mjs', 'scripts/restraint-matrix.mjs'];
afterEach(() => { vi.unstubAllEnvs(); });

const SWITCH = 'aria-label="Exotiq Protect"';
const FLAG = /if \((?:process\.env\.NEXT_PUBLIC_PROTECT_ENABLED === 'true'|protectOn)\) \{/g;
/** End (exclusive) of the block whose `{` is at `open`. */
function blockEnd(src: string, open: number): number { let d = 0; for (let i = open; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) return i + 1; } return src.length; }
/** [start, end) ranges behind the flag: each `if (flag) { … }` and its `else { … }`. */
function guardedRanges(src: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of Array.from(src.matchAll(FLAG))) {
    const open = (m.index ?? 0) + m[0].length - 1;
    let end = blockEnd(src, open);
    const el = /^\s*else\s*\{/.exec(src.slice(end));
    if (el) end = blockEnd(src, end + el[0].length - 1);
    out.push([m.index ?? 0, end]);
  }
  return out;
}
/** AC18 scan: every switch mention behind the flag (INFLIGHT_READ's null-safe read is the one exception); no raw f.switch read; literal, per-call flag reads only. */
function switchGuardProblems(rel: string, raw: string): string[] {
  const src = stripComments(raw); const p: string[] = []; const ranges = guardedRanges(src);
  const ro = src.indexOf('const INFLIGHT_READ = () => {'); const roEnd = ro < 0 ? -1 : blockEnd(src, src.indexOf('{', ro));
  for (let at = src.indexOf(SWITCH); at >= 0; at = src.indexOf(SWITCH, at + 1)) {
    if (ranges.some(([a, b]) => at >= a && at < b) || (ro >= 0 && at > ro && at < roEnd)) continue;
    p.push(`${rel}:${src.slice(0, at).split('\n').length}: the Protect switch is named outside the flag check`);
  }
  if (ro >= 0 && /\.click\(/.test(src.slice(ro, roEnd))) p.push(`${rel}: INFLIGHT_READ clicks`);
  for (const [i, line] of Array.from(src.split('\n').entries())) {
    if (/\bf\.switch\./.test(line) && !/\bf\.switch \?/.test(line)) p.push(`${rel}:${i + 1}: f.switch dereferenced without a null check`);
    if (/process\.env\.NEXT_PUBLIC_PROTECT_ENABLED/.test(line) && !/^\s+/.test(line)) p.push(`${rel}:${i + 1}: the flag is read at module top level`);
    if (/process\.env\.NEXT_PUBLIC_PROTECT_ENABLED(?! === 'true')/.test(line) || /process\.env\[/.test(line)) p.push(`${rel}:${i + 1}: not the literal flag check`);
  }
  if (!ranges.length) p.push(`${rel}: no flag check`);
  return p;
}
type Fake = { evaluate: (fn: (a?: unknown) => unknown, arg?: unknown) => Promise<unknown> };
/** Run a script's module-private `setup(page, 'protect-off')`, sliced from its source, against a fake page. */
async function runSetup(rel: string, present: boolean): Promise<{ ok: boolean; err?: string; log: string[] }> {
  const log: string[] = [];
  const g = globalThis as { document?: unknown };
  const page: Fake = { evaluate: async (fn, arg) => {
    const prev = g.document;
    g.document = { querySelector: (sel: string) => (sel.includes('Exotiq Protect') ? (present ? { click: () => log.push('click'), getAttribute: () => 'false' } : null) : sel.includes('data-money') ? {} : null) };
    try { return fn(arg); } finally { g.document = prev; }
  } };
  const waitFor = async (pg: Fake, pred: (a?: unknown) => unknown, arg: unknown, what: string) => { log.push(`wait:${what}`); if (!(await pg.evaluate(pred, arg))) throw new Error(`timed out waiting for ${what}`); };
  const make = new Function('waitFor', 'sleep', 'typeDob', 'clickText', `${sliceFunction(stripComments(read(rel)), 'setup')}\nreturn setup;`) as (...d: unknown[]) => (p: Fake, n: string) => Promise<void>;
  const setup = make(waitFor, async () => {}, async () => {}, async () => {});
  try { await setup(page, 'protect-off'); return { ok: true, log }; } catch (e) { return { ok: false, err: (e as Error).message, log }; }
}

type Probe = {
  delayMs: number; stillInFlightAfterClicks: boolean;
  atSend: { step: number; protection: string; consent: boolean };
  inFlight: {
    ariaBusy: string | null; buttonLabel: string | null; step: number; switch: Record<string, unknown> | null;
    optIn: { clicked: boolean; disabled: boolean; checkedBefore: boolean; checkedAfter: boolean };
    rental: { clicked: boolean; enabledButton: boolean; stepBefore: number; stepAfter: number };
    terms: { disabled: boolean }; tripFees: { disabled: boolean }; chromeBack: { disabled: boolean };
  };
  received: { bookingProtection: string | null; captureConsent: boolean | null };
};
/** A flag-off in-flight probe (null-aware; mirrors tests/fees/fees.live.test.ts:147-170 without the switch). */
function inflightProblems(r: Probe): string[] {
  const p: string[] = []; const f = r.inFlight;
  if (!(r.delayMs >= 1500)) p.push(`delayMs ${r.delayMs}: hold rent-create-booking at least 1500ms`);
  if (f.switch !== null) p.push('switch: present on a flag-off build');
  if (r.atSend.step !== 3 || r.atSend.protection !== 'decline' || r.atSend.consent !== true) p.push(`atSend ${JSON.stringify(r.atSend)}`);
  if (f.ariaBusy !== 'true') p.push(`aria-busy ${f.ariaBusy}`);
  if (f.buttonLabel !== 'Sending request…' || !r.stillInFlightAfterClicks) p.push(`button "${f.buttonLabel}", in flight after clicks ${r.stillInFlightAfterClicks}`);
  if (!f.optIn.clicked || !f.optIn.disabled || f.optIn.checkedBefore !== true || f.optIn.checkedAfter !== true) p.push(`opt-in ${JSON.stringify(f.optIn)}`);
  if (!f.rental.clicked || f.rental.enabledButton || f.rental.stepBefore !== 3 || f.rental.stepAfter !== 3 || f.step !== 3) p.push(`rental ${JSON.stringify(f.rental)}, step ${f.step}`);
  if (f.terms.disabled || f.tripFees.disabled) p.push('terms or Trip fees disabled (not payload controls)');
  if (!f.chromeBack.disabled) p.push('chrome Back enabled during flight');
  if (r.received.bookingProtection !== 'decline') p.push(`received protection ${r.received.bookingProtection}`);
  if (r.received.captureConsent !== true) p.push(`received consent ${r.received.captureConsent}`);
  return p;
}
const GOOD: Probe = { delayMs: 1503, stillInFlightAfterClicks: true, atSend: { step: 3, protection: 'decline', consent: true }, inFlight: { ariaBusy: 'true', buttonLabel: 'Sending request…', step: 3, switch: null, optIn: { clicked: true, disabled: true, checkedBefore: true, checkedAfter: true }, rental: { clicked: true, enabledButton: false, stepBefore: 3, stepAfter: 3 }, terms: { disabled: false }, tripFees: { disabled: false }, chromeBack: { disabled: true } }, received: { bookingProtection: 'decline', captureConsent: true } };

describe('MP-30 QA tooling', () => {
  it("the QA scripts follow the build's Protect flag", async () => {
    const problems: string[] = [];
    // (a) the scan.
    for (const rel of SCRIPTS) problems.push(...switchGuardProblems(rel, read(rel)));
    // (b) protect-off, per flag state and switch presence.
    for (const rel of SCRIPTS) {
      vi.stubEnv(ENV, undefined);
      let r = await runSetup(rel, false);
      if (!r.ok || r.log.includes('click') || JSON.stringify(r.log) !== JSON.stringify(['wait:the money card'])) problems.push(`${rel} flag unset, switch absent: ${JSON.stringify(r)}`);
      for (const v of [undefined, 'false']) {
        vi.stubEnv(ENV, v);
        r = await runSetup(rel, true);
        if (r.ok || !/switch is present/.test(r.err ?? '')) problems.push(`${rel} flag ${JSON.stringify(v)}, switch present: ${JSON.stringify(r)}`);
      }
      vi.stubEnv(ENV, 'true');
      r = await runSetup(rel, true);
      if (!r.ok || r.log.filter((x) => x === 'click').length !== 1 || JSON.stringify(r.log.filter((x) => x.startsWith('wait:'))) !== JSON.stringify(['wait:the Protect switch', 'wait:Protect off'])) problems.push(`${rel} flag true, switch present: ${JSON.stringify(r)}`);
      r = await runSetup(rel, false);
      if (r.ok || !/timed out waiting for the Protect switch/.test(r.err ?? '')) problems.push(`${rel} flag true, switch absent: ${JSON.stringify(r)}`);
    }
    // (c) the state lists are unchanged (the full pins stay with restraint.matrix and fees.browser).
    if ((STATES as { id: string; setup?: string }[]).find((s) => s.id === 'S06b')?.setup !== 'protect-off') problems.push('restraint-matrix: S06b is not protect-off');
    if ((APP_STATES as { id: string; setup?: string }[]).find((s) => s.id === 'A05')?.setup !== 'protect-off') problems.push('fee-matrix: A05 is not protect-off');
    // (d) the in-flight validator.
    expect(inflightProblems(GOOD), 'the good probe').toEqual([]);
    expect(inflightProblems({ ...GOOD, inFlight: { ...GOOD.inFlight, switch: { clicked: true, disabled: true, checkedBefore: 'false', checkedAfter: 'false' } } })).toContain('switch: present on a flag-off build');
    expect(inflightProblems({ ...GOOD, received: { ...GOOD.received, bookingProtection: 'premium' } })).toContain('received protection premium');
    expect(inflightProblems({ ...GOOD, inFlight: { ...GOOD.inFlight, optIn: { ...GOOD.inFlight.optIn, checkedAfter: false } } }).join('\n')).toContain('opt-in');
    expect(inflightProblems({ ...GOOD, delayMs: 900 }).join('\n')).toContain('delayMs 900');

    // Planted for (a): an unguarded click, a raw f.switch read and a top-level flag read are each reported.
    const fee = read(SCRIPTS[0]);
    const CLICK = "  if (protectOn) {\n    await page.evaluate(() => document.querySelector('[role=switch][aria-label=\"Exotiq Protect\"]').click());";
    const unguarded = fee.includes(CLICK) ? fee.replace(CLICK, "  {\n    await page.evaluate(() => document.querySelector('[role=switch][aria-label=\"Exotiq Protect\"]').click());") : fee;
    expect(switchGuardProblems('planted', unguarded).join('\n')).toContain('the Protect switch is named outside the flag check');
    expect(switchGuardProblems('planted', `${fee}\nfunction planted(f) {\n  return f.switch.disabled;\n}\n`).join('\n')).toContain('f.switch dereferenced without a null check');
    expect(switchGuardProblems('planted', `const ON = process.env.${ENV} === 'true';\n${fee}`).join('\n')).toContain('the flag is read at module top level');

    expect(problems).toEqual([]);
  });

  it.skipIf(!process.env.MP30_INFLIGHT_JSON)('the recorded flag-off in-flight probe holds every remaining control', () => {
    expect(inflightProblems(JSON.parse(readFileSync(process.env.MP30_INFLIGHT_JSON!, 'utf8')) as Probe)).toEqual([]);
  });
});
