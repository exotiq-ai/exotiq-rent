// MP-26 AC11: the commit path end to end in live (supabase) data mode against a stub backend. The
// verify lane stands up a throwaway stub of the RPCs (public_team_by_slug, public_vehicle_by_slug,
// public_vehicle_availability, public_vehicle_quote, public_booking_by_ref) and the
// rent-create-booking function, builds the app with NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=supabase
// pointed at it, drives a browser through it, and writes .autodev/evidence/MP-26/AC11-live-stub-run.json.
// This file fixes that log's schema and validates it: on planted logs in every run, and on the real
// log when MP26_EVIDENCE_DIR is set (run it only once the log exists: a missing log fails, by design).
//
// Schema (all times relative milliseconds from the run's start):
//   { app, stub, captured, runs: [Run, Run] }
//   Run = { name: 'happy' | 'quote-failure', entries: Entry[], snapshots: Snapshot[], finalPath?: string }
//   Entry = { t, kind: 'rpc' | 'function' | 'nav' | 'ui', name, body?, status? }
//     rpc:      name = the RPC (e.g. 'public_vehicle_quote'), body = the JSON request body, status = HTTP status returned
//     function: name = 'rent-create-booking', body, status
//     nav:      name = 'step:1' | 'step:2' | 'step:3' when the flow shows that step (read from its eyebrow), or 'path:<pathname+search>' on navigation
//     ui:       name = 'tick:terms' | 'toggle:protect' | 'dblclick:request' | 'click:retry'
//   Snapshot = { t, label, step, buttonLabel, buttonInert, figuresShown, protectRow, tryAgain }
//     happy labels:         'step3-quote-in-flight', 'step3-ready-terms-unticked', 'terms-ticked', 'after-toggle-in-flight', 'after-toggle-ready'
//     quote-failure labels: 'quote-failed', 'retry-recovered'
//   finalPath: the browser's final path with the token redacted, e.g. '/booking/BK-03460?t=REDACTED'
//
// AC21 (driver ruling on review S1, plus the ruling that the chrome Back freezes too): one more run
// against the same stub, with rent-create-booking answering after delayMs, writes
// .autodev/evidence/MP-26/AC21-inflight-probe.json (scripts/fee-matrix.mjs --phase inflight):
//   { app, stub, captured, delayMs,
//     atSend:   { step, protection: 'premium' | 'decline', consent },        read at the click on "Request this booking"
//     inFlight: { ariaBusy, buttonLabel, step,                                read while rent-create-booking is pending
//                 switch: { clicked, disabled, checkedBefore, checkedAfter },  aria-checked strings
//                 optIn:  { clicked, disabled, checkedBefore, checkedAfter },  booleans
//                 rental: { clicked, enabledButton, stepBefore, stepAfter },
//                 terms: { disabled }, tripFees: { disabled }, chromeBack: { disabled } },
//     received: { bookingProtection, captureConsent } }                     rent-create-booking body.protection, /api/renters/capture body.consent
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const EVIDENCE = process.env.MP26_EVIDENCE_DIR ?? '';
type Entry = { t: number; kind: 'rpc' | 'function' | 'nav' | 'ui'; name: string; body?: unknown; status?: number };
type Snapshot = { t: number; label: string; step: number | null; buttonLabel: string | null; buttonInert: boolean; figuresShown: boolean; protectRow: boolean; tryAgain: boolean };
type Run = { name: string; entries: Entry[]; snapshots: Snapshot[]; finalPath?: string };
type Log = { runs: Run[] };

const QUOTE = 'public_vehicle_quote';
const isQuote = (e: Entry) => e.kind === 'rpc' && e.name === QUOTE;
const indexOf = (r: Run, kind: Entry['kind'], name: string) => r.entries.findIndex((e) => e.kind === kind && e.name === name);
const snap = (r: Run, label: string) => r.snapshots.find((s) => s.label === label);

export function liveLogProblems(log: Log): string[] {
  const p: string[] = [];
  const happy = log.runs?.find((r) => r.name === 'happy');
  const failure = log.runs?.find((r) => r.name === 'quote-failure');
  if (!happy) p.push('no happy run');
  if (!failure) p.push('no quote-failure run');
  for (const r of [happy, failure].filter((x): x is Run => Boolean(x))) {
    const step3 = indexOf(r, 'nav', 'step:3');
    if (step3 < 0) { p.push(`${r.name}: never reached step 3`); continue; }
    const early = r.entries.slice(0, step3).filter(isQuote).length;
    if (early) p.push(`${r.name}: ${early} quote call(s) before step 3`);
    if (indexOf(r, 'nav', 'step:1') < 0 || indexOf(r, 'nav', 'step:2') < 0) p.push(`${r.name}: steps 1 and 2 not logged`);
  }
  if (happy && indexOf(happy, 'nav', 'step:3') >= 0) {
    const r = happy;
    const step3 = indexOf(r, 'nav', 'step:3');
    const toggle = indexOf(r, 'ui', 'toggle:protect');
    const click = indexOf(r, 'ui', 'dblclick:request');
    if (toggle < 0) p.push('happy: Protect never toggled');
    if (click < 0) p.push('happy: the request button never double-clicked');
    const onEntry = r.entries.slice(step3, toggle < 0 ? undefined : toggle).filter(isQuote);
    if (onEntry.length !== 1) p.push(`happy: ${onEntry.length} quote call(s) on entering step 3, expected 1`);
    const s1 = snap(r, 'step3-quote-in-flight');
    if (!s1 || !s1.buttonInert || s1.figuresShown) p.push('happy: the button is not inert with no figures while the first quote is in flight');
    const s2 = snap(r, 'step3-ready-terms-unticked');
    if (!s2 || !s2.buttonInert || !s2.figuresShown) p.push('happy: a ready quote with the terms unticked is not shown with an inert button');
    const s3 = snap(r, 'terms-ticked');
    if (!s3 || s3.buttonInert) p.push('happy: ticking the terms does not enable the button');
    if (toggle >= 0) {
      const afterToggle = r.entries.slice(toggle, click < 0 ? undefined : click).filter(isQuote);
      if (afterToggle.length !== 1) p.push(`happy: ${afterToggle.length} quote call(s) after the Protect toggle, expected 1`);
      else if (!JSON.stringify(afterToggle[0].body ?? {}).includes('"decline"')) p.push('happy: the re-quote does not carry the declined tier');
    }
    const s4 = snap(r, 'after-toggle-in-flight');
    if (!s4 || !s4.buttonInert) p.push('happy: the button is active while the post-toggle quote is in flight');
    const s5 = snap(r, 'after-toggle-ready');
    if (!s5 || s5.protectRow) p.push('happy: a protect row after the decline');
    if (!s5 || !s5.figuresShown || s5.buttonInert) p.push('happy: the re-quoted step is not ready to request');
    if (click >= 0) {
      const creates = r.entries.slice(click).filter((e) => e.kind === 'function' && e.name === 'rent-create-booking');
      if (creates.length !== 1) p.push(`happy: ${creates.length} rent-create-booking POST(s) for one double click, expected 1`);
      const body = (creates[0]?.body ?? {}) as { start_date?: string; end_date?: string; protection?: string; driver?: { name?: string; email?: string; phone?: string } };
      if (creates[0] && (!body.start_date || !body.end_date || body.protection !== 'decline' || !body.driver?.name || !body.driver?.email || !body.driver?.phone)) p.push('happy: the booking body lacks the dates, the driver or the declined tier');
    }
    if (!/^\/booking\/[A-Za-z0-9-]+\?t=REDACTED$/.test(r.finalPath ?? '')) p.push(`happy: final path "${r.finalPath}" is not /booking/<ref>?t=REDACTED`);
  }
  if (failure) {
    const failed = failure.entries.find((e) => isQuote(e) && (e.status ?? 200) >= 400);
    if (!failed) p.push('quote-failure: no failing quote call');
    const f1 = snap(failure, 'quote-failed');
    if (!f1 || !f1.tryAgain || !f1.buttonInert || f1.figuresShown) p.push('quote-failure: no "Try again" with an inert button and no figures');
    const retry = indexOf(failure, 'ui', 'click:retry');
    if (retry < 0 || !failure.entries.slice(retry).some((e) => isQuote(e) && (e.status ?? 200) < 400)) p.push('quote-failure: the retry did not re-quote successfully');
    const f2 = snap(failure, 'retry-recovered');
    if (!f2 || !f2.figuresShown) p.push('quote-failure: the retry did not recover the figures');
  }
  return p;
}

// ---- planted logs --------------------------------------------------------------------------------

const S = (label: string, o: Partial<Snapshot>): Snapshot => ({ t: 0, label, step: 3, buttonLabel: 'Request this booking', buttonInert: true, figuresShown: true, protectRow: true, tryAgain: false, ...o });
function goodLog(): Log {
  const quote = (tier: string, status = 200): Entry => ({ t: 0, kind: 'rpc', name: QUOTE, status, body: { _team_slug: 't', _vehicle_slug: 'v', _start_date: '2026-11-10', _end_date: '2026-11-13', _options: { protection: tier } } });
  const happy: Run = {
    name: 'happy',
    entries: [
      { t: 0, kind: 'rpc', name: 'public_team_by_slug', status: 200 }, { t: 1, kind: 'nav', name: 'step:1' }, { t: 2, kind: 'nav', name: 'step:2' }, { t: 3, kind: 'nav', name: 'step:3' }, quote('premium'),
      { t: 5, kind: 'ui', name: 'tick:terms' }, { t: 6, kind: 'ui', name: 'toggle:protect' }, quote('decline'), { t: 8, kind: 'ui', name: 'dblclick:request' },
      { t: 9, kind: 'function', name: 'rent-create-booking', status: 200, body: { team_slug: 't', vehicle_slug: 'v', start_date: '2026-11-10', end_date: '2026-11-13', pickup_time: '10:00 AM', protection: 'decline', driver: { name: 'A B', email: 'a@b.c', phone: '5555550100' } } },
      { t: 10, kind: 'nav', name: 'path:/booking/BK-03460?t=REDACTED' },
    ],
    snapshots: [S('step3-quote-in-flight', { figuresShown: false, buttonLabel: 'Getting final pricing…' }), S('step3-ready-terms-unticked', {}), S('terms-ticked', { buttonInert: false }), S('after-toggle-in-flight', { figuresShown: false }), S('after-toggle-ready', { buttonInert: false, protectRow: false })],
    finalPath: '/booking/BK-03460?t=REDACTED',
  };
  const failure: Run = {
    name: 'quote-failure',
    entries: [{ t: 0, kind: 'nav', name: 'step:1' }, { t: 1, kind: 'nav', name: 'step:2' }, { t: 2, kind: 'nav', name: 'step:3' }, quote('premium', 500), { t: 4, kind: 'ui', name: 'click:retry' }, quote('premium')],
    snapshots: [S('quote-failed', { tryAgain: true, figuresShown: false }), S('retry-recovered', {})],
  };
  return { runs: [happy, failure] };
}

// ---- AC21: the in-flight probe -------------------------------------------------------------------

type Ctl = { clicked: boolean; disabled: boolean };
export type InflightProbe = {
  app?: string; stub?: string; captured?: string; delayMs: number;
  atSend: { step: number; protection: 'premium' | 'decline'; consent: boolean };
  inFlight: {
    ariaBusy: string | null; buttonLabel: string | null; step: number;
    switch: Ctl & { checkedBefore: string; checkedAfter: string };
    optIn: Ctl & { checkedBefore: boolean; checkedAfter: boolean };
    rental: { clicked: boolean; enabledButton: boolean; stepBefore: number; stepAfter: number };
    terms: { disabled: boolean }; tripFees: { disabled: boolean }; chromeBack: { disabled: boolean };
  };
  received: { bookingProtection: string | null; captureConsent: boolean | null };
};

export function inflightProbeProblems(probe: InflightProbe): string[] {
  void probe;
  return [];
}

function goodInflight(): InflightProbe {
  return {
    app: 'http://127.0.0.1:3057', stub: 'http://127.0.0.1:54321', captured: '2026-10-06T00:00:00.000Z', delayMs: 1500,
    atSend: { step: 3, protection: 'decline', consent: true },
    inFlight: {
      ariaBusy: 'true', buttonLabel: 'Sending request…', step: 3,
      switch: { clicked: true, disabled: true, checkedBefore: 'false', checkedAfter: 'false' },
      optIn: { clicked: true, disabled: true, checkedBefore: true, checkedAfter: true },
      rental: { clicked: true, enabledButton: false, stepBefore: 3, stepAfter: 3 },
      terms: { disabled: false }, tripFees: { disabled: false }, chromeBack: { disabled: true },
    },
    received: { bookingProtection: 'decline', captureConsent: true },
  };
}

describe('MP-26 live-mode commit path (AC11)', () => {
  it('the live-stub run log shows one quote on entering step 3 and exactly one booking request', () => {
    expect(liveLogProblems(goodLog())).toEqual([]);
    const planted = (f: (l: Log) => void) => { const l = goodLog(); f(l); return liveLogProblems(l).join(); };
    const happy = (l: Log) => l.runs[0];
    // A quote before step 3 (burns the anonymous rate limit).
    expect(planted((l) => happy(l).entries.splice(2, 0, { t: 1, kind: 'rpc', name: QUOTE, status: 200 }))).toContain('quote call(s) before step 3');
    // A second rent-create-booking on a double click.
    expect(planted((l) => happy(l).entries.splice(10, 0, { ...happy(l).entries[9] }))).toContain('2 rent-create-booking POST(s)');
    // The button active while the post-toggle quote is in flight.
    expect(planted((l) => { happy(l).snapshots[3].buttonInert = false; })).toContain('active while the post-toggle quote is in flight');
    // A protect row after the decline.
    expect(planted((l) => { happy(l).snapshots[4].protectRow = true; })).toContain('a protect row after the decline');
    // A stub failure with no "Try again".
    expect(planted((l) => { l.runs[1].snapshots[0].tryAgain = false; })).toContain('no "Try again"');
    // A final URL without ?t=.
    expect(planted((l) => { happy(l).finalPath = '/booking/BK-03460'; })).toContain('final path');
    // The re-quote not carrying the new tier, and a booking body without the tier.
    expect(planted((l) => { (happy(l).entries[7].body as { _options: { protection: string } })._options.protection = 'premium'; })).toContain('declined tier');
    expect(planted((l) => { (happy(l).entries[9].body as { protection: string }).protection = 'premium'; })).toContain('lacks the dates, the driver or the declined tier');
    if (EVIDENCE) expect(liveLogProblems(JSON.parse(readFileSync(join(EVIDENCE, 'AC11-live-stub-run.json'), 'utf8')) as Log)).toEqual([]);
  });
});

describe('MP-26 in-flight freeze (AC21)', () => {
  it('the in-flight probe shows frozen controls and an unchanged payload', () => {
    expect(inflightProbeProblems(goodInflight())).toEqual([]);
    const bad = (f: (p: InflightProbe) => void) => { const p = goodInflight(); f(p); return inflightProbeProblems(p).join(); };
    expect(bad((p) => { p.inFlight.switch.checkedAfter = 'true'; p.received.bookingProtection = 'premium'; })).toContain('switch');
    expect(bad((p) => { p.inFlight.optIn.checkedAfter = false; p.received.captureConsent = false; })).toContain('opt-in');
    expect(bad((p) => { p.inFlight.rental.stepAfter = 1; })).toContain('step');
    expect(bad((p) => { p.inFlight.switch.disabled = false; })).toContain('switch');
    expect(bad((p) => { p.inFlight.ariaBusy = null; })).toContain('aria-busy');
    expect(bad((p) => { p.received.bookingProtection = 'premium'; })).toContain('received');
    expect(bad((p) => { p.atSend.protection = 'premium'; p.atSend.consent = false; p.received.bookingProtection = 'premium'; p.received.captureConsent = false; })).toContain('default');
    expect(bad((p) => { p.inFlight.optIn.clicked = false; })).toContain('clicked');
    expect(bad((p) => { p.delayMs = 0; })).toContain('delayMs');
    expect(bad((p) => { p.inFlight.chromeBack.disabled = false; })).toContain('Back');
    expect(bad((p) => { p.inFlight.terms.disabled = true; })).toContain('terms');
    if (EVIDENCE) expect(inflightProbeProblems(JSON.parse(readFileSync(join(EVIDENCE, 'AC21-inflight-probe.json'), 'utf8')) as InflightProbe)).toEqual([]);
  });
});
