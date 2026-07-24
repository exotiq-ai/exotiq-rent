# M6a — Payment Foundations (patch for the Lovable Cloud project)

Ref: `exotiq-rent/docs/rent/M6_MONEY_PLAN.md` (decisions M6-D1..D7).
Status: **READY TO APPLY — REV 2**, incorporating Lovable's 2026-07-23 spec
review. Applies on the Lovable Cloud side (this doc says "patch" because the
exotiq-rent agent never deploys to hosted Supabase; Lovable does).

## Rulings on the review's three questions

1. **Charge order: FLIPPED, agreed** (flag #1) — and improved: the rental is
   charged **on-session inside Checkout on the platform account as a
   destination charge** (`on_behalf_of` + `transfer_data.destination` =
   operator's connected account → operator's descriptor on the statement),
   with `setup_future_usage: 'off_session'` saving the card **platform-side**.
   The webhook then charges the smaller Exotiq portion off-session **also on
   the platform account** — which means **payment-method cloning is
   eliminated from the payment path entirely** (flag #2 dissolves; both PIs
   share one platform Customer + PM). Cloning survives only as the M6c
   deposit-hold nicety, in the platform→connected direction Stripe permits.
2. **`rent-checkout` is EVOLVED IN PLACE** (flag #3) — no `rent-create-payment`.
   The deployed function keeps its name and becomes the hosted-Checkout
   implementation; the existing `exotiq_payment_intent_id` /
   `operator_payment_intent_id` columns are reused as-is (Rev 2 of the
   migration adds no PI columns).
3. **Refund default <72h: operator rental NON-REFUNDABLE** (flag #7; ruled by
   Gregory 2026-07-23 = M6-D7). Matches fee/protection treatment; operators
   can override upward later.

## Contents

| File | What |
|------|------|
| `supabase/migrations/20260723090000_m6a_payment_foundations.sql` | `payment_expired` status; `payment_due_at` (48h clamped to pickup−2h, floor now+2h — flag #4); `paid_at`; `payment_stripe_mode` (sandbox ledger guard — nit #3); `teams.stripe_test_account_id`; expiry sweep |
| `supabase/functions/_shared/stripeMode.ts` | Mode from `STRIPE_SECRET_KEY` prefix; per-mode connected-account resolution with hard-fail |

## Lovable apply steps

1. Apply the migration via the established path.
2. Copy `_shared/stripeMode.ts` into `supabase/functions/_shared/`.
3. Create the **test-mode Connect account** for the Exotiq team — **USD**
   (flag #10) — and write its id to `teams.stripe_test_account_id` for team
   `c1de6533-ab44-4973-a123-007a8007b5ba`.
4. Register the **test-mode webhook endpoint** for the evolved `rent-checkout`
   flow (events: `checkout.session.completed`,
   `payment_intent.succeeded`, `payment_intent.payment_failed`); store its
   signing secret as `RENT_PAYMENT_WEBHOOK_SECRET`.
5. Confirm `STRIPE_SECRET_KEY` in edge env is `sk_test_…` for the QA window.
6. Command Center: label/color for `payment_expired` in
   `src/lib/bookingStatus.ts` (terminal, grey — "payment window expired");
   ledger/margin views exclude rows where `payment_stripe_mode = 'test'`.
7. Check the platform account's statement descriptor settings: M6b uses
   `statement_descriptor_suffix` (charset-safe `EXOTIQ RENT`, no dot —
   flag #5), composing with the account prefix. Confirm the prefix reads well.

## Verify after apply (M6a gate)

```sql
-- trigger clamps: approve a test booking with pickup 5 days out → due ≈ +48h;
-- approve one with pickup tomorrow → due ≈ pickup−2h (never past pickup).
-- sweep: service role → integer; anon → permission denied.
-- sandbox guard: any test payment rows carry payment_stripe_mode='test'
-- and are absent from operator ledger/margin views.
```

## M6b design contract (build after this patch is applied)

- **`rent-checkout` (evolved)** — anon + confirmation-token-gated; booking
  must be `pending_payment` and unexpired. Server re-derives all amounts from
  the fee snapshot (bodies never carry totals). Creates the platform Customer
  (dedupe by renter email — flag #9, and mirror email/name into the
  operator's `customers` row per the existing D6 pattern), then a Checkout
  session: `payment_method_types: ['card']` (off-session reuse guarantee —
  flag #2), line item = operator rental, destination charge per ruling #1,
  `setup_future_usage: 'off_session'`, success/cancel → the renter's tokened
  confirmation URL.
- **`rent-payment-webhook`** — verifies `RENT_PAYMENT_WEBHOOK_SECRET`; dedupes
  via the existing `stripe_webhook_events` table (flag #6); on rental PI
  success creates the Exotiq off-session PI (`statement_descriptor_suffix:
  'EXOTIQ RENT'`); stamps `payment_stripe_mode`; transition to `confirmed`
  fires only when **both PIs report succeeded**, idempotent under redelivery
  and event reordering. Partial failure (rental paid, Exotiq declined):
  booking stays `pending_payment` with retry surface + ops alert — the far
  less bad direction, per the flip. Expiry after partial failure auto-refunds
  nothing (rental keeps the booking payable; only the Exotiq leg retries).
- **Transfer/fee mechanics (M6-D2):** destination charge with
  `transfer_data.amount = rental − operator's Stripe fee share` (estimated at
  creation; optionally trued up from the balance transaction post-settlement).
  Each account nets its own processing cost.
- **Pay-link delivery (flag #8):** approval → transactional email to the
  renter carrying the tokened confirmation URL, and a reminder at due−24h —
  via the existing notifications/email path. **This is an M6b dependency on
  the Lovable side**; the renter app's confirmation page renders the pay CTA
  + countdown when status is `pending_payment`.
- **M6c nicety (flag #11):** `stripe-create-hold` prefers the saved
  platform PM cloned to the connected account at pickup, instead of re-asking
  for the card.
