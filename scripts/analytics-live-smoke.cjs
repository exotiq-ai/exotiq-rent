/* Controlled LIVE measurement smoke: real consented page views only.
 * Never submits booking/lead/payment forms. QA campaign is excluded from dashboards.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const CAMPAIGN = 'avi_tracking_qa_20260917';
const output = '/Users/gbot/.hermes/plans/exotiq-tracking-live-smoke.json';
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev', headless: true });
  const receipt = { controlled_live_test: true, campaign: CAMPAIGN, no_forms_submitted: true, posthog_responses: [], meta_events: [], errors: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    // Controlled visitor emulation; production bot filtering stays enabled.
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }));
    const page = await context.newPage();
    const analyticsRequests = [];
    page.on('request', request => {
      const u = new URL(request.url());
      if (/posthog\.com$|facebook\.net$|facebook\.com$/.test(u.hostname)) analyticsRequests.push(request.url());
      if (/facebook\.com$/.test(u.hostname) && u.pathname === '/tr/') receipt.meta_events.push({ pixel: u.searchParams.get('id'), event: u.searchParams.get('ev'), page: u.searchParams.get('dl') });
    });
    page.on('response', response => {
      const u = new URL(response.url());
      if (/posthog\.com$/.test(u.hostname) && /\/e\/?$/.test(u.pathname)) receipt.posthog_responses.push({ status: response.status(), host: u.hostname, path: u.pathname });
    });
    page.on('pageerror', e => receipt.errors.push(e.message));
    await page.goto(`https://exotiq.rent/?utm_source=facebook&utm_medium=paid_social&utm_campaign=${CAMPAIGN}&ad_id=qa_readonly`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Exotiq', exact: true }).waitFor();
    await page.waitForTimeout(1200);
    receipt.final_landing = page.url();
    assert.equal(analyticsRequests.length, 0, 'Fresh visitor: no trackers before permission');
    receipt.no_preconsent_requests = true;
    await page.screenshot({ path: '/Users/gbot/.hermes/plans/exotiq-tracking-live-consent.png' });
    // Simulated permission in this isolated QA browser only; UI controls are tested separately.
    await page.evaluate(() => localStorage.setItem('exotiq_tracking_consent_v1', JSON.stringify({ version: 1, analytics: true, marketing: true, at: Date.now() })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Exotiq', exact: true }).waitFor();
    await page.waitForTimeout(5000);
    await page.locator('a[href^="/exotiq/"]').first().click();
    await page.waitForTimeout(4000);
    receipt.vehicle_url = page.url();
    await page.screenshot({ path: '/Users/gbot/.hermes/plans/exotiq-tracking-live-vehicle.png' });
    assert(receipt.posthog_responses.some(r => r.status === 200), 'PostHog transport must respond successfully');
    assert(receipt.meta_events.some(e => e.pixel === '1603562574756003' && e.event === 'PageView'), 'Correct pixel PageView beacon');
    assert(receipt.meta_events.some(e => e.event === 'ViewContent'), 'Vehicle beacon');
    assert(!receipt.meta_events.some(e => ['Lead', 'Purchase'].includes(e.event)), 'No fake conversions');
    assert.deepEqual(receipt.errors, []);
    await context.close();
    const privateContext = await browser.newContext();
    await privateContext.addInitScript(() => localStorage.setItem('exotiq_tracking_consent_v1', JSON.stringify({ version: 1, analytics: true, marketing: true, at: Date.now() })));
    const privatePage = await privateContext.newPage();
    const privateTrackers = [];
    privatePage.on('request', r => { if (/posthog\.com|facebook\.net|facebook\.com/.test(new URL(r.url()).hostname)) privateTrackers.push(r.url()); });
    await privatePage.goto('https://book.exotiq.rent/booking/BK-QA-NOT-REAL?t=00000000-0000-4000-8000-000000000001', { waitUntil: 'domcontentloaded' });
    await privatePage.waitForTimeout(1500);
    assert.deepEqual(privateTrackers, [], 'Private page must not load tracking');
    receipt.private_route_untracked = true;
    await privateContext.close();
    receipt.passed = true;
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    fs.writeFileSync(output, JSON.stringify(receipt, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
