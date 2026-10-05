// MP-16 AC14: the before/after screenshot matrix for the restraint pass.
//
// The definition (STATES, HOVER_STATES, EXTRA_STATES, VIEWPORTS, cellName, allCells) is exported
// with no side effects: tests/restraint/restraint.matrix.test.ts imports it. The capture runs only
// from the command line, against a production build served in mock data mode:
//
//   NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock NEXT_PUBLIC_MARKETPLACE_BROWSE=on NEXT_PUBLIC_RENTER_CAPTURE=on \
//     npx next build && npx next start -p 3055
//   node scripts/restraint-matrix.mjs --phase before --base http://localhost:3055 --evidence <dir> [--ref <sha>]
//   node scripts/restraint-matrix.mjs --phase after  --base http://localhost:3056 --evidence <dir> [--ref <sha>]
//
// Writes <dir>/screens/<phase>/<state>__<viewport>.png, <dir>/screens/<phase>/_run.json, the
// consent-link probe <dir>/privacy-link-<phase>.json and, on the after phase, the manifest
// <dir>/AC14-screenshot-matrix.json and <dir>/AC13-privacy-link.json. Capture both phases on the
// same day: the calendar and the date filters are relative to today.
//
// No repo dependency: playwright-core is resolved at run time from PLAYWRIGHT_CORE (default: the
// shop's capture toolbox) and drives the installed Chrome. The cookie row is seeded as answered
// (both off) so it renders and is never clicked; DOM clicks keep the mouse still, so no hover
// leaks into a resting cell.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const VIEWPORTS = {
  mobile: { width: 390, height: 844, touch: true },
  desktop: { width: 1280, height: 900, touch: false },
};

const VEH = '/desert-exotic-rentals/mclaren-750s-spider';
const BOOK = `${VEH}/book?start={start}&end={end}`;

/** The spec's 15 states, captured at both viewports. `steps` advances the booking flow; `setup` stages a state. */
export const STATES = [
  { id: 'S01', label: 'storefront', route: '/desert-exotic-rentals' },
  { id: 'S02', label: 'storefront filtered (selected chip, status line)', route: '/desert-exotic-rentals?make=Ferrari&start={start}&end={end}' },
  { id: 'S03', label: 'vehicle page', route: VEH },
  { id: 'S04', label: 'flow: Dates', route: BOOK },
  { id: 'S05', label: 'flow: Driver', route: BOOK, steps: 1 },
  { id: 'S05b', label: 'flow: Driver, invalid date of birth (danger border and error text)', route: BOOK, steps: 1, setup: 'dob-invalid', reveal: '#dob-error' },
  { id: 'S06', label: 'flow: Review, Protect on', route: BOOK, steps: 2 },
  { id: 'S06b', label: 'flow: Review, Protect off', route: BOOK, steps: 2, setup: 'protect-off' },
  { id: 'S07', label: 'flow: Pay', route: BOOK, steps: 3 },
  { id: 'S08', label: 'confirmation', route: '/booking/BK-100001' },
  { id: 'S09', label: 'browse, filtered', route: '/browse?make=Ferrari' },
  { id: 'S10', label: 'browse, empty', route: '/browse?make=Nonexistent' },
  { id: 'S11', label: 'saved, empty', route: '/saved' },
  { id: 'S12', label: 'not found', route: '/does-not-exist' },
  { id: 'S13', label: 'share card', route: '/share/desert-exotic-rentals/mclaren-750s-spider' },
];

/** Desktop-only pointer states. */
export const HOVER_STATES = [
  { id: 'S14', label: 'card hover (line2 border, neutral shadow, lift)', route: '/desert-exotic-rentals', setup: 'hover-card', viewports: ['desktop'] },
  { id: 'S15', label: 'Book CTA hovered then pressed (lightened, then compressed)', route: VEH, setup: 'press-cta', viewports: ['desktop'] },
];

/**
 * Plan LD8: states mock mode cannot reach from the spec's routes. Mock bookings carry no live
 * payment, so ReturnNotice needs its query; the identity card reaches verified after a click;
 * and an under-age date of birth (the danger banner) cannot share a frame with S05b's invalid
 * date, because an invalid date clears the birth date the banner reads.
 */
export const EXTRA_STATES = [
  { id: 'X1', label: 'confirmation after a cancelled payment (ReturnNotice, warn)', route: '/booking/BK-100001?payment=cancelled' },
  { id: 'X2', label: 'confirmation after a completed payment (ReturnNotice, good)', route: '/booking/BK-100001?payment=success' },
  { id: 'X3', label: 'confirmation, identity verified', route: '/booking/BK-100001', setup: 'verify-identity' },
  { id: 'X4', label: 'flow: Driver, under-age date of birth (danger banner)', route: BOOK, steps: 1, setup: 'dob-under-age', reveal: '[data-under-age]' },
];

export const cellName = (state, viewport) => `${state}__${viewport}`;

/** Every cell: [state x viewport], spec states first, then hover, then extras. */
export function allCells() {
  const out = [];
  for (const s of [...STATES, ...HOVER_STATES, ...EXTRA_STATES]) {
    for (const viewport of s.viewports ?? Object.keys(VIEWPORTS)) out.push({ state: s.id, viewport, route: s.route, label: s.label });
  }
  return out;
}

// ---- capture (CLI only) ----------------------------------------------------------------------

const SEED = `try { localStorage.setItem('exotiq_tracking_consent_v1', JSON.stringify({ version: 1, analytics: false, marketing: false, at: Date.now() - 60000 })); } catch {}`;
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDay = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(1800); // one-shot entrance animations (page-in, sheen, reserve pop) finish
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
async function waitFor(page, predicate, arg, what, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(predicate, arg)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** MP-15's step model: Continue x2, then the terms box and Proceed to payment. */
async function advance(page, steps) {
  for (let s = 1; s <= steps; s++) {
    const prev = await h1Text(page);
    if (s === 3) {
      await waitFor(page, () => Boolean(document.querySelector('input.control-check')), null, 'the terms checkbox');
      await page.evaluate(() => document.querySelector('input.control-check').click());
      await sleep(200);
      await waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Proceed to payment' && !b.disabled), null, 'Proceed to payment');
      await clickText(page, 'Proceed to payment');
    } else {
      await waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Continue' && !b.disabled && b.offsetParent !== null), null, 'Continue');
      await clickText(page, 'Continue');
    }
    await waitFor(page, (p) => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).join('|') !== p, prev, `step ${s}`);
    await sleep(400);
  }
}

async function typeDob(page, digits) {
  const dob = page.locator('input[autocomplete="bday"]');
  await dob.click();
  await dob.pressSequentially(digits, { delay: 20 });
  await sleep(300);
}

/** Stage a state; returns an optional pointer action to run after settling. */
async function setup(page, name) {
  if (name === 'dob-invalid') await typeDob(page, '13452020');
  if (name === 'dob-under-age') {
    await typeDob(page, '01012015');
    // Tag the banner (the one paragraph naming the age rule) so `reveal` can scroll it into view.
    await waitFor(page, () => [...document.querySelectorAll('p')].some((p) => /requires drivers to be \d+\+/.test(p.textContent)), null, 'the under-age banner');
    await page.evaluate(() => [...document.querySelectorAll('p')].find((p) => /requires drivers to be \d+\+/.test(p.textContent)).setAttribute('data-under-age', ''));
  }
  if (name === 'protect-off') {
    await waitFor(page, () => Boolean(document.querySelector('[role=switch][aria-label="Exotiq Protect"]')), null, 'the Protect switch');
    await page.evaluate(() => document.querySelector('[role=switch][aria-label="Exotiq Protect"]').click());
    await waitFor(page, () => document.querySelector('[role=switch][aria-label="Exotiq Protect"]')?.getAttribute('aria-checked') === 'false', null, 'Protect off');
    await sleep(800);
  }
  if (name === 'verify-identity') {
    await waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Verify identity'), null, 'Verify identity');
    await clickText(page, 'Verify identity');
    await waitFor(page, () => document.body.innerText.includes('Identity verified'), null, 'the verified card', 100);
    await sleep(500);
  }
}

async function captureCell(browser, cell, state, phase, dirs, dates) {
  const vp = VIEWPORTS[cell.viewport];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.touch,
    hasTouch: vp.touch,
    ...(vp.touch ? { userAgent: MOBILE_UA } : {}),
  });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  const url = dirs.base + state.route.replace('{start}', dates.start).replace('{end}', dates.end);
  const res = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const status = res ? res.status() : 0;
  if (status !== 200 && !(state.id === 'S12' && status === 404)) throw new Error(`${cell.state} ${url}: HTTP ${status}`);
  await page.evaluate(async () => { await document.fonts.ready; });
  await sleep(600);
  if (state.steps) await advance(page, state.steps);
  if (state.setup && !['hover-card', 'press-cta'].includes(state.setup)) await setup(page, state.setup);
  await settle(page);
  if (state.reveal) {
    await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), state.reveal);
    await sleep(300);
  }
  const file = path.join(dirs.screens, `${cellName(cell.state, cell.viewport)}.png`);
  if (state.setup === 'hover-card') {
    await page.locator('a[href^="/desert-exotic-rentals/"]').first().hover();
    await sleep(500);
  }
  if (state.setup === 'press-cta') {
    const cta = page.locator('aside a[href$="/book"]').first();
    await cta.hover();
    await sleep(500);
    await page.screenshot({ path: path.join(dirs.screens, `${cellName(cell.state, cell.viewport)}-hover-only.png`), animations: 'disabled', caret: 'hide' });
    await page.mouse.down();
    await sleep(300);
  }
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  await ctx.close(); // never releases the pressed CTA: no navigation
  return { file, bytes: fs.statSync(file).size, url: url.replace(dirs.base, ''), status };
}

/** The consent dialog on /privacy, opened: its gold "Privacy notice" link must keep its colour (LD4). */
async function privacyProbe(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  await page.goto(`${base}/privacy`, { waitUntil: 'load', timeout: 60000 });
  await settle(page);
  await page.evaluate(() => [...document.querySelectorAll('[data-cookie-controls] button')].find((b) => b.textContent.trim() === 'Privacy preferences').click());
  await waitFor(page, () => { const d = document.querySelector('[data-cookie-controls] [role=dialog]'); return Boolean(d) && getComputedStyle(d).visibility === 'visible'; }, null, 'the consent dialog');
  await sleep(400);
  const probe = await page.evaluate(() => {
    const color = (el) => (el ? getComputedStyle(el).color : null);
    const consent = [...document.querySelectorAll('[data-cookie-controls] a')].find((a) => a.textContent.trim() === 'Privacy notice');
    const prose = [...document.querySelectorAll('article a')].find((a) => !a.closest('[data-cookie-controls]'));
    const h2 = document.querySelector('article h2');
    return {
      consentLink: { text: consent?.textContent.trim() ?? null, color: color(consent), decoration: consent ? getComputedStyle(consent).textDecorationColor : null },
      proseLink: { text: prose?.textContent.trim() ?? null, color: color(prose), decoration: prose ? getComputedStyle(prose).textDecorationColor : null },
      h2: { text: h2?.textContent.trim() ?? null, color: color(h2) },
    };
  });
  await ctx.close();
  return probe;
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const phase = arg('--phase');
  const base = arg('--base', 'http://localhost:3055');
  const evidence = arg('--evidence');
  const ref = arg('--ref', '');
  const only = arg('--only');
  if (!['before', 'after'].includes(phase) || !evidence) {
    console.error('usage: node scripts/restraint-matrix.mjs --phase before|after --base <url> --evidence <dir> [--ref <sha>] [--only S01,S02]');
    process.exit(2);
  }
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? '/Users/g.r./Documents/EXOTIQ/Claude/zomedia-capture/node_modules/playwright-core');
  const screens = path.join(evidence, 'screens', phase);
  fs.mkdirSync(screens, { recursive: true });
  const dates = { start: isoDay(7), end: isoDay(10) };
  const byId = Object.fromEntries([...STATES, ...HOVER_STATES, ...EXTRA_STATES].map((s) => [s.id, s]));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const run = { phase, base, ref, dates, captured: new Date().toISOString(), cells: [] };
  try {
    for (const cell of allCells()) {
      if (only && !only.split(',').includes(cell.state)) continue;
      const r = await captureCell(browser, cell, byId[cell.state], phase, { base, screens }, dates);
      run.cells.push({ cell: cellName(cell.state, cell.viewport), url: r.url, status: r.status, bytes: r.bytes });
      console.log(`${phase} ${cellName(cell.state, cell.viewport)} ${r.bytes}B ${r.url}`);
    }
    const probe = await privacyProbe(browser, base);
    fs.writeFileSync(path.join(evidence, `privacy-link-${phase}.json`), JSON.stringify({ phase, base, ref, ...probe }, null, 1));
    console.log(`${phase} privacy probe ${JSON.stringify(probe)}`);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(screens, '_run.json'), JSON.stringify(run, null, 1));

  if (phase === 'after') {
    const beforeRun = JSON.parse(fs.readFileSync(path.join(evidence, 'screens', 'before', '_run.json'), 'utf8'));
    const cells = allCells().map((c) => {
      const name = `${cellName(c.state, c.viewport)}.png`;
      const rel = { before: `screens/before/${name}`, after: `screens/after/${name}` };
      const abs = { before: path.join(evidence, rel.before), after: path.join(evidence, rel.after) };
      for (const p of Object.values(abs)) if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
      const sha = { before: sha256(abs.before), after: sha256(abs.after) };
      return { state: c.state, viewport: c.viewport, label: c.label, route: c.route, before: rel.before, after: rel.after, bytes: { before: fs.statSync(abs.before).size, after: fs.statSync(abs.after).size }, sha256: sha, differs: sha.before !== sha.after };
    });
    const manifest = {
      spec: 'MP-16 AC14 screenshot matrix (15 states x 2 viewports + 2 desktop hover states = 32 spec cells; LD8 extras X1-X4 at both viewports)',
      before: { base: beforeRun.base, ref: beforeRun.ref, captured: beforeRun.captured, dates: beforeRun.dates },
      after: { base, ref, captured: run.captured, dates },
      viewports: VIEWPORTS,
      summary: { cells: cells.length, differ: cells.filter((c) => c.differs).length, identical: cells.filter((c) => !c.differs).map((c) => cellName(c.state, c.viewport)) },
      cells,
    };
    fs.writeFileSync(path.join(evidence, 'AC14-screenshot-matrix.json'), JSON.stringify(manifest, null, 1));
    const before = JSON.parse(fs.readFileSync(path.join(evidence, 'privacy-link-before.json'), 'utf8'));
    const after = JSON.parse(fs.readFileSync(path.join(evidence, 'privacy-link-after.json'), 'utf8'));
    fs.writeFileSync(path.join(evidence, 'AC13-privacy-link.json'), JSON.stringify({
      claim: 'The consent dialog opened on /privacy keeps its gold "Privacy notice" link (frozen analytics zone, LD4) while the LegalPage prose links turn ink.',
      before: { consentLink: before.consentLink, proseLink: before.proseLink, h2: before.h2 },
      after: { consentLink: after.consentLink, proseLink: after.proseLink, h2: after.h2 },
      consentLinkUnchanged: before.consentLink.color === after.consentLink.color && before.consentLink.color === 'rgb(200, 166, 100)',
      proseLinkNowInk: after.proseLink.color === 'rgb(240, 242, 245)',
    }, null, 1));
    console.log(`manifest: ${manifest.summary.cells} cells, ${manifest.summary.differ} differ`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
