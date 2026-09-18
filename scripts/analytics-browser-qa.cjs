/* Browser integration QA against a local build at the production hostname.
 * All analytics endpoints are intercepted: fixture events NEVER reach Meta/PostHog.
 * No production booking/customer/payment write is allowed.
 * Run: PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core node scripts/analytics-browser-qa.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const OUT = process.env.QA_OUTPUT_DIR || '/Users/gbot/.hermes/previews/exotiq-cookie-release/local';
fs.mkdirSync(OUT, { recursive: true });
const ORIGIN = 'https://book.exotiq.rent';
const LOCAL = process.env.QA_LOCAL_ORIGIN || 'http://127.0.0.1:3219';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev';
const CONSENT = 'exotiq_tracking_consent_v1';
const results = [];
const contexts = [];

function decode(request) {
  const events = payload => Array.isArray(payload) ? payload.flatMap(events) : Array.isArray(payload.batch) ? payload.batch : [payload];
  const buffer = request.postDataBuffer();
  if (!buffer) return [];
  let text;
  if (buffer[0] === 31 && buffer[1] === 139) text = zlib.gunzipSync(buffer).toString();
  else text = buffer.toString();
  try { return events(JSON.parse(text)); } catch {}
  const form = new URLSearchParams(text);
  if (form.has('data')) {
    const raw = Buffer.from(form.get('data'), 'base64');
    try { return events(JSON.parse((raw[0] === 31 ? zlib.gunzipSync(raw) : raw).toString())); } catch {}
  }
  throw Error('Could not decode intercepted analytics payload: ' + text.slice(0, 90));
}

(async () => {
  const browser = process.env.QA_BROWSER === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    async function session(choice, gpc = false) {
      // PostHog intentionally suppresses HeadlessChrome. Emulate a real mobile
      // visitor for QA instead of weakening the production bot filter.
      const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
      contexts.push(context);
      const traffic = { ph: [], meta: [], scripts: [], blockedExternalWrites: [], forbiddenWrites: [], errors: [], console: [] };
      await context.addInitScript(({ choice, gpc, CONSENT }) => {
        // PostHog's real bot predicate also reads webdriver; emulate a visitor
        // only inside this intercepted QA context, never in production code.
        Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
        if (gpc) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
        if (choice && !sessionStorage.getItem('qa_seeded')) {
          localStorage.setItem(CONSENT, JSON.stringify({ version: 1, ...choice, at: Date.now() }));
          sessionStorage.setItem('qa_seeded', '1');
        }
        window.__qaDocumentId = Math.random().toString();
        window.__metaCalls = [];
        window.__preferenceWrites = 0;
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === CONSENT && ++window.__preferenceWrites > 10) throw Error('QA stopped consent write-back loop');
          return setItem.call(this, key, value);
        };
      }, { choice, gpc, CONSENT });
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (/posthog\.com$/.test(url.hostname)) {
          traffic.scripts.push(req.url());
          if (req.method() === 'POST' && /\/e\/?$|\/i\/v0\/e\/?$|\/capture\/?$/.test(url.pathname)) {
            try { traffic.ph.push(...decode(req)); } catch (error) { traffic.errors.push(error.message); }
          }
          return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': '*' }, body: JSON.stringify({ status: 1, flags: {}, errorsWhileComputingFlags: false }) });
        }
        if (url.hostname === 'connect.facebook.net') {
          traffic.scripts.push(req.url());
          if (process.env.QA_REAL_META === '1') return route.continue();
          return route.fulfill({ status: 200, contentType: 'application/javascript', body: `(()=>{const f=window.fbq;if(!f)return;f.callMethod=function(){window.__metaCalls.push(Array.from(arguments));};for(const a of f.queue.splice(0))f.callMethod.apply(f,a);})();` });
        }
        if (/facebook\.com$/.test(url.hostname)) {
          if (/^\/tr\/?$/.test(url.pathname)) traffic.meta.push(['trackSingle', url.searchParams.get('id'), url.searchParams.get('ev')]);
          return route.fulfill({ status: 200, body: '' });
        }
        if (/supabase\.co$/.test(url.hostname) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
          // Public data RPC POSTs are read-only; all renter write functions are blocked.
          const readOnlyRpc = /^\/rest\/v1\/rpc\/(public_team_by_slug|public_team_fleet|public_fleet_busy|public_marketplace_teams|public_marketplace_fleet|public_vehicle_by_slug|public_vehicle_availability|public_vehicle_quote|public_booking_by_ref)$/;
          if (!readOnlyRpc.test(url.pathname)) {
            traffic.forbiddenWrites.push(url.pathname);
            return route.abort();
          }
        }
        if (url.origin === ORIGIN) {
          if (!['GET', 'HEAD'].includes(req.method())) { traffic.forbiddenWrites.push(url.pathname); return route.abort(); }
          const response = await route.fetch({ url: LOCAL + url.pathname + url.search, maxRedirects: 0 });
          const headers = { ...response.headers() };
          if (headers.location?.startsWith(LOCAL)) headers.location = ORIGIN + headers.location.slice(LOCAL.length);
          return route.fulfill({ response, headers });
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && !/supabase\.co$/.test(url.hostname)) {
          // The real Meta pixel can fetch account-configured gateway destinations
          // outside facebook.com. Never deliver those fixture events either.
          traffic.blockedExternalWrites.push(url.origin + url.pathname); return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();

      page.on('pageerror', error => traffic.errors.push(error.message));
      page.on('console', message => { if (['error', 'warning'].includes(message.type())) traffic.console.push(message.text().slice(0, 300)); });
      return { context, page, traffic };
    }
    async function settle(page) {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1800); // SDK/React network debounce in this test harness, not a readiness guess.
    }
    async function events(s) {
      await settle(s.page);
      if (process.env.QA_REAL_META !== '1') s.traffic.meta = await s.page.evaluate(() => window.__metaCalls || []);
      return s.traffic;
    }
    async function pass(name, s) {
      assert.deepEqual(s.traffic.forbiddenWrites, [], 'No production writes permitted');
      if (s.traffic.blockedExternalWrites.length) assert(process.env.QA_REAL_META === '1' && s.traffic.scripts.some(u => u.includes('connect.facebook.net')), 'Unexpected external mutation without a permitted Meta SDK');
      assert.deepEqual(s.traffic.errors, [], 'No client or payload errors');
      results.push({ name, passed: true, posthog_events: s.traffic.ph.map(e => e.event), meta_events: s.traffic.meta.filter(c => c[0] === 'trackSingle').map(c => c[2]), blocked_external_transports: [...new Set(s.traffic.blockedExternalWrites)] });
      await s.context.unrouteAll({ behavior: 'ignoreErrors' });
      await s.context.close();
    }

    const denied = await session();
    await denied.page.goto(ORIGIN + '/exotiq');
    await events(denied);
    assert.equal(denied.traffic.scripts.length, 0, 'No SDK/network request before consent');
    assert.equal(denied.traffic.ph.length, 0);
    await denied.page.screenshot({ path: path.join(OUT, 'consent-mobile.png'), fullPage: false });
    await pass('No tracking before consent', denied);

    const unsafePublic = await session({ analytics: true, marketing: true });
    await unsafePublic.page.goto(ORIGIN + '/exotiq?t=QA_PRIVATE_CREDENTIAL'); await events(unsafePublic);
    assert.equal(unsafePublic.traffic.scripts.length, 0, 'Credential-bearing public URLs must not reach SDKs either');
    await pass('Credential query on public URL is fail-closed', unsafePublic);

    const analytics = await session({ analytics: true, marketing: false });
    await analytics.page.goto(ORIGIN + '/exotiq?utm_source=facebook&utm_medium=paid_social&utm_campaign=qa_fixture&ad_id=12345');
    await events(analytics);

    assert(analytics.traffic.ph.some(e => e.event === '$pageview'), 'PostHog pageview delivered to intercepted transport');
    assert(!analytics.traffic.scripts.some(u => u.includes('facebook')), 'Analytics permission does not allow Meta');
    assert(analytics.traffic.ph.every(e => process.env.QA_LIVE === '1' ? /^phc_[a-zA-Z0-9]+$/.test(e.properties.token || '') : e.properties.token === 'phc_trackingqatest123'), 'Required public ingestion token preserved');
    assert(analytics.traffic.ph.some(e => e.properties.last_utm_campaign === 'qa_fixture'));
    const link = analytics.page.locator('a[href^="/exotiq/"]').first();
    const vehiclePath = await link.getAttribute('href');
    await link.click(); await analytics.page.waitForURL(url => url.pathname === vehiclePath); await events(analytics);
    assert.equal(analytics.traffic.ph.filter(e => e.event === '$pageview').length, 2, 'One view per public SPA route');
    assert(analytics.traffic.ph.some(e => e.event === 'vehicle_view'));
    const ctaBounds = await analytics.page.getByRole('link', { name: 'Select dates', exact: true }).boundingBox();
    assert(ctaBounds && ctaBounds.y + ctaBounds.height <= 852, 'Privacy controls must not push the mobile booking CTA below the viewport');
    await pass('Analytics-only consent, campaign attribution and SPA pageviews', analytics);

    const ads = await session({ analytics: false, marketing: true });
    await ads.page.goto(ORIGIN + '/exotiq'); await events(ads);
    assert(!ads.traffic.scripts.some(u => u.includes('posthog')), 'Ads permission does not allow PostHog');
    assert(ads.traffic.meta.some(c => c[1] === '1603562574756003'));
    assert.equal(ads.traffic.meta.filter(c => c[0] === 'trackSingle' && c[2] === 'PageView').length, 1);
    const adsLink = ads.page.locator('a[href^="/exotiq/"]').first();
    const adsVehiclePath = await adsLink.getAttribute('href');
    await adsLink.click(); await ads.page.waitForURL(url => url.pathname === adsVehiclePath); await events(ads);
    assert.equal(ads.traffic.meta.filter(c => c[0] === 'trackSingle' && c[2] === 'ViewContent').length, 1);
    assert.equal(ads.traffic.meta.filter(c => c[0] === 'trackSingle' && c[2] === 'PageView').length, 2, 'Real Meta SDK must not add its own history pageview');
    assert(!ads.traffic.meta.some(c => c.includes('Purchase')));
    const metaWarnings = ads.traffic.console.filter(message => /meta pixel|facebook pixel|fbq/i.test(message));
    if (metaWarnings.length) console.log('Meta SDK warnings:', metaWarnings);
    await pass('Ads-only consent, correct pixel and ViewContent, no false Purchase', ads);

    const gpc = await session({ analytics: true, marketing: true }, true);
    await gpc.page.goto(ORIGIN + '/exotiq'); await events(gpc);
    assert(gpc.traffic.ph.some(e => e.event === '$pageview'));
    assert(!gpc.traffic.scripts.some(u => u.includes('facebook')));
    await pass('GPC disables advertising independently', gpc);

    const privatePage = await session({ analytics: true, marketing: true });
    await privatePage.page.goto(ORIGIN + '/booking/BK-QA-NOT-REAL?t=00000000-0000-4000-8000-000000000001'); await events(privatePage);
    assert.equal(privatePage.traffic.scripts.length, 0, 'Private route loads no tracking SDKs');
    await pass('Direct private booking URL is untracked', privatePage);

    async function openPreferences(page) {
      await page.getByRole('button', { name: /^(Details|Privacy preferences)$/ }).filter({ visible: true }).first().click();
      await page.getByRole('dialog').waitFor();
    }

    const ui = await session();
    await ui.page.goto(ORIGIN + '/exotiq'); await settle(ui.page);
    await openPreferences(ui.page);
    await ui.page.getByRole('switch', { name: 'Analytics cookies', exact: true }).click();
    await events(ui);
    assert(ui.traffic.ph.some(e => e.event === '$pageview'), 'Actual UI grant starts analytics');
    assert(!ui.traffic.scripts.some(u => u.includes('facebook')));
    const oldDocument = await ui.page.evaluate(() => window.__qaDocumentId);
    // Immediate-apply controls keep Details open after a grant.
    await ui.page.getByRole('switch', { name: 'Analytics cookies', exact: true }).click();
    await ui.page.waitForFunction(old => window.__qaDocumentId !== old, oldDocument);
    await events(ui);
    const phCount = ui.traffic.ph.length;
    const afterRevoke = await ui.page.evaluate(() => ({ choice: JSON.parse(localStorage.getItem('exotiq_tracking_consent_v1')), keys: Object.keys(localStorage) }));
    assert.equal(afterRevoke.choice.analytics, false);
    assert(!afterRevoke.keys.some(k => k.startsWith('ph_phc_')), 'Tracking identity cleared on withdrawal');
    await ui.page.reload(); await events(ui);
    assert.equal(ui.traffic.ph.length, phCount, 'No new collection after withdrawal');
    await openPreferences(ui.page);
    await ui.page.getByRole('switch', { name: 'Analytics cookies', exact: true }).click();
    await events(ui);
    assert(ui.traffic.ph.length > phCount, 'A new explicit opt-in must work after withdrawal');
    await pass('Actual preference controls grant, revoke, and re-grant consent', ui);

    const transition = await session({ analytics: true, marketing: true });
    await transition.page.goto(ORIGIN + '/exotiq'); await events(transition);
    const documentBefore = await transition.page.evaluate(() => window.__qaDocumentId);
    const eventsBefore = transition.traffic.ph.length;
    await transition.page.evaluate(() => history.pushState({}, '', '/booking/BK-QA-NOT-REAL?t=00000000-0000-4000-8000-000000000001'));
    await transition.page.waitForFunction(old => window.__qaDocumentId !== old, documentBefore);
    await events(transition);
    assert.equal(transition.traffic.ph.length, eventsBefore);
    assert(!JSON.stringify(transition.traffic.ph).includes('00000000-0000-4000-8000-000000000001'));
    await pass('Unanticipated private SPA transition unloads SDK document', transition);

    const returning = await session({ analytics: true, marketing: false });
    await returning.page.goto(ORIGIN + '/exotiq'); await events(returning);
    const initialDoc = await returning.page.evaluate(() => window.__qaDocumentId);
    await returning.page.evaluate(() => history.pushState({}, '', '/privacy'));
    await returning.page.waitForFunction(old => window.__qaDocumentId !== old, initialDoc);
    await settle(returning.page);
    const beforeReturn = returning.traffic.ph.length;
    await returning.page.locator('a[href="/"]').first().click();
    await returning.page.waitForURL(url => url.pathname === '/exotiq'); await events(returning);
    assert(returning.traffic.ph.length > beforeReturn, 'Valid application consent must resume analytics after private-route teardown');
    await pass('Analytics resumes when a consented visitor returns from a private route', returning);

    const tabs = await session();
    const second = await tabs.context.newPage();
    await Promise.all([tabs.page.goto(ORIGIN + '/exotiq'), second.goto(ORIGIN + '/exotiq')]);
    await settle(tabs.page); await settle(second);
    await openPreferences(tabs.page);
    await tabs.page.getByRole('switch', { name: 'Analytics cookies', exact: true }).click();
    await events(tabs); await settle(second);
    const firstWrites = await tabs.page.evaluate(() => window.__preferenceWrites);
    const secondWrites = await second.evaluate(() => window.__preferenceWrites);
    assert.equal(firstWrites, 1, 'Only the tab with the user action persists consent');
    assert.equal(secondWrites, 0, 'External consent synchronization must never write back');
    assert(tabs.traffic.ph.filter(e => e.event === '$pageview').length >= 2, 'Both consented tabs track after synchronization');
    const savedAt = await tabs.page.evaluate(() => JSON.parse(localStorage.getItem('exotiq_tracking_consent_v1')).at);
    await settle(second);
    assert.equal(await second.evaluate(() => JSON.parse(localStorage.getItem('exotiq_tracking_consent_v1')).at), savedAt, 'Cross-tab sync does not renew consent lifetime');
    const docA = await tabs.page.evaluate(() => window.__qaDocumentId);
    const docB = await second.evaluate(() => window.__qaDocumentId);
    await tabs.page.getByRole('switch', { name: 'Analytics cookies', exact: true }).click();
    await Promise.all([
      tabs.page.waitForFunction(old => window.__qaDocumentId !== old, docA),
      second.waitForFunction(old => window.__qaDocumentId !== old, docB),
    ]);
    await events(tabs); await settle(second);
    const afterWithdrawal = tabs.traffic.ph.length;
    await Promise.all([tabs.page.reload(), second.reload()]);
    await events(tabs); await settle(second);
    assert.equal(tabs.traffic.ph.length, afterWithdrawal, 'Cross-tab withdrawal survives reload without restoring a stale grant');
    assert.equal(await second.evaluate(() => JSON.parse(localStorage.getItem('exotiq_tracking_consent_v1')).analytics), false);
    await pass('Two-tab grant/withdrawal has no write echo, timestamp renewal, or stale-grant resurrection', tabs);

    console.log(JSON.stringify({ fixture_qa: true, actual_provider_delivery: false, results }, null, 2));
  } finally {
    fs.writeFileSync(path.join(OUT, 'browser-qa.json'), JSON.stringify({ fixture_qa: true, source: LOCAL, browser: process.env.QA_BROWSER || 'chromium', real_meta_sdk: process.env.QA_REAL_META === '1', actual_provider_delivery: false, results }, null, 2));
    for (const context of contexts) await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
