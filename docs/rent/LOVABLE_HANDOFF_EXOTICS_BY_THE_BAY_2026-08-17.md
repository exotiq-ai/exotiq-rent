# Lovable handoff — Exotics by the Bay go-live (backend/Command Center needs)

Date: 2026-08-17 · From: Claude (renter-app side) · Context: first REAL
third-party tenant. Real payments, real Stripe Identity, real emails. This
list is what the go-live needs from the Lovable side; the renter-app gaps are
tracked separately (tickets T-5..T-9 in the exotiq-rent factory) and are not
your work — they're listed only where a fix spans both sides.

Source: adversarially-verified renter-app audit, 2026-08-17 (35 findings, 6
lenses, each blocker independently confirmed in code). Ask Gregory for the
full list if useful.

---

## 1. BLOCKER — the state fee is Colorado's number, about to be charged to California renters

`public_vehicle_quote` returns `state_fee_cents` ($5.89/day) sourced from a
Colorado figure. It is charged today to an Arizona operator's renters and
will be charged to Exotics by the Bay's California renters the moment they
go live. Needed:

- A per-state (or per-team) daily-rate source: `team.state → state fee
  cents/day`, with correct **CA** and **AZ** values (Gregory to supply the
  authoritative rates).
- `public_vehicle_quote` AND the booking snapshot write must both read it —
  the quote shown, the snapshot stored, and the charge taken must stay
  identical (this parity is asserted daily by the renter-side canary).
- If a state has NO such fee, return 0 — the renter app hides the line when
  the value is 0.

Renter-side counterpart (ours, T-7): the line will be labeled from
`team.state` ("CA rental fee") instead of the current generic "State rental
fee". No other renter-side dependency.

## 2. BLOCKER — renter transactional emails are Drive Exotiq-branded for every tenant

All renter templates (payment-approved, payment-reminder, receipt-confirmed,
refund-confirmation, booking-request) carry Drive Exotiq branding. An
Exotics by the Bay renter would get a receipt from a brand they never booked
with — and Drive Exotiq is the OWNER's fleet, i.e. a competing operator's
brand on their customer's receipt. Needed:

- Tenant-aware templates: operator name in the subject/body ("Your Exotics
  by the Bay booking…"), platform brand as sender-of-record.
- Decision from Gregory (copy him): what IS the platform sender brand on
  email — "Drive Exotiq" (current), "Exotiq", or "Exotiq Rent"? The renter
  app has the same open question for page titles; the two should match.
- Same check for any drip campaigns: templates must read the tenant name
  from the DB (the business-name rename on 2026-08-16 proved DB-driven copy
  updates live in ~5 min; hardcoded copy never does).

## 3. Tenant-onboarding audit checklist — data the renter app depends on

Add these to your Command Center audit for this tenant; each has a
renter-visible failure mode:

| Field | Renter-visible failure if missing/wrong |
| --- | --- |
| `hero_image_url` on EVERY listed vehicle | Imageless vehicles are filtered from the storefront grid — a sparse tenant renders as "No vehicles are listed right now" while the fleet sits in the DB |
| `public_description` | A placeholder bio renders as the operator's own words (and currently makes claims like "concierge-approved" they never made) |
| `timezone` = `America/Los_Angeles` | Pickup times and rental dates render shifted; the 72h cancel window computes wrong |
| `state` = `CA` | Drives the state-fee label AND (after item 1) the rate |
| `phone` | "Call {operator}" buttons render dead or hidden; renters have no contact path |
| Slug chosen deliberately, then never changed | Renames don't move slugs (good) — but printed QR codes / links live forever |
| Connect: `charges_enabled` + `payouts_enabled` | rent-checkout destination charges fail |
| Connect: **statement descriptor set** | Renters see the operator's charge on their statement under whatever Stripe falls back to — dispute bait. Set it during onboarding |
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
remains true for a `America/Los_Angeles` team, and that
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
