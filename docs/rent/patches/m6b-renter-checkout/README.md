# M6b — Renter Checkout + Payment Webhook (patch for the Lovable Cloud project)

Ref: `exotiq-rent/docs/rent/M6_MONEY_PLAN.md` (M6-D1 rev 2, D2, D4, D6) and
`../m6a-payment-foundations/README.md` (design contract + rulings).
Depends on: **M6a applied first** (status, payment_due_at trigger,
stripe_test_account_id, `_shared/stripeMode.ts`, test webhook endpoint).
Status: READY TO APPLY — test mode.

## Contents

| File | What |
|------|------|
| `supabase/migrations/20260723120000_m6b_renter_payment.sql` | Fee/protection snapshot columns; `create_marketplace_booking` persists them (old signature dropped, permission posture re-applied); `public_booking_by_ref` returns `payment_due_at`, `paid_at`, tier + snapshot cents (token-gated) |
| `supabase/functions/rent-checkout/index.ts` | **Replaces the 2026-07-22 draft in place** (flag #3 ruling). Hosted Checkout per M6-D1 rev 2: rental on-session as destination charge (`on_behalf_of` → operator descriptor), card-only, card saved platform-side; refuses expired windows, missing snapshots, and double-payment (`rental_already_paid`) |
| `supabase/functions/rent-payment-webhook/index.ts` | Verifies `RENT_PAYMENT_WEBHOOK_SECRET`; dedupes via `stripe_webhook_events` (row released on handler error so redelivery reprocesses); charges the Exotiq leg off-session (`EXOTIQ RENT` suffix, per-leg idempotency key); `confirmed` only when **both** PIs recorded; partial failure → `pending_payment` + ops alert |
| `supabase/functions/rent-create-booking/index.ts` | M5 function updated: passes the fee snapshot to the RPC and **strips `deposit_cents` out of `total_value`** (see bug note) |

## ⚠️ Bug note for Lovable (independent of this patch)

Since the 2026-07-22 quote update rolled `deposit_cents` into
`operator_total_cents`, the **deployed** `rent-create-booking` has been
storing `total_value` inflated by the deposit ($1,500 on most Exotiq
vehicles). Any marketplace bookings created since then carry the wrong
`total_value` — worth a one-off data pass, and it's why this patch computes
`total_value = operator_total_cents − deposit_cents`.

## Lovable apply steps

1. Apply the migration (after M6a's).
2. Deploy the three functions (`rent-checkout` replaces the existing one;
   `rent-payment-webhook` + updated `rent-create-booking`).
   `config.toml`: `verify_jwt = false` for `rent-checkout` and
   `rent-payment-webhook` (Stripe/guests call them), matching
   `rent-create-booking`.
3. Point the M6a-registered test webhook endpoint at
   `/functions/v1/rent-payment-webhook` (events:
   `checkout.session.completed`, `payment_intent.succeeded`,
   `payment_intent.payment_failed`) and confirm `RENT_PAYMENT_WEBHOOK_SECRET`
   matches it.
4. `stripe_webhook_events` dedupe insert uses columns
   `(event_id, event_type)` — align names if the deployed table differs.
5. **Approval email (flag #8):** on `requested → pending_payment`, send the
   renter the tokened confirmation URL
   (`https://book.exotiq.rent/booking/{ref}?t={token}`) via the existing
   transactional path, plus a reminder at `payment_due_at − 24h`. The renter
   app's pay CTA lives on that page.

## Verify after apply (M6b gate — all test mode)

1. Create a booking on book.exotiq.rent → row has `protection_tier`,
   `platform_fee_cents`, `protection_total_cents`; `total_value` excludes
   the deposit.
2. Approve it in the Command Center → `pending_payment`, `payment_due_at`
   stamped (≈+48h, clamped to pickup−2h).
3. `public_booking_by_ref` with token returns the payment fields; without
   token returns only existence + status.
4. Pay with `4242 4242 4242 4242` → two PIs in the Stripe **test** dashboard
   (rental with transfer to the test connected account; Exotiq leg with
   `EXOTIQ RENT` suffix) → booking `confirmed`, `paid_at` set,
   `payment_stripe_mode = 'test'`, excluded from operator ledger views.
5. Decline card (`4000 0000 0000 0002`) → booking stays `pending_payment`;
   retry works. Off-session decline simulation
   (`4000 0025 0000 3155` needs-auth card) → partial-failure path: rental
   paid, booking `pending_payment`, `renter_payment_partial_failure` in
   `user_activity_log`, renter checkout refuses with `rental_already_paid`.
6. Webhook redelivery of a processed event → `{received, duplicate}`; no
   double charge (per-leg idempotency keys).
7. `expire_overdue_payment_bookings()` on an overdue test booking →
   `payment_expired`, dates immediately bookable again.
