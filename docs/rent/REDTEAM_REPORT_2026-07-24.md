# Red-Team Report — Drive Exotiq Marketplace (sandbox, 2026-07-24)

Authorized security + QA sweep of the live **test-mode** surface
(book.exotiq.rent + spark edge functions/RPCs), run with the public anon key
only — i.e. the exact capability a hostile renter has. All test bookings
created during the sweep were cancelled; no test data left behind.

**Verdict:** the money-critical controls are solid — **forged-payment is not
possible** (webhook signatures enforced), PII does not leak, RLS holds, token
gating works, refunds reconcile. Seven findings below, none of them a
data-breach or free-money hole; the two worth acting on before public launch
are anti-abuse (rate limiting) and a booking-availability inconsistency.

---

## Confirmed secure (the important negatives)

| Area | Result |
|------|--------|
| Base-table reads via PostgREST (`bookings`/`customers`/`teams`) | Blocked by RLS (permission denied / empty) ✅ |
| Public RPC field exposure | No VIN, plate, owner/customer email, Stripe IDs, cost basis, or notes — explicit column lists only ✅ |
| SQL injection in slug params (`' OR '1'='1`, `; DROP TABLE`) | Parameterized — returns empty, no error ✅ |
| **Payment/identity webhook forgery** | Both `rent-payment-webhook` and `identity-webhook` reject unsigned bodies (400) — a `checkout.session.completed` cannot be forged to mark a booking paid ✅ **(most critical)** |
| Token gating (D4) | Missing/wrong token → only `booking_ref`+`status`+`currency`; never dates, amounts, or PII. Correct token → detail, still no customer PII ✅ |
| Booking validation | Past dates, inverted range, zero-night, bad email, short phone → all 400 ✅ |
| Non-marketplace / demo-tenant booking | 404 (hello@ demo tenant unbookable and unresolvable by slug) ✅ |
| Operator refund auth (`rent-refund-booking`) | 401 without auth; 401 with anon key (not an operator) ✅ |
| Cancel/refund lifecycle | Double-cancel → 409; refund releases dates; unpaid cancel → no Stripe activity ✅ |
| Full money circle | book → approve → pay (two statement legs) → refund → dates released — verified 2026-07-24 ✅ |
| HTTP hygiene | 405 on wrong method; 400 (not 500) on malformed input ✅ |
| URL split | Booking routes 404 on exotiq.rent; `/preview` 404 on live; legacy `exotiq-` slug redirects; demo-tenant share 404 ✅ |
| Share surface | No visible rate/PII on the hype card (a `$9` in the HTML is a Next.js RSC serialization marker, not a price) ✅ |

---

## Findings (ranked)

### F1 — MEDIUM-HIGH · Anonymous rate limiting is not effective
26 rapid `rent-create-booking` calls returned **zero 429s**. The limiter is
in-memory (`rateLimitMap`), which does not persist across serverless isolates
— so the "20/hr/IP" cap effectively does not enforce. Same pattern in
`rent-checkout` and `rent-cancel-booking`.
**Impact:** booking spam, ref/status enumeration, and Stripe Checkout-session
spam are unthrottled. With F2, enables stealth denial-of-booking.
**Fix (spark):** move rate limiting to a persistent store (a Postgres
counter keyed on IP+window, or the platform gateway), and/or add Cloudflare
Turnstile on the web booking form. Keep the per-request cap but back it with
shared state.

### F2 — MEDIUM · False availability (status-set mismatch)
`public_vehicle_availability` does **not** report `requested` /
`pending_documents` holds as busy, but `create_marketplace_booking`'s overlap
check **does** block them. Reproduced: availability showed Dec 9–12 free while
a `pending_documents` booking held it; a real create on those dates returned
409 "Those dates were just taken."
**Impact:** a renter sees dates as available, completes the whole flow, and is
rejected at the final step (abandoned bookings). Also a stealth
denial-of-inventory: fake unverified holds block real bookings without showing
on the calendar. No payment or identity is required to place such a hold.
**Fix (spark):** make the two functions agree on one status set. Decide
whether unverified holds should block availability, and give unverified
`requested`/`pending_documents` bookings a short TTL auto-expiry (mirror the
48h payment window with a shorter unverified window) so abandoned/malicious
holds self-clear.

### F3 — LOW-MEDIUM · Sequential booking refs + tokenless status = enumeration/volume oracle
Refs increment predictably (BK-03447 → 03448 → 03449 → 03450), and
`public_booking_by_ref` returns a row (with `status`) for any real ref without
a token, empty for fakes.
**Impact:** an observer can (a) enumerate valid refs and read their status, and
(b) estimate total marketplace booking volume over time by watching ref numbers
climb (German-tank-problem BI leak). No PII exposed.
**Fix (spark):** use an opaque/random public booking ref, **or** require the
token even for the existence/status read.

### F4 — LOW-MEDIUM · Invalid protection tier silently defaults to premium
`rent-create-booking` coerces an unrecognized `protection` value to `"premium"`
(the most expensive tier, $289/day) and creates the booking, rather than
rejecting it. Reproduced: `protection:"free_lol"` → booking created, premium
charged ($867). The DB has a tier guard, but the edge function sanitizes before
the RPC sees it.
**Impact:** a malformed client or bad actor sending garbage is max-charged
rather than getting a clear 400. Renter-trust risk more than security.
**Fix (spark):** reject unknown tiers with 400 in `rent-create-booking`;
let the client resend a valid tier.

### F5 — LOW · Fleet hero-image signed URLs have ~1-year TTL
`public_team_fleet.hero_image_url` returns storage signed URLs whose token
expires ~365 days out (exp − iat = 31,536,000s), inconsistent with
`rent-public-media`'s 1-hour design.
**Impact:** low — these are marketing car photos, but long-lived signed URLs to
a private bucket are a smell (anyone who ever captures the URL keeps access for
a year).
**Fix (spark):** shorten the TTL or serve hero images through the 1h media
function; confirm whether the long TTL is intentional.

### F6 — INFO · Two marketplace-visible tenants
Both **Exotiq** and **Saucy Rentals** (`fredo-d-lima`, the pilot) resolve as
marketplace-visible. Confirm both are intended to be publicly bookable, or hide
the pilot until launch.

### F7 — OPEN (carried) · Scheduler cron registration unconfirmed
No `cron.schedule` for `rent-payment-scheduler` was found in migrations. If it
isn't registered, the 24h reminder and payment-expiry emails never fire.
Pending Lovable's confirmation from the M6d verification pass.

---

## Not tested here (need browser Stripe or operator session — for the red team's own pass)

- Decline-card path (`4000 0000 0000 0002`) and off-session partial-failure
  (`4000 0025 0000 3155`) — the paid happy path + full refund are already
  verified; these exercise the failure branches in `rent-payment-webhook`.
- Webhook redelivery / out-of-order events (dedupe via `stripe_webhook_events`)
  — verify a redelivered `checkout.session.completed` doesn't double-charge.
- `<72h` paid-forfeit cancellation (M6-D7) — server demands `acknowledge_forfeit`;
  needs a paid booking inside the window.
- `payment_stripe_mode='test'` exclusion from operator revenue/ledger views
  (Command Center visual check).

---

## Lovable handoff requirements

Everything actionable is backend (spark repo). In priority order:

1. **F1 — persistent rate limiting** on `rent-create-booking` / `rent-checkout`
   / `rent-cancel-booking` (in-memory doesn't hold in serverless), plus
   Turnstile on the web booking form. *Pre-launch.*
2. **F2 — reconcile availability vs create-overlap status sets** and add a
   short TTL auto-expiry for unverified `requested`/`pending_documents`
   holds. *Pre-launch (UX + anti-abuse).*
3. **F7 — confirm/register the `rent-payment-scheduler` cron** and show one
   successful run. *Blocks M6d close.*
4. **F4 — 400 on unknown protection tier** in `rent-create-booking`. *Quick.*
5. **F3 — opaque public booking ref (or token-gate status reads).** *Design call.*
6. **F5 — shorten fleet hero-image signed-URL TTL** (or confirm intended).

## For Gregory

- **F6** — confirm Saucy Rentals should be publicly bookable now.
- Decline-terms legal copy (placeholder) — still the one true launch blocker
  once real money flows.
