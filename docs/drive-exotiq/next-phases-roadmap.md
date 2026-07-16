# Exotiq Rent Next Phases Roadmap

> **For Hermes/Avi:** Use this as the working roadmap for moving Exotiq Rent from polished mock/mobile-web scaffold toward a functional renter-facing app. Keep Exotiq Rent frontend separate from Lovable/app.exotiq.ai. Use Lovable/Supabase later for narrow backend plumbing tasks only.

**Goal:** Turn the current Gold + Editorial renter-facing scaffold into a functional, production-shaped mobile web app while preserving portability and avoiding premature Supabase/Stripe coupling.

**Architecture:** Exotiq Rent remains a separate Next.js App Router frontend. It uses `domain/booking/service.ts` as the stable frontend facade. Today that facade is backed by mocks. Later, the same facade should call public-safe Supabase RPCs and edge functions owned/coordinated through app.exotiq.ai/Lovable.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, lucide-react, local mock service facade now; Supabase RPC/edge functions and Stripe Connect later.

---

## 0. Current State

### Completed

- Exotiq Rent renter flow exists as a separate Next.js mobile-web experience.
- Existing cyan marketplace root is preserved.
- Gold + Editorial design language is applied to the renter path.
- Fake phone status chrome was removed so the app feels like real mobile web, not a mockup.
- Route structure exists:
  - `/{teamSlug}` via transitional folder `app/[operatorSlug]/page.tsx`
  - `/{teamSlug}/{vehicleSlug}` via `app/[operatorSlug]/[vehicleSlug]/page.tsx`
  - `/{teamSlug}/{vehicleSlug}/book`
  - `/booking/{bookingRef}` via transitional folder `app/booking/[bookingId]/page.tsx`
- Booking flow is split into step components:
  - `DatesStep`
  - `DriverStep`
  - `ExtrasStep`
  - `ProtectStep`
  - `ReviewStep`
  - `PayStep`
- Confirmation was moved out of `BookingFlow.tsx` into `ConfirmationScreen.tsx`.
- Service boundary exists:
  - `domain/booking/service.ts`
  - `domain/booking/mockService.ts`
  - `domain/booking/publicContracts.ts`
- Current verification baseline passes:
  - `npm test`
  - `npx tsc --noEmit`
  - `npm run lint` with existing marketplace warnings only
  - `npm run build`

### Current preview routes

```text
/desert-exotic-rentals
/desert-exotic-rentals/mclaren-750s-spider
/desert-exotic-rentals/mclaren-750s-spider/book
/booking/BK-01001
```

### Current constraints

- No production Supabase reads/writes yet.
- No real Stripe yet.
- No schema migrations from Exotiq Rent yet.
- No direct base table reads from the renter app later.
- Lovable should not build Exotiq Rent frontend.
- Lovable should only be used for narrow backend/Supabase plumbing tasks when contracts are clear.

---

## 1. What Avi Can Do Today Without Much Help

These are safe, high-leverage frontend/product tasks that do not require Lovable/Supabase access.

### 1.1 Functional app polish

Avi can continue converting the current scaffold from “demo” toward “usable app” by:

- removing any remaining mockup-only language
- replacing “Apple Pay mock” / “Mock payment method” copy with production-shaped disabled/placeholder states
- improving mobile safe-area handling
- tightening loading/error/not-found states
- making route segments and variable names more consistently `teamSlug` / `bookingRef`
- making the app feel browser-native rather than Figma/mockup-native

### 1.2 Mock data expansion

Avi can add richer mocked data without backend help:

- multiple teams/operators
- multiple vehicles per team
- realistic vehicle photo arrays
- availability examples
- different pricing tiers
- unavailable dates
- declined protection path
- confirmation states such as requested/pending/confirmed

This is useful because it forces the UI and service facade to support real product variety before Supabase is wired.

### 1.3 Storefront buildout

Avi can improve `/{teamSlug}` now:

- fleet grid/list
- operator profile section
- policy cards
- pickup/delivery expectations
- contact CTA
- “how it works” section
- empty states
- hidden/unavailable vehicle behavior
- multi-vehicle scrolling and filtering

### 1.4 Vehicle detail buildout

Avi can improve `/{teamSlug}/{vehicleSlug}` now:

- photo gallery
- specs section
- rate summary
- pickup location preview
- availability preview placeholder
- operator policies
- CTA to booking
- “similar vehicles” mock section
- SEO metadata from service facade

### 1.5 Booking flow hardening

Avi can polish and harden:

- date picker interactions
- pickup time selector
- driver details form instead of fixed mock identity
- document upload UI states without real upload
- extras selection state
- protection decline flow
- review edit actions
- confirmation next steps
- browser back/forward behavior
- URL/session persistence if useful

### 1.6 Contract tests and adapter tests

Avi can add tests around the frontend domain boundary:

- totals math
- mock service responses
- invalid team/vehicle returns `null`
- booking ref lookup
- quote shapes
- availability shape
- money conversion helpers

### 1.7 Design QA pass

Avi can keep comparing against the shared design bundle:

- `screen1.jsx`
- `screen-dates.jsx`
- `screen-driver.jsx`
- `screen-extras.jsx`
- `screen2.jsx`
- `screen3.jsx`
- `screen-pay.jsx`
- `screen4.jsx`
- `styles.css`

Focus areas:

- Gold + Editorial fidelity
- no mocked phone chrome
- sticky CTA safe areas
- card clipping
- scroll behavior
- real mobile browser feel
- Newsreader only for headings/voice moments
- Inter for labels/prices/numbers

### 1.8 Deployment preview hygiene

Avi can continue providing:

- Cloudflare quick tunnels
- local production `next start` previews
- route smoke checks
- browser QA
- screenshots when helpful

---

## 2. What Should Wait for Gregory + Lovable/Supabase

These need app.exotiq.ai/Supabase truth or explicit approval.

### 2.1 Real public data reads

Need Lovable/Supabase for:

- public-safe team lookup
- public-safe fleet lookup
- public-safe vehicle detail lookup
- public-safe media delivery
- RLS policy review
- SECURITY DEFINER RPC review

Do not query base tables directly from Exotiq Rent.

### 2.2 Schema changes

Need Lovable/Supabase for:

- `vehicles.slug`
- unique `(team_id, slug)` index
- team marketplace visibility flag
- vehicle marketplace visibility flag
- public team profile fields/table
- possibly vehicle public fields
- availability/booking overlap constraints

### 2.3 Booking writes

Need Lovable/Supabase before creating real bookings:

- booking lifecycle agreement
- customer vs marketplace intent decision
- audit/activity rows
- notification triggers
- document upload storage strategy
- rate limiting

### 2.4 Stripe/payment

Need dedicated Stripe phase before real payment:

- Express vs Standard account behavior confirmed
- marketplace fee rule encoded
- Gregory rule: Exotiq broker fee = 10% of operator daily rate only
- deposits/security holds operator-owned
- protection charge UX/legal/product decision
- webhook routing/idempotency
- refund/cancel handling

### 2.5 Exotiq Protection

Protection needs later product/backend work:

- product schema
- quote logic
- decline/hold logic
- coverage copy/legal guardrails
- payment ownership
- two-charge renter statement decision

---

## 3. Recommended Phase Order

## Phase 1 — Functional Frontend Hardening

**Owner:** Avi

**Can start:** Immediately

**Goal:** Make the current mock-backed renter app feel like a real mobile web product.

### Task 1.1: Rename public-facing route terminology in code comments/types

**Objective:** Reduce `operatorSlug` leakage in code where the product/backend concept is `teamSlug`.

**Files:**

- Modify: `app/[operatorSlug]/page.tsx`
- Modify: `app/[operatorSlug]/[vehicleSlug]/page.tsx`
- Modify: `app/[operatorSlug]/[vehicleSlug]/book/page.tsx`
- Modify: `components/drive-exotiq/VehicleEntryPage.tsx`
- Modify: `domain/booking/types.ts`

**Steps:**

1. Keep folder names as `[operatorSlug]` for now to avoid Next route churn.
2. Immediately assign `const teamSlug = params.operatorSlug` in route files.
3. Use `team` naming in service responses.
4. Avoid new `operator` naming except where displayed to renters as a rental operator.
5. Run `npx tsc --noEmit`.

**Verify:**

- Routes still return 200.
- No type errors.

### Task 1.2: Add real app loading/error/not-found states

**Objective:** Replace abrupt failures with product-shaped states.

**Files:**

- Create: `components/drive-exotiq/AppState.tsx`
- Add/modify: `app/[operatorSlug]/not-found.tsx` if route-specific not-found is needed
- Add/modify: `app/[operatorSlug]/[vehicleSlug]/not-found.tsx` if needed

**Components:**

- `DriveLoadingState`
- `DriveEmptyState`
- `DriveNotFoundState`
- `DriveErrorPanel`

**Verify:**

- Bad team slug shows a clean not-found state.
- Bad vehicle slug shows a clean not-found state.
- No raw Next.js error UI for normal missing data.

### Task 1.3: Replace fixed driver identity with editable mock form

**Objective:** Move from a static mock identity to functional form fields that later map to renter/customer payloads.

**Files:**

- Modify: `components/drive-exotiq/flow/DriverStep.tsx`
- Modify: `domain/booking/types.ts`

**Fields:**

- full name
- date of birth
- phone
- email optional or required depending flow decision

**Rules:**

- Keep UI premium and concise.
- No raw PII persistence beyond local state.
- Do not implement real auth.

**Verify:**

- Continue remains blocked until docs are satisfied.
- Driver edits persist through review.

### Task 1.4: Make date selection interactive enough for MVP demo

**Objective:** Dates should not be purely visual.

**Files:**

- Modify: `components/drive-exotiq/flow/DatesStep.tsx`
- Modify: `components/drive-exotiq/flow/state.ts`
- Modify: `domain/booking/totals.test.ts`

**Behavior:**

- Tap first date sets start.
- Tap later date sets end.
- If end before start, reset range.
- Enforce `vehicle.minRentalDays` visually.
- Recompute totals.

**Verify:**

- Selecting a new range changes rental subtotal.
- Test totals for changed dates.

### Task 1.5: Improve review edit flow

**Objective:** Review rows should jump cleanly back to their step and preserve state.

**Files:**

- Modify: `components/drive-exotiq/flow/ReviewStep.tsx`
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Verify:**

- Tapping Dates returns to dates.
- Tapping Extras returns to extras.
- Tapping Protection returns to protection.
- Returning to Review keeps changes.

### Task 1.6: Clean payment placeholder

**Objective:** Keep payment future-proof without screaming “mockup.”

**Files:**

- Modify: `components/drive-exotiq/flow/PayStep.tsx`

**Copy direction:**

- Instead of “Apple Pay mock,” use “Reserve request” or “Continue to secure payment” disabled/placeholder language depending route.
- Keep a clear note that live payment is not connected in preview builds if needed.
- Do not collect raw card data.

**Verify:**

- The preview still routes to confirmation.
- UI reads like a functional pre-payment/reservation step, not a toy mock.

---

## Phase 2 — Rich Mock Marketplace Slice

**Owner:** Avi

**Can start:** Immediately after Phase 1 or in parallel where safe

**Goal:** Stress the renter app with multiple teams/vehicles and more production-shaped data.

### Task 2.1: Expand mock data structure

**Files:**

- Modify: `domain/booking/mockData.ts`
- Modify: `domain/booking/mockService.ts`
- Possibly create: `domain/booking/mockCatalog.ts`

**Data:**

- 2-3 teams
- 6-10 vehicles
- multiple photo arrays
- varied rates
- varied minimum days
- varied locations
- unavailable/hidden vehicle examples

**Verify:**

- Team storefront shows all public vehicles for team.
- Bad slugs return null/404.

### Task 2.2: Improve storefront inventory UX

**Files:**

- Modify: `app/[operatorSlug]/page.tsx`
- Possibly create: `components/drive-exotiq/TeamStorefrontPage.tsx`

**Features:**

- fleet cards
- rate filter/sort mock
- vehicle count
- operator policy summary
- pickup/delivery section
- empty state

**Verify:**

- Multiple vehicles render cleanly.
- CTA links route to correct vehicle pages.

### Task 2.3: Improve vehicle detail page

**Files:**

- Modify: `components/drive-exotiq/VehicleEntryPage.tsx`

**Features:**

- image carousel/gallery
- larger specs
- pricing card
- pickup location card
- operator trust section
- CTA to book

**Verify:**

- The page feels like a real vehicle detail page, not just screen 1 of a flow.

---

## Phase 3 — Lovable/Supabase Plumbing Prep

**Owner:** Avi prepares contracts; Gregory + Lovable/Supabase execute/review

**Can start:** Later today with Gregory

**Goal:** Convert our known frontend facade into explicit backend tasks.

### Task 3.1: Backend Task A — Vehicle slugs

**Prompt to Lovable:**

```text
Plan only first. We need app.exotiq.ai/Supabase to support Exotiq Rent public vehicle URLs.
Please propose the minimal migration to add vehicles.slug, backfill safe slugs, and enforce uniqueness per team with a unique index on (team_id, slug). Do not change frontend code. Include rollback considerations and confirm any existing vehicle URL assumptions.
```

**Expected output from Lovable:**

- migration SQL
- slug generation/backfill approach
- conflict handling
- index details
- affected app files if any

**Avi review criteria:**

- No global slug uniqueness unless intended.
- Unique per team.
- No breaking operator UI.
- Backfill deterministic and safe.

### Task 3.2: Backend Task B — Marketplace visibility

**Prompt to Lovable:**

```text
Plan only first. We need public marketplace visibility controls for Exotiq Rent. Please propose minimal schema fields/helpers so public RPCs can include only teams/vehicles that are marketplace-visible and exclude demo accounts. Do not loosen base table RLS.
```

**Expected output:**

- `teams.marketplace_visible` or equivalent
- `vehicles.marketplace_visible` or equivalent
- helper function such as `public.is_marketplace_visible(team_id)`
- demo exclusion rule

**Avi review criteria:**

- Public functions cannot trust caller-provided `team_id`.
- Demo teams excluded.
- Visibility logic centralized.

### Task 3.3: Backend Task C — Public read RPCs

**Prompt to Lovable:**

```text
Plan only first. We need public-safe RPCs for Exotiq Rent reads: public_team_by_slug, public_team_fleet, public_vehicle_by_slug. These must preserve RLS on base tables and return minimal public fields only. Please propose signatures, returned fields, SECURITY DEFINER safeguards, and tests.
```

**Required RPCs:**

```text
public_team_by_slug(team_slug text)
public_team_fleet(team_slug text)
public_vehicle_by_slug(team_slug text, vehicle_slug text)
```

**Security requirements:**

- lock `search_path`
- explicit column list, no `select *`
- no Stripe IDs
- no VIN/license plate
- no internal notes
- no private storage paths unless signed/proxied
- exclude demo teams
- require marketplace-visible flags

### Task 3.4: Backend Task D — Public media delivery

**Prompt to Lovable:**

```text
Plan only first. Vehicle photos are private today. We need a public-safe media delivery strategy for Exotiq Rent. Compare short-lived signed URLs vs a public derived image bucket/CDN. Recommend a v1 approach and include TTL, caching, SEO, and storage RLS implications.
```

**Avi recommendation:**

- For v1 app preview: signed URLs with <= 1 hour TTL are acceptable.
- For SEO/open graph/static sharing: create deliberate public/derived image path later.

### Task 3.5: Backend Task E — Availability and quote RPCs

**Prompt to Lovable:**

```text
Plan only first. Exotiq Rent needs public-safe availability and quote functions. Please propose get_vehicle_availability and get_vehicle_quote RPC/edge contracts. Availability must return only busy ranges/booleans and never expose booking IDs, customer refs, payment state, or internal statuses. Quote must encode operator-owned deposits and Exotiq broker fee rules.
```

**Required contracts:**

```text
get_vehicle_availability(vehicle_id uuid, range_start timestamptz, range_end timestamptz)
get_vehicle_quote(vehicle_id uuid, start_at timestamptz, end_at timestamptz, options jsonb)
```

**Quote rule:**

- Exotiq broker fee = 10% of operator daily rate only.
- Do not apply broker fee to delivery, gas, mileage, taxes, or deposits.
- Deposits belong to operator.

---

## Phase 4 — First Real Backend Integration

**Owner:** Avi after Lovable/Supabase plumbing is reviewed and applied

**Goal:** Swap mock reads for public RPC reads while preserving the service facade.

### Task 4.1: Add backend client wrapper

**Files:**

- Create: `services/exotiq-rent/client.ts`
- Create: `services/exotiq-rent/adapters.ts`
- Modify: `domain/booking/service.ts`

**Rules:**

- Only call public-safe RPCs.
- No base table reads.
- Convert dollars to cents in adapters.
- Normalize image URLs.

### Task 4.2: Add integration mode flag

**Files:**

- Modify: `.env.example`
- Modify: `domain/booking/service.ts`

**Config:**

```text
NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock|supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Verify:**

- Mock mode works without env.
- Supabase mode fails gracefully if env missing.

### Task 4.3: Wire team/vehicle reads

**Methods:**

- `getPublicTeamStorefront`
- `getPublicVehicleContext`
- `getBookingStartContext`

**Verify:**

- Known real team loads.
- Hidden/demo team returns not found.
- Vehicle detail loads from RPC.

---

## Phase 5 — Booking Intent and Document Upload

**Owner:** Lovable/Supabase for backend; Avi for frontend integration

**Goal:** Create real marketplace booking/request without payment.

### Backend prerequisites

- booking lifecycle decision
- marketplace booking source
- customer vs `marketplace_renter_intent` decision
- document storage bucket/path decision
- rate limits
- audit log
- notifications

### Frontend work

- submit booking request payload
- upload documents through backend-controlled function
- show requested/pending state
- confirmation from real booking ref

### Do not include yet

- real Stripe payment
- Exotiq Protection purchase
- deposit capture

---

## Phase 6 — Stripe and Exotiq Protection

**Owner:** Dedicated later phase with Gregory + Lovable/Supabase + Avi

**Goal:** Safely implement renter money movement.

### Decisions required

1. Does renter see one charge or two charges?
2. Is Exotiq Protection charged directly to platform account?
3. How are deposits authorized/captured?
4. How are refunds handled?
5. Which webhook handles renter payment events?
6. How are idempotency keys generated/stored?
7. Where is the broker fee stored and snapshotted?

### Guardrails

- Operator deposits/security holds are operator-owned.
- Exotiq broker fee is 10% of operator daily rate only.
- Existing hardcoded 20% marketplace paths are not final product decision.
- No raw card collection in frontend app state.

---

## 4. Suggested Plan for Today

### Avi solo block

If Gregory is not available, Avi should work in this order:

1. Convert remaining mock language into functional preview language.
2. Improve `PayStep` so it feels like a real reservation/payment boundary.
3. Expand mock data to multiple vehicles.
4. Improve tenant storefront for multiple vehicles.
5. Improve vehicle detail page.
6. Add tests for service facade/mock service.
7. Browser QA and tunnel refresh.

### Gregory + Lovable/Supabase block later today

When Gregory is available, do not open with another huge context doc. Use one narrow Lovable prompt at a time:

1. Vehicle slugs.
2. Marketplace visibility flags/helper.
3. Public read RPC signatures.
4. Media delivery strategy.
5. Availability/quote plan.

Stop after each Lovable answer and let Avi review before applying.

---

## 5. Acceptance Criteria for Next Milestone

The next milestone is “functional mock marketplace slice.” It is complete when:

- `/{teamSlug}` shows a real-feeling storefront with multiple vehicles.
- `/{teamSlug}/{vehicleSlug}` feels like a real vehicle detail page.
- `/{teamSlug}/{vehicleSlug}/book` supports interactive dates, driver details, docs, extras, protection, review, and pay boundary.
- `/booking/{bookingRef}` shows a production-shaped confirmation.
- No fake phone chrome remains.
- No raw “mockup” copy remains except where intentionally marking payment as preview-only.
- All routes work in production build.
- Browser QA passes on mobile viewport.
- `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.

---

## 6. Commands for Every Work Session

Before starting:

```bash
git status --short --branch
```

During development:

```bash
npm test
npx tsc --noEmit
npm run lint
```

Before sharing preview:

```bash
npm run build
npm run start -- -p 3000
```

Smoke routes:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/desert-exotic-rentals
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/desert-exotic-rentals/mclaren-750s-spider
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/desert-exotic-rentals/mclaren-750s-spider/book
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/booking/BK-01001
```

---

## 7. Decision Summary

Avi can make meaningful progress today without Lovable by improving product feel, mock depth, route UX, design fidelity, and tests.

Lovable/Supabase should be used later today only for tightly scoped backend plumbing:

- vehicle slugs
- marketplace visibility
- public read RPCs
- media delivery
- availability/quote

Do not start booking writes, document uploads, Stripe, or protection plumbing until public reads and schema visibility are clean.
