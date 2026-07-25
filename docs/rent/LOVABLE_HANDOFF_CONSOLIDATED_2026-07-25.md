# Lovable Handoff — Consolidated Pre-Launch Findings (2026-07-25)

Standalone (no repo pull needed). Distilled from a 217-agent deep audit of both
repos plus live sandbox testing. Renter-frontend blockers are already fixed and
shipped by Claude (exotiq-rent PRs #35–40); **everything below is backend /
Command Center and owned by Lovable or is a Gregory decision.** Findings are
verified against the *deployed* spark code unless noted.

Ordered by severity. Several share one root cause — the **partial-failure money
state** (rental leg captured, Exotiq leg not) — called out first because fixing
it resolves a cluster.

## Executive summary — start here

**Verdict: still NO-GO for live payments.** Renter-frontend is in good shape
(all frontend blockers fixed and shipped). The remaining launch-blockers are
backend, and most collapse into three root causes:

**Cluster A — the partial-failure money state (fix this first; resolves items
1–5, 10, 13).** The whole money layer keys off `paid_at` / `pending_payment`
and has no concept of "rental captured, Exotiq leg not." Consequences, all
verified in deployed code: a booking whose rental was captured but whose
Exotiq leg declined (a) is never refunded on cancel (`paid` is judged from
`paid_at` alone), (b) is marked `payment_expired` by the sweep with the
$1,500 rental kept and no refund, and (c) has no renter retry path (the
per-leg idempotency key locks in the decline). **Fix:** track the rental
capture explicitly (the `operator_payment_intent_id` column already exists);
make cancel/refund/expiry all check it, refund a captured rental whenever the
booking ends unpaid, and never expire a booking with a captured leg without
refunding.

**Cluster B — operator (Command Center) money integrity (items 12, 14–16).**
A fully paid marketplace booking shows as *unpaid* with "Collect Deposit" in
the Payments view; declining/cancelling a paid booking issues no refund
(`rent-refund-booking` is never called from the CC); and editing a
pending_payment booking reprices it at the vehicle's *current* rate while
`rent-checkout` still charges the original snapshot. **Fix:** read the
booking's payment fields for paid state; wire the decline/cancel actions to
`rent-refund-booking`; block or re-quote-and-re-notify on edits to
marketplace bookings.

**Cluster C — identity + security (items 9, 20; verified exploitable today).**
`identity-create-session` resolves the customer from a client-supplied email
used as an unescaped ILIKE pattern with no token check — I confirmed live that
`qa-redteam-one@example.co%` returns a *verified* session for a customer the
caller has no relationship to. An attacker who knows (or wildcards) a renter's
email can hijack their verification or lock them out. **Fix:** gate the guest
path on `booking_ref` + `confirmation_token`, derive the customer from that
booking, match email with `.eq` (not `ilike`), and add rate limiting.

Then two Gregory decisions block real money regardless of code: the **deposit
hold** cannot be placed for marketplace renters (`stripe-create-hold` has no
renter caller — item 7), and **`pending_documents` is terminal** — nothing
promotes a booking after the renter verifies late (item 8). And the
**protection decline-terms legal copy** is still placeholder.

## Already verified FIXED (no action — context)

- Marketplace approval now lands on `pending_payment` (BK-03456 verified).
- Availability RPC and create-overlap now share one status set (F2).
- Photo bucket is public — no more long-lived signed URLs (F5/H1).
- Rate limiting is persistent; enumeration closed; invalid tiers 400; cron
  registered (red-team F1/F3/F4/F7).

---

## 1. [BLOCKER · LAUNCH-BLOCKING] — Lovable
**Captured rental leg is invisible to both refund paths — a partial-failure or raced booking keeps the renter's money with no booking**

`supabase/functions/rent-cancel-booking/index.ts`:119

- **Impact:** 3 nights @ $500 (the M6b gate shape): rental $1,500 is captured on-session and transferred to the operator's connected account; the off-session Exotiq leg ($150 fee + $867 protection = $1,017) declines, so paid_at stays NULL and status stays pending_payment. The renter clicks Cancel 5 days before pickup → `paid` is false → NO refund is attempted → status flips to 'cancelled' and the log records `refunded: false`. Ops then calls rent-refund-booking → 409 "Booking has no captured payment to refund". The renter is out $1,500 with a cancelled booking and the only remedy is a hand refund in the Str
- **Fix:** Gate both refund paths on the presence of PI ids (operator_payment_intent_id / exotiq_payment_intent_id, excluding the 'none_required' sentinel) rather than paid_at, refunding each leg that actually has a captured PI; or stamp a captured marker (e.g. rental_paid_at) the moment the rental PI is recorded and treat it as refundable.

## 2. [BLOCKER · LAUNCH-BLOCKING] — Lovable
**Expiry sweep marks a booking payment_expired even when the rental was already captured — no refund, dates released**

`supabase/migrations/20260723090000_m6a_payment_foundations.sql`:91

- **Impact:** Same $1,500 example: after the Exotiq leg declines, the booking sits pending_payment with the rental captured. When the 48h window lapses the sweep flips it to payment_expired and (per the migration's own comment, payment_expired is absent from every overlap list) releases the dates to another renter. The renter has paid $1,500, has no booking, and no code path refunds it. The renter-facing UI even says the window closed: PaymentCard.tsx:121 "The 48-hour payment window for this booking has passed and the dates may have been released."
- **Fix:** Exclude rows with operator_payment_intent_id IS NOT NULL from the sweep and route them to an ops queue, or auto-refund the captured rental (reverse_transfer) as part of expiring them.

## 3. [BLOCKER · LAUNCH-BLOCKING] — Lovable
**Webhook silently abandons a captured rental charge when the booking has left pending_payment (expired/cancelled/declined)**

`supabase/functions/rent-payment-webhook/index.ts`:145

- **Impact:** The renter's card is charged the full rental (destination charge, funds transferred to the operator) and the webhook throws the fact away: the `.eq("status","pending_payment")` update matches 0 rows so `operator_payment_intent_id` is never even recorded, then `break` returns 200 with no refund, no status change and — unlike the decline branch — no `opsAlert`. Two realistic triggers: (a) the renter opens hosted Checkout, cancels the booking from the confirmation page in another tab (`CANCELLABLE` includes `pending_payment`, and nothing calls `stripe.checkout.sessions.expire`), then completes th
- **Fix:** In the `checkout.session.completed` branch, when the booking is not `pending_payment`, do not `break` silently: record `operator_payment_intent_id` unconditionally, fire `opsAlert(db, bookingRef, 'renter_payment_after_terminal_state', {status, operatorPi})`, and auto-refund the rental leg (`refunds.create({payment_intent, reverse_transfer:true}, {idempotencyKey:'auto-refund-rental-'+ref})`) when the booking is in a terminal state. Also call `stripe.checkout.sessions.expire()` for any open sessio

## 4. [BLOCKER · LAUNCH-BLOCKING] — Lovable
**Expiry sweep expires bookings whose rental leg was already captured — contradicts the M6a design and destroys the partial-failure recovery path**

`supabase/migrations/20260723090000_m6a_payment_foundations.sql`:90

- **Impact:** The documented partial-failure state (rental captured, Exotiq fee+protection declined off-session, booking deliberately left `pending_payment` — rent-payment-webhook lines 197-207) is swept into `payment_expired` as soon as the 48h clock runs out. The renter has paid the operator $1,500, the booking dies, the dates are released, and per M6d the renter gets a "payment window expired" email. Worse, there is no retry surface at all: `rent-checkout` refuses with 409 `rental_already_paid` (line 107-111), and nothing else in the patch set ever creates the Exotiq PI — so the sweep is the guaranteed o
- **Fix:** Add `AND operator_payment_intent_id IS NULL` to the sweep's WHERE clause (bookings with a captured rental must never auto-expire), and add a real retry path for the Exotiq leg — e.g. a service-role `rent-retry-exotiq-leg` action driven by the ops alert, or let `rent-checkout` return a retry-the-second-leg mode instead of a flat 409. Alert ops on any booking sitting `pending_payment` with `operator_payment_intent_id` set past `payment_due_at`.

## 5. [BLOCKER] — Lovable
**Fleet 'Delete Selected' hard-deletes vehicles and ON DELETE CASCADE destroys paid marketplace bookings, including the only record of the captured Stripe charges**

`src/contexts/FleetContext.tsx`:1405

- **Impact:** An operator multi-selects three cars they sold and clicks 'Delete Selected' — no prompt, no warning. Every booking on those vehicles is CASCADE-deleted, including confirmed marketplace bookings whose rental leg and Exotiq leg are already captured in Stripe. Afterwards: public_booking_by_ref INNER JOINs vehicles (20260723120000_m6b_renter_payment.sql:199 `JOIN public.vehicles v ON v.id = b.vehicle_id`) so the renter's confirmation page 404s; rent-cancel-booking / rent-refund-booking look the booking up by booking_ref and find nothing, so neither the renter nor ops can refund; and because market
- **Fix:** Route the batch action through trashVehicle (soft, reversible) like the single-vehicle path, and add the same typed confirmation. Independently, add a DB-level guard: change bookings.vehicle_id to ON DELETE RESTRICT (or a BEFORE DELETE trigger on vehicles that raises when non-terminal bookings exist), so no UI bug can ever cascade a booking away. Also write marketplace legs into the payments table from rent-payment-webhook so the Stripe PI ids survive independently of the bookings row.

## 6. [BLOCKER] — Gregory decision
**The pickup deposit hold cannot be placed for any marketplace renter: stripe-create-hold has zero callers, never confirms the PaymentIntent, and targets the wrong Stripe account for the saved card**

`docs/rent/M6_MONEY_PLAN.md`:23

- **Impact:** The security deposit is the operator's entire damage protection and the renter is explicitly promised it: ConfirmationScreen.tsx:125 lists 'Security deposit hold is placed on your card after your identity is verified.' On pickup day the operator opens the Command Center and there is no button to place a hold; if the endpoint is called directly it produces an unconfirmable PaymentIntent on the connected account with no card attached, hold_status stays 'pending', so the Capture/Release controls never appear either. Every marketplace rental therefore hands over a six-figure car with zero authoriz
- **Fix:** Decide and build the mechanism before launch. The cheapest design that matches the existing money model: keep the deposit on the platform account where the card already is — store the platform Stripe customer id and payment method from rent-checkout onto the booking/customer row, then have a new operator action create a manual-capture PaymentIntent on the platform with `customer` + `payment_method` + `off_session: true, confirm: true` (this is a genuine hold, no Stripe.js needed), and record hol

## 7. [BLOCKER] — Gregory decision
**pending_documents is a terminal state — nothing anywhere promotes a booking after the renter's ID verification succeeds, and the renter is told the opposite**

`supabase/functions/rent-create-booking/index.ts`:121

- **Impact:** A first-time renter completes Stripe Identity successfully. The card flips to 'Identity verified — booking confirmed. You're all set. The operator has been notified.' In fact the booking is still pending_documents, no notification row was created, and no code path will ever move it: the Command Center's approval surfaces key off status==='pending' so there is no Approve button, and the RENT app's PaymentCard only renders on pending_payment. The booking sits invisible and unpayable until the pickup date passes. Because identity reuse is keyed on the email (rent-create-booking:117-122), the rent
- **Fix:** Resolve the ordering contradiction first: ID_VERIFICATION_PLAN V1 puts verification after payment as the step that confirms the booking, while M6 makes operator approval → payment the confirming path. Once ruled, implement the missing edge: on identity.verification_session.verified, have identity-webhook (or a trigger) move that customer's marketplace bookings from pending_documents to 'requested' and insert a team notification, and make the Command Center approval queue accept requested/pending

## 8. [HIGH · LAUNCH-BLOCKING] — Lovable
**Webhook silently drops a completed Checkout when the booking already left pending_payment — money captured, no booking, no PI recorded, no alert**

`supabase/functions/rent-payment-webhook/index.ts`:145

- **Impact:** rent-checkout will mint a session up to one second before payment_due_at (index.ts:112 only rejects an already-past due date) and a hosted Checkout session stays payable for ~24h. Renter opens Checkout at due−1min and pays 20 minutes later: the sweep has already expired the booking, the status-guarded UPDATE matches 0 rows, and the handler breaks. $1,500 is captured and transferred to the operator, operator_payment_intent_id is never stored (so no in-app refund can ever find the charge), user_activity_log gets nothing, and the dates are already back on sale. Same outcome if the renter cancels 
- **Fix:** When a completed session's booking is not pending_payment: still persist the PI id, write an opsAlert, and auto-refund with reverse_transfer (or requeue for ops). Also expire the Checkout session in rent-cancel-booking and in the expiry sweep, and stop minting sessions within ~1h of payment_due_at.

## 9. [HIGH · LAUNCH-BLOCKING] — Lovable
**A declined Exotiq leg has no retry path and its idempotency key locks in the decline — the booking can never reach confirmed**

`supabase/functions/rent-payment-webhook/index.ts`:187

- **Impact:** After the $1,017 Exotiq leg declines there is no surface — renter, operator, or Stripe — that can retry it: the only creator is a webhook event that will not be reprocessed, and the fixed idempotency key replays Stripe's cached decline for 24h even if it were. The renter's PaymentCard.tsx:91 maps `rental_already_paid` to the permanent spinner "Payment received — finalizing", then the window-closed panel. Exotiq never collects its $150 fee + $867 protection, and the booking never becomes confirmed even though $1,500 was taken. The m6a README promises a "retry surface" that does not exist in the
- **Fix:** Add a token-gated retry endpoint (or let rent-checkout run an exotiq-only Checkout when operator_payment_intent_id is set and exotiq_payment_intent_id is NULL) and make the idempotency key attempt-scoped (e.g. `exotiq-leg-${ref}-${attempt}`) so a new card can actually be charged.

## 10. [HIGH · LAUNCH-BLOCKING] — Lovable
**Command Center booking edits reprice a pending_payment marketplace booking at the vehicle's current rate plus a gas fee, and rent-checkout charges the new total**

`src/components/dialogs/EditBookingDialog.tsx`:102

- **Impact:** A marketplace booking has no gas_fee, so opening Edit Booking and pressing Update — with no field changed — recomputes a 3-night $500/night booking as $1,500 + $20 = $1,520, and the renter is charged $1,520 for the rental leg instead of the quoted $1,500. If the operator has since raised current_rate to $700, the same save writes $2,120 and the renter is charged $620 above the quote they accepted. In both cases platform_fee_cents stays frozen at $150 (10% of the original $1,500), so Exotiq under-bills its own fee on the higher rental and there is no record of re-consent to the new amount.
- **Fix:** Block total_value edits for booking_source='marketplace' rows in pending_payment/confirmed (the dialog already has a guard pattern), or re-run public_vehicle_quote, re-snapshot platform_fee_cents/protection_total_cents, and require renter re-acceptance before the charge.

## 11. [HIGH · LAUNCH-BLOCKING] — Lovable
**Cancel and refund decide "is it paid?" from paid_at alone, so a captured rental is never refunded and ops cannot refund it either**

`supabase/functions/rent-cancel-booking/index.ts`:119

- **Impact:** Any booking with money captured but not fully confirmed — the partial-failure state, or the pay/cancel race — has `paid_at = NULL`, so: (1) a renter cancelling inside the free window takes the `unpaid` branch, gets `status='cancelled'`, zero refunds and a "no Stripe activity" outcome while $1,500 sits captured on the operator's account; (2) the operator/ops escape hatch `rent-refund-booking` hard-409s on the same row, so the only remedy is a manual Stripe-dashboard refund that no code path reconciles back to the booking. Renter is out real money with no self-serve or operator remedy.
- **Fix:** Derive paid state from the PI columns, not the confirmation stamp: `const paid = Boolean(booking.paid_at || booking.operator_payment_intent_id || (booking.exotiq_payment_intent_id && booking.exotiq_payment_intent_id !== 'none_required'))`, and refund whichever legs are present (refundLeg already no-ops on null/'none_required'). In `rent-refund-booking`, replace the `!booking.paid_at` gate with the same predicate so ops can always refund captured money.

## 12. [HIGH · LAUNCH-BLOCKING] — Lovable
**Declining or cancelling a PAID marketplace booking issues no refund — rent-refund-booking is never called anywhere in the Command Center**

`src/components/dashboard/BookEnhanced.tsx`:594

- **Impact:** Renter pays both legs (e.g. $1,500 rental to the operator's connected account + $1,017 EXOTIQ RENT). Operator then hits Decline/Cancel in the Command Center: the app writes status='cancelled' and nothing else — neither Stripe PI is refunded, reverse_transfer is never issued, and the status is 'cancelled' rather than 'declined'/'refunded', so no downstream process can tell a refund is owed. Exotiq keeps a paying customer's money on an operator-cancelled booking (chargeback + M6-D5 violation).
- **Fix:** In the decline/cancel handlers, if booking_source is marketplace and paid_at is set, invoke rent-refund-booking (JWT, { booking_ref }) and let it set 'refunded'; only fall back to a plain status write for unpaid bookings, using 'declined' for operator declines.

## 13. [HIGH · LAUNCH-BLOCKING] — Lovable
**A fully paid marketplace booking shows as unpaid in the Payments view with "Collect Deposit"/"Collect Balance" CTAs — paid state is computed only from the payments table, which the renter webhook never writes**

`src/components/dashboard/PaymentTracker.tsx`:91

- **Impact:** After a renter pays online, the booking is 'confirmed' with paid_at set but has no payments row, so totalPaid=0 → balancePaid=false → the booking lands in "Pending Payments" showing Balance Due = full total_value, the summary tile overstates outstanding cash by that amount, and the operator is presented with a "Collect Deposit" / "Collect Balance" button at pickup. Following that UI double-charges a renter who has already paid.
- **Fix:** Treat booking.paid_at (and operator_payment_intent_id / exotiq_payment_intent_id) as authoritative for marketplace bookings: exclude paid_at IS NOT NULL rows from pendingPayments, show a two-leg receipt instead of collect CTAs, and/or have the webhook insert reconciling payments rows.

## 14. [HIGH · LAUNCH-BLOCKING] — Lovable
**Editing a booking in the Command Center reprices it from the CURRENT vehicle rate and rent-checkout charges the rewritten total_value**

`src/components/dialogs/EnhancedBookingDialog.tsx`:458

- **Impact:** Any operator save on a marketplace booking (even one that only fixes the pickup time or notes) recomputes total_value from today's vehicle.current_rate rather than the rate the renter booked at, and writes it back. Because rent-checkout derives the on-session rental charge from booking.total_value, the renter is then charged an amount they never agreed to; platform_fee_cents / protection_total_cents are NOT recomputed, so the two Stripe legs no longer correspond to any quote the renter saw. "Save & Approve" combines this with the confirm-bypass above.
- **Fix:** For booking_source='marketplace', either block edits after the request is created or re-derive the full quote (rental + platform_fee_cents + protection_total_cents) and require re-consent; at minimum base the recompute on booking.daily_rate, not vehicle.current_rate.

## 15. [HIGH · LAUNCH-BLOCKING] — Lovable
**Cancel card tells the renter "Nothing has been charged" while the rental leg is already captured, and the cancel endpoint then skips the refund**

`components/drive-exotiq/CancelBookingCard.tsx`:66

- **Impact:** Renter's card has been charged the full rental (e.g. $1,500) but the page says nothing was charged, and pressing 'Yes, cancel' flips the booking to 'cancelled' with no refund call and no ops alert — the captured rental is silently kept. This is exactly the partial-failure surface M6-D1 calls 'the benign direction', and the UI plus the cancel path together turn it into an unrefunded charge.
- **Fix:** Expose the captured state to the renter surface: add a `rental_captured boolean` (operator_payment_intent_id IS NOT NULL) to public_booking_by_ref, plumb it into PublicBookingConfirmation.live and treat it as paid in CancelBookingCard's copy. In rent-cancel-booking, base the refund decision on the presence of operator_payment_intent_id / exotiq_payment_intent_id rather than paid_at, so a captured-but-unconfirmed booking is refunded on cancel.

## 16. [HIGH · LAUNCH-BLOCKING] — Gregory decision
**$150 concierge delivery is pre-selected while the step says nothing is required**

`domain/booking/mockData.ts`:317

- **Impact:** Every renter is opted into a $150 charge they never chose, and the escape hatch is labelled 'Skip — nothing here is required' — pressing it keeps the $150 in `extrasSubtotalCents`, in the Review breakdown, and in the amount actually charged. That is a textbook negative-option dark pattern (FTC/state ROSCA exposure), and for a luxury brand it is the worst possible first impression: an invented $150 on the bill. It also silently commits the operator to a delivery they may not have scheduled.
- **Fix:** Set `defaultSelected: false` on the delivery extra (or drop the flag entirely) so extras start empty; if a default is genuinely wanted, change the skip affordance to 'Continue without extras' and have it clear the selection.

## 17. [HIGH · LAUNCH-BLOCKING] — Lovable
**Exotiq booking fee is silently 0% for any operator whose platform_fee_percent was never hand-set (column is NOT NULL DEFAULT 0.00, so the RPC's coalesce(...,10) can never fire)**

`supabase/migrations/20260405032534_85a856d9-ce2d-4b3e-97ee-1e32b7ec3a6c.sql`:7

- **Impact:** A renter books the pilot operator (Saucy Rentals / fredo-d-lima, confirmed marketplace-visible in REDTEAM_REPORT_2026-07-24.md F6) whose platform_fee_percent is still the 0.00 default. PayStep shows "Exotiq booking fee (10%) — $150" and "Reserve for $2,517"; public_vehicle_quote returns platform_fee_cents = 0; rent-create-booking snapshots platform_fee_cents = 0; the webhook charges the Exotiq leg = 0 + protection only. Exotiq collects zero booking fee on every booking for that operator, and the renter is shown a fee line that is never charged. (The M6b E2E on the Exotiq team shows $1,017 = $1
- **Fix:** Backend: set platform_fee_percent explicitly for every marketplace team, change the column default to 10.00 (or make approve_marketplace_request/marketplace readiness require a non-zero fee for marketplace_visible teams), and drop the misleading coalesce. Frontend: expose platform_fee_percent from public_team_by_slug, map it in adaptTeam, and remove the `?? 10` fallbacks in state.ts:16 / mockData.ts:354 so live mode can never display a fee it will not charge.

## 18. [HIGH] — Lovable
**identity-create-session: anon caller can hijack any customer's ID verification — customer chosen by an unescaped LIKE pattern, no confirmation token**

`supabase/functions/identity-create-session/index.ts`:104

- **Impact:** POST {"email":"%@%","booking_ref":"BK-00001"} with only the public anon key matches every customer row in the database (any tenant) and, because of `.order("created_at", {ascending:false}).limit(1)`, deterministically selects the NEWEST real customer — i.e. the renter who just booked. The response hands the attacker that victim's verification URL/client_secret. Two concrete outcomes: (a) the attacker completes the session with their OWN document, and identity-webhook (supabase/functions/identity-webhook/index.ts, `case "identity.verification_session.verified"`) writes `patch.verified_name`, `i
- **Fix:** Do not use client input as a LIKE pattern: match with `.eq("email", email)` against a lower(email) index, or escape % and _ . More importantly, gate the guest path on the booking the caller actually holds: require `booking_ref` + `confirmation_token`, look the booking up via public_booking_by_ref semantics (token must equal bookings.confirmation_token), and derive customer_id from that booking row — never from a client-supplied email. Add persistent (Postgres-backed) rate limiting on this functi

## 19. [MEDIUM] — Lovable
**rent-create-booking: ID-verification gate bypassed by a LIKE wildcard in the driver email**

`supabase/functions/rent-create-booking/index.ts`:115

- **Impact:** An anon caller submits driver.email = "%@%" (passes the `includes("@")` check). The identity lookup then matches ANY verified identity row in the marketplace, so `identityVerified` is true and the booking is created as `requested` instead of `pending_documents`. The renter app treats that as ID-complete — exotiq-rent/components/drive-exotiq/ConfirmationScreen.tsx:69 renders `<IdentityVerificationCard ... initialStatus={live && live.status !== 'pending_documents' ? 'verified' : undefined} />` — so the ID upload step is never shown. The attacker does not need email delivery to continue: rent-cre
- **Fix:** Compare exactly, not as a pattern: filter on `customers.email` with `.eq()` (or `lower(email) = lower($1)`), or escape % and _ before building the filter. Add a strict email-format regex in the validation block at line 94 so pattern metacharacters are rejected with 400.

## 20. [MEDIUM] — Lovable
**create_marketplace_booking defaults the money params to 0, so a stale rent-create-booking deploy silently charges the deposit and zero Exotiq fee instead of failing**

`supabase/migrations/20260723120000_m6b_renter_payment.sql`:41

- **Impact:** Because the params default to 0 rather than NULL, a booking created by the stale function passes rent-checkout's guard: platform_fee_cents = 0 and protection_total_cents = 0. On a $500/night, 3-night booking with a $1,500 deposit, total_value is stored as operator_total_cents/100 = $3,000 (deposit rolled in, per the m6b README bug note), so the renter is charged $3,000 for a $1,500 rental — the deposit is captured and transferred to the operator as revenue instead of being an authorization hold at pickup — and exotiqCents = 0 makes the webhook write `exotiq_payment_intent_id: 'none_required'` 
- **Fix:** Drop the DEFAULT 0 on _platform_fee_cents/_protection_total_cents (make them required, or NULL-defaulted) so an out-of-date caller hard-fails instead of booking a zero-fee, deposit-inflated charge; and land the five deployed money functions in the SPARK repo so a redeploy cannot revert M6b.

## 21. [MEDIUM] — Lovable
**payment_due_at is computed with a double timezone shift — the deadline printed in the approval/reminder email can fall AFTER the pickup moment, defeating M6-D4**

`supabase/migrations/20260723090000_m6a_payment_foundations.sql`:65

- **Impact:** Pickup 2026-08-08 10:00 America/Phoenix is stored as 2026-08-08 17:00Z. With the session zone UTC and v_tz='America/New_York' (the only value any code ever writes — see the teams.timezone finding), `::timestamp` yields naive 2026-08-08 17:00 and `AT TIME ZONE 'America/New_York'` yields 2026-08-08 21:00Z. v_due clamps to 19:00Z — two hours AFTER the car was due to be handed over. The clamp that exists specifically so "a booking never sits pending_payment past its own pickup" does the opposite, and {{PAYMENT_DEADLINE}} in payment-approved.html / payment-reminder.html tells the renter they still 
- **Fix:** Delete the cast entirely — start_date is already an instant: `v_due := LEAST(now() + interval '48 hours', NEW.start_date - interval '2 hours');` and drop the stale comment. Keep the `GREATEST(v_due, now() + interval '2 hours')` floor. Then format {{PAYMENT_DEADLINE}} from payment_due_at with an explicit IANA zone.

## 22. [MEDIUM] — Lovable
**Stripe TEST-mode payment traffic is not excluded from any revenue/margin/payout reporting — payment_stripe_mode is referenced nowhere in the app**

`src/components/margin/useMarginData.ts`:102

- **Impact:** The pilot runs Stripe in TEST mode, so every sandbox booking paid with 4242 4242 4242 4242 becomes status='confirmed' with payment_stripe_mode='test' and is counted at full total_value in Gross Revenue, Vehicle P&L, Revenue by Source, net margin and the dashboard revenue tiles. Operators (and Gregory) see fake sandbox money as real revenue, and the same rows feed partner-payout obligations once completed.
- **Fix:** Add payment_stripe_mode to the useMarginData bookings select and exclude rows where it equals 'test' (or gate on a tenant 'sandbox' flag) in countsForRevenue / RevenueBySourceCard / VehiclePnLTable; regenerate types.ts first so the column is typed.

## 23. [MEDIUM] — Lovable
**Unpaid, expired and refunded marketplace bookings count as revenue — the exclusion sets predate the M5/M6 statuses**

`src/components/margin/useMarginData.ts`:31

- **Impact:** A renter request that is never approved ('requested'), one awaiting payment ('pending_payment'), one that expired unpaid ('payment_expired') and one that was fully refunded ('refunded') are all counted at 100% of total_value in sumGross / sumPlatformFees / MarginOverview booking count / VehiclePnLTable / Revenue by Source. Marketplace revenue and margin are systematically overstated, and a refunded booking is reported as earned revenue.
- **Fix:** Extend REVENUE_EXCLUDED_STATUSES to ['pending','cancelled','declined','quote','draft','requested','pending_documents','pending_payment','payment_expired','refunded'] and make RevenueBySourceCard use countsForRevenue instead of its own !== 'cancelled' check.

## 24. [MEDIUM] — Gregory decision
**Operator's platform fee percent is never read from the server: UI always quotes 10% while the DB column defaults to 0.00 (NOT NULL), so Exotiq's booking fee is charged as $0**

`domain/booking/adapters.ts`:27

- **Impact:** Any operator whose teams row still has the column default (0.00) — i.e. every operator onboarded without someone manually setting the fee, such as the 'fredo-d-lima' pilot flagged as marketplace-visible in REDTEAM_REPORT F6 — produces quote.platform_fee_cents = 0. The renter is shown 'Booking fee (10%) $450' in ReviewStep/PayStep and a grand total that includes it, then is charged rental + protection only: Exotiq collects $0 of booking fee on every booking for that operator while the renter was told they paid it. The reverse case is equally live: a team set to 15% charges 15% while the UI stil
- **Fix:** Two parts. Frontend: stop inventing the rate — call public_vehicle_quote (fetchVehicleQuote/adaptQuote already exist and are unused) and render the server quote in ReviewStep/PayStep, or at minimum carry platform_fee_percent through adaptTeam. Backend/data: change teams.platform_fee_percent default to 10.00 and backfill every marketplace-visible team with its contracted rate; make public_vehicle_quote fail loudly (or clamp to the platform default) when fee_pct = 0.

## 25. [MEDIUM] — Lovable
**Confirmation page and calendar invite show a hard-coded 10:00 AM pickup, not the renter's choice**

`components/drive-exotiq/ConfirmationScreen.tsx`:71

- **Impact:** A renter who selects '4:00 PM' or 'Request after-hours pickup' sees 'Pickup 10:00 AM' on the confirmation page and downloads a calendar event that says 10:00 AM. They arrive six hours early (or the operator waits six hours), on a vehicle handoff that is the entire premium of the product. The operator's Command Center has the correct time, so nobody catches it until pickup day.
- **Fix:** Add `pickup_time` to the `public_booking_by_ref` RPC return, surface it as `live.pickupTime`, and use `live.pickupTime ?? cart.pickupTime` in the Detail cell and in ConfirmationActions. Until the RPC ships, hide the Pickup cell in live mode rather than show a fabricated time.

## 26. [MEDIUM] — Gregory decision
**Step 07 is headed "Final payment." and "Estimated total due today" but charges nothing**

`components/drive-exotiq/flow/PayStep.tsx`:15

- **Impact:** The last screen of the booking flow tells the renter this is the final payment and that the amount is due today, then takes no money. Combined with the confirmation page's 'Reserved' badge and (per the identity-card defect above) 'booking confirmed — you're all set', a renter has every reason to believe the transaction is complete. They then ignore the approval email, the 48h payment window expires, and the booking is cancelled — a lost sale caused purely by copy.
- **Fix:** Retitle the step 'Request your reservation' with 'Estimated total — nothing is charged yet', state that the operator approves within X hours and that a secure payment link follows, and keep the button as 'Reserve for $X'.

## 27. [MEDIUM] — Lovable
**Every M6 money function reads bookings.operator_payment_intent_id / exotiq_payment_intent_id, but neither column exists anywhere in the SPARK repo of record, and the M6a migration deliberately stopped creating them**

`supabase/migrations/20260723090000_m6a_payment_foundations.sql`:3

- **Impact:** If the assumption is wrong for any environment (or the schema is ever rebuilt from these migrations), PostgREST returns 42703 on the checkout select → rent-checkout catches and returns 500 "Unable to start payment", so no renter can pay; and confirmIfFullyPaid can never see two legs, so a paid booking never flips to confirmed while the renter's card has already been charged.
- **Fix:** Add the columns explicitly in a migration (idempotent ADD COLUMN IF NOT EXISTS bookings.operator_payment_intent_id text, exotiq_payment_intent_id text), settle on the single name `exotiq_payment_intent_id`, correct M6_MONEY_PLAN.md:55, and regenerate src/integrations/supabase/types.ts so the Command Center compiles against the real shape.

## 28. [MEDIUM] — Lovable
**Nothing monitors the renter path: the only uptime check is never scheduled, checks a single URL, and its content assertion cannot match the Next.js site**

`supabase/functions/uptime-check/index.ts`:11

- **Impact:** On launch night there is no signal that anything renter-facing has failed. A broken Netlify deploy of book.exotiq.rent, a crashed or unpublished rent-checkout / rent-payment-webhook, an expired Stripe webhook secret, or the mock-fallback described above all present as silence. This compounds the already-reported defect that every M6 ops alert writes user_activity_log columns that do not exist, so the partial-failure alert (rental captured, Exotiq leg declined) is dropped too — meaning the one failure that leaves a renter's money captured with no booking has no alerting path whatsoever, and the
- **Fix:** Before the flip, put an external synthetic check on book.exotiq.rent (a marker string that actually exists in the Next.js output, not `<div id="root">`) plus a shallow probe of rent-checkout, and schedule whatever you keep — uptime-check is dead code until a cron entry or pg_net job invokes it. Make the ops alert path write to a table whose columns exist and page a human on renter_payment_partial_failure, since that is the one event where money is captured and the booking is not.

## 29. [MEDIUM] — Lovable
**No price agreement between what the renter reviewed and what the server books: rent-create-booking re-quotes and commits at the current rate with no comparison**

`supabase/functions/rent-create-booking/index.ts`:105

- **Impact:** Steps 01-07 quote the renter a specific number from a storefront payload cached for up to 5 minutes (and held in browser state for as long as the renter takes). If the operator edits current_rate in that window — exactly what the Command Center's pricing tools encourage — pressing Reserve commits the renter to the new rate with no re-confirmation, no warning, and no 409. The booking's total_value is the new number, and rent-checkout charges total_value verbatim (rent-checkout/index.ts:139 `const rentalCents = Math.round(Number(booking.total_value) * 100);`). The renter's first sight of the cha
- **Fix:** Add an `expected_total_cents` (and ideally `expected_daily_rate_cents`) field to the rent-create-booking request, compare it to the freshly re-run public_vehicle_quote, and return a distinct 409 with both figures when they differ. Have the Reserve step surface 'the price for these dates changed from $X to $Y — confirm to continue' rather than booking silently. Keep the server quote authoritative; the added parameter is an agreement check, never an input to pricing.
