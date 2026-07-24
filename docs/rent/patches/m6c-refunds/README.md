# M6c — Refunds & Cancellation (patch for the Lovable Cloud project)

Ref: `exotiq-rent/docs/rent/M6_MONEY_PLAN.md` (M6-D5 defaults + M6-D7).
Depends on: **M6a and M6b applied first.** No migration — statuses
(`cancelled`, `refunded`) and all columns already exist.
Status: READY TO APPLY — test mode.

## Contents

| File | What |
|------|------|
| `supabase/functions/rent-cancel-booking/index.ts` | Renter self-serve cancel (anon + confirmation token). ≥72h before pickup: full refund of both legs (rental `reverse_transfer`, Exotiq plain) → `refunded`; unpaid → `cancelled`. <72h: forfeit-all (M6-D5/D7) — requires an explicit `acknowledge_forfeit: true` in the body on top of the UI warning → `cancelled`, no refunds. Partial-refund failure keeps the status and alerts ops (`renter_cancel_refund_failed`); retries are idempotent per leg. |
| `supabase/functions/rent-refund-booking/index.ts` | Operator/Command-Center full refund (verify_jwt, team-membership-checked). Refunds both legs and flips to `refunded`. |

## Lovable apply steps

1. Deploy both functions. `config.toml`: `verify_jwt = false` for
   `rent-cancel-booking` (token is the credential), `true` for
   `rent-refund-booking`.
2. **Command Center wiring:** when an operator declines a booking whose
   `paid_at` is set, call `rent-refund-booking` (M6-D5: decline after
   payment auto-refunds in full). Also expose it behind any manual
   "Refund booking" action you want operators to have.
3. Statuses `cancelled` / `refunded` should already render in
   `bookingStatus.ts`; confirm the marketplace lifecycle colors read
   sensibly for both.

## Verify after apply (M6c gate — test mode)

1. Paid test booking ≥72h out → renter cancel → both refunds appear in the
   Stripe test dashboard (rental refund pulls the transfer back), status
   `refunded`, dates released (refunded is not a blocking status).
2. Unpaid booking → renter cancel → `cancelled`, no Stripe activity.
3. Paid booking <72h out → cancel without `acknowledge_forfeit` → 409
   `forfeit_ack_required`; with it → `cancelled`, **no refunds**.
4. Operator declines a paid booking in CC → `rent-refund-booking` fires →
   `refunded` + both refunds visible.
5. Re-run any refund call → idempotent (no double refunds).
6. `active` / `completed` bookings → renter cancel returns 409.
