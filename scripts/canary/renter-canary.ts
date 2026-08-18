/**
 * Live renter-flow canary — exercises the real production booking path daily
 * and stops one step short of payment. No card is ever entered, no money
 * moves, no fraud-shaped charge/refund pattern is created on the live Stripe
 * account (decision 2026-08-01: real-money smoke tests stay manual and rare).
 *
 * What one run does, against production:
 *   1. reads the storefront + fleet (public RPCs)
 *   2. quotes the canary vehicle and asserts every money invariant the
 *      renter UI relies on — including that the server's premium protection
 *      rate equals the rate the Protect copy advertises (imported from
 *      domain/booking/totals, the same module the UI reads)
 *   3. creates a REAL booking request with an unmistakable canary driver
 *      ("Exotiq Canary — automated check" / canary@exotiq.ai)
 *   4. reads it back through the token-authorized RPC and asserts the
 *      snapshot total equals the quoted total (shown == snapshot)
 *   5. cancels it — cancellation is attempted even when a later assertion
 *      fails, so the worst case a broken run leaves behind is one visibly
 *      canary-named `requested` booking in the Command Center inbox
 *
 * Operator-side note: each run produces one booking request + one
 * cancellation in the Command Center. That noise is the accepted cost of
 * exercising the real path; the driver name makes it filterable.
 *
 * Env (all public values — the anon key ships in every browser bundle):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY   required
 *   CANARY_TEAM_SLUG      default "exotiq"
 *   CANARY_VEHICLE_SLUG   default "2017-audi-s8"; falls back to the cheapest
 *                         listed vehicle if the configured slug disappears
 *
 * Run: bun scripts/canary/renter-canary.ts
 */

import { PROTECTION_DAILY_RATES } from '../../domain/booking/totals';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const TEAM_SLUG = process.env.CANARY_TEAM_SLUG ?? 'exotiq';
const VEHICLE_SLUG = process.env.CANARY_VEHICLE_SLUG ?? '2017-audi-s8';

// Far enough out that the canary never competes with near-term real demand;
// slid forward in 3-day steps if the window happens to be booked.
const WINDOW_START_DAYS = 45;
const RENTAL_DAYS = 2;
const WINDOW_SLIDE_TRIES = 10;

const CANARY_DRIVER = {
  name: 'Exotiq Canary — automated check',
  email: 'canary@exotiq.ai',
  phone: '+1 480 555 0100', // reserved fictional range
};

let failures = 0;
const pass = (m: string) => console.log(`  PASS  ${m}`);
const fail = (m: string) => {
  failures++;
  console.log(`  FAIL  ${m}`);
};
const assert = (cond: boolean, m: string) => (cond ? pass(m) : fail(m));

function isoDatePlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

async function fn(name: string, body: Record<string, unknown>): Promise<{ status: number; body: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Aborting.');
    process.exit(2);
  }

  console.log('\n== Storefront reads ==');
  const teams = await rpc<any[]>('public_team_by_slug', { _team_slug: TEAM_SLUG });
  assert(teams.length === 1, `team "${TEAM_SLUG}" resolves (${teams[0]?.name ?? 'MISSING'})`);

  const fleet = await rpc<any[]>('public_team_fleet', { _team_slug: TEAM_SLUG });
  assert(fleet.length > 0, `fleet listed (${fleet.length} vehicles)`);

  let vehicleSlug = VEHICLE_SLUG;
  if (!fleet.some((v) => v.vehicle_slug === vehicleSlug)) {
    const cheapest = fleet.reduce((a, b) =>
      Number(a.daily_rate ?? Infinity) <= Number(b.daily_rate ?? Infinity) ? a : b,
    );
    console.log(`  WARN  configured vehicle "${vehicleSlug}" not listed — falling back to cheapest: ${cheapest.vehicle_slug}`);
    vehicleSlug = cheapest.vehicle_slug;
  }

  console.log('\n== Availability window ==');
  // ALL free windows, not just the first: the availability RPC excludes
  // cancelled bookings but the create-side guard does not (backend gap found
  // 2026-08-17, flagged to Lovable), so a window this canary used and
  // cancelled yesterday looks free yet 409s on create. The create step slides
  // through this list instead of false-alarming on the canary's own residue.
  const windows: Array<{ start: string; end: string }> = [];
  {
    const rangeStart = isoDatePlus(WINDOW_START_DAYS);
    const rangeEnd = isoDatePlus(WINDOW_START_DAYS + WINDOW_SLIDE_TRIES * 3 + RENTAL_DAYS);
    const busy = await rpc<Array<{ busy_start: string; busy_end: string }>>('public_vehicle_availability', {
      _team_slug: TEAM_SLUG,
      _vehicle_slug: vehicleSlug,
      _range_start: rangeStart,
      _range_end: rangeEnd,
    });
    pass(`availability RPC responds (${busy.length} busy range(s) in probe window)`);
    for (let i = 0; i < WINDOW_SLIDE_TRIES; i++) {
      const s = isoDatePlus(WINDOW_START_DAYS + i * 3);
      const e = isoDatePlus(WINDOW_START_DAYS + i * 3 + RENTAL_DAYS);
      const overlaps = busy.some((b) => b.busy_start < e && b.busy_end > s);
      if (!overlaps) windows.push({ start: s, end: e });
    }
    assert(windows.length > 0, `free ${RENTAL_DAYS}-day window(s) found (${windows.length}, first ${windows[0]?.start} → ${windows[0]?.end})`);
    if (windows.length === 0) process.exit(1);
  }
  let start = windows[0]!.start;
  let end = windows[0]!.end;

  console.log('\n== Quote invariants ==');
  const quotes = await rpc<any[]>('public_vehicle_quote', {
    _team_slug: TEAM_SLUG,
    _vehicle_slug: vehicleSlug,
    _start_date: start,
    _end_date: end,
    _options: { protection: 'premium' },
  });
  let q = quotes[0];
  assert(Boolean(q), 'quote returned');
  if (!q) process.exit(1);

  const n = (v: unknown) => Number(v ?? 0);
  assert(q.rental_days === RENTAL_DAYS, `rental_days == ${RENTAL_DAYS}`);
  assert(
    n(q.rental_subtotal_cents) === n(q.daily_rate_cents) * RENTAL_DAYS,
    `rental_subtotal == daily_rate × days (${q.rental_subtotal_cents})`,
  );
  // The server's premium rate must equal the rate the Protect copy advertises.
  // These live in different systems (SQL vs domain/booking/totals.ts) and have
  // drifted before — this is the shown-price == charged-price guarantee.
  assert(
    n(q.protection_daily_cents) === PROTECTION_DAILY_RATES.premium,
    `server premium daily (${q.protection_daily_cents}) == UI rate (${PROTECTION_DAILY_RATES.premium})`,
  );
  assert(
    n(q.protection_total_cents) === n(q.protection_daily_cents) * RENTAL_DAYS,
    'protection_total == daily × days',
  );
  assert(
    Math.abs(n(q.platform_fee_cents) - Math.round((n(q.rental_subtotal_cents) * Number(q.platform_fee_percent)) / 100)) <= 1,
    `platform_fee (${q.platform_fee_cents}) == ${q.platform_fee_percent}% of subtotal`,
  );
  assert(n(q.state_fee_cents) % RENTAL_DAYS === 0, `state_fee (${q.state_fee_cents}) is per-day divisible`);
  assert(n(q.processing_fee_cents) > 0, `processing_fee present (${q.processing_fee_cents})`);
  // The Exotiq leg is FOUR components. Anything reading fewer under-quotes the
  // renter — this shipped as a live bug once (BK-03459, $34.70 gap).
  const exotiqLeg =
    n(q.platform_fee_cents) + n(q.protection_total_cents) + n(q.state_fee_cents) + n(q.processing_fee_cents);
  assert(n(q.exotiq_total_cents) === exotiqLeg, `exotiq_total == platform + protection + state + processing (${exotiqLeg})`);
  assert(
    n(q.grand_total_cents) === n(q.operator_total_cents) + n(q.exotiq_total_cents),
    `grand_total == operator + exotiq (${q.grand_total_cents})`,
  );
  // Deposit decision 2026-07-26: the renter is never charged or held a deposit.
  // A nonzero here means someone re-enabled deposits server-side.
  assert(n(q.deposit_cents) === 0, 'deposit_cents == 0 (renter never pays a deposit)');

  console.log('\n== Booking create → read-back → cancel ==');
  let create = { status: 0, body: {} as any };
  for (const w of windows) {
    if (w.start !== start) {
      // Re-quote for the slid window: the snapshot-parity checks below must
      // compare against the quote for the dates actually booked.
      const requote = await rpc<any[]>('public_vehicle_quote', {
        _team_slug: TEAM_SLUG,
        _vehicle_slug: vehicleSlug,
        _start_date: w.start,
        _end_date: w.end,
        _options: { protection: 'premium' },
      });
      if (!requote[0]) continue;
      q = requote[0];
      start = w.start;
      end = w.end;
    }
    create = await fn('rent-create-booking', {
      team_slug: TEAM_SLUG,
      vehicle_slug: vehicleSlug,
      start_date: start,
      end_date: end,
      pickup_time: '10:00 AM',
      protection: 'premium',
      driver: CANARY_DRIVER,
    });
    if (create.status !== 409) break;
    console.log(`  WARN  ${start} → ${end} rejected 409 ("${String(create.body?.error ?? '').slice(0, 60)}") — sliding to the next free window`);
  }
  assert(create.status === 200, `rent-create-booking 200 (got ${create.status} ${JSON.stringify(create.body).slice(0, 200)})`);
  const bookingRef: string | undefined = create.body?.booking_ref;
  const token: string | undefined = create.body?.confirmation_token;
  assert(Boolean(bookingRef && token), `booking_ref + confirmation_token issued (${bookingRef ?? 'none'})`);
  if (!bookingRef || !token) process.exit(1);

  // From here on the booking exists — cancel it no matter what else fails.
  try {
    const rows = await rpc<any[]>('public_booking_by_ref', { _booking_ref: bookingRef, _token: token });
    const row = rows[0];
    assert(Boolean(row?.authorized), 'token-authorized read-back');
    assert(
      ['requested', 'pending_documents'].includes(row?.status),
      `status is a pre-approval state (${row?.status})`,
    );
    // The row snapshot is what the renter will be charged; the quote is what
    // they were shown. These must be identical — component by component.
    // Row semantics (M6b): total_cents is the OPERATOR rental leg; the
    // renter-facing total is total_cents + the four fee columns, exactly how
    // PaymentCard renders it.
    assert(
      Number(row?.total_cents) === n(q.operator_total_cents),
      `snapshot rental leg (${row?.total_cents}) == quoted operator total (${q.operator_total_cents})`,
    );
    const snapshotPairs: Array<[string, unknown, number]> = [
      ['platform_fee_cents', row?.platform_fee_cents, n(q.platform_fee_cents)],
      ['protection_total_cents', row?.protection_total_cents, n(q.protection_total_cents)],
      ['state_fee_cents', row?.state_fee_cents, n(q.state_fee_cents)],
      ['processing_fee_cents', row?.processing_fee_cents, n(q.processing_fee_cents)],
    ];
    for (const [name, got, want] of snapshotPairs) {
      assert(Number(got ?? -1) === want, `snapshot ${name} (${got}) == quoted (${want})`);
    }
  } finally {
    const cancel = await fn('rent-cancel-booking', {
      booking_ref: bookingRef,
      token,
      acknowledge_forfeit: false,
    });
    assert(
      cancel.status === 200 && cancel.body?.status === 'cancelled',
      `cancelled cleanly (${cancel.status} → ${cancel.body?.status})`,
    );
    if (cancel.status !== 200) {
      console.log(`  NOTE  stray canary booking ${bookingRef} left in "requested" — decline it in the Command Center.`);
    }
  }

  const verify = await rpc<any[]>('public_booking_by_ref', { _booking_ref: bookingRef, _token: token });
  assert(verify[0]?.status === 'cancelled', `read-back confirms cancelled (${verify[0]?.status})`);

  console.log(`\n${failures === 0 ? 'CANARY GREEN' : `CANARY RED — ${failures} assertion(s) failed`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('CANARY RED — unhandled error:', err);
  process.exit(1);
});
