# M5 booking writes — apply instructions (spark repo)

Same delivery pattern as `../idv/` (this agent cannot push to
`exotiq-spark-mvp-flow`): finished, apply-ready files with instructions.
Gate context: Gregory lifted the cutover gate for booking writes on
2026-07-22 (in-chat) after M2/M3/identity were applied collaboratively.

## Contents

```
supabase/migrations/20260722050000_renter_booking_writes.sql
supabase/functions/rent-create-booking/index.ts
```

## What the migration does

1. **D3 lifecycle states** — widens the bookings status CHECK with
   `requested / pending_documents / pending_payment / declined / refunded`.
   Existing operator statuses unchanged. (D3 rule: document for Lovable so
   the Command Center UI can map the new statuses — `requested` and
   `pending_documents` will start appearing on marketplace bookings.)
2. **D4 confirmation tokens** — `bookings.confirmation_token uuid` +
   `public_booking_by_ref(_booking_ref, _token)`: without the token, only
   existence + status; with it, the renter-safe summary (no PII, no ids).
3. **Double-booking guard (F-BUG-1-DB)** — `btree_gist` exclusion
   constraint on `(vehicle_id, tstzrange(start_date, end_date))`, **scoped
   to marketplace-source blocking rows** so legacy operator overlaps can't
   fail the apply. Marketplace-vs-operator overlap is caught by the
   pre-check inside the transactional function. Fleet-wide constraint =
   follow-up after Lovable dedupes historical operator overlaps.
4. **`create_marketplace_booking(...)`** — SECURITY DEFINER, revoked from
   anon/authenticated (service-role only): validates marketplace
   eligibility, composes pickup/return times in the team's timezone,
   re-checks overlap against ALL blocking bookings in-transaction, upserts
   the guest customer (D6, owner-attributed), inserts with
   `booking_source='marketplace'` (D2 — margin trigger fires), best-effort
   audit row.

## What the function does

`rent-create-booking` (anon POST): input validation + per-IP rate limit →
server-side re-quote via `public_vehicle_quote` (client totals never
trusted) → identity lookup by email (V7 reuse: verified + unexpired, any
team) → transactional create. Initial status: `requested` when already
verified, else `pending_documents` (ID plan V1 ruling: verification
confirms the booking after payment).

**Deliberately not included: Stripe Checkout URL.** The D1 money-flow
review (two separate statement charges) is still open with Gregory — wiring
`create-payment-checkout` now would bake in the wrong charge model. Payment
attach is M6, after that review.

## Apply steps

1. Copy both files into the same paths in `exotiq-spark-mvp-flow`.
2. `supabase/config.toml`:

   ```toml
   [functions.rent-create-booking]
   verify_jwt = false   # guest checkout; validation is in-function
   ```

3. Cross-check schema assumptions against repo reality (the step that
   caught the `is_active` drift last time): `bookings` columns
   (`team_id`, `customer_id`, `booking_ref` trigger, `booking_source`),
   `customers(user_id, team_id, email, full_name, phone)`,
   `teams(owner_id, timezone, slug)`, `user_activity_log(user_id, team_id,
   action, details)` — fix drift, note it in the PR.
4. Open PR; migration to Lovable via the established path; function
   deploys on repo sync.
5. Smoke (anon key):

   ```bash
   curl -s -X POST "$URL/functions/v1/rent-create-booking" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
     -H "Content-Type: application/json" -d '{
       "team_slug":"exotiq-","vehicle_slug":"2017-audi-s8",
       "start_date":"2026-08-04","end_date":"2026-08-07",
       "pickup_time":"10:00 AM","protection":"premium",
       "driver":{"name":"Gregory Ringler","email":"gregory.ringler@gmail.com","phone":"+13035550184"}
     }'
   # then, with the returned ref + token:
   curl -s -X POST "$URL/rest/v1/rpc/public_booking_by_ref" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
     -H "Content-Type: application/json" \
     -d '{"_booking_ref":"BK-01xxx","_token":"<confirmation_token>"}'
   # concurrency: fire the create twice in parallel for the same dates —
   # exactly one must succeed, the other must 409.
   ```
