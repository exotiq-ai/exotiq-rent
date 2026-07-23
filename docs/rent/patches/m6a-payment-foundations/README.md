# M6a — Payment Foundations (patch for exotiq-spark-mvp-flow)

Ref: `exotiq-rent/docs/rent/M6_MONEY_PLAN.md` (decisions M6-D1..D6).
Status: **READY TO APPLY** (test mode — no live money paths touched).

## Contents

| File | What |
|------|------|
| `supabase/migrations/20260723090000_m6a_payment_foundations.sql` | `payment_expired` status, payment-tracking columns, `teams.stripe_test_account_id`, 48h `payment_due_at` trigger, expiry-sweep function |
| `supabase/functions/_shared/stripeMode.ts` | Mode-aware helper: mode from `STRIPE_SECRET_KEY` prefix; per-mode connected-account resolution with hard-fail |

## Lovable apply steps

1. Apply the migration via the established path.
2. Copy `_shared/stripeMode.ts` into `supabase/functions/_shared/`.
3. **Create a test-mode Connect account** for the Exotiq team (Express is
   fine; test onboarding accepts dummy data) and write its `acct_…` id to
   `teams.stripe_test_account_id` for team `c1de6533-ab44-4973-a123-007a8007b5ba`.
4. **Register a test-mode webhook endpoint** (events:
   `checkout.session.completed`, `payment_intent.payment_failed`) pointing at
   the future `rent-payment-webhook` function URL; store its signing secret
   as `RENT_PAYMENT_WEBHOOK_SECRET` in edge env. (Function ships in M6b —
   registering now means no Stripe-dashboard round-trip later.)
5. Confirm `STRIPE_SECRET_KEY` in edge env is currently `sk_test_…` (expected
   — Identity already runs test mode).
6. Command Center UI: add a label/color for the new `payment_expired` status
   in `src/lib/bookingStatus.ts` (terminal, grey — "payment window expired").

## Verify after apply

```sql
-- status widened
INSERT-free check: SELECT conname FROM pg_constraint WHERE conname='bookings_status_check';
-- trigger stamps the clock
UPDATE bookings SET status='pending_payment' WHERE booking_ref='<a test booking>';
SELECT payment_due_at FROM bookings WHERE booking_ref='<same>';  -- ≈ now()+48h
-- sweep is callable by service role only
SELECT expire_overdue_payment_bookings();  -- as service role: integer; as anon: permission denied
```

## Design note for M6b (charge mechanics — read before building)

The Command Center already charges operators via **direct charges on the
connected account** (`stripeAccount` header in `create-payment-checkout`).
M6b therefore implements M6-D1's "one card entry, two charges" as:

1. `rent-create-payment` (anon, confirmation-token-gated): Checkout session
   **on the platform account** for the **Exotiq portion** (booking fee +
   protection, `EXOTIQ.RENT` descriptor), with `setup_future_usage:
   'off_session'` and a platform Customer — this saves the card
   platform-side, which is the only direction Stripe allows cloning from.
2. `rent-payment-webhook` on `checkout.session.completed`: clone the saved
   payment method to the operator's connected account
   (`stripe.paymentMethods.create({ customer, payment_method }, { stripeAccount })`)
   and create the **rental PaymentIntent as a direct charge there**
   (off-session, confirm immediately). Operator's own descriptor and their
   own Stripe processing fee (M6-D2 satisfied natively; same for the
   platform charge).
3. Both PIs recorded on the booking → status `confirmed`. If the rental
   charge declines after the Exotiq charge succeeded: booking stays
   `pending_payment` with a retry surface and an ops alert; if the window
   then lapses, expiry auto-refunds the Exotiq charge (M6c wires the refund;
   until then the alert covers it). Never silently `confirmed`.
4. Idempotency: webhook handlers key on `event.id` + booking id; PI creates
   pass an idempotency key derived from `booking_ref` + leg.

Amounts are always re-derived server-side from the booking's fee snapshot —
request bodies never carry totals.
