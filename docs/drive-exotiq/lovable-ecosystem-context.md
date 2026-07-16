# Exotiq Rent + app.exotiq.ai Ecosystem Context for Lovable

**Document type:** Product and architecture orientation only.

**Audience:** Lovable / app.exotiq.ai planning context, Gregory, Avi, and any future implementation agents.

**Important:** This is **not** a build instruction, not a schema migration request, not a Stripe implementation request, and not an instruction to change production Supabase. This document explains the direction we are aligning toward so Lovable can reason correctly when Gregory later provides scoped prompts, schema changes, edge-function work, or migration tasks.

---

## 1. Executive Summary

Exotiq is moving toward a two-surface platform:

1. **app.exotiq.ai** — the operator command center / SaaS dashboard.
2. **Exotiq Rent (`exotiq.rent`)** — the renter-facing marketplace and booking platform.

These should be separate applications with different product goals, but they should share one backend source of truth: the existing Supabase project currently used by app.exotiq.ai.

The current direction is:

- Lovable continues to be strongest on the app.exotiq.ai/Supabase/operator-side system.
- Avi/Codex continues to build the separate Exotiq Rent renter-facing frontend in the `exotiq-rent` repo.
- The two products should integrate through a thin, public-safe backend contract: read-only public views/RPCs plus scoped renter edge functions.
- Exotiq Rent should **not** directly query or write sensitive base tables.
- Stripe renter checkout and Exotiq Protection should be a separate coordinated phase.
- Migration away from Lovable is not a blocker for renter frontend work, but portability needs to remain a constant design constraint.

Lovable’s discovery answers dated 2026-05-26 clarified several important backend truths:

- Canonical operator entity is `teams`, not `operators` or `tenants`.
- `teams.slug` is the public storefront slug.
- There are no renter accounts today.
- No public reads are currently possible because RLS requires team membership.
- Vehicle slugs do not exist yet and need to be added before public URLs launch.
- Vehicle photos are in a private bucket and require signed/proxied delivery for public marketplace use.
- Availability is derived from `bookings`, not a dedicated availability table.
- Booking refs (`BK-01001`) should be used in public confirmation URLs, not UUIDs.
- Stripe Connect exists on the SaaS side using Express accounts, but renter Stripe/payment/protection must be its own coordinated phase.
- Marketplace fee handling exists in some Stripe functions but is not final for renter launch: marketplace booking paths currently hardcode `0.20`, direct booking paths charge `0%`, and SaaS settings expose `teams.platform_fee_percent`. This must be reconciled before launch.
- Gregory's current commercial rule: Exotiq's broker fee should be **10% of the operator daily rate only**; it should not apply to delivery, gas, mileage, or deposits. Platform/broker fees are paused until renter launch.
- Deposits and withheld/deposit portions belong to the operator, not Exotiq.
- Exotiq Protection does not exist in schema yet.

---

## 2. Product Boundary

### app.exotiq.ai

`app.exotiq.ai` is the operator command center.

It is the SaaS application used by rental operators and internal Exotiq staff to manage:

- teams / operator businesses
- users, roles, and team membership
- vehicle inventory
- vehicle photos and generated/enhanced assets
- locations
- bookings
- customers
- documents
- payments
- partner payouts
- Stripe Connect onboarding/status
- notifications
- internal audit/activity records

Lovable currently has the most context and tooling around this surface, including Supabase MCP access, schema knowledge, deployed edge functions, and operator SaaS UI implementation.

### Exotiq Rent (`exotiq.rent`)

`exotiq.rent` is the renter-facing marketplace and booking platform.

It is the public consumer/renter surface where visitors should be able to:

- browse marketplace inventory
- view public team/operator storefronts
- view public vehicle pages
- check availability
- receive a quote
- complete a premium mobile-web booking flow
- upload driver/insurance documents
- pay for a booking in a future Stripe phase
- receive a booking confirmation

Exotiq Rent is **mobile-web**, not native app.

Exotiq Rent should be developed as a separate frontend application/repo while consuming backend data from the same Supabase project through safe contracts.

---

## 3. Naming and Public URL Model

Lovable discovery confirmed that the canonical backend entity is `teams`.

Terminology should be handled carefully:

| Context | Preferred term |
|---|---|
| Database / backend contracts | `team`, `team_id`, `teamSlug` |
| Public URL docs | `teamSlug` or `operator slug` depending audience |
| Renter-facing copy | operator, partner, rental company, host, or brand name |
| Casual product conversation | tenant/operator may appear, but code should prefer `team` |

The desired public URL structure is:

```text
exotiq.rent
exotiq.rent/{teamSlug}
exotiq.rent/{teamSlug}/{vehicleSlug}
exotiq.rent/{teamSlug}/{vehicleSlug}/book
exotiq.rent/booking/{bookingRef}
```

Important backend implications:

- `teams.slug` already exists and is globally unique.
- `vehicles.slug` does not exist yet and should be added before public launch.
- Vehicle slugs should be unique per `team_id`, not globally, because the URL includes both `teamSlug` and `vehicleSlug`.
- Confirmation URLs should use `bookings.booking_ref`, not internal UUIDs.

---

## 4. Current Exotiq Rent Renter Scaffold

A separate renter-facing scaffold has been started in the `exotiq-rent` repo.

Current route shape:

```text
/{operatorSlug}/{vehicleSlug}
/{operatorSlug}/{vehicleSlug}/book
/booking/{bookingId}
/preview
```

This maps well to the discovered backend direction, but should be renamed conceptually toward:

```text
/{teamSlug}/{vehicleSlug}
/{teamSlug}/{vehicleSlug}/book
/booking/{bookingRef}
```

The current scaffold includes:

- mobile-web renter booking shell
- gold/editorial visual direction
- long-term route shape
- mock operator/team and vehicle data
- mock booking flow state
- mock totals
- split billing UI concepts
- mocked payment boundary
- confirmation screen
- preview route

The scaffold is **not** a final backend implementation.

It intentionally avoids:

- real Supabase writes
- real Stripe checkout
- real Stripe Connect behavior
- Supabase migrations
- direct production table integration
- real renter document upload

Lovable is invited to examine the current renter scaffold and provide feedback on:

- whether route naming should be updated from `operatorSlug` to `teamSlug`
- how the mock model should map to the real schema
- what public RPC/edge-function shape would be safest
- whether any frontend assumptions conflict with existing app.exotiq.ai data reality
- what must exist in the backend before renter-side integration can proceed

This feedback should be advisory only unless Gregory provides a scoped build prompt.

---

## 5. Renter-Facing Design Direction

Gregory has provided mobile-web design screens for the renter-facing side.

Design bundle received:

```text
/Users/gbot/.hermes/cache/documents/doc_44d278bcc09c_Drive Exotiq Wire Fram Screens.zip
```

The bundle includes, among other files:

```text
Drive Exotiq Booking Flow - Gold + Editorial Type.html
Drive Exotiq Booking Flow - Gold.html
Drive Exotiq Booking Flow v2.html
Drive Exotiq - Walkthrough.html
HANDOFF.md
frame.jsx
icons.jsx
assets/drive-exotiq-logo.png
assets/mclaren-750s.png
```

Design constraints that should remain stable unless Gregory changes direction:

- Mobile web, not native.
- Premium, restrained, editorial luxury feel.
- Champagne gold accent, not the old cyan marketplace direction.
- Newsreader/serif only for voice moments like vehicle names and screen headlines.
- Inter/sans for UI labels, prices, metadata, tables, and chrome.
- No emoji.
- Avoid gimmicky marketplace tone.
- Payment UI should be restrained and should not show raw card collection until a real Stripe phase is designed.
- Confirmation should be car-specific, e.g. “Your McLaren is reserved.”
- Operator/rental charge and Exotiq Protection charge should remain conceptually separate.
- Deposits/security holds belong to the operator. Exotiq's broker fee should not be applied to deposits.
- Exotiq's intended broker fee is 10% of the operator daily rate only, not delivery, gas, mileage, or deposit amounts.

Lovable should treat these screens as product context for Exotiq Rent, not as instructions to rebuild app.exotiq.ai.

---

## 6. Backend Source of Truth

Lovable discovery confirmed that the existing Supabase project is the source of truth for renter-relevant data.

Supabase project referenced by discovery:

```text
jlgwbbqydjeokypoenoc
```

Core source-of-truth areas:

| Concept | Current source |
|---|---|
| Operator business | `teams` |
| Team/user membership | `profiles`, `team_members`, `user_roles`, `super_admins` |
| Locations | `locations` |
| Vehicles | `vehicles` |
| Vehicle media | `vehicle_photos` + Supabase Storage |
| Bookings | `bookings` |
| Customers/renters today | `customers` |
| Documents | `documents` and customer document URL columns |
| Payments | `payments`, `payment_receipts`, `payouts`, `partner_payouts`, `stripe_webhook_events` |
| Stripe Connect status | columns on `teams` |
| Notifications | `notifications`, `notification_preferences` |
| Availability | derived from `bookings` |
| Protection / coverage | missing today |
| Add-ons/extras | not currently discrete; fixed fields only |

Strategic principle:

**Do not create a second renter database.**

Exotiq Rent should consume the same data authority, but through safe public contracts rather than direct table access.

---

## 7. Public Marketplace Access and RLS Strategy

Lovable discovery confirmed that public reads do not work today.

Every renter-relevant base table is protected by team-scoped RLS requiring `auth.uid()` to be a team member.

That is correct for the operator command center, but it means Exotiq Rent needs a separate public access layer.

### Recommended pattern

Do **not** loosen RLS on base tables.

Instead use:

1. read-only public views exposing safe fields only
2. carefully audited SECURITY DEFINER RPCs for public reads
3. edge functions for sensitive renter writes
4. signed/proxied media URLs for private vehicle photos
5. per-IP/per-session rate limiting on public RPCs and renter upload functions

Suggested public read surface:

```text
public_team_by_slug(slug)
public_team_fleet(slug)
public_vehicle_by_slug(team_slug, vehicle_slug)
get_vehicle_availability(vehicle_id, start, end)
get_vehicle_quote(vehicle_id, start, end, options)
```

Non-negotiable public RPC safety rules:

- Every public RPC must internally filter `teams.marketplace_visible = true` or equivalent.
- Every public RPC must internally exclude `teams.is_demo_account = true`.
- RPCs must not trust caller-provided `team_id` for tenant isolation.
- Prefer a shared helper such as `public.is_marketplace_visible(team_id)` so every function uses the same tenant visibility rule.
- Treat every SECURITY DEFINER function as a privilege-escalation surface: keep projections minimal, search paths locked, and table access reviewed.
- Public availability functions must return only busy/free ranges such as `{ start, end }`; never return booking IDs, customer references, payment state, or internal statuses.

Suggested renter write surface:

```text
renter-create-booking
renter-upload-document
renter-protection-charge   (future Stripe/protection phase)
```

### Data that should never be public

Never expose publicly:

- VIN
- license plate
- internal `team_id` if not needed externally
- `user_id`
- Stripe account IDs
- Stripe customer IDs
- internal notes
- customer status
- blacklist information
- mileage/internal ops fields
- operational status details not needed for renters
- partner payout amounts
- internal addresses not intended for public display
- document URLs
- damage claim data
- customer notes
- booking IDs or customer references in availability responses

---

## 8. Storefront and Marketplace Requirements

The storefront route should be:

```text
exotiq.rent/{teamSlug}
```

This page should eventually show public operator/team information and bookable inventory.

Lovable discovery says current `teams` supports:

- name
- slug
- logo_url
- timezone
- settings jsonb
- platform_fee_percent
- rental_buffer_minutes
- Stripe Connect status
- demo account flag

Missing for launch:

- marketplace/public visibility flag
- public description
- market/city tags
- public hero image
- public policies
- possibly a `team_public_profile` table

Recommended direction:

- Add `teams.marketplace_visible` or equivalent before launch.
- Exclude `teams.is_demo_account = true` from public listings.
- Consider a `team_public_profile` table if public branding/policies outgrow the core `teams` table.
- Keep operator command center private fields private.

---

## 9. Vehicle Inventory and Media Requirements

Vehicle truth is in `vehicles`.

Important existing realities:

- `vehicles.team_id` links vehicle to team/operator.
- Rates are stored as dollars (`numeric(10,2)`), not cents.
- Fields include daily/current rate, 3hr rate, 6hr rate, multiday rate, mileage overage rate, default mileage limit.
- `vehicles.status` includes available/booked/maintenance/retired.
- `ops_status` exists for operational state, but public marketplace should not expose internal ops details.
- No `vehicles.slug` yet.
- No vehicle-level marketplace visibility flag yet.

Recommended additions before public launch:

- `vehicles.slug text`
- `UNIQUE (team_id, slug)`
- vehicle marketplace visibility flag
- clear rule for public eligibility

Public eligibility should roughly be:

```text
team is marketplace_visible
team is not demo
vehicle marketplace_visible = true
vehicle status in public-displayable states
photo/media exists and is visible
```

Lovable recommends that booked vehicles may still display publicly with unavailable dates. That is good marketplace behavior.

### Vehicle photos

Current state:

- `vehicle_photos` exists.
- Storage bucket `vehicle-photos` is private.
- URLs are signed/private.
- `thumbnail_url` and `enhanced_url` may be populated by the existing photo pipeline.
- Public hero precedence should match operator-side expectations: `vehicles.image_url` AI/generated hero first, then the first `vehicle_photos` row by `display_order` where `is_visible = true`, then a static fallback.
- No `is_hero` field exists today.

Public marketplace implication:

Exotiq Rent should not directly rely on long-lived private URLs from the DB. It needs either:

1. edge function returning short-lived signed URLs, or
2. a public CDN/derived image bucket for approved public images.

Signed URL policy guidance:

- Prefer signed URLs with TTL <= 1 hour for renter browsing.
- Regenerate on page load or API response as needed.
- Do not embed signed private URLs into indexable/static SSR cache.
- If SEO/static sharing requires stable image URLs, create a deliberate public/derived image path rather than leaking private storage URLs.

This should be resolved before production launch.

---

## 10. Availability and Calendar Direction

Current availability is derived from `bookings`.

Blocking bookings are overlapping `start_date` / `end_date` rows where status is one of:

```text
pending, confirmed, active
```

`teams.rental_buffer_minutes` governs turnaround buffer.

There is no separate blackout/blockout table today.

There is no database-level exclusion constraint today.

### Recommended direction for renter launch

Exotiq Rent should not query `bookings` directly because bookings contain PII and internal fields.

Use a SECURITY DEFINER RPC such as:

```text
get_vehicle_availability(vehicle_id uuid, range_start timestamptz, range_end timestamptz)
```

The response must be PII-minimized. It should return only unavailable/busy date-time ranges or availability booleans. It must not expose booking IDs, customer IDs, customer names, booking refs, payment state, document state, or internal booking statuses.

Before concurrent renter-side writes go live, add DB-level double-booking protection, likely using a `btree_gist` exclusion constraint on booking ranges for blocking statuses.

Potential future needs:

- per-vehicle blackout/blockout periods
- same-day cutoff rules
- per-team minimum lead time
- per-vehicle minimum rental days/hours
- pickup/dropoff time windows
- maintenance holds that are date-range based rather than only vehicle status

Those are not required for the current frontend scaffold but should be considered before launch.

---

## 11. Booking Lifecycle Direction

The current booking table already includes many fields useful for renter launch:

- `vehicle_id`
- `customer_id`
- `team_id`
- `start_date`
- `end_date`
- pickup/dropoff location fields
- `daily_rate`
- `total_value`
- security deposit amount
- delivery/gas/mileage fees
- discount fields
- `rental_duration_type`
- `booking_source`
- `booking_ref`
- platform fee snapshot fields

Public confirmation route should use:

```text
/booking/{bookingRef}
```

Example:

```text
/booking/BK-01001
```

Not the UUID.

Even though `booking_ref` is globally unique and sequence-generated, Exotiq Rent should not query the `bookings` table directly by ref. Add a public-safe lookup such as:

```text
public_booking_by_ref(booking_ref text)
```

That function should return only renter-safe confirmation fields and should apply whatever session/identity checks are required for non-public details.

### Existing statuses

Observed production booking statuses include:

```text
pending, confirmed, active, completed, cancelled, declined
```

Observed payment statuses include:

```text
pending, deposit_paid, partial, paid, refunded
```

Therefore `declined` and `refunded` are not missing concepts. The genuinely missing marketplace lifecycle states are:

```text
requested
pending_documents
pending_payment
```

Implementation caution: because existing operator UI may switch on the current booking status enum, marketplace-specific lifecycle may be safer as either carefully added enum states or a separate sub-state column rather than a disruptive status rewrite.

### Recommended renter booking sequence

Lovable’s recommended sequence is sensible:

1. Renter selects dates.
2. Exotiq Rent calls availability RPC.
3. Quote returned.
4. Driver info captured.
5. Customer record is created/upserted in the relevant operator/team scope, or a temporary marketplace renter intent is created first and resolved to a team-scoped customer when the operator accepts.
6. Documents uploaded through edge function.
7. Booking created with marketplace source and pending/pending_documents/pending_payment status.
8. Stripe PaymentIntents created in dedicated payment phase.
9. Operator approval or auto-confirm setting moves booking forward.
10. Pickup moves booking active.
11. Return moves booking completed.

For v1, guest checkout is acceptable, but the system should not block future renter auth/accounts.

---

## 12. Customer, Renter, and Driver Direction

Current state:

- `customers` table exists.
- Customers are team-scoped.
- Same human across two operators equals two customer rows today.
- No DB-level uniqueness on email or phone.
- Customers are not auth users today.
- There are no renter accounts today.
- Driver/license/insurance fields live on `customers`.

Strategic direction:

- Guest checkout is acceptable for v1.
- Renter auth should be planned for later so booking history and document reuse can survive across operators.
- Do not dedupe renters across teams at the `customers` level; duplicates are acceptable by design to preserve operator data isolation.
- Consider a future global `renters` table separate from operator-owned `customers` if cross-operator renter identity, booking history, or document reuse becomes a product requirement.
- Do not force renter accounts into the immediate mobile-web booking scaffold unless Gregory explicitly prioritizes it.

This means Exotiq Rent should design UI/flows that can work guest-first but later support sign-in without re-architecting everything.

Open architecture choice: for request-to-book flows, consider a `marketplace_renter_intent` or equivalent pre-customer object so the platform can collect renter intent and documents before creating/attaching a team-scoped `customers` row. This avoids prematurely polluting operator-owned customer records with unaccepted marketplace leads.

---

## 13. Documents and Verification Direction

Current state:

- `documents` is vehicle-centric for registration/insurance/title.
- Driver document URLs are currently stored directly on `customers`.
- Buckets are private.
- `customer-documents` is private.
- RLS protects metadata.

Renter app implication:

Do not upload directly from the browser to private buckets without backend control.

Use an edge function like:

```text
renter-upload-document
```

This function should:

- authenticate or validate the renter/session
- scope file path correctly
- write to private storage
- attach document metadata to customer and/or booking
- stamp correct team scoping
- avoid exposing raw private URLs to the client

Recommended flow:

- Create a booking early with `status = 'pending_documents'`.
- Attach uploaded docs to that booking/customer.
- Advance once verification/payment requirements are met.

This is cleaner than a disconnected pre-booking upload flow.

---

## 14. Pricing, Fees, and Extras Direction

Current pricing facts:

- Rates are dollars, not cents.
- Daily, 3hr, 6hr, and multiday fields exist.
- Delivery/gas/mileage fields exist.
- No discrete add-ons/extras table exists today.
- Operators bake taxes in today.
- No tax engine exists.
- Pricing is operator-controlled.
- AI pricing suggestions exist, but operator sets actual price.

Frontend implication:

Exotiq Rent frontend can use cents internally for safety, but the adapter layer must convert to/from backend dollar numerics explicitly.

Do not hardcode pricing logic in the frontend for production.

Use a backend quote function eventually:

```text
get_vehicle_quote(vehicle_id, start, end, options)
```

Quote should eventually return:

- rental subtotal
- duration
- mileage package/default mileage
- delivery fee if applicable
- fixed fees
- platform fee if renter-visible or internally tracked
- protection placeholder/premium if selected
- deposit/hold amount if applicable
- total due now / hold amounts / separate charges

Commercial rule to encode before launch:

- Exotiq broker fee = 10% of the operator daily rate only.
- Do not apply Exotiq broker fee to delivery, gas, mileage, taxes, or deposits.
- Deposits/security holds belong to the operator and should never be routed as platform revenue.
- Platform/broker fees are paused until the renter app launches.

### Extras

Current design may include renter-facing extras like delivery, additional driver, photo package, etc.

Backend currently has only fixed fee fields, not a general extras model.

Therefore:

- Keep extras mocked/contract-shaped in the renter scaffold for now.
- Do not assume a real extras table exists.
- If extras become important, define a separate add-ons schema in a future scoped phase.

---

## 15. Stripe and Payment Direction

Stripe is **not** a casual frontend task.

Lovable discovery confirms Stripe Connect is already substantial on the SaaS side:

- Express connected accounts
- `teams.stripe_account_id`
- onboarding edge function
- connected account capability status fields
- webhook function
- idempotent webhook event storage
- refunds function
- manual capture holds/deposits
- payment history
- `payments` table

Current Stripe model:

- PaymentIntent on connected account.
- Manual capture.
- Destination charges with `application_fee_amount`.
- Security deposit as separate manual-capture PaymentIntent.
- 7-day auth window.

### Critical pre-launch issue

There is a renter-launch fee policy issue, but it is not necessarily a production bug today because no marketplace bookings exist yet:

- SaaS subscription/direct-booking flows use existing settings / source-specific logic.
- Marketplace booking paths in `stripe-create-hold` and related functions currently hardcode `0.20` when `booking_source === 'marketplace'`.
- Direct-booking source charges `0%`.
- `teams.platform_fee_percent` exists and is snapshotted into bookings, but may not represent the final renter marketplace fee policy.

Before renter launch, replace hardcoded marketplace `0.20` with the approved product rule: either `teams.platform_fee_percent`, a dedicated `teams.marketplace_fee_percent`, or Gregory's current broker rule of **10% of the operator daily rate only**. Do not assume the existing 20% is the real product decision.

### Recommended Stripe phase boundaries

Do not implement real renter Stripe until these are resolved:

1. Express account flow confirmed as final.
2. Marketplace fee source reconciled: hardcoded `0.20` vs `teams.platform_fee_percent` vs a dedicated `teams.marketplace_fee_percent` vs Gregory's 10%-of-daily-rate broker rule.
3. Rental charge flow defined.
4. Deposit/hold flow defined with operator ownership explicit.
5. Exotiq Protection charge flow defined.
6. Webhook booking status transitions defined.
7. Idempotency strategy defined.
8. SCA/3DS handling defined.
9. Refund/cancel flow defined.
10. Operator approval vs auto-confirm timing defined.

### Two-party payment concept

The renter experience should clearly preserve the conceptual separation between:

1. operator rental/payment/deposit amounts
2. Exotiq broker fee and any Exotiq Protection/platform-owned charges

Deposit ownership rule: deposits and withheld/deposit portions belong to the operator, not Exotiq. The renter quote/checkout adapter must never route deposit money as platform revenue.

Broker fee rule: Exotiq's broker fee is intended to be 10% of the operator daily rate only, not delivery, gas, mileage, taxes, or deposits.

Lovable recommends Exotiq Protection conceptually be charged to the Exotiq platform account, not the operator connected account. This is reasonable architecturally, but it may mean the renter sees two separate Stripe charges on their statement: one from the operator and one from Exotiq. That is a UX/legal/product decision that must be explicitly approved before implementation.

This should be designed in a dedicated Stripe/protection phase.

For now, Exotiq Rent should keep payment mocked/tokenized and avoid raw-card UI.

---

## 16. Exotiq Protection Direction

Current schema reality:

- Exotiq Protection / coverage does not exist.
- `damage_claims` exists but is post-incident, not a pre-sold coverage product.
- Two-party billing is not modeled yet.

Lovable recommended future tables:

```text
protection_products
booking_protection
```

Likely future needs:

- protection product catalog
- daily premium
- deductible
- coverage limits
- active/inactive status
- booking-level premium snapshot
- declined flag
- decline acknowledgement timestamp/IP
- separate protection payment record
- direct-to-platform Stripe charge, if UX/legal approves separate platform charge presentation

Frontend implication:

- Premium protection can remain preselected in mock UI.
- Decline protection should require explicit acknowledgement.
- Do not imply real coverage is active until backend/product/legal/payment details exist.
- Keep copy careful and mock-friendly.

---

## 17. Audit, Abuse Prevention, and Public Function Safety

Renter-side actions will mutate operator-owned data, so they need an audit trail even when initiated from the public marketplace.

Renter-initiated mutations that should write an attributable activity/audit row include:

- marketplace booking intent created
- booking created
- document uploaded
- payment session started
- payment succeeded/failed
- protection selected/declined
- operator accepted/declined marketplace request

Audit rows should be tagged with a source such as:

```text
source = 'marketplace'
```

Where possible, include team, booking, vehicle, customer/intent, IP/session fingerprint, and edge function name without leaking PII into broad public logs.

Public endpoints also require abuse controls before launch:

- per-IP and per-session rate limits for public browse/quote/availability RPCs
- stricter rate limits for `renter-upload-document`
- storage upload size/type validation
- no VIN-adjacent/internal metadata in public responses
- no signed private media URLs in long-lived caches
- monitoring for scraping patterns

SECURITY DEFINER functions should be treated as high-risk code. Strong recommendations:

- Use a single helper such as `public.is_marketplace_visible(team_id)` for marketplace visibility checks.
- Lock `search_path` inside definer functions.
- Return explicit column lists, never `select *`.
- Avoid selecting from `customers`, `payments`, `documents`, or `damage_claims` in public definer functions unless a future scoped prompt explicitly justifies it.
- Add a CI/lint check or migration review checklist for public definer functions.

---

## 18. Operator Workflow Direction

Current app.exotiq.ai workflow is manual approval today.

Auto-confirm is planned but not implemented.

Recommended future setting:

```text
teams.settings->>'auto_confirm_marketplace_bookings'
```

Exotiq Rent should be flexible enough to support either:

- request-to-book / operator approval, or
- instant booking for opted-in teams.

Do not hardcode all bookings as auto-confirmed until product/backend confirms this.

Notifications today include:

- in-app notifications
- email via Resend
- Slack notification function
- Google Calendar push
- weekly digests

No Twilio/GHL today.

Future marketplace booking creation should trigger appropriate operator notifications through backend functions, not frontend hacks.

---

## 19. Migration and Portability Direction

Gregory does not want to be handcuffed to Lovable.

Lovable discovery indicates migration away from Lovable is not a blocker for renter frontend work because:

- app source is standard Vite/React
- edge functions are portable Deno TypeScript
- migrations live in `supabase/migrations`
- generated types can be regenerated
- Supabase/Stripe are the real platform dependencies, not Lovable runtime

Highest migration risks:

1. Stripe webhook URL and signing secret.
2. Auth redirect URLs.
3. Edge function secrets.
4. Generated type drift.
5. Storage RLS/bucket policies.
6. AI gateway/MCP-related secrets.
7. CSP/domain references, including hardcoded Lovable preview origins such as `exotiq.lovable.app` defaults in edge function origin handling.
8. Renter domain `exotiq.rent` allowed-origin handling for Stripe, document upload, and marketplace edge functions.
9. Stripe webhook routing if renter Stripe adds new event types/account contexts.

Strategic instruction:

- Build Exotiq Rent frontend on mocks and clean adapter contracts now.
- Do not deeply couple the renter frontend to Lovable-generated app internals.
- Keep all backend integration expressed as public RPC/edge-function contracts.
- Maintain a migration inventory before production cutover.
- Review existing edge functions for hardcoded Lovable/app origins and add explicit `exotiq.rent` handling before renter launch.
- Decide whether renter Stripe events share the existing webhook endpoint or use a separate endpoint before adding new renter payment event types; this affects idempotency and event partitioning.

---

## 20. Recommended System Architecture

```text
Exotiq Rent Frontend (Next.js mobile-web)
  |
  | calls typed service adapters
  v
Exotiq Rent Service Layer
  |
  | future HTTP/Supabase RPC/edge-function calls
  v
Public-safe Backend Contract
  - audited SECURITY DEFINER read RPCs
  - shared marketplace visibility helper
  - edge functions for writes/uploads/payments
  - signed/proxied media access
  - rate limiting and abuse controls
  |
  v
Shared Supabase Source of Truth
  - teams
  - locations
  - vehicles
  - vehicle_photos
  - bookings
  - customers
  - documents
  - payments
  - Stripe Connect fields/functions
  |
  v
app.exotiq.ai Operator Command Center
```

This keeps:

- operator SaaS workflows in app.exotiq.ai
- renter UX in exotiq.rent
- shared data in Supabase
- public access safe through RPC/edge functions
- Stripe centralized and coordinated
- migration path portable

---

## 21. Near-Term Collaboration Model

### Lovable should help with

- schema truth
- Supabase/RLS reality
- migrations when explicitly approved
- public RPC designs
- edge-function implementation proposals
- Stripe existing architecture explanation
- operator SaaS UI and workflows
- portability inventory
- reviewing Exotiq Rent assumptions against backend reality

### Avi / Exotiq Rent repo should handle

- renter-facing mobile-web frontend
- premium design implementation
- route structure
- tenant storefront frontend
- vehicle detail frontend
- booking funnel frontend
- mock service adapters
- typed integration contracts
- frontend maintainability and QA
- review of Lovable backend proposals from renter-app perspective

### Gregory decides

- product priority
- Stripe phase timing
- migration timing
- whether schema changes are approved
- whether Lovable or Avi implements a given scoped backend task

---

## 22. What Lovable Should Review Now

Lovable is asked to review the direction and provide feedback, not build yet.

Please review:

1. Does the boundary of app.exotiq.ai vs Exotiq Rent look correct?
2. Should all code/data contracts use `teamSlug` rather than `operatorSlug`?
3. Are the proposed public RPCs the right shape?
4. Are there safer public read approaches than SECURITY DEFINER RPCs/views?
5. Should public team profile data live on `teams` or `team_public_profile`?
6. What should be the exact public vehicle eligibility rule?
7. What is the best public media delivery strategy for private `vehicle-photos`, and what signed URL TTL should be enforced?
8. Should `requested`, `pending_documents`, and `pending_payment` become booking statuses or a separate marketplace sub-state?
9. Should guest checkout remain v1, or should renter auth be created before public launch?
10. What is the minimum schema needed for Exotiq Protection to be represented honestly?
11. What is the safest Stripe sequencing for rental charge, operator-owned deposit hold, 10%-of-daily-rate broker fee, and protection premium?
12. Should Exotiq Protection be a separate Stripe charge if that creates two statement charges for the renter?
13. What migration/portability risks are missing from this document?
14. Should public SECURITY DEFINER functions be linted in CI to prevent selecting from `customers`, `payments`, `documents`, or `damage_claims`?

---

## 23. What Lovable Should Not Do From This Document

Do not implement anything solely because it appears here.

Specifically, do not yet:

- add schema migrations
- loosen RLS
- create public views/RPCs
- create renter edge functions
- alter Stripe logic
- add protection tables
- route deposits or withheld deposit funds to Exotiq/platform revenue
- treat hardcoded 20% marketplace fee as a final product decision
- create renter auth
- deploy edge functions
- change production secrets
- change payment fees
- modify webhook behavior
- rebuild Exotiq Rent frontend inside app.exotiq.ai

Any of those should be handled in a separate scoped prompt with acceptance criteria and review.

---

## 24. Proposed Next Steps

### Step 1 — Align on this document

Gregory, Lovable, and Avi confirm this ecosystem direction is accurate.

### Step 2 — Update Exotiq Rent frontend plan

Avi updates the renter-app plan to reflect Lovable’s discoveries:

- `teamSlug` naming
- `bookingRef` confirmation route
- public RPC contract expectations
- no direct base-table access
- mock service boundary
- Stripe later

### Step 3 — Continue safe frontend work

Avi continues work in `exotiq-rent` on:

- design fidelity
- component split
- tenant storefront mock page
- vehicle detail/booking polish
- mock service adapters

No production Supabase/Stripe wiring yet.

### Step 4 — Define backend contract in a separate doc

Avi prepares an integration contract plan describing:

- required public reads
- required edge functions
- request/response shapes
- security constraints
- staging-first sequencing

### Step 5 — Lovable reviews backend contract

Lovable reviews the contract against actual schema and proposes scoped changes.

### Step 6 — Backend phase, separately approved

Only after Gregory approves:

- add `vehicles.slug`
- add marketplace visibility
- add public profile fields/table
- add public RPCs
- add availability/quote functions
- add renter booking/document edge functions
- later, add Stripe/protection work

---

## 25. Current Confidence Assessment

Based on Lovable’s discovery answers:

### Product architecture clarity

High.

We now understand the division:

- app.exotiq.ai = operator command center
- Exotiq Rent = renter marketplace/mobile web booking
- Supabase = shared source of truth

### Frontend readiness

Moderate.

The scaffold exists and has the right direction, but still needs:

- visual polish
- component splitting
- tenant storefront
- service-adapter cleanup
- design alignment
- QA hardening

### Backend integration readiness

Moderate as knowledge, low as implementation.

We now understand the backend gaps, but the necessary public RPCs, vehicle slugs, visibility flags, protection schema, and renter edge functions are not implemented yet.

### Stripe readiness

Not ready for renter launch.

SaaS-side Stripe is substantial, but renter-side payment must be coordinated separately because of fee mismatch, protection charges, deposit holds, webhook transitions, and idempotency requirements.

### Migration urgency

Not urgent for frontend work.

Migration away from Lovable should be planned, but it does not block Exotiq Rent frontend development as long as the renter app stays decoupled through mocks/service contracts and does not directly depend on Lovable internals.

---

## 26. Final Direction

The recommended direction is:

**Build Exotiq Rent separately as the renter-facing mobile-web marketplace, while using app.exotiq.ai/Supabase as the shared source of truth. Lovable should continue to own/understand the operator command center and help expose safe backend contracts. Avi should continue the renter frontend and integration architecture. Stripe/protection should be a later coordinated phase, not improvised inside the frontend.**

This approach preserves:

- premium renter experience quality
- frontend portability
- backend data consistency
- operator SaaS continuity
- RLS/security discipline
- future migration flexibility
- Stripe correctness

