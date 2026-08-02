/**
 * Live Stripe config monitor — read-only drift detection for the objects the
 * money path depends on. Catches the failure class that killed the sandbox
 * webhook for ten days (silent endpoint death) plus the one that nearly
 * shipped at go-live (duplicate endpoints at the same URL, where one copy can
 * never verify and fails forever).
 *
 * Checks, against the live account:
 *   - platform account reachable, charges enabled
 *   - the four webhook endpoints created 2026-08-01 still exist, are enabled
 *     (Stripe auto-disables endpoints that fail for days — status flips here
 *     before renters notice), and still carry their expected events
 *   - NO unexpected endpoint targets our function URLs (duplicate detection)
 *   - the four hardcoded subscription prices + portal config are active
 *
 * Needs STRIPE_MONITOR_KEY in the env: a RESTRICTED live key, read-only
 * (Core: Read, Webhook Endpoints: Read, Billing: Read, Connect: Read).
 * Never the full secret key — this job can run from CI and read-only means a
 * leaked key can't move money or change config.
 *
 * Run: STRIPE_MONITOR_KEY=rk_live_… bun scripts/canary/stripe-live-monitor.ts
 */

const KEY = process.env.STRIPE_MONITOR_KEY ?? '';

const FUNCTIONS_BASE = 'https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1';

// Endpoint IDs are stable identifiers, not secrets. Created 2026-08-01
// (session record: memory project-exotiq-stripe-live-switch).
const EXPECTED_ENDPOINTS: Array<{ id: string; url: string; events: string[] }> = [
  {
    id: 'we_1TzjjLHO7nC3pJiPggtq38ey', // platform: subscriptions + charges
    url: `${FUNCTIONS_BASE}/stripe-webhook`,
    events: [
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
      'charge.refunded',
      'charge.dispute.created',
      'charge.succeeded',
      'payout.paid',
    ],
  },
  {
    id: 'we_1TznwIHO7nC3pJiPDs6xZAMy', // connected accounts: onboarding + holds + payouts
    url: `${FUNCTIONS_BASE}/stripe-webhook`,
    events: [
      'account.updated',
      'account.application.deauthorized',
      'charge.captured',
      'charge.succeeded',
      'charge.refunded',
      'payout.paid',
    ],
  },
  {
    id: 'we_1TzjjMHO7nC3pJiP0w035KfK', // renter payments — the money path
    url: `${FUNCTIONS_BASE}/rent-payment-webhook`,
    events: ['checkout.session.completed', 'payment_intent.succeeded', 'payment_intent.payment_failed'],
  },
  {
    id: 'we_1TzjjMHO7nC3pJiPlSjl6FeB', // identity verification
    url: `${FUNCTIONS_BASE}/identity-webhook`,
    events: [
      'identity.verification_session.verified',
      'identity.verification_session.requires_input',
      'identity.verification_session.canceled',
      'identity.verification_session.processing',
      'identity.verification_session.redacted',
    ],
  },
];

const PRICE_IDS = [
  'price_1Tbv4IHO7nC3pJiPH4EbyVlL',
  'price_1Tbv4JHO7nC3pJiPqaBeoyAX',
  'price_1Tbv4KHO7nC3pJiPC5emMKgJ',
  'price_1Tbv4LHO7nC3pJiParUQCB7y',
];

let failures = 0;
const pass = (m: string) => console.log(`  PASS  ${m}`);
const fail = (m: string) => {
  failures++;
  console.log(`  FAIL  ${m}`);
};

async function stripe(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  return res.json();
}

async function main() {
  if (!/^(rk|sk)_live_/.test(KEY)) {
    console.error('STRIPE_MONITOR_KEY must be an rk_live_ (preferred) or sk_live_ key. Aborting.');
    process.exit(2);
  }

  console.log('\n== Account ==');
  const acct = await stripe('account');
  if (acct.error) {
    fail(`key rejected: ${acct.error.message}`);
  } else {
    pass(`live account ${acct.id}`);
    if (acct.charges_enabled) pass('charges enabled');
    else fail('charges NOT enabled on the platform account');
  }

  console.log('\n== Webhook endpoints ==');
  const eps = await stripe('webhook_endpoints?limit=100');
  const existing: any[] = eps.data ?? [];
  if (eps.error) fail(`cannot list endpoints: ${eps.error.message}`);

  for (const want of EXPECTED_ENDPOINTS) {
    const found = existing.find((e) => e.id === want.id);
    if (!found) {
      fail(`${want.id} (${want.url.split('/').pop()}) MISSING — recreate per docs/rent/CANARY.md and update the secret`);
      continue;
    }
    if (found.status !== 'enabled') {
      // Stripe auto-disables after sustained delivery failures — this is the
      // "sandbox webhook died silently for ten days" failure mode, caught.
      fail(`${want.id} status is "${found.status}" — deliveries have been failing; check the signing secret`);
      continue;
    }
    const events: string[] = found.enabled_events ?? [];
    const missing = want.events.filter((e) => !events.includes(e) && !events.includes('*'));
    if (missing.length) fail(`${want.id} missing events: ${missing.join(', ')}`);
    else pass(`${want.id} enabled with expected events (${want.url.split('/').pop()})`);
  }

  // Duplicate detection: a second endpoint at one of our URLs means Stripe
  // delivers every event twice and one copy can never pass signature
  // verification — permanent failures that eventually disable the endpoint.
  // This exact situation occurred (and was cleaned up) on go-live night.
  const ourUrls = new Set(EXPECTED_ENDPOINTS.map((e) => e.url));
  const expectedIds = new Set(EXPECTED_ENDPOINTS.map((e) => e.id));
  const strays = existing.filter((e) => ourUrls.has(e.url) && !expectedIds.has(e.id));
  if (strays.length) {
    for (const s of strays) fail(`unexpected endpoint ${s.id} targets ${s.url} — duplicate delivery; delete it or update this monitor`);
  } else {
    pass('no unexpected endpoints target our function URLs');
  }

  console.log('\n== Subscription prices ==');
  for (const id of PRICE_IDS) {
    const p = await stripe(`prices/${id}`);
    if (p.error) fail(`${id}: ${p.error.message}`);
    else if (!p.active) fail(`${id} is archived`);
    else pass(`${id} active`);
  }

  console.log('\n== Billing portal ==');
  const portal = await stripe('billing_portal/configurations?limit=5');
  if ((portal.data ?? []).some((c: any) => c.active)) pass('active portal configuration present');
  else fail('no active customer portal configuration');

  console.log(`\n${failures === 0 ? 'MONITOR GREEN' : `MONITOR RED — ${failures} check(s) failed`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('MONITOR RED — unhandled error:', err);
  process.exit(1);
});
