// MP-25: the browser probes behind AC1-AC11 and AC13 (evidence .autodev/evidence/MP-25/AC<n>-*.json).
//
// Against a production build in mock data mode, renter capture on, tracking enabled at build time:
//   NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock NEXT_PUBLIC_MARKETPLACE_BROWSE=on NEXT_PUBLIC_RENTER_CAPTURE=on \
//     NEXT_PUBLIC_POSTHOG_KEY=phc_trackingqatest123 npm run build && npx next start -p 3255
//   PLAYWRIGHT_CORE=<path to playwright-core> node scripts/polish-probe.mjs --base http://localhost:3255 \
//     --evidence <dir> [--phase base|after] [--only AC1,AC6] [--ref <base sha>]
//
// No repo dependency: playwright-core is resolved at run time (PLAYWRIGHT_CORE or module resolution) and drives
// the installed Chrome. Gestures are CDP touch sequences (Input.dispatchTouchEvent), and one informational flick
// uses Input.synthesizeScrollGesture; every artifact names the gesture it used. Reduced motion is Playwright's
// emulation; reduced transparency is CDP Emulation.setEmulatedMedia, because Playwright has no option for it.
// The cookie row is seeded as answered (both off) so it renders. Run the same day as the build's base phase:
// the calendar is relative to today.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const VEH = '/desert-exotic-rentals/mclaren-750s-spider';
const SF = '/desert-exotic-rentals';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SEED = `try { localStorage.setItem('exotiq_tracking_consent_v1', JSON.stringify({ version: 1, analytics: false, marketing: false, at: Date.now() - 60000 })); } catch {}`;
// Every animation that starts, from the first paint: the replay and spring checks read this log.
const LOG = `window.__mp25 = { anims: [] }; addEventListener('animationstart', (e) => { const t = e.target; window.__mp25.anims.push({ name: e.animationName, t: Math.round(performance.now()), shell: !!(t.classList && t.classList.contains('overflow-y-auto') && t.classList.contains('min-h-0')), cls: String(t.className || '').slice(0, 90) }); }, true);`;
const P390 = { width: 390, height: 844 };
const P320 = { width: 320, height: 568 };
const DESK = { width: 1440, height: 900 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDay = (o) => {
  const d = new Date();
  d.setDate(d.getDate() + o);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const BOOK = () => `${VEH}/book?start=${isoDay(7)}&end=${isoDay(10)}`;
/** "November 2026" for today's month plus `offset` (the first browsable month is offset 0, the last offset 6). */
const MONTH = (offset) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + offset, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
const monthIndex = (label) => { const d = new Date(`1 ${label}`); return d.getFullYear() * 12 + d.getMonth(); };

const argv = process.argv.slice(2);
const arg = (k, d = '') => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const BASE = arg('base');
const OUT = arg('evidence');
const PHASE = arg('phase', 'after');
const ONLY = arg('only').split(',').filter(Boolean);
const REF = arg('ref');
const usage = 'usage: PLAYWRIGHT_CORE=<path> node scripts/polish-probe.mjs --base <url> --evidence <dir> [--phase base|after] [--only AC1,AC2] [--ref <sha>]';
if (!BASE || !OUT) { console.error(usage); process.exit(2); }
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core')); } catch { console.error(`playwright-core not found (the repo does not depend on it).\n${usage}`); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const write = (name, body) => fs.writeFileSync(path.join(OUT, name), `${JSON.stringify({ phase: PHASE, base: BASE, ref: REF, captured: new Date().toISOString(), ...body }, null, 1)}\n`);
const verdict = (problems) => ({ pass: problems.length === 0, problems });

// ---- browser helpers (the gesture and state helpers were run end to end by the plan lane) -------
async function phone(browser, viewport, { reduce = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await context.addInitScript(SEED);
  await context.addInitScript(LOG);
  const page = await context.newPage();
  return { context, page, cdp: await context.newCDPSession(page) };
}
async function desk(browser, viewport = DESK, { reduce = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await context.addInitScript(SEED);
  await context.addInitScript(LOG);
  const page = await context.newPage();
  return { context, page, cdp: await context.newCDPSession(page) };
}
const frames = (page, n = 2) => page.evaluate((k) => new Promise((r) => { const step = (i) => (i ? requestAnimationFrame(() => step(i - 1)) : r()); step(k); }), n);
/** A CDP touch drag from (x0, y0) by (dx, dy) over ms, one move per 16ms; `mid` runs at half travel, finger still down. */
async function drag(cdp, { x0, y0, dx, dy = 0, ms, mid }) {
  const steps = Math.max(2, Math.round(ms / 16));
  const t0 = Date.now();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let k = 1; k <= steps; k++) {
    const wait = t0 + (ms * k) / steps - Date.now();
    if (wait > 0) await sleep(wait);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * k) / steps, y: y0 + (dy * k) / steps }] });
    if (mid && k === Math.round(steps / 2)) await mid((dx * k) / steps);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return Date.now() - t0;
}
async function tap(cdp, x, y, hold = 50) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(hold);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
/** The calendar's state: month label, chevrons, track offset, rendered months, geometry, overflow, scroll. */
const cal = (page) => page.evaluate(() => {
  const vp = document.querySelector('[data-calendar="viewport"]');
  const track = vp?.firstElementChild;
  const tf = track ? getComputedStyle(track).transform : 'none';
  const shell = document.querySelector('.min-h-0.flex-1.overflow-y-auto');
  const hint = [...document.querySelectorAll('div')].find((d) => d.textContent.startsWith('Tap start, then end'));
  return {
    label: [...document.querySelectorAll('span')].find((s) => /^[A-Z][a-z]+ \d{4}$/.test(s.textContent.trim()))?.textContent.trim(),
    prevDisabled: document.querySelector('[aria-label="Previous month"]')?.disabled ?? null,
    nextDisabled: document.querySelector('[aria-label="Next month"]')?.disabled ?? null,
    tx: tf === 'none' ? 0 : new DOMMatrixReadOnly(tf).m41,
    months: document.querySelectorAll('[data-calendar="month"]').length,
    inert: vp ? vp.querySelectorAll('[inert]').length : 0,
    vp: vp ? vp.getBoundingClientRect().toJSON() : null,
    touchAction: vp ? getComputedStyle(vp).touchAction : null,
    shellOverflowX: shell ? shell.scrollWidth - shell.clientWidth : null,
    docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    shellTop: shell ? shell.scrollTop : null,
    shellScrollable: shell ? shell.scrollHeight - shell.clientHeight : null,
    hintTop: hint ? hint.getBoundingClientRect().top : null,
    selectTop: document.querySelector('select[aria-label="Pickup time"]')?.getBoundingClientRect().top ?? null,
  };
});
/** A touch point inside the grid that nothing else covers (an overlay bar can cover the grid at 320x568). */
const touchPoint = (page, xFrac) => page.evaluate((xf) => {
  const vp = document.querySelector('[data-calendar="viewport"]');
  if (!vp) return null;
  const r = vp.getBoundingClientRect();
  const x = r.left + r.width * xf;
  for (let y = r.top + 8; y < r.bottom - 8; y += 8) { const el = document.elementFromPoint(x, y); if (el && vp.contains(el)) return { x, y, W: r.width }; }
  return null;
}, xFrac);
/** The selection, as the bar states it (dates and day count): what "selects nothing" compares. */
const barText = (page) => page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /^(Continue|Request this booking)/.test(x.textContent.trim()) && x.offsetParent);
  let n = b;
  while (n && !/(^|\s)border-t(\s|$)/.test(n.className)) n = n.parentElement;
  return (n?.innerText ?? '').replace(/\s+/g, ' ');
});
const rest = (page) => page.waitForFunction(() => document.querySelectorAll('[data-calendar="month"]').length <= 1 && getComputedStyle(document.querySelector('[data-calendar="viewport"]')?.firstElementChild ?? document.body).transform === 'none', null, { timeout: 3000 }).catch(() => {});
async function chevron(page, which) {
  await page.evaluate((w) => document.querySelector(`[aria-label="${w} month"]`)?.click(), which);
  await sleep(40);
  await rest(page);
  await sleep(40);
}
async function waitFor(page, predicate, arg, what, tries = 60) {
  for (let i = 0; i < tries; i++) { if (await page.evaluate(predicate, arg)) return; await sleep(100); }
  throw new Error(`timed out waiting for ${what}`);
}
async function clickText(page, text) {
  const ok = await page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t && x.offsetParent !== null && !x.disabled); if (!b) return false; b.click(); return true; }, text);
  if (!ok) throw new Error(`no enabled visible button "${text}"`);
}
const h1Text = (page) => page.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).join('|'));
/** Continue n times (the mock cart pre-fills the Driver form), waiting for each step's heading. */
async function advance(page, n) {
  for (let s = 1; s <= n; s++) {
    const prev = await h1Text(page);
    await waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Continue' && !b.disabled && b.offsetParent !== null), null, 'Continue');
    await clickText(page, 'Continue');
    await waitFor(page, (p) => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).join('|') !== p, prev, `step ${s}`);
    await sleep(450);
  }
}
async function openBook(page) {
  await page.goto(BASE + BOOK(), { waitUntil: 'load' });
  await page.waitForSelector('h1');
  await sleep(700);
}
const animsSince = (page, t0 = 0) => page.evaluate((t) => window.__mp25.anims.filter((a) => a.t >= t), t0);
const now = (page) => page.evaluate(() => Math.round(performance.now()));
/** Computed styles on the ancestors of the first visible cookie row (fixed-capture properties, finding 8: computed, not substrings). */
const cookieAncestors = (page) => page.evaluate(() => {
  const row = [...document.querySelectorAll('[data-cookie-controls]')].find((r) => r.offsetParent !== null);
  if (!row) return null;
  const bad = [];
  for (let n = row.parentElement; n && n !== document.documentElement; n = n.parentElement) {
    const s = getComputedStyle(n);
    const hit = { transform: s.transform !== 'none' ? s.transform : null, filter: s.filter !== 'none' ? s.filter : null, backdrop: s.backdropFilter !== 'none' ? s.backdropFilter : null, perspective: s.perspective !== 'none' ? s.perspective : null, contain: s.contain !== 'none' ? s.contain : null, willChange: s.willChange !== 'auto' ? s.willChange : null };
    if (Object.values(hit).some(Boolean)) bad.push({ el: `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 60)}`, ...hit });
  }
  return bad;
});

/**
 * The scale on a pressed day's disc layer (null when nothing is :active). Pressed with the mouse inside the touch
 * context: headless Chrome never sets :active for a CDP touch hold (measured), while (hover: hover) stays false here,
 * so no hover utility can leak into the reading. Released off the grid, so the press selects nothing.
 */
async function pressScale(page) {
  const d = await page.evaluate(() => { const b = [...document.querySelectorAll('.grid-cols-7 > button.aspect-square')].filter((x) => !x.disabled)[12]; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(d.x, d.y);
  await page.mouse.down();
  await sleep(120);
  const scale = await page.evaluate(() => { const a = document.querySelector('.grid-cols-7 > button.aspect-square:active'); if (!a) return null; const t = getComputedStyle(a, '::before').transform; const m = new DOMMatrixReadOnly(t === 'none' ? undefined : t); return Math.round(Math.hypot(m.a, m.b) * 1000) / 1000; });
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await sleep(200);
  return scale;
}
const durationsMs = (list) => list.split(',').map((t) => parseFloat(t) * (t.trim().endsWith('ms') ? 1 : 1000));

// ---- AC1: the swipe ----------------------------------------------------------------------------
async function ac1(browser) {
  const runs = [];
  const problems = [];
  for (const [name, vp] of [['390x844', P390], ['320x568', P320]]) {
    const { context, page, cdp } = await phone(browser, vp);
    await openBook(page);
    if (!(await page.$('[data-calendar="viewport"]'))) { problems.push(`${name}: no [data-calendar="viewport"] (no pager)`); await context.close(); continue; }
    if ((await cal(page)).touchAction === 'none') problems.push(`${name}: the grid claims touch-action none`);
    const cases = [
      ['60% in 250ms, right to left', 0.8, 0.6, 250, false, 1], ['60% in 250ms, left to right', 0.2, -0.6, 250, false, -1], ['12% in 600ms', 0.8, 0.12, 600, false, 0],
      ['25% flick in 100ms', 0.8, 0.25, 100, false, 1], ['90% in 300ms', 0.95, 0.9, 300, false, 1], ['mostly vertical (dy = 3dx)', 0.8, 0.1, 300, true, 0],
    ];
    const one = async (label, xf, ratio, ms, vertical, want) => {
      const p = await touchPoint(page, xf);
      const before = await cal(page);
      const bar0 = await barText(page);
      let follow = null;
      const elapsed = await drag(cdp, { x0: p.x, y0: p.y, dx: vertical ? -30 : -ratio * p.W, dy: vertical ? -90 : 0, ms, mid: async (fx) => { await frames(page); follow = Math.round(((await cal(page)).tx / fx) * 100) / 100; } });
      await sleep(450);
      await rest(page);
      const after = await cal(page);
      const moved = monthIndex(after.label) - monthIndex(before.label);
      if (moved !== want) problems.push(`${name} ${label}: paged ${moved}, expected ${want}`);
      if (!vertical && want !== 0 && !(follow >= 0.5)) problems.push(`${name} ${label}: the grid followed ${follow} of the finger`);
      if ((await barText(page)) !== bar0) problems.push(`${name} ${label}: the selection changed`);
      if (after.prevDisabled !== (after.label === MONTH(0)) || after.nextDisabled !== (after.label === MONTH(6))) problems.push(`${name} ${label}: chevrons do not match ${after.label}`);
      if (after.shellOverflowX > 0 || after.docOverflowX > 0) problems.push(`${name} ${label}: horizontal overflow ${after.shellOverflowX}/${after.docOverflowX}`);
      if (vertical && before.shellScrollable > 1 && !(after.shellTop > before.shellTop)) problems.push(`${name}: a vertical drag did not scroll the step`);
      runs.push({ viewport: name, label, gesture: 'cdp-touch', elapsed, point: p, before: before.label, after: after.label, follow, overflow: [after.shellOverflowX, after.docOverflowX], scrollTop: [before.shellTop, after.shellTop] });
    };
    for (const c of cases) await one(...c);
    for (let i = 0; i < 7; i++) await chevron(page, 'Previous');
    await one('first month, left to right', 0.2, -0.6, 250, false, 0);
    for (let i = 0; i < 7; i++) await chevron(page, 'Next');
    await one('last month, right to left', 0.8, 0.6, 250, false, 0);
    // Informational: the same 25% flick as a synthesized touch scroll gesture with fling (the spec's risk note).
    for (let i = 0; i < 3; i++) await chevron(page, 'Previous');
    const p = await touchPoint(page, 0.8);
    const b = (await cal(page)).label;
    await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(p.x), y: Math.round(p.y), xDistance: -Math.round(0.25 * p.W), yDistance: 0, speed: Math.round((0.25 * p.W) / 0.1), gestureSourceType: 'touch', preventFling: false }).catch((e) => runs.push({ viewport: name, label: 'synthesized flick', error: String(e) }));
    await sleep(600);
    runs.push({ viewport: name, label: '25% flick, synthesized (informational; xDistance sign as Chrome defines it)', gesture: 'synthesized-scroll', before: b, after: (await cal(page)).label });
    await context.close();
  }
  write('AC1-swipe-probe.json', { criterion: 'AC1', runs, verdict: verdict(problems) });
}

// ---- AC2: six rows, one reachable month, the chevron slide ------------------------------------
async function ac2(browser) {
  const problems = [];
  const out = {};
  for (const [name, vp] of [['390x844', P390], ['320x568', P320]]) {
    const { context, page, cdp } = await phone(browser, vp);
    await openBook(page);
    if (!(await page.$('[data-calendar="viewport"]'))) { problems.push(`${name}: no pager`); await context.close(); continue; }
    for (let i = 0; i < 7; i++) await chevron(page, 'Previous');
    const months = [];
    for (let i = 0; i < 7; i++) {
      const s = await cal(page);
      months.push({ label: s.label, height: s.vp.height, hintTop: s.hintTop, selectTop: s.selectTop, rendered: s.months, inert: s.inert });
      if (i < 6) await chevron(page, 'Next');
    }
    const h0 = months[0];
    for (const m of months) {
      if (Math.abs(m.height - h0.height) > 0.5 || Math.abs(m.hintTop - h0.hintTop) > 0.5 || Math.abs(m.selectTop - h0.selectTop) > 0.5) problems.push(`${name} ${m.label}: grid ${m.height}, hint ${m.hintTop}, select ${m.selectTop} (first month ${h0.height}, ${h0.hintTop}, ${h0.selectTop})`);
      if (m.rendered !== 1) problems.push(`${name} ${m.label}: ${m.rendered} months rendered at rest`);
    }
    // The chevron slide: the track moves, the next month lands within 400ms, the month sliding in is inert meanwhile.
    for (let i = 0; i < 3; i++) await chevron(page, 'Previous');
    const slide = await page.evaluate(async () => {
      const label = () => [...document.querySelectorAll('span')].find((s) => /^[A-Z][a-z]+ \d{4}$/.test(s.textContent.trim()))?.textContent.trim();
      const vpEl = document.querySelector('[data-calendar="viewport"]');
      const before = label();
      const t0 = performance.now();
      document.querySelector('[aria-label="Next month"]').click();
      const samples = [];
      while (performance.now() - t0 < 800) {
        await new Promise((r) => requestAnimationFrame(r));
        const tf = getComputedStyle(vpEl.firstElementChild).transform;
        const s = { t: Math.round(performance.now() - t0), tx: tf === 'none' ? 0 : Math.round(new DOMMatrixReadOnly(tf).m41), label: label(), months: document.querySelectorAll('[data-calendar="month"]').length, inert: vpEl.querySelectorAll('[inert]').length, focusable: [...vpEl.querySelectorAll('button')].filter((b) => !b.closest('[inert]') && !b.disabled).length };
        samples.push(s);
        if (s.label !== before && s.months === 1 && s.tx === 0) break;
      }
      return { before, samples };
    });
    const landed = slide.samples.find((s) => s.label !== slide.before && s.months === 1);
    if (!slide.samples.some((s) => s.tx !== 0)) problems.push(`${name}: the chevron page jumps without a slide`);
    if (!landed || landed.t > 400) problems.push(`${name}: the chevron page lands at ${landed?.t ?? 'never'}ms`);
    if (slide.samples.some((s) => s.months === 2 && s.inert !== 1)) problems.push(`${name}: the month sliding in is not inert`);
    // One month in Tab order and in the accessibility tree.
    const enabled = await page.evaluate(() => [...document.querySelectorAll('.grid-cols-7 > button.aspect-square')].filter((b) => !b.disabled).length);
    await page.focus('[aria-label="Previous month"]').catch(() => {});
    const tabbed = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const a = await page.evaluate(() => (document.activeElement?.closest('[data-calendar="viewport"]') ? document.activeElement.getAttribute('aria-label') : null));
      if (a) tabbed.push(a);
      else if (tabbed.length) break;
    }
    if (tabbed.length !== enabled) problems.push(`${name}: ${tabbed.length} day buttons in Tab order, ${enabled} enabled in the visible month`);
    const ax = await cdp.send('Accessibility.getFullAXTree');
    const axDays = ax.nodes.filter((n) => n.role?.value === 'button' && /\b\d{4}\b/.test(n.name?.value ?? '') && !n.ignored).length;
    const rendered = await page.evaluate(() => document.querySelectorAll('.grid-cols-7 > button.aspect-square').length);
    if (axDays !== rendered) problems.push(`${name}: ${axDays} day buttons in the accessibility tree, ${rendered} in the visible month`);
    out[name] = { months, slide, tabbed: tabbed.length, enabled, axDays, rendered };
    await context.close();
  }
  // A mouse click selects exactly as today (desktop-class context, no touch).
  const { context, page } = await desk(browser, P390);
  await openBook(page);
  const bar0 = await barText(page);
  const target = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-calendar="viewport"] button, .grid-cols-7 button')].filter((x) => !x.disabled)[12]; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: b.getAttribute('aria-label') }; });
  await page.mouse.click(target.x, target.y);
  await sleep(300);
  const clicked = target.name;
  const pressed = await page.evaluate((n) => document.querySelector(`button[aria-label="${n}"]`)?.getAttribute('aria-pressed'), clicked);
  if (pressed !== 'true' || (await barText(page)) === bar0) problems.push(`mouse click on ${clicked}: aria-pressed ${pressed}, the selection did not change`);
  out.mouse = { clicked, pressed };
  await context.close();
  write('AC2-calendar-layout-probe.json', { criterion: 'AC2', ...out, verdict: verdict(problems) });
}

// ---- AC3: only the tapped disc springs -----------------------------------------------------------
async function ac3(browser) {
  const problems = [];
  const { context, page, cdp } = await phone(browser, P390);
  await openBook(page);
  const onLoad = (await animsSince(page)).filter((a) => a.name === 'daySpring');
  if (onLoad.length) problems.push(`the spring played on the first render of a seeded range (${onLoad.length})`);
  const tapDay = async (index) => {
    const d = await page.evaluate((i) => { const b = [...document.querySelectorAll('.grid-cols-7 > button.aspect-square')].filter((x) => !x.disabled && !x.hasAttribute('data-taken'))[i]; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: b.getAttribute('aria-label') }; }, index);
    const t0 = await now(page);
    await tap(cdp, d.x, d.y);
    await sleep(80);
    const timing = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'daySpring').map((a) => ({ duration: a.effect.getComputedTiming().duration, keyframes: a.effect.getKeyframes().map((k) => k.transform) })));
    await sleep(450);
    return { day: d.name, anims: (await animsSince(page, t0)).filter((a) => a.name === 'daySpring'), timing };
  };
  const first = await tapDay(10);
  const second = await tapDay(16);
  for (const [label, t] of [['first tap', first], ['closing tap', second]]) {
    if (t.anims.length !== 1) problems.push(`${label} on ${t.day}: ${t.anims.length} springs`);
    for (const x of t.timing) if (!(x.duration >= 240 && x.duration <= 420)) problems.push(`${label}: spring lasts ${x.duration}ms`);
  }
  const t0 = await now(page);
  await chevron(page, 'Next');
  await chevron(page, 'Previous');
  const paging = (await animsSince(page, t0)).filter((a) => a.name === 'daySpring');
  if (paging.length) problems.push(`the spring played on paging (${paging.length})`);
  write('AC3-spring-probe.json', { criterion: 'AC3', gesture: 'cdp-touch tap', onLoad, first, second, paging, verdict: verdict(problems) });
  await context.close();
}

// ---- AC4: reduced motion -------------------------------------------------------------------------
async function ac4(browser) {
  const problems = [];
  const out = {};
  const { context, page, cdp } = await phone(browser, P390, { reduce: true });
  await openBook(page);
  const longAnims = () => page.evaluate(() => document.getAnimations().map((a) => ({ name: a.animationName ?? a.transitionProperty, duration: a.effect.getComputedTiming().duration })).filter((a) => a.duration > 0.01));
  out.chevron = await page.evaluate(async () => {
    const label = () => [...document.querySelectorAll('span')].find((s) => /^[A-Z][a-z]+ \d{4}$/.test(s.textContent.trim()))?.textContent.trim();
    const before = label();
    document.querySelector('[aria-label="Next month"]').click();
    await new Promise((r) => requestAnimationFrame(r));
    return { before, afterOneFrame: label() };
  });
  if (out.chevron.afterOneFrame === out.chevron.before) problems.push('reduce: a chevron page has not landed one frame after the tap');
  const p = await touchPoint(page, 0.8);
  if (!p) problems.push('no pager: the slide and swipe legs cannot run');
  if (p) {
    await drag(cdp, { x0: p.x, y0: p.y, dx: -0.6 * p.W, ms: 250 });
    out.swipe = await page.evaluate(async () => { await new Promise((r) => requestAnimationFrame(r)); return { tf: getComputedStyle(document.querySelector('[data-calendar="viewport"]').firstElementChild).transform, months: document.querySelectorAll('[data-calendar="month"]').length }; });
    if (out.swipe.tf !== 'none' || out.swipe.months !== 1) problems.push(`reduce: a released swipe is not at rest one frame later (${JSON.stringify(out.swipe)})`);
    out.pressedUnderReduce = await pressScale(page);
    out.afterTap = await longAnims();
  }
  await advance(page, 1);
  out.afterContinue = await longAnims();
  for (const k of ['afterTap', 'afterContinue']) if (out[k]?.length) problems.push(`reduce: ${k} runs ${JSON.stringify(out[k])}`);
  if (out.pressedUnderReduce !== null && out.pressedUnderReduce !== undefined && out.pressedUnderReduce < 1) problems.push(`reduce: the pressed day scales (${out.pressedUnderReduce})`);
  await context.close();
  // The site bar's materialize fade under reduce (when built): its colour transition is 0.01ms.
  const d = await desk(browser, DESK, { reduce: true });
  await d.page.goto(`${BASE}/browse`, { waitUntil: 'load' });
  out.siteBarTransition = await d.page.evaluate(() => getComputedStyle(document.querySelector('header')).transitionDuration);
  if (durationsMs(out.siteBarTransition).some((ms) => ms > 0.01)) problems.push(`reduce: the site bar transitions for ${out.siteBarTransition}`);
  await d.context.close();
  write('AC4-reduced-motion-probe.json', { criterion: 'AC4', emulation: 'playwright reducedMotion=reduce', ...out, verdict: verdict(problems) });
}

// ---- AC5: the step entry --------------------------------------------------------------------------
async function ac5(browser) {
  const problems = [];
  const out = {};
  const { context, page } = await phone(browser, P390);
  await openBook(page);
  const chromeRects = () => page.evaluate(() => {
    const r = (el) => (el ? (({ top, left, height }) => ({ top, left, height }))(el.getBoundingClientRect()) : null);
    const bar = (() => { const b = [...document.querySelectorAll('button')].find((x) => /^(Continue|Request this booking)/.test(x.textContent.trim()) && x.offsetParent); let n = b; while (n && !/(^|\s)border-t(\s|$)/.test(n.className)) n = n.parentElement; return n; })();
    return { bar: r(bar), header: r(document.querySelector('[aria-label="Back"]')?.parentElement), progress: r(document.querySelector('[data-chrome="progress"]')) };
  });
  const entry = async (label, action) => {
    const rect0 = await chromeRects();
    const t0 = await now(page);
    await action();
    const samples = [];
    for (const ms of [0, 60, 140, 240, 360]) {
      await sleep(ms ? 60 : 0);
      samples.push({ ms, rects: await chromeRects(), shell: await page.evaluate(() => { const s = document.querySelector('.min-h-0.flex-1.overflow-y-auto'); const a = s?.getAnimations()[0]; return s ? { pointerEvents: getComputedStyle(s).pointerEvents, inert: s.hasAttribute('inert'), anim: a ? { name: a.animationName, duration: a.effect.getComputedTiming().duration, easing: a.effect.getComputedTiming().easing, keyframes: a.effect.getKeyframes().map((k) => ({ opacity: k.opacity, transform: k.transform })) } : null, fixedInside: [...s.querySelectorAll('*')].filter((e) => getComputedStyle(e).position === 'fixed').length } : null; }) });
    }
    await sleep(400);
    const anims = await animsSince(page, t0);
    const steps = anims.filter((a) => a.name === 'stepIn');
    if (steps.length !== 1 || !steps[0].shell) problems.push(`${label}: ${steps.length} step entries (${JSON.stringify(steps)})`);
    if (anims.some((a) => !a.shell && a.name === 'stepIn')) problems.push(`${label}: something besides ScreenShell entered`);
    const first = samples.find((s) => s.shell?.anim)?.shell.anim;
    if (first) {
      const rise = Number(/translateY\((\d+(?:\.\d+)?)px\)/.exec(first.keyframes[0]?.transform ?? '')?.[1]);
      if (!(first.duration >= 200 && first.duration <= 350) || !(rise >= 4 && rise <= 8) || first.keyframes[0].opacity !== '0') problems.push(`${label}: entry ${JSON.stringify(first)}`);
    }
    for (const s of samples) {
      if (s.shell && (s.shell.pointerEvents === 'none' || s.shell.inert)) problems.push(`${label}: content not interactive at ${s.ms}ms`);
      if (s.shell?.fixedInside) problems.push(`${label}: a fixed element inside the step`);
      for (const k of ['bar', 'header', 'progress']) if (s.rects[k] && samples[0].rects[k] && (Math.abs(s.rects[k].top - samples[0].rects[k].top) > 0.5 || Math.abs(s.rects[k].left - samples[0].rects[k].left) > 0.5)) problems.push(`${label}: the ${k} moved at ${s.ms}ms`);
    }
    out[label] = { rect0, samples, anims };
  };
  await entry('Continue to Driver', () => clickText(page, 'Continue'));
  await sleep(300);
  // No replay while typing in the Driver form.
  let t0 = await now(page);
  await page.locator('input[type="email"]').first().pressSequentially('x', { delay: 30 }).catch(() => {});
  await page.locator('input[type="email"]').first().press('Backspace').catch(() => {});
  if ((await animsSince(page, t0)).some((a) => a.name === 'stepIn')) problems.push('typing in Driver replays the entry');
  await entry('Back to Dates', () => page.evaluate(() => document.querySelector('[aria-label="Back"]').click()));
  await advance(page, 2);
  // No replay on the Protect flip. MP-30 turned Protect off by flag (NEXT_PUBLIC_PROTECT_ENABLED), so in a
  // default build the switch does not render and there is nothing to flip: recorded, never passed silently.
  const hasSwitch = await page.evaluate(() => Boolean(document.querySelector('button[role="switch"][aria-label="Exotiq Protect"]')));
  if (hasSwitch) {
    t0 = await now(page);
    await page.evaluate(() => document.querySelector('button[role="switch"][aria-label="Exotiq Protect"]').click());
    await sleep(500);
    if ((await animsSince(page, t0)).some((a) => a.name === 'stepIn')) problems.push('the Protect flip replays the entry');
    out.protectFlip = 'flipped: no replay checked';
  } else out.protectFlip = 'not rendered: Protect is off by flag in this build (MP-30), so no flip exists; the replay rule is the source-shape proof (ScreenShell unkeyed)';
  await entry("Review's Rental row back to Dates", () => page.evaluate(() => document.querySelector('button[data-money-line="rental"]').click()));
  out.quoteSwap = 'source-shape (tests/polish/polish.motion.test.ts): mock mode never renders the blocked branch (locate finding 6)';
  await context.close();
  write('AC5-step-entry-probe.json', { criterion: 'AC5', ...out, verdict: verdict(problems) });
}

// ---- AC6 and AC7: the glass recipe, reduced transparency, materialize -------------------------
const barStyle = (page) => page.evaluate(() => {
  const h = document.querySelector('header');
  if (!h) return null;
  const s = getComputedStyle(h);
  const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); const p = m ? m[1].split(/[ ,/]+/).filter(Boolean) : []; return p.length === 4 ? Number(p[3]) : p.length === 3 ? 1 : 0; };
  return { bg: s.backgroundColor, bgAlpha: alpha(s.backgroundColor), border: s.borderBottomColor, borderAlpha: alpha(s.borderBottomColor), backdrop: s.backdropFilter, webkitBackdrop: s.webkitBackdropFilter ?? null, height: h.firstElementChild?.getBoundingClientRect().height, transitionProperty: s.transitionProperty, transitionDuration: s.transitionDuration };
});
async function ac6(browser) {
  const problems = [];
  const out = {};
  for (const [name, route, vp] of [['/browse 390', '/browse', P390], ['/browse 1440', '/browse', DESK], ['404 390', '/no-such-page-mp25', P390], ['storefront 1440', SF, DESK]]) {
    const { context, page } = await desk(browser, vp);
    await page.goto(BASE + route, { waitUntil: 'load' });
    await sleep(500);
    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await page.evaluate(() => window.scrollTo(0, 200));
    await sleep(500);
    const frosted = await barStyle(page);
    out[name] = { maxScroll, frosted };
    if (!frosted) { problems.push(`${name}: no site bar`); await context.close(); continue; }
    // A page too short to scroll past 24px shows the bar's top state: clear if materialize is built (AC7 judges it), frosted otherwise.
    const clearAtTop = maxScroll <= 24 && frosted.bgAlpha === 0;
    if (!clearAtTop && (Math.abs(frosted.bgAlpha - 0.9) > 0.021 || !/blur\((1[2-9]|2[0-4])px\)/.test(frosted.backdrop) || Math.abs(frosted.borderAlpha - 0.7) > 0.011)) problems.push(`${name}: frosted bar ${JSON.stringify(frosted)}`);
    // Reduced transparency: CDP emulation, verified by matchMedia before trusting it (finding 9).
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    await sleep(200);
    const emulated = await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches);
    const reduced = await barStyle(page);
    out[name].reducedTransparency = { emulated, reduced };
    // The fallback is the frosted state's: a bar that is clear at the top (materialize, no scroll range) is not glass.
    if (emulated && !clearAtTop && (reduced.bgAlpha !== 1 || reduced.backdrop !== 'none')) problems.push(`${name}: reduced transparency leaves ${JSON.stringify(reduced)}`);
    // The fallback rule as shipped, read from the stylesheets (the leg that runs whether or not emulation works).
    out[name].fallbackRules = await page.evaluate(() => {
      const hits = [];
      for (const sheet of document.styleSheets) { let rules; try { rules = sheet.cssRules; } catch { continue; } for (const r of rules) if (r.conditionText?.includes('prefers-reduced-transparency')) for (const inner of r.cssRules) hits.push(inner.cssText.slice(0, 160)); }
      return hits;
    });
    if (!out[name].fallbackRules.some((t) => t.includes('glass-bar-twin')) || !out[name].fallbackRules.some((t) => /bg-ground/.test(t))) problems.push(`${name}: the shipped CSS lacks the reduced-transparency fallback`);
    // Other glass: every element with a backdrop filter is the bar or an over-photo pill.
    out[name].glass = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).backdropFilter !== 'none').map((e) => `${e.tagName.toLowerCase()} ${String(e.className).slice(0, 70)}`));
    await context.close();
  }
  // Phone booking screens: no glass at all (no bar wears a backdrop filter).
  const { context, page } = await phone(browser, P390);
  await openBook(page);
  for (let s = 0; s < 3; s++) {
    const g = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).backdropFilter !== 'none').length);
    if (g) problems.push(`flow step ${s + 1}: ${g} element(s) with a backdrop filter`);
    if (s < 2) await advance(page, 1);
  }
  // The built CSS as served: both properties (errata 1).
  out.servedCss = await page.evaluate(async () => {
    const texts = await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => fetch(l.href).then((r) => r.text())));
    const all = texts.join('\n');
    return { files: texts.length, webkitTwin: /\.glass-bar-twin\{[^}]*-webkit-backdrop-filter:blur\(\d+px\)/.test(all.replace(/\s+/g, '')), unprefixed: /[;{]backdrop-filter:/.test(all.replace(/\s+/g, '')) };
  });
  if (!out.servedCss.webkitTwin || !out.servedCss.unprefixed) problems.push(`served CSS: ${JSON.stringify(out.servedCss)}`);
  await context.close();
  write('AC6-glass-probe.json', { criterion: 'AC6', ...out, verdict: verdict(problems) });
}
async function ac7(browser) {
  const problems = [];
  const out = {};
  let built = null;
  for (const [name, route, vp] of [['/browse 390', '/browse', P390], ['/browse 1440', '/browse', DESK], ['404 390', '/no-such-page-mp25', P390], ['storefront 1440', SF, DESK]]) {
    const { context, page } = await desk(browser, vp);
    await page.goto(BASE + route, { waitUntil: 'load' });
    await sleep(500);
    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const top = await barStyle(page);
    await page.evaluate(() => window.scrollTo(0, 20));
    await sleep(450);
    const at20 = await barStyle(page);
    await page.evaluate(() => window.scrollTo(0, 120));
    await sleep(450);
    const scrolled = await barStyle(page);
    const isBuilt = top.bgAlpha === 0;
    built = built ?? isBuilt;
    if (isBuilt !== built) problems.push(`${name}: materialize built on some surfaces and not others`);
    if (isBuilt) {
      if (top.borderAlpha !== 0 || top.backdrop !== 'none' || at20.bgAlpha !== 0) problems.push(`${name}: not clear at the top (${JSON.stringify({ top, at20 })})`);
      const d = Math.max(...durationsMs(scrolled.transitionDuration));
      if (!(d >= 150 && d <= 300) || /backdrop|all/.test(scrolled.transitionProperty)) problems.push(`${name}: transition ${scrolled.transitionProperty} ${scrolled.transitionDuration}`);
    } else if (Math.abs(top.bgAlpha - 0.9) > 0.021) problems.push(`${name}: not built and not frosted at the top (${top.bgAlpha})`);
    // A page that cannot scroll past the threshold (the 404 at 390 has no scroll range) only shows the top state.
    if (maxScroll > 24) {
      if (Math.abs(scrolled.bgAlpha - 0.9) > 0.021 || scrolled.backdrop === 'none') problems.push(`${name}: not frosted once scrolled`);
      if (Math.round(scrolled.height) !== 48) problems.push(`${name}: condensed height ${scrolled.height}`);
    }
    if (Math.round(top.height) !== 64 || Math.round(at20.height) !== 64) problems.push(`${name}: resting heights ${top.height}/${at20.height}`);
    out[name] = { maxScroll, scrollChecked: maxScroll > 24, top, at20, scrolled };
    await context.close();
  }
  write('AC7-materialize-probe.json', { criterion: 'AC7', built, ...out, verdict: verdict(problems) });
}

// ---- AC8: overscroll; AC9: the progress ---------------------------------------------------------
async function ac8(browser) {
  const problems = [];
  const out = {};
  const { context, page, cdp } = await phone(browser, P390);
  const read = () => page.evaluate(() => { const s = document.querySelector('.min-h-0.flex-1.overflow-y-auto'); return s ? { overscrollY: getComputedStyle(s).overscrollBehaviorY, docOverscrollY: getComputedStyle(document.documentElement).overscrollBehaviorY, windowScrollY: scrollY } : null; });
  await openBook(page);
  out.dates = await read();
  await advance(page, 1);
  out.driver = await read();
  const p = await page.evaluate(() => { const s = document.querySelector('.min-h-0.flex-1.overflow-y-auto').getBoundingClientRect(); return { x: s.left + s.width / 2, y: s.top + 60 }; });
  await drag(cdp, { x0: p.x, y0: p.y, dx: 0, dy: 220, ms: 250 });
  out.driverPull = await read();
  await advance(page, 1);
  out.review = await read();
  await page.goto(BASE + VEH, { waitUntil: 'load' });
  await sleep(600);
  out.vehicle = await read();
  await page.goto(BASE + SF, { waitUntil: 'load' });
  await sleep(600);
  out.storefront = await read();
  for (const k of ['dates', 'driver', 'review', 'vehicle', 'storefront']) {
    if (out[k]?.overscrollY !== 'contain') problems.push(`${k}: overscroll-behavior-y ${out[k]?.overscrollY}`);
    if (out[k] && out[k].docOverscrollY !== 'auto') problems.push(`${k}: the document's overscroll changed (${out[k].docOverscrollY})`);
  }
  if (out.driverPull?.windowScrollY !== 0) problems.push(`a pull at the top of Driver scrolled the document (${out.driverPull?.windowScrollY})`);
  await context.close();
  write('AC8-overscroll-probe.json', { criterion: 'AC8', gesture: 'cdp-touch pull', ...out, verdict: verdict(problems) });
}
async function ac9(browser) {
  const problems = [];
  const out = {};
  for (const [name, vp] of [['320x568', P320], ['390x844', P390]]) {
    const { context, page } = await phone(browser, vp);
    await openBook(page);
    out[name] = [];
    for (let s = 1; s <= 3; s++) {
      const m = await page.evaluate(() => ({ labels: [...document.querySelectorAll('[data-chrome="progress"] li span')].filter((x) => x.textContent.trim()).map((x) => ({ text: x.innerText, scroll: x.scrollWidth, client: x.clientWidth })), oldName: document.body.innerText.includes('Review & Request') || /REVIEW & REQUEST/.test(document.body.innerText) }));
      out[name].push({ step: s, ...m });
      if (JSON.stringify(m.labels.map((l) => l.text)) !== JSON.stringify(['DATES', 'DRIVER', 'REVIEW'])) problems.push(`${name} step ${s}: the progress reads ${m.labels.map((l) => l.text).join(', ')}`);
      for (const l of m.labels) if (l.scroll > l.client) problems.push(`${name} step ${s}: ${l.text} is truncated (${l.scroll} > ${l.client})`);
      if (m.oldName) problems.push(`${name} step ${s}: "Review & Request" still renders`);
      if (s < 3) await advance(page, 1);
    }
    await context.close();
  }
  write('AC9-progress-probe.json', { criterion: 'AC9', ...out, verdict: verdict(problems) });
}

// ---- AC10, AC11: the nice-to-haves in the calendar ---------------------------------------------
async function ac10(browser) {
  const problems = [];
  const { context, page, cdp } = await phone(browser, P390);
  await openBook(page);
  const built = await page.evaluate(() => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.name === 'washIn'); } catch { return false; } }));
  const onLoad = (await animsSince(page)).filter((a) => a.name === 'washIn');
  const tapAt = async (i) => { const d = await page.evaluate((k) => { const b = [...document.querySelectorAll('.grid-cols-7 > button.aspect-square')].filter((x) => !x.disabled && !x.hasAttribute('data-taken'))[k]; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i); const t0 = await now(page); await tap(cdp, d.x, d.y); await sleep(400); return (await animsSince(page, t0)).filter((a) => a.name === 'washIn'); };
  const firstTap = await tapAt(8);
  const closingTap = await tapAt(14);
  const t0 = await now(page);
  await chevron(page, 'Next');
  await chevron(page, 'Previous');
  const paging = (await animsSince(page, t0)).filter((a) => a.name === 'washIn');
  if (onLoad.length || paging.length || firstTap.length) problems.push(`the wash faded outside the closing tap (load ${onLoad.length}, first tap ${firstTap.length}, paging ${paging.length})`);
  if (built && !closingTap.length) problems.push('built, but the closing tap does not fade the wash');
  write('AC10-wash-probe.json', { criterion: 'AC10', built, onLoad, firstTap, closingTap, paging, verdict: verdict(problems) });
  await context.close();
}
async function ac11(browser) {
  const problems = [];
  const out = {};
  for (const reduce of [false, true]) {
    const { context, page, cdp } = await phone(browser, P390, { reduce });
    await openBook(page);
    const pressed = await pressScale(page);
    const d = await page.evaluate(() => { const b = [...document.querySelectorAll('.grid-cols-7 > button.aspect-square')].filter((x) => !x.disabled)[12]; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, W: (document.querySelector('[data-calendar="viewport"]') ?? b.parentElement).getBoundingClientRect().width }; });
    const bar0 = await barText(page);
    await drag(cdp, { x0: d.x, y0: d.y, dx: -0.6 * d.W, ms: 250 });
    await sleep(500);
    const after = await page.evaluate(() => ({ active: document.querySelectorAll(':active').length }));
    out[reduce ? 'reduce' : 'motion'] = { pressedScale: pressed, afterSwipe: after };
    if (after.active > 0) problems.push(`${reduce ? 'reduce' : 'motion'}: a pressed state remains after a swipe`);
    if ((await barText(page)) !== bar0) problems.push(`${reduce ? 'reduce' : 'motion'}: a swipe that started on a day selected it`);
    await context.close();
  }
  const built = out.motion.pressedScale !== null && out.motion.pressedScale < 1;
  if (built && !(out.motion.pressedScale >= 0.94 && out.motion.pressedScale <= 0.98)) problems.push(`press scale ${out.motion.pressedScale}`);
  if (built && out.reduce.pressedScale !== null && out.reduce.pressedScale < 1) problems.push(`the press scales under reduced motion (${out.reduce.pressedScale})`);
  write('AC11-press-probe.json', { criterion: 'AC11', built, ...out, verdict: verdict(problems) });
}

// ---- AC13: cookie-row ancestors at rest and mid-entry, the Details dialog, the diff scope ------
async function ac13(browser) {
  const problems = [];
  const out = {};
  const { context, page } = await phone(browser, P390);
  await openBook(page);
  out.datesAtRest = await cookieAncestors(page);
  const dialog = async () => {
    const opened = await page.evaluate(() => { const row = [...document.querySelectorAll('[data-cookie-controls]')].find((r) => r.offsetParent !== null); const b = row?.querySelector('button[aria-controls]'); b?.click(); return Boolean(b); });
    await sleep(300);
    const m = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const row = [...document.querySelectorAll('[data-cookie-controls]')].find((r) => r.offsetParent !== null); if (!d || !row) return null; const a = d.getBoundingClientRect(); const b = row.getBoundingClientRect(); return { dialog: a.toJSON(), row: b.toJSON(), vw: innerWidth, vh: innerHeight }; });
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Close cookie preferences')?.click());
    await sleep(200);
    return { opened, ...m };
  };
  out.datesDialog = await dialog();
  await clickText(page, 'Continue');
  await sleep(60);
  out.midEntry = await cookieAncestors(page);
  await sleep(400);
  await advance(page, 1);
  out.reviewDialog = await dialog();
  for (const k of ['datesDialog', 'reviewDialog']) {
    const m = out[k];
    if (!m?.dialog) { problems.push(`${k}: the Details dialog did not open`); continue; }
    if (m.dialog.left < 0 || m.dialog.top < 0 || m.dialog.right > m.vw || m.dialog.bottom > m.vh) problems.push(`${k}: the dialog leaves the viewport ${JSON.stringify(m.dialog)}`);
    if (Math.min(Math.abs(m.dialog.bottom - m.row.top), Math.abs(m.dialog.top - m.row.bottom)) > 24) problems.push(`${k}: the dialog is not anchored to its row`);
  }
  await page.goto(BASE + VEH, { waitUntil: 'load' });
  await sleep(600);
  out.vehicleBar = await cookieAncestors(page);
  await page.goto(BASE + SF, { waitUntil: 'load' });
  await sleep(600);
  out.storefrontBody = await cookieAncestors(page);
  for (const k of ['datesAtRest', 'midEntry', 'vehicleBar', 'storefrontBody']) {
    if (out[k] === null) problems.push(`${k}: no visible cookie row (seed or tracking key missing?)`);
    else if (out[k].length) problems.push(`${k}: ${JSON.stringify(out[k])}`);
  }
  await context.close();
  if (REF) {
    const files = execFileSync('git', ['diff', '--name-only', `${REF}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const allowed = /^(components\/drive-exotiq\/flow\/(DatesStep\.tsx|monthPager\.ts|shared\.tsx|steps\.ts)|components\/drive-exotiq\/VehicleEntryPage\.tsx|app\/\[operatorSlug\]\/page\.tsx|components\/browse\/(tokens\.ts|SiteBar\.tsx)|app\/globals\.css|scripts\/polish-probe\.mjs|tests\/polish\/.+|tests\/fees\/(goldens\.ts|fees\.flow\.test\.ts|fees\.golden\.test\.tsx|golden\/(dates-step\.html|driver-step\.html|base\.json))|tests\/chrome\/chrome\.frame\.test\.tsx|tests\/bars\/.+)$/;
    out.scope = { ref: REF, files, outside: files.filter((f) => !allowed.test(f)) };
    if (out.scope.outside.length) problems.push(`diff outside the allowed set: ${out.scope.outside.join(', ')}`);
  }
  write('AC13-scope-consent.json', { criterion: 'AC13', ...out, verdict: verdict(problems) });
}

const PROBES = { AC1: ac1, AC2: ac2, AC3: ac3, AC4: ac4, AC5: ac5, AC6: ac6, AC7: ac7, AC8: ac8, AC9: ac9, AC10: ac10, AC11: ac11, AC13: ac13 };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const summary = {};
try {
  for (const [id, run] of Object.entries(PROBES)) {
    if (ONLY.length && !ONLY.includes(id)) continue;
    try { await run(browser); summary[id] = 'written'; } catch (e) { summary[id] = `error: ${e.message}`; write(`${id}-probe-error.json`, { criterion: id, error: String(e.stack ?? e) }); }
    console.log(`${PHASE} ${id}: ${summary[id]}`);
  }
} finally {
  await browser.close();
}
