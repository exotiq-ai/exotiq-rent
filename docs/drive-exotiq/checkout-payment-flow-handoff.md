# Drive Exotiq Wire Frame Checkout + Payment Flow Handoff

_Last updated: 2026-05-27_

## Purpose

This document aligns the renter-facing Exotiq.Rent booking flow with the operator-facing Exotiq Command Center / app.exotiq.ai backend and Stripe implementation before final code freeze.

The current repo is still a frontend/payment scaffold. It now shows the intended V1 payment breakdown:

- Single Stripe Checkout charge: customer statement descriptor `EXOTIQ.RENT`.
- Operator rental charge: included in the full checkout amount; operator share transfers automatically.
- Exotiq platform fee: 10% platform fee on operator total, excluding any deposit/security authorization and excluding protection.
- Exotiq protection plan: $89/day, Exotiq-controlled, included in the single checkout charge.
- Security deposit: separate authorization hold on the operator connected account, not charged today and not included in the platform-fee base.
- Free cancellation: 72 hours before pickup; platform fee and protection are refundable inside the window.

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
- Exotiq total.
- Separate security deposit authorization hold.
- Stripe statement descriptor requirement: `EXOTIQ.RENT` for the single V1 charge.
- Hosted Stripe Checkout boundary language.
- Free cancellation up to 72 hours before pickup.

Stripe implementation intent:

- V1 uses one hosted Stripe Checkout charge for the full booking amount via Exotiq.
- Do not implement Stripe Elements / Payment Element or collect card data in Exotiq.Rent components.
- Backend creates the booking and returns the hosted Stripe Checkout URL.
- Operator share transfers automatically after checkout.
- Security deposit is a separate authorization hold on the operator connected account, created server-side after payment.

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

The V1 Stripe architecture is locked:

- Customer completes one hosted Stripe Checkout for the full booking amount.
- Statement descriptor should be `EXOTIQ.RENT`.
- Exotiq receives the full charge and transfers the operator share automatically.
- The 10% renter platform fee is calculated on operator total only: rental + extras + operator taxes/fees.
- Platform fee base excludes protection and excludes deposits/security authorization holds.
- Protection is $89/day, Exotiq-controlled, and included in the single checkout charge.
- Security deposit is a separate server-side authorization hold on the operator connected account after payment.
- Broker commission is invisible to renters and remains operator-side/Phase 2.

When Lovable deploys the backend, the payment button should:

1. Call `renter-create-booking` to create the booking and return a Stripe Checkout URL.
2. Redirect the renter to that hosted Stripe Checkout URL.
3. Accept Stripe success redirects at `/booking/{bookingRef}?status=confirmed`.
4. Accept cancel redirects back to the booking page with `?payment=cancelled`.

## Remaining implementation coordination

The core V1 payment decisions are now locked. Remaining coordination points are implementation details:

1. **Tax treatment**
   - Current scaffold has a simple operator tax estimate.
   - Backend quote should own final tax calculations and decide whether platform fee/protection are taxable by market.

2. **Command Center booking lifecycle**
   - Confirm statuses for marketplace/direct bookings: recommended states include `requested`, `pending_documents`, `pending_payment`, `confirmed`, `declined`, `cancelled`, `completed`, `refunded`.
   - If existing enums are tight, consider a marketplace sub-state rather than breaking current operator UI.

3. **Stripe connected account type**
   - Prior inspection showed app.exotiq.ai may create Express accounts while older handoff language referenced Standard accounts.
   - Confirm the account type for transfer and security-deposit hold implementation.

4. **Refund webhook behavior**
   - Product rule: platform fee and protection are refundable inside the 72h free-cancellation window; platform fee is non-refundable after the window; protection is non-refundable after rental start or early return.
   - Backend/webhooks should persist which portions were refunded.

5. **Security deposit hold lifecycle**
   - Deposit hold is separate from the Stripe Checkout charge and should be created server-side on the operator connected account after payment confirmation.
   - Backend should persist hold status, expiry, capture, release, and damage adjustment details.

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
