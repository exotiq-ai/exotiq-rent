# Lovable Work Order — Red-Team Fixes + Tenant Sunset (2026-07-24)

Standalone (no repo pull needed). From an authorized sandbox red-team sweep of
the Drive Exotiq marketplace (book.exotiq.rent + the rent edge functions/RPCs),
run with the public anon key only. All work here is **backend / Lovable Cloud**.
Test mode throughout — no live money involved.

**Bottom line from testing:** the money-critical controls are solid — payment
webhooks reject forged/unsigned events, RLS blocks base-table reads, public
RPCs leak no PII, token gating works, operator refund auth holds, and the full
pay → confirm → refund → date-release circle reconciles. The items below are
hardening and correctness, not breaches. Two are pre-launch priority (#1, #2).

---

## 0. Immediate: sunset the Saucy Rentals tenant

Owner decision — keep only **Exotiq** publicly bookable during testing.

- Set `teams.marketplace_visible = false` for the team with slug
  **`fredo-d-lima`** (display name "Saucy Rentals").
- Visibility gate is `marketplace_visible = true AND is_demo_account = false
  AND is_deleted = false`, so this one flag fully hides it (reversible — flip
  back to `true` to relist).
- **Verify:** `public_team_by_slug('fredo-d-lima')` returns empty, and
  `public_team_by_slug('exotiq')` still returns Exotiq.

---

## What testing confirmed SECURE (no action needed — context)

- Base tables (`bookings`/`customers`/`teams`) — anon reads blocked by RLS.
- Public RPCs — no VIN, plate, owner/customer email, Stripe IDs, cost, or notes.
- SQL injection in slug params — parameterized, safe.
- **Payment + identity webhooks reject unsigned bodies (400)** — a "paid"
  event cannot be forged. (Most important control; it holds.)
- Token gating — missing/wrong token exposes only ref + status + currency.
- Booking validation — past/inverted/zero-night dates, bad email, short phone
  all 400; non-marketplace + demo tenants 404.
- Operator refund auth — 401 without an operator session.
- Cancel/refund lifecycle — double-cancel 409, refund releases dates.
- HTTP hygiene — 405 wrong method, 400 (not 500) on junk.

---

## Fixes — priority order

### 1. Rate limiting is not effective (MEDIUM-HIGH · pre-launch)
26 rapid `rent-create-booking` calls returned **zero 429s**. The current
limiter is an in-memory `Map`, which does not persist across serverless
isolates — so the "20/hr/IP" cap effectively never enforces. Same pattern in
`rent-checkout` and `rent-cancel-booking`.
**Why it matters:** anonymous booking/checkout/cancel endpoints can be hammered
— booking spam, ref enumeration, and Stripe Checkout-session spam are
unthrottled.
**Do:**
- Replace in-memory limiting with a **persistent** counter (a Postgres table
  keyed on `ip + window`, or the platform gateway's rate limiter) so the cap
  holds across isolates.
- Add **Cloudflare Turnstile** (or equivalent) on the web booking form and
  verify the token server-side in `rent-create-booking`.

### 2. False availability — status sets disagree (MEDIUM · pre-launch)
`public_vehicle_availability` does **not** report `requested` /
`pending_documents` holds as busy, but `create_marketplace_booking`'s overlap
check **does** block them. Reproduced: availability showed a date range free
while a `pending_documents` booking held it; a real create on those dates
returned 409 "Those dates were just taken."
**Why it matters:** a renter sees dates as available, completes the whole flow,
and is rejected at the final step. It's also a stealth denial-of-inventory:
unverified holds (no payment, no ID needed) block real bookings without showing
on the calendar.
**Do:**
- Make the two functions use the **same status set**. Decide whether unverified
  holds should block public availability, and apply that decision to both.
- Add a **short TTL auto-expiry** for unverified `requested` /
  `pending_documents` bookings (mirror the 48h payment-window sweep with a
  shorter unverified window, e.g. 2–6h) so abandoned or malicious holds
  self-clear. The existing `expire_overdue_payment_bookings` pattern is a good
  model.

### 3. Confirm the payment-scheduler cron is registered (OPEN · blocks M6d)
No `cron.schedule` entry for `rent-payment-scheduler` was found. If it isn't
scheduled, the 24h payment reminder and payment-expiry emails never fire.
**Do:** register it (pg_cron, every 15 min, with the `x-cron-token` header),
commit the registration as a migration, and confirm one successful run in the
logs.

### 4. Reject unknown protection tiers (LOW-MEDIUM · quick)
`rent-create-booking` coerces an unrecognized `protection` value to `"premium"`
(the most expensive tier) and creates the booking. Reproduced:
`protection:"free_lol"` → booking created, premium charged ($867).
**Do:** in `rent-create-booking`, return **400** for any `protection` not in
`{premium, standard, decline}` instead of defaulting. (A DB guard exists but
the function sanitizes before the RPC sees it.)

### 5. Opaque booking references (LOW-MEDIUM · design call)
Refs increment predictably (BK-03447 → 03448 → 03449) and
`public_booking_by_ref` returns status for any real ref without a token. That
lets an observer enumerate valid bookings and estimate total marketplace volume
over time (numbers climbing). No PII exposed.
**Do (pick one):** use a random/opaque public booking ref, **or** require the
confirmation token even for the existence/status read.

### 6. Shorten fleet hero-image signed-URL TTL (LOW)
`public_team_fleet.hero_image_url` returns storage signed URLs that expire
~365 days out, inconsistent with `rent-public-media`'s 1-hour design.
**Do:** shorten the TTL (or serve hero images through the 1h media function).
If the long TTL is intentional for caching, confirm and we'll leave it.

---

## Not for Lovable

- **Decline-card / off-session partial-failure / webhook-redelivery /
  <72h-forfeit paths** — the red team exercises these with browser Stripe test
  cards; the happy paths and full refund are already verified.
- **Decline-terms legal copy** and the **live-flip go** — Gregory.
