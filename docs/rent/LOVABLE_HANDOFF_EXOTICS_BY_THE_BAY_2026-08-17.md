# Lovable handoff — Exotics by the Bay go-live (backend/Command Center needs)

Date: 2026-08-17 · From: Claude (renter-app side) · Context: first REAL
third-party tenant. Real payments, real Stripe Identity, real emails. This
list is what the go-live needs from the Lovable side; the renter-app gaps are
tracked separately (tickets T-5..T-9 in the exotiq-rent factory) and are not
your work — they're listed only where a fix spans both sides.

Source: adversarially-verified renter-app audit, 2026-08-17 (35 findings, 6
lenses, each blocker independently confirmed in code). Ask Gregory for the
full list if useful.

*Updated 2026-08-17 evening after live verification against the deployed
tenant (Tampa, **FL** — the first draft wrongly assumed California; all
geography below corrected).*

---

## 0. BLOCKER (breaks the booking test running right now) — Identity sessions are TEST-mode in production

`identity-create-session` reads `STRIPE_IDENTITY_SECRET_KEY ??
STRIPE_SECRET_KEY` (index.ts:65-66). The main key went live at the 2026-08-01
cutover, but **`STRIPE_IDENTITY_SECRET_KEY` still holds a sandbox key and
overrides the fallback** — every renter ID verification is created in test
mode (live account shows zero Identity sessions ever).

Fix — one secret + redeploy:
1. Set `STRIPE_IDENTITY_SECRET_KEY` to the live secret key (or delete the
   var entirely so the live fallback applies).
2. Redeploy `identity-create-session` and `identity-session-status`.

Everything else is already in place and verified 2026-08-17: live-mode
Identity is **activated** (a live session was created and cancelled as
proof: `vs_1U5ZIjHO7nC3pJiP4JSNkfAP`), and `STRIPE_IDENTITY_WEBHOOK_SECRET`
already matches the live endpoint `we_1TzjjMHO7nC3pJiPlSjl6FeB` (enabled,
all 5 events). After the flip, one real verification through the booking
flow confirms end-to-end. (Tracked renter-side as T-10.)

## 1. State fee — SHIPPED and verified live; one confirmation requested

The live quote for this tenant now returns `state_code: "FL"`,
`state_fee_label: "FL rental fee"`, `state_fee_daily_cents: 200` — correct
Florida surcharge, per-tenant. Nice work; this closes the old
Colorado-figure blocker. Remaining:

- **Confirm the source of truth is the tenant's Command Center settings**
  (Gregory's requirement: "state rental fee needs to match tenant command
  center") — i.e. operators/admins can see and maintain the value per team,
  and quote + booking snapshot + charge all read the same source.
- If a state has NO such fee, return 0 — the renter app hides the line.

Renter-side counterpart (ours, T-7): consume the server's
`state_fee_label` instead of the hardcoded "State rental fee" text.

## 2. BLOCKER — renter transactional emails are Drive Exotiq-branded for every tenant

All renter templates (payment-approved, payment-reminder, receipt-confirmed,
refund-confirmation, booking-request) carry Drive Exotiq branding. An
Exotics by the Bay renter would get a receipt from a brand they never booked
with — and Drive Exotiq is the OWNER's fleet, i.e. a competing operator's
brand on their customer's receipt.

Gregory's requirement (2026-08-17): **tenant name in the email flow, with
the tenant's support email as the reply-to, sourced from the Command
Center.** The plumbing hook already exists — `send-renter-email` accepts
`body.replyTo` (index.ts:97, falls back to `RENTER_EMAIL_REPLY_TO` →
`support@exotiq.ai`). Needed:

- A per-team **support email** field in Command Center settings.
- Every caller of `send-renter-email` (approval, reminder, receipt, refund)
  passes the team's support email as `replyTo` and puts the tenant name in
  the subject/body ("Your Exotics By The Bay booking…").
- The from-header display name (`RENTER_EMAIL_FROM`, currently "Drive
  Exotiq <bookings@exotiq.rent>") needs Gregory's platform-brand decision —
  "Drive Exotiq", "Exotiq", or "Exotiq Rent"; the renter app's page titles
  will match whatever he picks.
- Same check for any drip campaigns: templates must read the tenant name
  from the DB (the business-name rename on 2026-08-16 proved DB-driven copy
  updates live in ~5 min; hardcoded copy never does).

## 2b. NEW — operator tax as a first-class quote field (charged by the tenant)

Gregory's requirement (2026-08-17): tax rate is tenant-specific, set in
**Command Center fleet settings**, shown to the renter as a line item, and
charged **by the tenant** — inside the operator leg of the destination
charge, never the Exotiq leg. Verified live today: the quote has no tax
field at all (`operator_total_cents == rental_subtotal_cents`). Needed:

- Tax rate in CC fleet settings (per team).
- `public_vehicle_quote`: add `operator_tax_rate`, `operator_tax_cents`
  (and a label if you want jurisdiction naming), with
  `operator_total_cents = rental_subtotal + tax`.
- Booking snapshot: persist the tax amount alongside the existing fee
  columns; `public_booking_by_ref` exposes it.
- `rent-checkout`: the operator leg (`rentalCents`) must include the tax so
  the tenant receives and remits it; the transfer still nets only their own
  Stripe fee share.
- Keep quote == snapshot == charge identical — the renter-side canary will
  gain a tax assertion the day this ships.

Renter-side counterpart (ours, T-11): render the line item in the operator
section ("Tax — charged by {operator}") on review, pay, confirmation and
receipt. Blocked until your fields exist.

## 2c. Verified, no action — the 10% stays renter-side only

Confirmed in the deployed `rent-checkout` (2026-08-17): the operator
receives `rental − their own Stripe fee share`; **no application fee or
platform cut is deducted from the tenant.** The 10% platform fee is charged
to the renter inside the Exotiq leg. That matches Gregory's directive
("10% charged to renter stays, no 10% charge to the tenant yet") — nothing
to change; this item exists so nobody "fixes" it in the other direction.

## 3. Tenant-onboarding audit checklist — data the renter app depends on

Add these to your Command Center audit for this tenant; each has a
renter-visible failure mode:

| Field | Renter-visible failure if missing/wrong |
| --- | --- |
| `hero_image_url` on EVERY listed vehicle | Imageless vehicles are filtered from the storefront grid — a sparse tenant renders as "No vehicles are listed right now" while the fleet sits in the DB |
| `public_description` | A placeholder bio renders as the operator's own words (and currently makes claims like "concierge-approved" they never made) |
| `timezone` = `America/New_York` (✓ verified set) | Pickup times and rental dates render shifted; the 72h cancel window computes wrong |
| `state` = `FL` (✓ verified set) | Drives the state-fee label AND rate |
| `phone` | "Call {operator}" buttons render dead or hidden; renters have no contact path |
| Slug chosen deliberately, then never changed | Renames don't move slugs (good) — but printed QR codes / links live forever |
| Connect: `charges_enabled` + `payouts_enabled` (✓ verified: `acct_1U45i2Qb9rGw6gmn`, both true) | rent-checkout destination charges fail |
| Connect: **statement descriptor set** (✓ verified: `EXOTICSBYTHEBAY.CO`) | Renters see the operator's charge on their statement under whatever Stripe falls back to — dispute bait. Set it during onboarding |
| Platform fee % set (not 0) | The 0%-fee audit of 2026-07-31 found 18 teams at 0 before correction — verify this tenant's row |

## 4. Cancellation-policy truth (renter copy is currently wrong — we need the real policy)

The renter app claims post-72h refunds "follow {operator}'s policy" while
`rent-cancel-booking` flat-forfeits after the window. Before this tenant
goes live, confirm the intended marketplace policy: is 72h-full-refund /
after-that-forfeit the platform standard for every tenant? Any operator
override? We will rewrite the renter copy (T-6) to state exactly what the
backend does — so what the backend does needs to be the deliberate answer,
not the accident.

## 5. Timezone semantics — one confirmation, no change expected

`create_marketplace_booking` composes `start_date` from local date+time cast
via the team's timezone (verified 2026-07-26 on a real write). Confirm that
remains true for an `America/New_York` team, and that
`public_booking_by_ref` continues returning instants (it does). Renter-side
(T-3) will render those instants in the TEAM's timezone instead of the
viewer's. Optional nice-to-have: add `timezone` to `public_booking_by_ref`'s
row so the confirmation can render correctly even when the catalog RPC is
down (pairs with our T-9 resilience fix); we currently fetch it via
`public_team_by_slug`.

## 6. Stripe Identity — nothing tenant-specific, one operational check

Verification is platform-level (marketplace-wide reuse), live webhooks were
set up 2026-08-01, nothing to configure per tenant. One operational item:
`manual_review` notifications route to the tenant's team members — confirm
Exotics by the Bay staff will actually see that queue in their Command
Center, because with real IDs the 3-strikes → manual-review path WILL fire.

## 7. Known backend items already on your list (unchanged, restated for the record)

- `identity-webhook` has no per-event dedupe and double-counts
  `attempt_count` on duplicate delivery (can push a renter to manual review
  one failure early) — flagged 2026-08-01, spark PR #29 sidebar.
- The connected-accounts webhook endpoint + `STRIPE_CONNECT_WEBHOOK_SECRET`
  are live (4 endpoints, 2026-08-01). New-tenant Connect onboarding events
  (`account.updated`) flow through it — no action, context only.

---

*Reply-to for questions: Gregory. Renter-app tickets T-5..T-9 land via
exotiq-rent PRs and do not require Lovable action.*
