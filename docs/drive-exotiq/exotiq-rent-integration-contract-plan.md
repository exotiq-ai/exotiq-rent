# Exotiq Rent Integration Contract Plan

> **For Hermes/Avi:** This is the internal implementation contract for the Exotiq Rent renter-facing app. It translates Lovable/app.exotiq.ai discovery into frontend service boundaries. Do not wire production Supabase or Stripe until the backend contracts in this plan are explicitly implemented and reviewed.

**Goal:** Keep Exotiq Rent moving quickly on frontend/design while preparing a clean, portable, public-safe integration layer with app.exotiq.ai/Supabase.

**Architecture:** Exotiq Rent remains a separate Next.js renter-facing app. It uses a local service adapter layer today, backed by mocks. Later, the adapter layer swaps to public-safe RPCs and edge functions exposed by the shared Supabase project. The renter app should never query or mutate sensitive base tables directly.

**Source context:**
- `docs/drive-exotiq/lovable-ecosystem-context.md`
- `docs/drive-exotiq/exotiq-discovery-answers.md`
- `docs/drive-exotiq/beautiful-maintainable-plan.md`
- renter mobile-web design bundle at `/Users/gbot/.hermes/cache/documents/doc_44d278bcc09c_Drive Exotiq Wire Fram Screens.zip`

---

## 1. Hard Constraints

1. Build Exotiq Rent separately from Lovable/app.exotiq.ai.
2. Use app.exotiq.ai/Supabase as source of truth later.
3. Do not add Supabase client integration in Exotiq Rent until public-safe contracts exist.
4. Do not query base tables directly from Exotiq Rent.
5. Do not loosen RLS on base tables.
6. Do not implement renter Stripe yet.
7. Do not implement Exotiq Protection schema/payment yet.
8. Preserve operator-owned deposits.
9. Preserve Exotiq broker fee rule: 10% of operator daily rate only, not delivery, gas, mileage, taxes, or deposits.
10. Use `teamSlug` in service/data contracts, even if existing component props still say `operatorSlug` during transition.
11. Use `bookingRef` for public confirmation URLs, not internal UUIDs.
12. Keep payment UI mocked/tokenized until Stripe phase.

---

## 2. Route Contract

### Current scaffold routes

```text
/{operatorSlug}/{vehicleSlug}
/{operatorSlug}/{vehicleSlug}/book
/booking/{bookingId}
/preview
```

### Target product routes

```text
/{teamSlug}
/{teamSlug}/{vehicleSlug}
/{teamSlug}/{vehicleSlug}/book
/booking/{bookingRef}
/preview
```

### Transition plan

Phase A: keep current folder names if needed to avoid churn, but rename internal variables/service methods to `teamSlug`.

Phase B: when adding tenant storefront, use:

```text
app/[teamSlug]/page.tsx
```

If Next route segment collisions require keeping `[operatorSlug]` temporarily, treat it as an implementation detail and expose `teamSlug` in services.

### Route behavior

| Route | Data loader | Future backend contract |
|---|---|---|
| `/{teamSlug}` | `getPublicTeamStorefront(teamSlug)` | `public_team_by_slug`, `public_team_fleet` |
| `/{teamSlug}/{vehicleSlug}` | `getPublicVehicleContext(teamSlug, vehicleSlug)` | `public_vehicle_by_slug` |
| `/{teamSlug}/{vehicleSlug}/book` | `getBookingStartContext(teamSlug, vehicleSlug)` | `public_vehicle_by_slug`, `get_vehicle_quote`, `get_vehicle_availability` |
| `/booking/{bookingRef}` | `getBookingConfirmation(bookingRef)` | `public_booking_by_ref` |

Invalid team or vehicle slugs must return 404.

---

## 3. Frontend Adapter File Structure

Create/target this structure:

```text
domain/booking/
  types.ts
  totals.ts
  mockData.ts
  service.ts              # facade used by app routes and components
  mockService.ts          # current mock implementation
  publicContracts.ts      # future RPC/edge payload shapes
```

Future optional split:

```text
services/exotiq-rent/
  client.ts               # future backend client wrapper
  adapters.ts             # conversion between Supabase DTOs and frontend models
```

Immediate principle:

Routes and components should call `domain/booking/service.ts`, not import mock data directly.

---

## 4. Frontend Domain Model Direction

### Team / operator

Frontend type should move toward:

```ts
export type PublicTeam = {
  id?: string; // internal ID optional; avoid exposing if not needed
  slug: string;
  name: string;
  logoUrl?: string;
  city?: string;
  state?: string;
  publicDescription?: string;
  timezone?: string;
  displayPhone?: string;
  callablePhone?: string;
};
```

Notes:

- Do not expose Stripe account IDs to the renter app.
- Do not expose internal team settings wholesale.
- `callablePhone` should be E.164 if used in `tel:` links.
- `displayPhone` can be formatted for UI.

### Vehicle

```ts
export type PublicVehicle = {
  id?: string;
  slug: string;
  teamSlug: string;
  name: string;
  shortName: string;
  year: number;
  make: string;
  model: string;
  dailyRateCents: number;
  minRentalDays?: number;
  heroImageUrl: string;
  photos: PublicVehiclePhoto[];
  specs?: {
    zeroToSixty?: string;
    power?: string;
    engine?: string;
    transmission?: string;
  };
  pickupLocation?: PublicPickupLocation;
  defaultMileageLimit?: number;
  mileageOverageCents?: number;
};
```

Backend conversion:

- Supabase rates are dollars; convert to cents in adapter.
- Hero image precedence: `vehicles.image_url` first, then first visible `vehicle_photos` by `display_order`, then fallback.
- Never expose VIN/license plate.

### Storefront

```ts
export type PublicTeamStorefront = {
  team: PublicTeam;
  vehicles: PublicVehicleSummary[];
};
```

### Booking confirmation

```ts
export type PublicBookingConfirmation = {
  bookingRef: string;
  status: 'requested' | 'pending_documents' | 'pending_payment' | 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'declined';
  vehicle: Pick<PublicVehicle, 'name' | 'shortName' | 'heroImageUrl'>;
  team: Pick<PublicTeam, 'name' | 'displayPhone' | 'callablePhone'>;
  dates: { start: string; end: string };
  pickupTime?: string;
  pickupLocation?: PublicPickupLocation;
  charges: PublicChargeSummary;
  nextSteps: string[];
};
```

---

## 5. Service Facade API

`domain/booking/service.ts` should export the stable frontend API.

```ts
export async function getPublicTeamStorefront(teamSlug: string): Promise<PublicTeamStorefront | null>;

export async function getPublicVehicleContext(teamSlug: string, vehicleSlug: string): Promise<{
  team: PublicTeam;
  vehicle: PublicVehicle;
} | null>;

export async function getBookingStartContext(teamSlug: string, vehicleSlug: string): Promise<{
  team: PublicTeam;
  vehicle: PublicVehicle;
  quote: PublicQuote;
  availabilityPreview?: PublicAvailability;
} | null>;

export async function getBookingConfirmation(bookingRef: string): Promise<PublicBookingConfirmation | null>;
```

Client-side booking flow can continue using in-memory cart state for now, but should initialize from `getBookingStartContext`.

---

## 6. Future Backend RPC Contracts

These are not build instructions for Lovable yet. They are the integration targets the frontend should be shaped around.

### public_team_by_slug

```text
public_team_by_slug(team_slug text)
```

Must internally enforce:

- `teams.slug = team_slug`
- marketplace visible flag
- `is_demo_account = false`

Returns only public fields:

```ts
type PublicTeamBySlugResponse = {
  slug: string;
  name: string;
  logo_url: string | null;
  public_description: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
};
```

No Stripe IDs, no settings blob, no internal metadata.

### public_team_fleet

```text
public_team_fleet(team_slug text)
```

Returns visible vehicles for the storefront.

Must enforce:

- team visible
- team not demo
- vehicle visible
- vehicle displayable status
- safe public projection

### public_vehicle_by_slug

```text
public_vehicle_by_slug(team_slug text, vehicle_slug text)
```

Returns a single public vehicle context.

Must not expose:

- VIN
- license plate
- `user_id`
- internal ops notes/status details
- raw private storage paths unless signed/proxied

### get_vehicle_availability

```text
get_vehicle_availability(vehicle_id uuid, range_start timestamptz, range_end timestamptz)
```

Returns only:

```ts
type BusyRange = { start: string; end: string };
```

Never return:

- booking IDs
- booking refs
- customer IDs
- customer names
- payment status
- document status
- internal status details

### get_vehicle_quote

```text
get_vehicle_quote(vehicle_id uuid, start_at timestamptz, end_at timestamptz, options jsonb)
```

Returns quote lines in cents or dollars with explicit currency metadata.

Preferred frontend shape:

```ts
type PublicQuote = {
  currency: 'usd';
  rentalDays: number;
  dailyRateCents: number;
  rentalSubtotalCents: number;
  deliveryFeeCents?: number;
  mileagePackageCents?: number;
  operatorFeesCents?: number;
  depositHoldCents?: number;
  exotiqBrokerFeeCents?: number;
  protectionPremiumCents?: number;
  operatorChargeCents: number;
  exotiqChargeCents: number;
  totalDueTodayCents: number;
};
```

Fee rules:

- Broker fee = 10% of operator daily rate only, if enabled.
- Broker fee does not apply to delivery/gas/mileage/taxes/deposits.
- Deposits are operator-owned holds/charges.

### public_booking_by_ref

```text
public_booking_by_ref(booking_ref text)
```

Returns renter-safe confirmation data.

Important unresolved question:

- Should full confirmation data require email/session token verification?
- Public booking ref alone may be guessable enough that confirmation details should be minimized unless paired with a token.

Recommendation:

For MVP preview, return minimal confirmation data. For production, consider:

```text
/booking/{bookingRef}?token={renterAccessToken}
```

or a secure magic-link model.

---

## 7. Future Edge Function Contracts

These should only be implemented after Lovable/Avi/Gregory approve a scoped backend phase.

### renter-create-booking

Purpose:

Create a marketplace booking/request safely from public renter flow.

Input sketch:

```ts
type CreateRenterBookingRequest = {
  teamSlug: string;
  vehicleSlug: string;
  dates: { start: string; end: string };
  pickupTime?: string;
  renter: {
    name: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  };
  selectedExtras?: string[];
  protection?: 'premium' | 'standard' | 'decline';
  declineProtectionAcknowledged?: boolean;
  quoteId?: string;
};
```

Server responsibilities:

- Re-resolve team/vehicle from slugs.
- Re-check marketplace visibility.
- Re-check availability.
- Recompute quote server-side.
- Create marketplace booking/request.
- Attach/create team-scoped customer or pre-customer intent.
- Write audit/activity row with `source = 'marketplace'`.
- Return bookingRef and next action.

### renter-upload-document

Purpose:

Upload driver/insurance docs through a backend-controlled path.

Server responsibilities:

- Validate booking/session/token.
- Validate file type and size.
- Store in private bucket.
- Attach document metadata to booking/customer/intent.
- Avoid exposing private URL directly.
- Rate limit heavily.
- Audit event.

### renter-start-payment-session

Future Stripe phase only.

Do not implement until:

- fee source is resolved
- operator deposit ownership is encoded
- protection charge strategy is approved
- webhook behavior is updated
- SCA/3DS/idempotency is designed

---

## 8. Immediate Frontend Implementation Tasks

These are safe to do now without Lovable.

### Task 8.1: Rename service concepts to teamSlug

Internal adapters should accept `teamSlug` even if route segment files still use `[operatorSlug]` temporarily.

### Task 8.2: Add `domain/booking/service.ts` and `mockService.ts`

Move direct mock lookups into service facade.

Routes should call:

```ts
getPublicVehicleContext(teamSlug, vehicleSlug)
getBookingStartContext(teamSlug, vehicleSlug)
getBookingConfirmation(bookingRef)
```

### Task 8.3: Add tenant storefront mock route

Add:

```text
app/[teamSlug]/page.tsx
```

or carefully reconcile with existing `[operatorSlug]` nesting.

If route conflict risk is high, keep route naming as `[operatorSlug]` but make service API use teamSlug.

### Task 8.4: Split BookingFlow

Move screens into:

```text
components/drive-exotiq/flow/DatesStep.tsx
components/drive-exotiq/flow/DriverStep.tsx
components/drive-exotiq/flow/ExtrasStep.tsx
components/drive-exotiq/flow/ProtectStep.tsx
components/drive-exotiq/flow/ReviewStep.tsx
components/drive-exotiq/flow/PayStep.tsx
```

### Task 8.5: Apply design screens

Use the renter design zip as visual source of truth.

Do not ask Lovable to implement the frontend design.

---

## 9. Lovable Backend Tasks Later

Do not send all of this to Lovable at once. Use small scoped prompts later.

### Backend Task A: Vehicle slugs

- Add `vehicles.slug`.
- Backfill slugs.
- Add unique index `(team_id, slug)`.
- Confirm slug update rules.

### Backend Task B: Marketplace visibility

- Add/confirm team marketplace visibility.
- Add/confirm vehicle marketplace visibility.
- Exclude demo teams.
- Define public eligibility helper.

### Backend Task C: Public read RPCs

- `public_team_by_slug`
- `public_team_fleet`
- `public_vehicle_by_slug`

### Backend Task D: Public media delivery

- signed image function or public derived CDN strategy
- TTL policy <= 1 hour if signed

### Backend Task E: Availability/quote

- busy ranges only
- quote server-side
- broker fee/deposit rules encoded

### Backend Task F: Booking/doc upload

- marketplace booking intent/create function
- document upload function
- audit trail
- rate limiting

### Backend Task G: Stripe/protection

Separate future architecture phase.

---

## 10. Verification Checklist

Before calling any integration step complete:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Browser checks:

- `/preview` renders.
- `/{teamSlug}` or current equivalent renders storefront.
- `/{teamSlug}/{vehicleSlug}` renders vehicle.
- `/{teamSlug}/{vehicleSlug}/book` starts booking.
- `/booking/{bookingRef}` renders confirmation.
- bad team/vehicle returns 404.
- no browser console errors.

Process hygiene:

- one server only on port 3000.
- no mixed `next dev` and `next start`.
- clear `.next` before production-style review.

---

## 11. Decision Summary

We are good to continue Exotiq Rent frontend work without more Lovable context right now.

We should not ask Lovable for broad docs again until we have a narrow backend task.

Lovable is needed later for:

- schema changes
- public RPCs
- RLS-safe exposure
- media delivery
- availability/quote
- booking/document edge functions
- Stripe/protection phase

Avi can proceed now with:

- service facade and mocks
- component split
- tenant storefront mock
- visual polish
- booking flow cleanup

