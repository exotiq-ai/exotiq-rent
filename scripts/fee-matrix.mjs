// MP-26 AC20 (and the AC4/AC6 hydrated probes): the fee-breakdown screenshot matrix.
//
// The definition (VIEWPORTS, FIXTURE_IDS, FIXTURE_STATES, APP_STATES, cellName, allCells) is exported
// with no side effects: tests/fees/fees.browser.test.ts imports it. Capture runs only from the
// command line, against production builds served in mock data mode:
//
//   NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock NEXT_PUBLIC_MARKETPLACE_BROWSE=on NEXT_PUBLIC_RENTER_CAPTURE=on \
//     npx next build && npx next start -p 3056            (the branch; the base on :3055)
//   MP26_EVIDENCE_DIR=<dir> MP26_CSS=<concatenated .next/static/css/*.css> \
//     npx vitest run tests/fees/fees.surfaces.test.tsx   (writes <dir>/fixtures/*.html)
//   node scripts/fee-matrix.mjs --phase fixtures --base http://localhost:3056 --evidence <dir>
//   node scripts/fee-matrix.mjs --phase before   --base http://localhost:3055 --evidence <dir> [--ref <sha>]
//   node scripts/fee-matrix.mjs --phase after    --base http://localhost:3056 --evidence <dir> [--ref <sha>]
//   node scripts/fee-matrix.mjs --phase probe    --base http://localhost:3056 --evidence <dir> --surfaces review,mock
//   (verify lane, against the AC11 stub's live-mode build:)
//   node scripts/fee-matrix.mjs --phase probe --base <live app> --evidence <dir> --surfaces payment,paid \
//     --payment-path '/booking/<ref>?t=<token>' --paid-path '/booking/<ref>?t=<token>'
//   (AC21, verify lane, the same stub with rent-create-booking answering after ~1.5 s:)
//   node scripts/fee-matrix.mjs --phase inflight --base <live app> --evidence <dir> [--book-path <path>] [--stub <url>]
//   (build-lane smoke on the mock app, which answers at once: --hold-navigation-ms 1500 aborts the
//   /booking/ document navigation, which keeps the step in flight; delaying it does not, Chrome drops
//   the page as soon as the intercepted navigation starts)
//
// Writes <dir>/screens/<phase>/<state>__<viewport>.png (fixture cells under screens/after), a
// <dir>/screens/<phase>/_run.json per phase, the manifest <dir>/AC20-screenshot-matrix.json after
// the after phase (it needs fixtures and before), and the probe files <dir>/AC4-a11y-probe-390.json
// and <dir>/AC6-hierarchy-probe-390.json (merged per surface, so two probe runs add up). The inflight
// phase writes <dir>/AC21-inflight-probe.json (schema in tests/fees/fees.live.test.ts).
//
// Fixture pages are served from the branch build's own origin (request interception), so their
// links to /_next assets, fonts and images resolve; their frame height is released to the content
// so one screenshot covers the whole step. No repo dependency: playwright-core comes from the
// PLAYWRIGHT_CORE env var (a path to an installed playwright-core) and drives the installed Chrome.
// Capture before and after on the same day: the calendar and booking dates are relative to today.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const VIEWPORTS = {
  320: { width: 320, height: 740, touch: true },
  390: { width: 390, height: 844, touch: true },
  1280: { width: 1280, height: 900, touch: false },
};

export const FIXTURE_IDS = ['FX-T0S0P0', 'FX-T0S0P1', 'FX-T0S1P0', 'FX-T0S1P1', 'FX-T1S0P0', 'FX-T1S0P1', 'FX-T1S1P0', 'FX-T1S1P1'];
const WIDE = ['FX-T1S1P1', 'FX-T0S0P0'];
const SURFACE = { R: 'review', C: 'payment', P: 'paid' };

/** 37 fixture cells: R-, C-, P- for all 8 fixtures at 390, R-FX-T1S1P1-open at 390, and R/C/P x {T1S1P1, T0S0P0} at 320 and 1280. */
export const FIXTURE_STATES = [
  ...['R', 'C', 'P'].flatMap((s) => FIXTURE_IDS.map((fx) => ({ id: `${s}-${fx}`, kind: 'fixture', surface: SURFACE[s], fixture: fx, viewports: WIDE.includes(fx) ? ['320', '390', '1280'] : ['390'] }))),
  { id: 'R-FX-T1S1P1-open', kind: 'fixture', surface: 'review', fixture: 'FX-T1S1P1', open: true, viewports: ['390'] },
];

const VEH = '/desert-exotic-rentals/mclaren-750s-spider';
const BOOK = `${VEH}/book?start={start}&end={end}`;
/** Live-app cells in mock mode, before (base) and after (branch); A07 has no before: the control did not exist. */
export const APP_STATES = [
  { id: 'A01', kind: 'app', label: 'vehicle page, how it works', route: VEH, reveal: 'how-it-works', viewports: ['390', '1280'], phases: ['before', 'after'] },
  { id: 'A02', kind: 'app', label: 'flow: Dates', route: BOOK, viewports: ['390', '1280'], phases: ['before', 'after'] },
  { id: 'A03', kind: 'app', label: 'flow: Driver', route: BOOK, steps: 1, viewports: ['390', '1280'], phases: ['before', 'after'] },
  { id: 'A04', kind: 'app', label: 'flow: Review & Request, Protect ON', route: BOOK, steps: 2, reveal: 'money', viewports: ['390', '1280'], phases: ['before', 'after'] },
  { id: 'A05', kind: 'app', label: 'flow: Review & Request, Protect OFF', route: BOOK, steps: 2, setup: 'protect-off', reveal: 'money', viewports: ['390', '1280'], phases: ['before', 'after'] },
  { id: 'A06', kind: 'app', label: 'confirmation, mock charges block', route: '/booking/BK-100001', reveal: 'charges', viewports: ['390', '1280'], phases: ['before', 'after'] },
  { id: 'A07', kind: 'app', label: 'flow: Review & Request, Trip-fees detail open', route: BOOK, steps: 2, setup: 'open-trip-fees', reveal: 'money', viewports: ['390'], phases: ['after'] },
];

export const cellName = (state, viewport) => `${state}__${viewport}`;

/** Every cell: fixture cells first, then the live-app cells; `phases` says which captures it has. */
export function allCells() {
  const out = [];
  for (const s of FIXTURE_STATES) for (const viewport of s.viewports) out.push({ state: s.id, viewport, kind: 'fixture', surface: s.surface, fixture: s.fixture, open: Boolean(s.open), phases: ['after'] });
  for (const s of APP_STATES) for (const viewport of s.viewports) out.push({ state: s.id, viewport, kind: 'app', route: s.route, label: s.label, phases: s.phases });
  return out;
}

// ---- capture (CLI only) ----------------------------------------------------------------------

const SEED = `try { localStorage.setItem('exotiq_tracking_consent_v1', JSON.stringify({ version: 1, analytics: false, marketing: false, at: Date.now() - 60000 })); } catch {}`;
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDay = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** MP-16's doubled-hairline probe (scripts/restraint-matrix.mjs), copied: pairs under 20px apart, each tagged with its layer. */
const HAIRLINE_PROBE = `(() => {
  const lines = [];
  const layers = new Map();
  const layerOf = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (['absolute', 'fixed', 'sticky'].includes(getComputedStyle(n).position)) {
        if (!layers.has(n)) layers.set(n, layers.size + 1);
        return layers.get(n);
      }
    }
    return 0;
  };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const side = parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderRightWidth) > 0;
    if (side) continue;
    const name = (el.className && typeof el.className === 'string' ? el.className : el.tagName).slice(0, 60);
    const layer = layerOf(el);
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') lines.push({ y: r.top, x0: r.left, x1: r.right, el: name, layer });
    if (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none') lines.push({ y: r.bottom, x0: r.left, x1: r.right, el: name, layer });
  }
  const pairs = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j], gap = Math.abs(a.y - b.y);
    if (gap > 1 && gap < 20 && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0) pairs.push({ gap: Math.round(gap * 10) / 10, y: Math.round(Math.min(a.y, b.y)), a: a.el, b: b.el, sameLayer: a.layer === b.layer });
  }
  return pairs;
})()`;
/** Horizontal overflow: the document, and any element wider than the viewport. */
const OVERFLOW_PROBE = `(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth }))()`;

async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(1500); // one-shot entrance animations finish
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  await sleep(300);
}

async function clickText(page, text) {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t && x.offsetParent !== null && !x.disabled);
    if (!b) return false;
    b.click();
    return true;
  }, text);
  if (!ok) throw new Error(`no enabled visible button "${text}"`);
}
const h1Text = (page) => page.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).join('|'));
async function waitFor(page, predicate, arg, what, tries = 80) {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(predicate, arg)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Continue x n (both the base's four-step flow and the branch's three reach Review with two). */
async function advance(page, steps) {
  for (let s = 1; s <= steps; s++) {
    const prev = await h1Text(page);
    await waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Continue' && !b.disabled && b.offsetParent !== null), null, 'Continue');
    await clickText(page, 'Continue');
    await waitFor(page, (p) => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).join('|') !== p, prev, `step ${s}`);
    await sleep(400);
  }
}

async function setup(page, name) {
  if (name === 'protect-off') {
    // TODO(PROTECT_ENABLED): see domain/booking/protect.ts. This script's env must be the build's.
    if (process.env.NEXT_PUBLIC_PROTECT_ENABLED === 'true') {
      await waitFor(page, () => Boolean(document.querySelector('[role=switch][aria-label="Exotiq Protect"]')), null, 'the Protect switch');
      await page.evaluate(() => document.querySelector('[role=switch][aria-label="Exotiq Protect"]').click());
      await waitFor(page, () => document.querySelector('[role=switch][aria-label="Exotiq Protect"]')?.getAttribute('aria-checked') === 'false', null, 'Protect off');
      await sleep(600);
    } else {
      // Flag off: the state is the default (declined) one, and the switch must not exist.
      await waitFor(page, () => Boolean(document.querySelector('[data-money="card"]')), null, 'the money card');
      if (await page.evaluate(() => Boolean(document.querySelector('[role=switch][aria-label="Exotiq Protect"]')))) {
        throw new Error('protect-off: the Protect switch is present, but NEXT_PUBLIC_PROTECT_ENABLED is not "true" here; run the script with the build\'s flag');
      }
    }
  }
  if (name === 'open-trip-fees') {
    await waitFor(page, () => Boolean(document.querySelector('[data-money="trip-fees-toggle"]')), null, 'the Trip-fees toggle');
    await page.evaluate(() => document.querySelector('[data-money="trip-fees-toggle"]').click());
    await waitFor(page, () => document.querySelector('[data-money="trip-fees-toggle"]')?.getAttribute('aria-expanded') === 'true', null, 'the detail open');
    await sleep(300);
  }
}

/** The element a cell is about, found by text so the same rule works on the base and the branch. */
async function reveal(page, kind) {
  await page.evaluate((k) => {
    const byText = (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === t);
    const target = k === 'how-it-works' ? byText('h2', 'How it works')
      : k === 'charges' ? byText('div', 'Charges')
      : k === 'money' ? (document.querySelector('[data-money="card"]') ?? byText('div', 'Operator')) : null;
    target?.scrollIntoView({ block: 'start' });
  }, kind);
  await sleep(300);
}

/** Phone widths: grow the viewport until the step's inner scroller holds all of its content (the frame is h-dvh). */
async function growToContent(page, vp) {
  for (let i = 0; i < 3; i++) {
    const extra = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('*')].map((e) => (/(auto|scroll)/.test(getComputedStyle(e).overflowY) ? e.scrollHeight - e.clientHeight : 0)), document.documentElement.scrollHeight - innerHeight));
    if (extra < 2) return;
    const height = Math.min(6000, (await page.evaluate(() => innerHeight)) + Math.ceil(extra));
    await page.setViewportSize({ width: vp.width, height });
    await sleep(250);
  }
}

async function newContext(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.touch,
    hasTouch: vp.touch,
    ...(vp.touch ? { userAgent: MOBILE_UA } : {}),
  });
  await ctx.addInitScript(SEED);
  return ctx;
}

async function captureApp(browser, cell, state, dirs, dates) {
  const vp = VIEWPORTS[cell.viewport];
  const ctx = await newContext(browser, vp);
  const page = await ctx.newPage();
  const url = dirs.base + state.route.replace('{start}', dates.start).replace('{end}', dates.end);
  const res = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const status = res ? res.status() : 0;
  if (status !== 200) throw new Error(`${cell.state} ${url}: HTTP ${status}`);
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(600);
  if (state.steps) await advance(page, state.steps);
  // The detail is opened after settling (settle blurs and scrolls, it does not toggle): once only.
  if (state.setup && state.setup !== 'open-trip-fees') await setup(page, state.setup);
  await settle(page);
  if (state.setup === 'open-trip-fees') await setup(page, state.setup);
  if (vp.touch) await growToContent(page, vp);
  else if (state.reveal) await reveal(page, state.reveal);
  if (vp.touch && state.reveal === 'how-it-works') await reveal(page, state.reveal);
  const file = path.join(dirs.screens, `${cellName(cell.state, cell.viewport)}.png`);
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  const hairlinePairs = await page.evaluate(HAIRLINE_PROBE);
  const overflow = await page.evaluate(OVERFLOW_PROBE);
  const cards = await page.evaluate(() => document.querySelectorAll('[data-money="card"]').length);
  await ctx.close();
  return { file, bytes: fs.statSync(file).size, url: url.replace(dirs.base, ''), status, hairlinePairs, overflow, cards };
}

/** The font wrapper class of the running build (next/font variable class), copied into fixture pages. */
async function fontClass(base) {
  try {
    const html = await (await fetch(`${base}/booking/BK-100001`)).text();
    return /class="(__variable_[^"]*)"/.exec(html)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function captureFixture(browser, cell, dirs, font) {
  const vp = VIEWPORTS[cell.viewport];
  const ctx = await newContext(browser, vp);
  const page = await ctx.newPage();
  const name = `${cell.state}.html`;
  const source = path.join(dirs.evidence, 'fixtures', name);
  if (!fs.existsSync(source)) throw new Error(`missing fixture page ${source} (run tests/fees/fees.surfaces.test.tsx with MP26_EVIDENCE_DIR and MP26_CSS)`);
  let html = fs.readFileSync(source, 'utf8');
  if (font) html = html.replace('data-mp26-font=""', `class="${font}"`);
  const url = `${dirs.base}/__mp26__/fixtures/${name}`;
  await page.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(500);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height: Math.min(8000, Math.max(vp.height, height)) });
  await sleep(300);
  const file = path.join(dirs.screens, `${cellName(cell.state, cell.viewport)}.png`);
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  const hairlinePairs = await page.evaluate(HAIRLINE_PROBE);
  const overflow = await page.evaluate(OVERFLOW_PROBE);
  const cards = await page.evaluate(() => document.querySelectorAll('[data-money="card"]').length);
  await ctx.close();
  return { file, bytes: fs.statSync(file).size, url: `/__mp26__/fixtures/${name}`, status: 200, hairlinePairs, overflow, cards };
}

// ---- the hydrated probes (AC4, AC6) ----------------------------------------------------------

/** AC4: the disclosure, driven with a real pointer and keyboard. */
async function disclosureProbe(page) {
  const sel = '[data-money="trip-fees-toggle"]';
  await waitFor(page, (s) => Boolean(document.querySelector(s)), sel, 'the Trip-fees toggle');
  const state = () => page.evaluate((s) => {
    const b = document.querySelector(s);
    const region = document.getElementById(b.getAttribute('aria-controls') ?? '');
    const cs = region ? getComputedStyle(region) : null;
    return {
      expanded: b.getAttribute('aria-expanded'),
      regionHidden: region ? region.hidden : null,
      regionVisible: Boolean(region && cs.display !== 'none' && cs.visibility !== 'hidden' && region.getBoundingClientRect().height > 0),
      focusOnButton: document.activeElement === b,
    };
  }, sel);
  const meta = await page.evaluate((s) => {
    const b = document.querySelector(s);
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { tag: b.tagName.toLowerCase(), role: b.getAttribute('role') ?? (b.tagName === 'BUTTON' ? 'button' : null), type: b.getAttribute('type'), name: b.textContent.trim(), ariaControls: b.getAttribute('aria-controls'), regionExists: Boolean(document.getElementById(b.getAttribute('aria-controls') ?? '')), title: b.hasAttribute('title'), iconHidden: b.querySelector('svg')?.getAttribute('aria-hidden') ?? null, box: { width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 } };
  }, sel);
  await sleep(200);
  const initial = await state();
  await page.locator(sel).click();
  await sleep(150);
  const afterClick = await state();
  await page.keyboard.press('Enter');
  await sleep(150);
  const afterEnter = await state();
  await page.keyboard.press('Space');
  await sleep(150);
  const afterSpace = await state();
  // Tab order: one full cycle of sequential focus, counting how often it lands on the toggle. The walk
  // starts wherever focus navigation stands (a blurred element keeps the starting point) and ends when
  // the first element it reached comes round again; each element gets a stable id for the comparison.
  let hits = 0;
  let presses = 0;
  let first = null;
  for (; presses < 300; presses++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate((s) => {
      const a = document.activeElement;
      if (!a || a === document.body) return { key: 'body', hit: false };
      window.__mp26tab = window.__mp26tab ?? 0;
      if (!a.dataset.mp26tab) a.dataset.mp26tab = String(++window.__mp26tab);
      return { key: a.dataset.mp26tab, hit: a === document.querySelector(s) };
    }, sel);
    if (at.key === 'body') continue;
    if (first === null) first = at.key;
    else if (at.key === first) break;
    if (at.hit) hits++;
  }
  return { ...meta, initial, afterClick, afterEnter, afterSpace, tab: { stops: hits, presses } };
}

/** AC6: computed weight and colour of both group headers against the line labels, and the gap between the groups. */
async function hierarchyProbe(page) {
  await waitFor(page, () => Boolean(document.querySelector('[data-money="card"]')), null, 'the money card');
  return page.evaluate(() => {
    const card = document.querySelector('[data-money="card"]');
    const header = (g) => {
      const label = document.getElementById(g.getAttribute('aria-labelledby') ?? '');
      const name = label?.querySelector('span');
      const cs = name ? getComputedStyle(name) : null;
      return { text: label?.textContent.replace(/\s+/g, ' ').trim() ?? null, weight: cs ? Number(cs.fontWeight) : null, color: cs?.color ?? null };
    };
    const op = card.querySelector('[data-money="group-operator"]');
    const ex = card.querySelector('[data-money="group-exotiq"]');
    const labels = [...card.querySelectorAll('[data-money-line]')]
      .filter((row) => !row.closest('[data-money="trip-fees-detail"]'))
      .map((row) => {
        const label = row.querySelector('button, span') ?? row;
        const leaf = label.querySelector('span') ?? label;
        return { line: row.getAttribute('data-money-line'), text: leaf.textContent.trim().slice(0, 40), weight: Number(getComputedStyle(leaf).fontWeight) };
      });
    const gap = ex.getBoundingClientRect().top - op.getBoundingClientRect().bottom;
    const gold = getComputedStyle(document.documentElement).getPropertyValue('--tone-gold').trim();
    return { operator: header(op), exotiq: header(ex), lineLabels: labels, interGroupGapPx: Math.round(gap * 10) / 10, goldToken: gold };
  });
}

async function probeSurface(browser, base, surface, opts, dates) {
  const vp = VIEWPORTS['390'];
  const ctx = await newContext(browser, vp);
  const page = await ctx.newPage();
  const route = surface === 'review' ? BOOK.replace('{start}', dates.start).replace('{end}', dates.end)
    : surface === 'mock' ? '/booking/BK-100001'
      : surface === 'payment' ? opts.paymentPath : opts.paidPath;
  if (!route) throw new Error(`no path for surface ${surface} (pass --payment-path / --paid-path)`);
  await page.goto(base + route, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(600);
  if (surface === 'review') await advance(page, 2);
  await settle(page);
  const hierarchy = await hierarchyProbe(page);
  const disclosure = await disclosureProbe(page);
  await ctx.close();
  return { route: route.replace(/([?&]t=)[^&]+/, '$1REDACTED'), disclosure, hierarchy };
}

// ---- the AC21 in-flight probe ----------------------------------------------------------------

/**
 * AC21: send the request with non-default choices (Protect declined, the opt-in ticked), then, while
 * rent-create-booking is pending, programmatically click the switch, the opt-in and the Rental row and
 * read every control before and after. The request bodies are read off the wire (page.on('request')).
 */
const INFLIGHT_READ = () => {
  const sw = document.querySelector('[role=switch][aria-label="Exotiq Protect"]');
  const terms = [...document.querySelectorAll('label')].find((l) => l.textContent.replace(/\s+/g, ' ').trim() === 'I agree to the Rental Terms & Conditions.')?.querySelector('input');
  const opt = [...document.querySelectorAll('label input.control-check')].find((i) => i !== terms);
  const rental = document.querySelector('[data-money-line="rental"]');
  const eyebrow = document.querySelector('h1')?.previousElementSibling?.textContent ?? '';
  const cta = [...document.querySelectorAll('button')].find((b) => b.offsetParent !== null && ['Request this booking', 'Sending request…', 'Getting final pricing…'].includes(b.textContent.trim()));
  return {
    step: Number(/Step (\d+)/.exec(eyebrow)?.[1] ?? 0),
    ariaBusy: document.querySelector('[aria-busy]')?.getAttribute('aria-busy') ?? null,
    buttonLabel: cta?.textContent.trim() ?? null,
    switchChecked: sw?.getAttribute('aria-checked') ?? null,
    switchDisabled: Boolean(sw?.disabled),
    optChecked: Boolean(opt?.checked),
    optDisabled: Boolean(opt?.disabled),
    rentalEnabledButton: Boolean(rental && ((rental.tagName === 'BUTTON' && !rental.disabled) || [...rental.querySelectorAll('button')].some((b) => !b.disabled))),
    termsDisabled: Boolean(terms?.disabled),
    tripFeesDisabled: Boolean(document.querySelector('[data-money="trip-fees-toggle"]')?.disabled),
    backDisabled: Boolean(document.querySelector('button[aria-label="Back"]')?.disabled),
  };
};

async function inflightProbe(browser, base, opts, dates) {
  // TODO(PROTECT_ENABLED): see domain/booking/protect.ts. Off: no switch to decline or click, and the request must carry 'decline' anyway.
  const protectOn = process.env.NEXT_PUBLIC_PROTECT_ENABLED === 'true';
  const ctx = await newContext(browser, VIEWPORTS['390']);
  const page = await ctx.newPage();
  const received = { bookingProtection: null, captureConsent: null };
  const timing = { createSent: null, createAnswered: null };
  page.on('request', (req) => {
    if (req.method() !== 'POST') return;
    let body = {};
    try { body = JSON.parse(req.postData() ?? '{}'); } catch { body = {}; }
    if (req.url().includes('/functions/v1/rent-create-booking')) { received.bookingProtection = body.protection ?? null; timing.createSent = Date.now(); }
    if (req.url().includes('/api/renters/capture')) received.captureConsent = typeof body.consent === 'boolean' ? body.consent : null;
  });
  page.on('response', (res) => { if (res.url().includes('/functions/v1/rent-create-booking') && res.request().method() === 'POST') timing.createAnswered = Date.now(); });
  if (opts.holdMs) {
    // Mock-mode smoke only. Chrome discards the current document as soon as an intercepted navigation
    // starts, even while the route handler delays it, so a delayed /booking/ navigation cannot keep the
    // step on screen. Aborting it (net::ERR_ABORTED) leaves the page as it is with reserving still true.
    await page.route('**/booking/**', (route) => (route.request().resourceType() === 'document' ? route.abort('aborted') : route.continue()));
  }
  const route = opts.bookPath ?? BOOK.replace('{start}', dates.start).replace('{end}', dates.end);
  await page.goto(base + route, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(600);
  await advance(page, 2);
  const ready = () => waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Request this booking') && Boolean(document.querySelector('[data-money="card"]')), null, 'the merged step with its card', 150);
  await ready();
  // Non-default choices first, so a dropped or reversed click would show in the payload.
  if (protectOn) {
    await page.evaluate(() => document.querySelector('[role=switch][aria-label="Exotiq Protect"]').click());
    await waitFor(page, () => document.querySelector('[role=switch][aria-label="Exotiq Protect"]')?.getAttribute('aria-checked') === 'false', null, 'Protect declined', 150);
    await ready();
  }
  await page.evaluate(() => {
    const terms = [...document.querySelectorAll('label')].find((l) => l.textContent.replace(/\s+/g, ' ').trim() === 'I agree to the Rental Terms & Conditions.')?.querySelector('input');
    if (terms && !terms.checked) terms.click();
    const opt = [...document.querySelectorAll('label input.control-check')].find((i) => i !== terms);
    if (opt && !opt.checked) opt.click();
  });
  await waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Request this booking' && !b.disabled), null, 'the request button enabled', 150);
  const send = await page.evaluate(INFLIGHT_READ);
  const atSend = { step: send.step, protection: send.switchChecked === 'true' ? 'premium' : 'decline', consent: send.optChecked };
  const clickedAt = Date.now();
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Request this booking').click());
  await waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Sending request…'), null, 'the request in flight', 50);
  const before = await page.evaluate(INFLIGHT_READ);
  const clicked = await page.evaluate((protectOn) => {
    const out = { switch: false, optIn: false, rental: false };
    if (protectOn) {
      const sw = document.querySelector('[role=switch][aria-label="Exotiq Protect"]');
      if (sw) { sw.click(); out.switch = true; }
    }
    const terms = [...document.querySelectorAll('label')].find((l) => l.textContent.replace(/\s+/g, ' ').trim() === 'I agree to the Rental Terms & Conditions.')?.querySelector('input');
    const opt = [...document.querySelectorAll('label input.control-check')].find((i) => i !== terms);
    if (opt) { opt.click(); out.optIn = true; }
    const rental = document.querySelector('[data-money-line="rental"]');
    if (rental) { (rental.tagName === 'BUTTON' ? rental : rental.querySelector('button') ?? rental).click(); out.rental = true; }
    return out;
  }, protectOn);
  await sleep(250);
  const after = await page.evaluate(INFLIGHT_READ);
  // Let the answer and the fire-and-forget capture call land (the mock smoke just waits out its hold).
  if (opts.holdMs) await sleep(Math.max(0, opts.holdMs - (Date.now() - clickedAt)));
  while (Date.now() - clickedAt < (opts.holdMs ?? 0) + 5000 && ((timing.createSent && !timing.createAnswered) || (timing.createSent && received.captureConsent === null))) await sleep(100);
  await ctx.close();
  const measured = timing.createSent && timing.createAnswered;
  return {
    app: base,
    stub: opts.stub ?? null,
    captured: new Date().toISOString(),
    delayMs: measured ? timing.createAnswered - timing.createSent : (opts.holdMs ?? 0),
    delaySource: measured ? 'measured rent-create-booking latency' : opts.holdMs ? `--hold-navigation-ms ${opts.holdMs}: the /booking/ navigation aborted, the step held in flight (mock data mode: no function call, no capture call)` : 'none',
    stillInFlightAfterClicks: after.buttonLabel === 'Sending request…',
    atSend,
    inFlight: {
      ariaBusy: before.ariaBusy,
      buttonLabel: before.buttonLabel,
      step: after.step,
      switch: protectOn ? { clicked: clicked.switch, disabled: before.switchDisabled, checkedBefore: before.switchChecked, checkedAfter: after.switchChecked } : null,
      optIn: { clicked: clicked.optIn, disabled: before.optDisabled, checkedBefore: before.optChecked, checkedAfter: after.optChecked },
      rental: { clicked: clicked.rental, enabledButton: before.rentalEnabledButton, stepBefore: before.step, stepAfter: after.step },
      terms: { disabled: before.termsDisabled },
      tripFees: { disabled: before.tripFeesDisabled },
      chromeBack: { disabled: before.backDisabled },
    },
    received,
  };
}

function mergeProbe(file, surface, entry, meta) {
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { viewport: 390, surfaces: {} };
  prev.surfaces[surface] = { ...entry, ...meta };
  fs.writeFileSync(file, JSON.stringify(prev, null, 1));
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const phase = arg('--phase');
  const base = arg('--base', 'http://localhost:3056');
  const evidence = arg('--evidence');
  const ref = arg('--ref', '');
  const only = arg('--only');
  const usage = 'usage: PLAYWRIGHT_CORE=<path to playwright-core> node scripts/fee-matrix.mjs --phase fixtures|before|after|probe|inflight --base <url> --evidence <dir> [--ref <sha>] [--only A04,R-FX-T1S1P1] [--surfaces review,mock|payment,paid --payment-path <path> --paid-path <path>] [--book-path <path>] [--hold-navigation-ms 1500] [--stub <url>]';
  if (!['fixtures', 'before', 'after', 'probe', 'inflight'].includes(phase) || !evidence) {
    console.error(usage);
    process.exit(2);
  }
  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core'));
  } catch {
    console.error('playwright-core not found (the repo does not depend on it).\n' + usage);
    process.exit(2);
  }
  const dates = { start: isoDay(7), end: isoDay(10) };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    if (phase === 'inflight') {
      const holdMs = arg('--hold-navigation-ms') ? Number(arg('--hold-navigation-ms')) : undefined;
      const r = await inflightProbe(browser, base, { bookPath: arg('--book-path'), holdMs, stub: arg('--stub') }, dates);
      fs.mkdirSync(evidence, { recursive: true });
      fs.writeFileSync(path.join(evidence, 'AC21-inflight-probe.json'), JSON.stringify({ ...r, ref }, null, 1));
      const f = r.inFlight;
      console.log(`inflight: delayMs ${r.delayMs} (${r.delaySource}); at send step ${r.atSend.step}, protection ${r.atSend.protection}, consent ${r.atSend.consent}`);
      console.log(`inflight: aria-busy ${f.ariaBusy}, button "${f.buttonLabel}", still in flight after the clicks: ${r.stillInFlightAfterClicks}`);
      console.log(f.switch ? `inflight: switch disabled ${f.switch.disabled}, aria-checked ${f.switch.checkedBefore} -> ${f.switch.checkedAfter}` : 'inflight: no Protect switch (flag off)');
      console.log(`inflight: opt-in disabled ${f.optIn.disabled}, checked ${f.optIn.checkedBefore} -> ${f.optIn.checkedAfter}`);
      console.log(`inflight: rental enabled button ${f.rental.enabledButton}, step ${f.rental.stepBefore} -> ${f.rental.stepAfter}`);
      console.log(`inflight: terms disabled ${f.terms.disabled}, Trip fees disabled ${f.tripFees.disabled}, chrome Back disabled ${f.chromeBack.disabled}`);
      console.log(`inflight: received protection ${r.received.bookingProtection}, consent ${r.received.captureConsent}`);
      if (f.switch === null && !holdMs && r.received.bookingProtection !== 'decline') {
        console.error(`inflight: flag off, but rent-create-booking received protection ${JSON.stringify(r.received.bookingProtection)} (want "decline")`);
        process.exitCode = 1;
      }
      return;
    }
    if (phase === 'probe') {
      const surfaces = (arg('--surfaces', 'review,mock') ?? '').split(',').filter(Boolean);
      for (const surface of surfaces) {
        const r = await probeSurface(browser, base, surface, { paymentPath: arg('--payment-path'), paidPath: arg('--paid-path') }, dates);
        const meta = { base, ref, captured: new Date().toISOString() };
        mergeProbe(path.join(evidence, 'AC4-a11y-probe-390.json'), surface, { route: r.route, ...r.disclosure }, meta);
        mergeProbe(path.join(evidence, 'AC6-hierarchy-probe-390.json'), surface, { route: r.route, ...r.hierarchy }, meta);
        console.log(`probe ${surface}: expanded ${r.disclosure.initial.expanded}->${r.disclosure.afterClick.expanded}->${r.disclosure.afterEnter.expanded}->${r.disclosure.afterSpace.expanded}, box ${r.disclosure.box.width}x${r.disclosure.box.height}, tab stops ${r.disclosure.tab.stops}; header weights ${r.hierarchy.operator.weight}/${r.hierarchy.exotiq.weight}, gap ${r.hierarchy.interGroupGapPx}px`);
      }
      return;
    }
    const screens = path.join(evidence, 'screens', phase === 'fixtures' ? 'after' : phase);
    fs.mkdirSync(screens, { recursive: true });
    const runFile = path.join(screens, phase === 'fixtures' ? '_fixtures.json' : '_run.json');
    const previous = only && fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, 'utf8')) : null;
    const run = { phase, base, ref, dates, captured: new Date().toISOString(), cells: [] };
    const byId = Object.fromEntries(APP_STATES.map((s) => [s.id, s]));
    const font = phase === 'fixtures' ? await fontClass(base) : null;
    if (phase === 'fixtures') run.fontNote = font ? `fixture pages served from ${base}'s origin with its next/font wrapper class "${font}" and compiled CSS (MP26_CSS); frame height released to the content` : 'system-font fallback: the build at --base did not expose its next/font class';
    for (const cell of allCells()) {
      if (only && !only.split(',').includes(cell.state)) continue;
      if (phase === 'fixtures' ? cell.kind !== 'fixture' : cell.kind !== 'app' || !cell.phases.includes(phase)) continue;
      const r = cell.kind === 'fixture'
        ? await captureFixture(browser, cell, { base, screens, evidence }, font)
        : await captureApp(browser, cell, byId[cell.state], { base, screens }, dates);
      run.cells.push({ cell: cellName(cell.state, cell.viewport), url: r.url, status: r.status, bytes: r.bytes, cards: r.cards, overflow: r.overflow, hairlinePairs: r.hairlinePairs });
      console.log(`${phase} ${cellName(cell.state, cell.viewport)} ${r.bytes}B cards=${r.cards} scrollWidth=${r.overflow.scrollWidth}/${r.overflow.innerWidth} doubled=${r.hairlinePairs.filter((p) => p.sameLayer).length} incidental=${r.hairlinePairs.filter((p) => !p.sameLayer).length}`);
    }
    if (previous) {
      const fresh = new Set(run.cells.map((c) => c.cell));
      run.cells = [...previous.cells.filter((c) => !fresh.has(c.cell)), ...run.cells];
      run.merged = [...(previous.merged ?? []), { only, captured: run.captured, ref }];
      run.captured = previous.captured;
      if (previous.fontNote && !run.fontNote) run.fontNote = previous.fontNote;
    }
    fs.writeFileSync(runFile, JSON.stringify(run, null, 1));
  } finally {
    await browser.close();
  }

  if (phase === 'after') {
    const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
    const beforeRun = read(path.join(evidence, 'screens', 'before', '_run.json'));
    const afterRun = read(path.join(evidence, 'screens', 'after', '_run.json'));
    const fixtureRun = read(path.join(evidence, 'screens', 'after', '_fixtures.json'));
    const find = (r, name) => r.cells.find((x) => x.cell === name);
    const cells = allCells().map((c) => {
      const name = cellName(c.state, c.viewport);
      const rel = { after: `screens/after/${name}.png`, ...(c.phases.includes('before') ? { before: `screens/before/${name}.png` } : {}) };
      const sha = Object.fromEntries(Object.entries(rel).map(([k, v]) => [k, fs.existsSync(path.join(evidence, v)) ? sha256(path.join(evidence, v)) : null]));
      const bytes = Object.fromEntries(Object.entries(rel).map(([k, v]) => [k, fs.existsSync(path.join(evidence, v)) ? fs.statSync(path.join(evidence, v)).size : 0]));
      const a = find(c.kind === 'fixture' ? fixtureRun : afterRun, name);
      const b = c.phases.includes('before') ? find(beforeRun, name) : undefined;
      return { state: c.state, viewport: c.viewport, kind: c.kind, surface: c.surface, fixture: c.fixture, open: c.open, label: c.label, route: c.route, files: rel, bytes, sha256: sha, differs: c.phases.includes('before') ? sha.before !== sha.after : null, cards: { after: a?.cards ?? null, before: b?.cards ?? null }, overflow: { after: a?.overflow ?? null, before: b?.overflow ?? null }, hairlinePairs: { after: a?.hairlinePairs ?? null, before: b?.hairlinePairs ?? null } };
    });
    const fx = cells.filter((c) => c.kind === 'fixture');
    const manifest = {
      spec: 'MP-26 AC20 fee-breakdown screenshot matrix: 37 fixture cells (R-/C-/P- x 8 fixtures at 390, R-FX-T1S1P1-open at 390, R/C/P x FX-T1S1P1 and FX-T0S0P0 at 320 and 1280) and live-app cells A01-A06 at 390 and 1280 before and after, plus A07 at 390 after only',
      before: { base: beforeRun.base, ref: beforeRun.ref, captured: beforeRun.captured, dates: beforeRun.dates },
      after: { base: afterRun.base, ref: afterRun.ref, captured: afterRun.captured, dates: afterRun.dates },
      fixtures: { base: fixtureRun.base, captured: fixtureRun.captured },
      fontNote: fixtureRun.fontNote,
      viewports: VIEWPORTS,
      axes: {
        tax: { withTax: fx.filter((c) => /T1/.test(c.fixture ?? '')).map((c) => cellName(c.state, c.viewport)), taxFree: fx.filter((c) => /T0/.test(c.fixture ?? '')).map((c) => cellName(c.state, c.viewport)) },
        stateFee: { withStateFee: fx.filter((c) => /S1/.test(c.fixture ?? '')).map((c) => cellName(c.state, c.viewport)), noStateFee: fx.filter((c) => /S0/.test(c.fixture ?? '')).map((c) => cellName(c.state, c.viewport)) },
        protect: { on: [...fx.filter((c) => /P1/.test(c.fixture ?? '')).map((c) => cellName(c.state, c.viewport)), 'A04__390', 'A04__1280'], off: [...fx.filter((c) => /P0/.test(c.fixture ?? '')).map((c) => cellName(c.state, c.viewport)), 'A05__390', 'A05__1280'] },
        viewports: [...new Set(cells.map((c) => c.viewport))],
        tripFeesDetail: { closed: cells.filter((c) => !c.open && c.state !== 'A07').map((c) => cellName(c.state, c.viewport)), open: ['R-FX-T1S1P1-open__390', 'A07__390'] },
      },
      summary: {
        cells: cells.length,
        fixtureCells: fx.length,
        appAfterCells: cells.filter((c) => c.kind === 'app').length,
        appBeforeCells: cells.filter((c) => c.files.before).length,
        identicalBeforeAfter: cells.filter((c) => c.differs === false).map((c) => cellName(c.state, c.viewport)),
        overflowAfter: cells.filter((c) => c.overflow.after && c.overflow.after.scrollWidth > c.overflow.after.innerWidth).map((c) => cellName(c.state, c.viewport)),
        doubledHairlinesAfter: cells.filter((c) => c.hairlinePairs.after?.some((p) => p.sameLayer)).map((c) => cellName(c.state, c.viewport)),
        incidentalCrossLayerPairsAfter: cells.filter((c) => c.hairlinePairs.after?.some((p) => !p.sameLayer)).map((c) => cellName(c.state, c.viewport)),
      },
      cells,
    };
    fs.writeFileSync(path.join(evidence, 'AC20-screenshot-matrix.json'), JSON.stringify(manifest, null, 1));
    console.log(`manifest: ${manifest.summary.cells} cells; identical ${manifest.summary.identicalBeforeAfter.length}; overflow ${manifest.summary.overflowAfter.length}; doubled ${manifest.summary.doubledHairlinesAfter.length}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
