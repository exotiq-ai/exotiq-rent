# M6 — Money Milestone Plan (2026-07-23)

> Goal: a renter pays for an approved booking and it becomes `confirmed`,
> with two clean statement lines — built and proven **entirely in Stripe
> test mode**, then flipped to live by configuration, not code.

## 1. Decisions (ruled by Gregory, 2026-07-23)

| # | Decision | Ruling |
|---|----------|--------|
| M6-D1 | Charge sequencing | **One card entry, two charges.** Checkout charges the **Exotiq portion on the platform account** (fee + protection, `EXOTIQ.RENT`) and saves the card (`setup_future_usage: off_session`); the webhook then clones the payment method to the operator's connected account and creates the **rental as a direct charge there** (operator's own descriptor). Renter sees two statement lines. *Mechanics note:* Stripe only clones payment methods platform → connected, and the Command Center already uses direct charges on connected accounts — this ordering is the buildable one, and it makes M6-D2 automatic (each account pays its own processing fee natively). Full design in `patches/m6a-payment-foundations/README.md`. |
| M6-D2 | Processing fees | **Each party absorbs their own.** Operator nets rental minus Stripe's cut; Exotiq absorbs the cut on its own charge. No renter surcharges. |
| M6-D3 | Deposit hold | **Operator places it at pickup** via the Command Center (`stripe-create-hold`, already live). No scheduled auto-holds — avoids the 7-day authorization-expiry trap. |
| M6-D4 | Payment window | **48 hours** from operator approval. Unpaid bookings expire and the dates release back to the calendar. |
| M6-D5 | Refunds (defaults, legal review pending) | ≥72h before pickup: full refund of both charges (matches live UI copy). <72h: booking fee + protection non-refundable, operator rental per operator policy. Operator decline after payment: automatic full refund of both charges. |
| M6-D6 | Descriptors | Platform charge: `EXOTIQ.RENT`. Operator charge: the operator's own Stripe descriptor. |

## 2. Sandbox-first: what differs between test and live

Same building blocks, different configuration. Everything below must be
**config, never hardcode** — the live flip is then a value swap + smoke.

| Item | Test | Live |
|------|------|------|
| Edge secret `STRIPE_SECRET_KEY` | `sk_test_…` (already in place — IDV runs test mode) | `sk_live_…` |
| Webhook signing secret | test endpoint's `whsec_…` | live endpoint's `whsec_…` (endpoints are registered per mode) |
| Renter app `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` or absent (hosted flows) | `pk_live_51S30O7…` (on file) |
| Operator connected account | **must be created** — a test-mode Express account for the Exotiq team, stored per-tenant (e.g. `teams.stripe_test_account_id` or a mode-aware lookup) | `acct_1TvnfgQfNJmCrgjR` (onboarded, verified) |
| Cards / IDs | Stripe test cards (4242…, decline variants) | real cards |

The per-tenant **test account mapping is the only new building block** the
sandbox requires. Everything else is identical code paths.

## 3. Build phases

Backend work ships as patches under `docs/rent/patches/m6-*/` (spark repo /
Lovable applies — agents never touch hosted Supabase). Frontend ships as
exotiq-rent PRs. Red team can keep working the current deploy throughout —
every new path is gated behind `pending_payment`, which nothing reaches today
without operator approval.

### M6a — Foundations (spark patch)
- Migration: `bookings.payment_due_at`, `operator_payment_intent_id`,
  `platform_payment_intent_id`, `paid_at`; `payment_expired` handling
  (expire → release dates → notify).
- Per-tenant test-account mapping + mode-aware Stripe client helper shared
  by the money functions.
- Test-mode Connect account for the Exotiq team; test webhook endpoint
  registered; secrets confirmed in edge env.
- **Gate:** helper resolves the right account/key per mode in a unit-style
  Deno test; approval flips a booking to `pending_payment` with
  `payment_due_at = now() + 48h`.

### M6b — Renter checkout + webhook (spark patch + rent PR)
- `rent-create-payment` (anon, confirmation-token-gated): booking must be
  `pending_payment` and unexpired; server re-derives amounts from the fee
  snapshot; mints the Checkout session per M6-D1; returns hosted URL.
- Webhook: `checkout.session.completed` → record operator PI → immediately
  create the off-session platform PI (fee + protection) → both succeeded →
  `confirmed`. Partial-failure path: rental paid but platform charge
  declined → booking `pending_payment` with a retry surface + ops alert
  (never silently confirmed). Idempotent on event redelivery.
- Renter app: confirmation page gains a `pending_payment` state ("Your
  booking is approved — complete payment", countdown to `payment_due_at`,
  pay CTA → hosted Checkout) and a paid/confirmed receipt state showing the
  two charges.
- **Gate:** test-mode E2E — reserve → approve in Command Center → pay with
  4242 → two PIs visible in Stripe test dashboard → status `confirmed` →
  confirmation page shows receipt. Decline-card and abandoned-checkout
  paths behave.

### M6c — Refunds & cancellation (spark patch + rent PR)
- Renter cancel endpoint (token-gated) honoring M6-D5; operator decline
  after payment auto-refunds both PIs.
- Renter app: cancel affordance on the confirmation page with window-aware
  copy.
- **Gate:** test-mode refunds land on both charges; ledger fields update.

### M6d — Expiry & notifications (spark patch)
- 48h sweep: `pending_payment` past due → expired, dates released,
  renter + operator notified. (Mechanism per spark conventions — scheduled
  function or Command Center-triggered.)
- **Gate:** simulated overdue booking releases its dates.

### M6e — Live flip (config only, Gregory approves)
- Swap: `sk_live`, live `whsec`, restore `pk_live` on the book site, live
  account mapping. Descriptor check on a real ~$1 rental against the live
  Connect account (same pattern as the 2026-07-21 $1 hold test), refund it.
- **Gate:** Gregory sees both statement lines on a real statement and says
  go.

## 4. Needed from Gregory / Lovable

1. **Lovable (at M6a):** apply the patches; create the test-mode Connect
   account for the Exotiq team; register the test webhook endpoint + drop
   its signing secret into edge env; confirm `STRIPE_SECRET_KEY` in edge
   env is the test key for the QA window.
2. **Gregory (before M6e only):** decline-terms + refund legal copy final
   pass; the live-flip go/no-go.
3. Nothing else — M6-D1…D6 above unblock all build work.

## 5. Out of scope for M6

Extras charging (extras remain operator-collected at pickup for now),
multi-currency (Orion/GBP tested post-M6), payouts scheduling (Stripe
defaults), the marketplace gold rebrand.
