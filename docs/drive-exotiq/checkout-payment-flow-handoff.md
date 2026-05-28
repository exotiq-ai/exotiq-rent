# Drive Exotiq Wire Frame Checkout + Payment Flow Handoff

_Last updated: 2026-05-27_

## Purpose

This document aligns the renter-facing Exotiq.Rent booking flow with the operator-facing Exotiq Command Center / app.exotiq.ai backend and Stripe implementation before final code freeze.

The current repo is still a frontend/payment scaffold. It now shows the intended final payment breakdown:

- Operator rental charge: collected for the rental operator.
- Exotiq platform fee: 10% platform fee on the booking amount, excluding any deposit/security authorization.
- Exotiq protection plan: passed through Stripe to Exotiq.
- Customer statement descriptor for Exotiq lines: `exotiq.rent`.

## Current implementation scope

Implemented in the Exotiq.Rent frontend scaffold:

- Mobile-web booking route: `/{teamSlug}/{vehicleSlug}/book`.
- Confirmation route: `/booking/{bookingRef}`.
- Frontend cart/totals model in cents.
- Mock operator, vehicle, extras, protection, and booking data.
- Payment screen copy that treats Stripe as a future tokenized boundary.
- No raw card fields in React state.
- No live Stripe Connect charges yet.
- No Supabase migrations in this repo yet.

Primary touched files:

- `domain/booking/totals.ts`
- `domain/booking/types.ts`
- `domain/booking/mockData.ts`
- `domain/booking/publicContracts.ts`
- `components/drive-exotiq/flow/ReviewStep.tsx`
- `components/drive-exotiq/flow/PayStep.tsx`
- `components/drive-exotiq/ConfirmationScreen.tsx`
- `domain/booking/totals.test.ts`

## Checkout flow wire frame

### 01. Vehicle

Route: `/{teamSlug}/{vehicleSlug}`

Renter reviews the selected vehicle, operator, pickup market, specs, and starting price.

Backend dependency:

- Public-safe team lookup by `teamSlug`.
- Public-safe vehicle lookup by `vehicleSlug` + `team_id`.
- Visible/public marketplace flag.
- Vehicle photos/media URLs.
- Current published rate.

### 02. Dates

Renter selects start/end date and pickup time.

Backend dependency:

- Availability quote endpoint or edge function.
- Busy ranges / blackouts.
- Operator timezone from Command Center `teams.timezone` or location timezone.
- Minimum rental duration.

### 03. Driver

Renter enters driver information and uploads or prepares identity/insurance docs.

Backend dependency:

- Customer/session creation.
- Document upload endpoint/storage policy.
- Verification status mapping.
- Secure document retention rules.

### 04. Extras

Renter chooses operator add-ons like concierge delivery or additional driver.

Backend dependency:

- Operator-managed extras catalog.
- Pricing unit: flat vs per-day.
- Whether extras are taxed.
- Whether extras are included in the platform-fee base.

Current frontend assumption: selected extras are included in the operator charge and therefore included in the 10% platform-fee base.

### 05. Protection

Renter selects Exotiq protection plan or declines with explicit acknowledgement.

Backend dependency:

- Protection plan catalog.
- Premium/standard/decline pricing.
- Decline-protection consent capture.
- Security deposit / authorization hold amount if protection is declined.

Current frontend assumption: protection is an Exotiq pass-through line, not an operator charge and not part of the platform-fee base.

### 06. Review

Renter sees split billing before payment:

- Operator: rental + extras + operator taxes/fees.
- Exotiq.Rent: 10% platform fee + protection plan.
- Total due today.

Current formula in frontend scaffold:

```text
rentalSubtotal = dailyRate * rentalDays
extrasSubtotal = selectedExtras total
operatorTax = round((rentalSubtotal + extrasSubtotal) * operatorTaxRate)
operatorTotal = rentalSubtotal + extrasSubtotal + operatorTax
platformFeeBase = operatorTotal
platformFee = round(platformFeeBase * 10%)
protectionTotal = protectionDailyRate * rentalDays
exotiqTotal = platformFee + protectionTotal
grandTotal = operatorTotal + exotiqTotal
```

Important: the platform-fee base explicitly excludes any deposit/security authorization. Deposits are not currently represented as due-today revenue in the scaffold.

### 07. Final payment

Payment screen displays:

- Estimated total due today.
- Operator rental charge.
- Exotiq platform fee at 10%.
- Exotiq protection plan.
- Exotiq pass-through total.
- Stripe statement descriptor requirement: `exotiq.rent` for Exotiq lines.
- Tokenized Stripe checkout boundary language.

Stripe implementation intent:

- Use Stripe Elements / Payment Element or Checkout; do not collect raw card data in Exotiq.Rent components.
- Platform fee and protection plan should be routed to Exotiq's Stripe account.
- Customer statement for Exotiq lines should show `exotiq.rent`.
- Operator charge/transfer should align with the operator's connected account.

### 08. Confirmation

Route: `/booking/{bookingRef}`

Confirmation shows:

- Car-specific reserved headline.
- Booking reference.
- Total due.
- Operator charge.
- Exotiq platform fee.
- Exotiq protection plan.
- Exotiq pass-through total.

Backend dependency:

- Booking record with public `booking_ref`.
- Payment intent/session status.
- Operator confirmation state.
- Notifications/reminders.

## Command Center / app.exotiq.ai integration contract

The renter app should not directly couple itself to base Command Center tables. Preferred integration is through public-safe RPCs or Supabase Edge Functions owned by app.exotiq.ai.

Suggested boundary functions:

- `getPublicTeamStorefront(teamSlug)`
- `getPublicVehicleContext(teamSlug, vehicleSlug)`
- `getBookingStartContext(teamSlug, vehicleSlug)`
- `quoteBooking(input)`
- `createBookingDraft(input)`
- `uploadRenterDocument(sessionId, type, file)`
- `createStripeCheckoutOrPaymentIntent(bookingRef)`
- `getBookingConfirmation(bookingRef)`

Expected table mapping:

- Team/operator: `teams`
- Vehicle: `vehicles` + `vehicle_photos`
- Booking: `bookings`
- Customer/driver: `customers`
- Documents: `documents`
- Payments: `payments`

## Stripe architecture notes

The final Stripe design needs to be explicit because the desired money movement has two destination concepts:

1. Operator receives the rental-side economics.
2. Exotiq receives platform fee and protection plan.

Possible implementation patterns to evaluate:

### Option A: One customer payment intent with Stripe Connect transfer/application-fee split

- Customer sees one payment authorization/charge.
- Operator connected account receives operator portion.
- Exotiq keeps application fee and protection plan amount.
- Must verify statement descriptor behavior; a single charge may not allow two different statement descriptors.
- Requires careful accounting if protection is not technically an application fee.

### Option B: Separate payment intents/charges

- Operator charge goes to operator connected account.
- Exotiq platform/protection charge goes to Exotiq account with descriptor `exotiq.rent`.
- Statement descriptors are cleaner.
- Customer may see multiple charges, which must be made clear in UI.
- More SCA/3DS, failure recovery, refund, and webhook complexity.

### Option C: Stripe Checkout with line items and backend-led transfers

- Customer-facing UI is familiar.
- Backend handles transfers or application fee after session completion.
- Need confirm whether exact customer statement descriptor and split-recipient requirements are achievable.

## Clarification flags before final backend implementation

These need product/legal/Stripe confirmation before both sides are locked:

1. **Platform-fee base**
   - Current frontend assumption: 10% is calculated on operator total due for the rental, including rental, selected extras, and operator tax/fees, excluding deposit/security authorizations and excluding protection.
   - Please confirm if the intended base is instead pre-tax rental subtotal only, rental + extras only, or total due including protection.

2. **Deposit/security hold treatment**
   - Current assumption: deposits/security holds are not revenue and never included in the Exotiq platform-fee base.
   - Need final answer on whether deposit is a separate authorization hold, separate payment, operator-owned hold, and when it is captured/released.

3. **One charge vs multiple charges**
   - Requirement says Exotiq platform fee and protection plan pass through Stripe to Exotiq and show as `exotiq.rent` on the customer statement.
   - Need Stripe decision: one PaymentIntent with Connect splits, or separate customer charge(s) for Exotiq vs operator.

4. **Statement descriptor feasibility**
   - Confirm exact descriptor format supported by Stripe: `exotiq.rent` may need to comply with Stripe descriptor length/character rules and account descriptor prefixes.

5. **Protection plan accounting**
   - Confirm if protection is Exotiq revenue, insurance/protection pass-through, or a third-party remittance item.
   - This affects Stripe account routing, taxes, refunds, and receipt wording.

6. **Tax treatment**
   - Current scaffold has a simple operator tax estimate.
   - Need final tax calculation owner and whether platform fee/protection are taxable in each market.

7. **Command Center booking lifecycle**
   - Confirm statuses for marketplace/direct bookings: recommended states include `requested`, `pending_documents`, `pending_payment`, `confirmed`, `declined`, `cancelled`, `completed`, `refunded`.
   - If existing enums are tight, consider a marketplace sub-state rather than breaking current operator UI.

8. **Stripe connected account type**
   - Prior inspection showed app.exotiq.ai may create Express accounts while older handoff language referenced Standard accounts.
   - Confirm the account type before implementing onboarding and charge routing.

9. **Refund/cancellation ownership**
   - Define how refunds split between operator rental charge, Exotiq platform fee, and protection plan.
   - Define whether platform fee is refundable and under what conditions.

10. **Failed partial payment recovery**
   - If operator and Exotiq are separate charges, define what happens if one succeeds and the other fails.
   - Booking should not become confirmed until required payments and holds are reconciled.

## Recommended build sequence

1. Lock backend quote response shape and fee base.
2. Implement quote endpoint in app.exotiq.ai / Supabase Edge Function.
3. Update Exotiq.Rent to consume quote response instead of frontend-only math.
4. Implement booking draft creation before Stripe session creation.
5. Implement Stripe PaymentIntent/Checkout session creation from backend only.
6. Handle Stripe webhooks in Command Center backend.
7. Persist payment rows with:
   - `booking_id`
   - `team_id`
   - `amount`
   - `payment_type`
   - `payment_status`
   - `stripe_payment_intent_id`
   - `stripe_charge_id`
   - `platform_fee`
   - `hold_status` where applicable
8. Return public booking confirmation by `booking_ref`.
9. Run end-to-end test: quote → draft booking → document upload → Stripe test payment → webhook → confirmation.

## Frontend handoff note

The Exotiq.Rent UI is ready to display the finalized split, but the authoritative quote must ultimately come from the backend. Once the Command Center quote/Stripe functions are finalized, replace local math with backend quote fields so the UI cannot drift from Stripe/accounting truth.
