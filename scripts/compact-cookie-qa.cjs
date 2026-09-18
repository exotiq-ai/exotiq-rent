/* Compact consent release gate. Public reads only; no booking, lead or payment
 * writes, and no events delivered to providers. Proxies local or deployed pages
 * under the real hostname so the production scope guard is exercised unchanged.
 * PLAYWRIGHT_MODULE=/path/to/playwright-core node scripts/compact-cookie-qa.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ORIGIN = 'https://book.exotiq.rent';
const SOURCE = process.env.QA_LOCAL_ORIGIN || 'http://127.0.0.1:3219';
const OUT = process.env.QA_OUTPUT_DIR || '/Users/gbot/.hermes/previews/exotiq-cookie-release/layout';
const KEY = 'exotiq_tracking_consent_v1';
const results = [];
fs.mkdirSync(OUT, { recursive: true });
const readRpc = /^\/rest\/v1\/rpc\/(public_team_by_slug|public_team_fleet|public_fleet_busy|public_marketplace_teams|public_marketplace_fleet|public_vehicle_by_slug|public_vehicle_availability|public_vehicle_quote|public_booking_by_ref)$/;
const visible = locator => locator.filter({ visible: true });
const details = page => visible(page.getByRole('button', { name: 'Details', exact: true })).first();
const allSwitch = page => visible(page.getByRole('checkbox', { name: /^Optional cookies:/ })).first();

(async () => {
  const browser = process.env.QA_BROWSER === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev', headless: true });
  const contexts = [];
  try {
    async function session({ width = 393, height = 740, choice = null, gpc = false, host = ORIGIN } = {}) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 1024 });
      contexts.push(context);
      const log = { providers: [], writes: [], errors: [] };
      await context.addInitScript(({ KEY, choice, gpc }) => {
        window.__docId = Math.random().toString();
        if (gpc) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });
        if (choice && !sessionStorage.getItem('qa_seeded')) {
          localStorage.setItem(KEY, JSON.stringify({ version: 1, ...choice, at: Date.now() }));
          sessionStorage.setItem('qa_seeded', '1');
        }
      }, { KEY, choice, gpc });
      await context.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (/posthog\.com$|facebook\.net$|facebook\.com$/.test(u.hostname)) {
          log.providers.push(req.url());
          return route.abort();
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && !(/supabase\.co$/.test(u.hostname) && readRpc.test(u.pathname))) {
          log.writes.push(u.pathname); return route.abort();
        }
        if (u.origin === host) {
          let response = await route.fetch({ url: SOURCE + u.pathname + u.search, maxRedirects: 0 });
          // WebKit cannot fulfill a redirect response for Next's background
          // prefetch. Follow the real server redirect for that read only;
          // document navigation keeps its original redirect semantics.
          if (process.env.QA_BROWSER === 'webkit' && response.status() >= 300 && response.status() < 400 && !req.isNavigationRequest()) {
            response = await route.fetch({ url: SOURCE + u.pathname + u.search, maxRedirects: 10 });
          }
          const headers = { ...response.headers() };
          if (headers.location?.startsWith(SOURCE)) headers.location = host + headers.location.slice(SOURCE.length);
          return route.fulfill({ response, headers });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', e => log.errors.push(e.message));
      return { page, context, log, host };
    }
    async function ready(page) {
      await page.waitForLoadState('networkidle');
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).filter(img => img.complete).map(img => img.decode().catch(() => {}))); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
    }
    async function finish(s, name, extra = {}) {
      assert.deepEqual(s.log.writes, [], 'No mutating request attempted');
      assert.deepEqual(s.log.errors, [], 'No client errors');
      results.push({ name, passed: true, ...extra });
      await s.context.unrouteAll({ behavior: 'ignoreErrors' });
      await s.context.close();
    }
    async function bounds(page, locator, label) {
      const b = await locator.boundingBox(), viewport = page.viewportSize();
      assert(b && b.width > 0 && b.y >= 0 && b.x >= -1 && b.y + b.height <= viewport.height + 1 && b.x + b.width <= viewport.width + 1, `${label} visible in viewport: ${JSON.stringify(b)}`);
      const topmost = await locator.evaluate(el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return top === el || el.contains(top); });
      assert(topmost, `${label} not obscured by cookie controls`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
      return b;
    }

    const scrolledPrivacy = await session();
    await scrolledPrivacy.page.goto(ORIGIN + '/privacy'); await ready(scrolledPrivacy.page);
    const manual = scrolledPrivacy.page.getByRole('button', { name: 'Privacy preferences', exact: true });
    await manual.evaluate(el => window.scrollTo(0, scrollY + el.getBoundingClientRect().top - 80));
    await manual.click();
    await scrolledPrivacy.page.getByRole('dialog').waitFor();
    for (const label of ['Close cookie preferences', 'Analytics cookies', 'Advertising cookies']) {
      const control = scrolledPrivacy.page.getByRole(label.startsWith('Close') ? 'button' : 'switch', { name: label, exact: true });
      await bounds(scrolledPrivacy.page, control, `Scrolled privacy: ${label}`);
    }
    await scrolledPrivacy.page.screenshot({ path: path.join(OUT, 'privacy-scrolled-details.png'), animations: 'disabled' });
    await finish(scrolledPrivacy, 'Scrolled privacy: every Details control visible and focus remains on-screen');

    const discovery = await session();
    await discovery.page.goto(ORIGIN + '/exotiq'); await ready(discovery.page);
    const vehiclePath = await discovery.page.locator('a[href^="/exotiq/"]').first().getAttribute('href');
    assert(vehiclePath && !vehiclePath.includes('/book'));
    assert(await details(discovery.page).count(), 'Eligible storefront has compact preference access');
    assert.equal(await discovery.page.getByRole('dialog').count(), 0, 'No automatic dialog');
    assert.deepEqual(discovery.log.providers, [], 'No tracker before consent');
    await finish(discovery, 'Storefront: no top banner, no auto dialog, compact access');

    for (const [width, height] of [[360, 640], [393, 740], [430, 780], [1280, 900]]) {
      const s = await session({ width, height }), p = s.page;
      await p.goto(ORIGIN + vehiclePath); await ready(p);
      const cta = visible(p.getByRole('link', { name: 'Select dates', exact: true })).first();
      const ctaBox = await bounds(p, cta, 'Select dates');
      const rowSwitch = allSwitch(p);
      await rowSwitch.waitFor();
      assert.equal(await rowSwitch.getAttribute('aria-checked'), 'false');
      const switchBox = await bounds(p, rowSwitch, 'Optional cookies');
      assert(switchBox.height >= 44 && switchBox.width >= 44, '44px touch target');
      assert(switchBox.y + switchBox.height <= ctaBox.y + 1, 'Cookie controls sit above CTA');
      assert.equal(await p.locator('body > aside[aria-label="Privacy choices"]').count(), 0, 'No top privacy strip');
      assert.equal(await p.getByRole('dialog').count(), 0);
      assert.deepEqual(s.log.providers, [], 'No preconsent tracking');
      await p.screenshot({ path: path.join(OUT, `vehicle-${width}-collapsed.png`), animations: 'disabled' });
      await details(p).click();
      const card = p.getByRole('dialog'); await card.waitFor();
      assert.equal(await card.getAttribute('aria-modal'), 'false');
      const cardBox = await bounds(p, card, 'Nonmodal cookie details');
      assert(cardBox.height <= 310, 'Preferences stays a compact card, including disclosure');
      await bounds(p, cta, 'CTA with details open');
      const analytics = p.getByRole('switch', { name: 'Analytics cookies', exact: true });
      const ads = p.getByRole('switch', { name: 'Advertising cookies', exact: true });
      assert.equal(await analytics.getAttribute('aria-checked'), 'false');
      assert.equal(await ads.getAttribute('aria-checked'), 'false');
      await p.screenshot({ path: path.join(OUT, `vehicle-${width}-details.png`), animations: 'disabled' });
      await p.keyboard.press('Escape');
      assert.equal(await card.count(), 0);
      assert(await details(p).evaluate(el => document.activeElement === el), 'Escape restores focus');
      await details(p).click();
      await cta.focus();
      assert.equal(await card.count(), 0, 'Leaving nonmodal controls dismisses card');
      await details(p).click();
      await analytics.click();
      await p.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').analytics === true, KEY);
      assert.equal(await ads.getAttribute('aria-checked'), 'false', 'Independent advertising choice');
      await p.keyboard.press('Escape');
      assert(await p.getByText('Custom', { exact: true }).isVisible(), 'Partial grant is labeled Custom');
      await p.screenshot({ path: path.join(OUT, `vehicle-${width}-custom.png`), animations: 'disabled' });
      const oldDoc = await p.evaluate(() => window.__docId);
      await allSwitch(p).click();
      await p.waitForFunction(old => old !== window.__docId, oldDoc);
      await ready(p);
      assert.equal(await allSwitch(p).getAttribute('aria-checked'), 'false', 'Combined toggle revokes custom grant');
      if (width === 393) {
        await allSwitch(p).click();
        assert.equal(await allSwitch(p).getAttribute('aria-checked'), 'true');
        const both = await p.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
        assert.equal(both.analytics, true); assert.equal(both.marketing, true);
        await p.screenshot({ path: path.join(OUT, 'vehicle-393-on.png'), animations: 'disabled' });
      }
      if (width < 1024) {
        const lastCard = p.getByRole('heading', { name: 'How it works', exact: true }).locator('..');
        await lastCard.evaluate(el => {
          for (let n = el.parentElement; n; n = n.parentElement) {
            if (getComputedStyle(n).overflowY === 'auto') { n.scrollTop = n.scrollHeight; break; }
          }
        });
        const last = await lastCard.boundingBox(), controls = await allSwitch(p).boundingBox();
        assert(last.y + last.height <= controls.y, 'Last content card scrolls completely clear of the fixed action area');
      }
      await finish(s, `Vehicle ${width}x${height}: fine-line row, details, keyboard, independent and combined consent`, { cta: ctaBox, details: cardBox });
    }

    const booking = await session({ width: 360, height: 640 });
    const future = new Date(); future.setUTCDate(future.getUTCDate() + 21); const start = future.toISOString().slice(0, 10); future.setUTCDate(future.getUTCDate() + 4); const end = future.toISOString().slice(0, 10);
    await booking.page.goto(`${ORIGIN}${vehiclePath}?start=${start}&end=${end}`); await ready(booking.page);
    const datedCta = visible(booking.page.getByRole('link', { name: 'Book these dates', exact: true })).first();
    await bounds(booking.page, datedCta, 'Selected-date CTA');
    await datedCta.click(); await booking.page.waitForURL(url => url.pathname.endsWith('/book')); await ready(booking.page);
    const next = booking.page.getByRole('button', { name: /Continue/ });
    await bounds(booking.page, next, 'Dates Continue');
    await details(booking.page).click();
    await bounds(booking.page, next, 'Dates Continue with details open');
    await booking.page.keyboard.press('Escape');
    if (await next.isEnabled()) {
      await next.click(); await ready(booking.page);
      await bounds(booking.page, booking.page.getByRole('button', { name: /Continue/ }), 'Driver Continue');
    }
    await booking.page.screenshot({ path: path.join(OUT, 'booking-360.png'), animations: 'disabled' });
    await finish(booking, 'Selected dates and booking steps: CTA remains reachable; no booking submitted');

    for (const target of ['/ark/mclaren-gt', '/privacy', '/booking/BK-QA-NOT-REAL?t=00000000-0000-4000-8000-000000000001', '/exotiq?token=QA_NOT_REAL']) {
      const s = await session(); await s.page.goto(ORIGIN + target); await ready(s.page);
      assert.equal(await s.page.getByRole('switch').count(), 0, 'No automatic consent prompt outside tracking scope');
      assert.equal(await allSwitch(s.page).count(), 0, 'No combined control outside tracking scope');
      assert.equal(await s.page.getByRole('dialog').count(), 0);
      assert.equal(await s.page.locator('body > aside[aria-label="Privacy choices"]').count(), 0);
      assert.deepEqual(s.log.providers, [], 'Outside scope loads no tracking');
      if (target === '/privacy') {
        await visible(s.page.getByRole('button', { name: 'Privacy preferences', exact: true })).first().click();
        await s.page.getByRole('dialog').waitFor();
        await s.page.getByRole('switch', { name: 'Analytics cookies', exact: true }).click();
        assert.deepEqual(s.log.providers, [], 'Manual preference on legal page does not activate SDK');
      }
      await finish(s, `Scope preserved: ${target.split('?')[0]}`);
    }
    const gpc = await session({ gpc: true }); await gpc.page.goto(ORIGIN + vehiclePath); await ready(gpc.page);
    await details(gpc.page).click();
    assert(await gpc.page.getByRole('switch', { name: 'Advertising cookies', exact: true }).isDisabled());
    await gpc.page.keyboard.press('Escape'); await allSwitch(gpc.page).click();
    const gpcChoice = await gpc.page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    assert.equal(gpcChoice.analytics, true); assert.equal(gpcChoice.marketing, false);
    await finish(gpc, 'GPC: combined choice still cannot enable advertising');

    const desktopGpc = await session({ width: 1280, height: 900, gpc: true });
    await desktopGpc.page.goto(ORIGIN + vehiclePath); await ready(desktopGpc.page); await details(desktopGpc.page).click();
    for (const label of ['Close cookie preferences', 'Analytics cookies', 'Advertising cookies']) {
      await bounds(desktopGpc.page, desktopGpc.page.getByRole(label.startsWith('Close') ? 'button' : 'switch', { name: label, exact: true }), `Desktop GPC: ${label}`);
    }
    await desktopGpc.page.screenshot({ path: path.join(OUT, 'desktop-gpc-details.png'), animations: 'disabled' });
    await finish(desktopGpc, 'Desktop GPC: expanded card not clipped by sticky aside');

    const demo = await session({ host: 'https://demo.exotiq.rent' }); await demo.page.goto(demo.host + vehiclePath); await ready(demo.page);
    assert.equal(await demo.page.getByRole('switch').count(), 0); assert.deepEqual(demo.log.providers, []);
    await finish(demo, 'Demo hostname: no automatic prompt or tracking');
    console.log(JSON.stringify({ passed: true, source: SOURCE, browser: process.env.QA_BROWSER || 'chromium', provider_delivery: false, results }, null, 2));
  } finally {
    fs.writeFileSync(path.join(OUT, 'compact-cookie-qa.json'), JSON.stringify({ source: SOURCE, browser: process.env.QA_BROWSER || 'chromium', results }, null, 2));
    for (const c of contexts) await c.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
    await browser.close();
  }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
