# Lovable Discovery Questions for Exotiq Rent + app.exotiq.ai

> **Purpose:** This is a discovery/context document for Lovable in plan mode. It is **not** a request to build, modify schema, migrate data, or implement features yet.
>
> Gregory is using this to gather Lovable's current understanding of app.exotiq.ai, Supabase, Stripe, schema, portability, and how the future renter-facing Exotiq Rent platform should connect to the existing operator SaaS.

---

## 0. Important Context

We are planning the relationship between two surfaces:

1. **app.exotiq.ai**
   - Operator-facing SaaS / command center.
   - Operators manage fleets, vehicles, bookings, locations, documents, payments, team/admin settings, and Stripe onboarding here.
   - Lovable currently manages much of the UI and Supabase/MCP workflow for this side.

2. **Exotiq Rent / exotiq.rent**
   - Renter-facing mobile-web marketplace and booking platform.
   - Root marketplace is `exotiq.rent`.
   - Tenant/operator storefronts should eventually live at `exotiq.rent/{tenantSlug}`.
   - Vehicle detail and booking routes likely live under the tenant slug.

A mobile-web renter-facing booking scaffold has been started separately for Exotiq Rent. It currently uses mock data and long-term route shapes. It is not connected to production Supabase or Stripe yet.

Current scaffold route shape:

- `/{operatorSlug}/{vehicleSlug}` — vehicle detail / booking entry
- `/{operatorSlug}/{vehicleSlug}/book` — renter booking flow
- `/booking/{bookingId}` — confirmation
- `/preview` — temporary branch preview helper

The current Exotiq Rent marketplace root should **not** be replaced yet.

---

## 1. What We Need From Lovable

Please answer these questions as the current source of truth for app.exotiq.ai and Supabase. If an answer is uncertain, please say so and identify where it can be verified.

Please do **not** implement anything from this document yet. We are gathering context before deciding architecture and migration sequencing.

---

# A. Product / App Boundary Questions

## A1. Confirm the intended role of app.exotiq.ai

Is the current app best described as:

- Operator command center / SaaS dashboard?
- Internal Exotiq admin tool?
- Both operator dashboard and internal admin?
- Something else?

Please describe the main user types and what each user type can do today.

## A2. Confirm the intended role of exotiq.rent

Should Exotiq Rent be treated as a separate renter-facing marketplace app that consumes shared Supabase/backend data from app.exotiq.ai?

If not, what relationship do you recommend between app.exotiq.ai and exotiq.rent?

## A3. Shared backend/data authority

Is the current Supabase project behind app.exotiq.ai expected to be the source of truth for:

- Operators/tenants
- Vehicle inventory
- Vehicle photos
- Locations
- Bookings
- Customers/renters
- Documents
- Payments
- Stripe Connect account status

If any of these should live somewhere else, please explain.

---

# B. Naming / Schema Entity Questions

## B1. Tenant/operator/team naming

In the existing schema/codebase, what is the canonical entity for a rental business/operator?

Possible names we have seen/discussed:

- `teams`
- `operators`
- `tenants`
- something else

Please confirm:

1. Which table/entity represents an operator business?
2. Which field should power public storefront URLs like `exotiq.rent/{tenantSlug}`?
3. Is that slug globally unique?
4. Are demo/test accounts mixed into the same table?
5. Is there a field that marks whether an operator should be publicly listed?

## B2. User/team membership model

How are users/admins connected to teams/operators?

Please identify tables/fields for:

- User profile
- Team membership
- Role/permission
- Owner/admin/member distinctions
- Internal Exotiq admin access, if present

## B3. Current schema overview

Please provide the current canonical tables and their purposes for these concepts, if they exist:

- Operators / teams / tenants
- Locations
- Vehicles
- Vehicle photos/media
- Bookings
- Customers/renters/drivers
- Driver documents
- Insurance documents
- Payments
- Stripe Connect accounts
- Protection/coverage/insurance products
- Availability/calendar/blockout dates
- Pricing/rates/extras/add-ons
- Notifications/messages
- Audit logs/activity logs

We do not need full SQL in this first response unless it is easy to provide. A table/entity overview is enough.

---

# C. Public Marketplace / RLS / Data Access

## C1. Public marketplace reads

For Exotiq Rent, renters will need to browse some data without being logged into the operator SaaS.

What is the recommended safe/public read model?

Please answer:

1. Can anonymous users safely read public vehicle inventory today?
2. Can anonymous users read operator/team public profiles today?
3. Can anonymous users read vehicle photos today?
4. Can anonymous users read public pricing today?
5. Can anonymous users read availability today?
6. Are there existing RLS policies for this?
7. Would you recommend public views/RPC functions instead of direct table reads?

## C2. Sensitive data boundaries

Which fields should never be exposed publicly to Exotiq Rent renters?

Examples:

- Internal operator notes
- VIN/license plates
- Stripe account IDs
- Customer PII
- Driver docs
- Internal payout/payment records
- Private addresses
- Internal status/ops fields

Please identify sensitive fields/tables we must protect.

## C3. Public tenant storefront

For `exotiq.rent/{tenantSlug}`, what data should be available?

Potential fields:

- Business name
- Logo
- Public description
- Market/city/state
- Public pickup region
- Public policies
- Public fleet list
- Featured vehicles
- Public reviews/testimonials, if any
- Branding settings

Does the current schema support this? If not, what is missing?

---

# D. Vehicle Inventory + Media

## D1. Vehicle entity truth

Please explain the current vehicle model.

Questions:

1. Which table stores vehicles?
2. Which field links vehicle to operator/team?
3. Which fields control whether a vehicle is public/bookable?
4. Which fields represent daily/short-term/multiday pricing?
5. Are rates stored as dollars, cents, strings, or numeric decimals?
6. Which field should be used as the public vehicle slug?
7. Are slugs unique globally or only per operator/team?

## D2. Vehicle photos/media

Please explain how vehicle photos are stored.

Questions:

1. Is there a separate `vehicle_photos` table?
2. Are photos stored in Supabase Storage?
3. Are URLs public or signed?
4. Is there a hero image field?
5. Are thumbnails or optimized/enhanced images available?
6. How should Exotiq Rent choose the best public hero image?

## D3. Vehicle status/ops status

Please explain current vehicle status fields.

Questions:

1. What statuses exist?
2. What status means a vehicle can be shown publicly?
3. What status means it can be booked?
4. Are maintenance/unavailable states modeled?
5. Is there a difference between marketplace visibility and operational availability?

---

# E. Availability + Calendar Logic

## E1. Current availability model

Does app.exotiq.ai currently have a model for vehicle availability?

Please identify any tables/functions for:

- Existing bookings blocking dates
- Manual blackout dates
- Maintenance holds
- Turnaround/buffer windows
- Pickup/dropoff time windows
- Minimum rental length
- Same-day booking cutoff

## E2. Recommended availability API

For Exotiq Rent, should the renter app:

- Query bookings directly and compute availability client-side/server-side?
- Call a Supabase RPC/function like `get_vehicle_availability`?
- Use an existing edge function?
- Use a future dedicated availability service?

Please recommend the safest direction.

## E3. Booking conflict prevention

How does the current system prevent double-bookings?

If it does not yet, what approach would you recommend later?

---

# F. Booking Lifecycle

## F1. Current booking table/model

Please explain the current booking model.

Questions:

1. Which table stores bookings?
2. What are the key booking fields?
3. How are booking refs generated?
4. Which fields map to vehicle/operator/customer?
5. Are pickup and dropoff locations first-class fields?
6. Are delivery fees, deposits, taxes, and add-ons represented?

## F2. Booking statuses

Please list current booking statuses and what they mean.

Examples we may need:

- draft
- requested
- pending_documents
- pending_payment
- confirmed
- active
- completed
- cancelled
- declined
- refunded

What statuses already exist? Which are missing?

## F3. Desired renter booking creation sequence

From Lovable's understanding of the current system, what should happen when a renter books from Exotiq Rent?

Possible sequence:

1. Renter selects dates.
2. Renter provides driver info and documents.
3. Renter selects extras/protection.
4. System creates draft/pending booking.
5. Payment/hold is created.
6. Operator confirms or auto-confirms.
7. Booking moves to confirmed.

Please recommend the sequence that best fits the existing SaaS/backend.

## F4. Confirmation route

For `/booking/{bookingId}`, should `bookingId` be:

- Internal UUID?
- Public booking reference?
- Stripe checkout/session reference?
- Something else?

What is safest for public confirmation URLs?

---

# G. Customer / Renter / Driver Model

## G1. Customer table truth

Does the current system have a `customers` table or equivalent?

Please explain:

1. How customers are created.
2. Whether customers belong to a team/operator or are global.
3. Whether phone/email are unique.
4. Whether customers have auth accounts or are guest records.
5. Whether customer records store Stripe customer IDs.

## G2. Guest checkout vs renter accounts

For Exotiq Rent, do you recommend supporting guest checkout first?

If the current system expects logged-in customers, please explain.

## G3. Driver data

Where should renter/driver fields live?

Examples:

- Full name
- Email
- Phone
- Date of birth
- Driver license status
- Insurance status
- Verification status

---

# H. Documents / Verification / Storage

## H1. Current document model

Please explain how documents are modeled today.

Questions:

1. Is there a `documents` table?
2. Are documents linked to customers, bookings, vehicles, teams, or all of these?
3. What document types exist?
4. What verification statuses exist?
5. Who can verify documents?
6. Are expiration dates modeled?

## H2. Storage and security

Please explain how license/insurance files are stored.

Questions:

1. Which Supabase Storage buckets exist?
2. Are files public or private?
3. Are signed URLs used?
4. How does RLS protect document metadata?
5. Should Exotiq Rent upload directly to Supabase Storage, or should uploads go through an edge function?

## H3. Renter app upload flow

For Exotiq Rent, should a renter be able to upload driver/insurance documents before creating a full booking record?

If not, what should be created first?

---

# I. Pricing / Fees / Extras

## I1. Current pricing model

Please explain how pricing works today.

Questions:

1. Are rates stored in dollars or cents?
2. Are daily rates supported?
3. Are 3-hour/6-hour rates supported?
4. Are multiday rates supported?
5. Are discounts supported?
6. Are delivery fees supported?
7. Are mileage packages supported?
8. Are extras/add-ons modeled?
9. Are taxes/fees modeled?

## I2. Operator-set vs Exotiq-set pricing

Who controls pricing today?

- Operator only?
- Exotiq admin?
- AI/recommendation layer?
- Mixed?

## I3. Platform fees

Please clarify platform fee logic.

Questions:

1. Is the platform fee currently 10%, 20%, configurable, or inconsistent?
2. Where is it stored?
3. Is it per team/operator?
4. Is it applied through Stripe today?
5. Is it visible to operators/renters?

---

# J. Stripe / Payments / Connect

## J1. Current Stripe Connect implementation

Stripe Connect is already wired on the SaaS side. Please explain the current implementation.

Questions:

1. Are connected accounts Express, Standard, Custom, or mixed?
2. Which table stores `stripe_account_id`?
3. How is onboarding completed?
4. Which fields track charges/payouts enabled?
5. Are webhooks implemented?
6. Are webhook events idempotently handled?
7. Are refunds implemented?
8. Are security deposits/holds implemented?
9. Are payment history records implemented?

## J2. Current payment flow

For existing bookings, what is the current payment flow?

Examples:

- Stripe Checkout
- PaymentIntent
- SetupIntent
- Manual capture
- Destination charge
- Separate charges/transfers
- Application fee amount
- Security deposit hold

Please identify which is currently used.

## J3. Renter app payment recommendation

For Exotiq Rent, we want to avoid rework later.

Given the current SaaS Stripe implementation, what would Lovable recommend for renter-side booking payments?

Please consider:

- Operator rental revenue
- Exotiq platform fee
- Exotiq protection/coverage charge
- Security deposit/hold
- Refunds/cancellations
- SCA/3DS
- Webhook recovery
- Booking status synchronization

## J4. Separate Stripe phase

Would Lovable agree that Stripe should be handled as a dedicated coordination phase rather than casually implemented inside the renter UI build?

If not, what is the minimum Stripe/data work that must happen before renter booking integration proceeds?

---

# K. Exotiq Protection / Coverage / Two-Party Billing

## K1. Existing protection model

Does the current SaaS have any concept of renter protection, insurance, coverage, or damage waiver products?

If yes:

- Which table/entity stores it?
- Is it per booking?
- Is pricing configurable?
- Is decline/self-cover modeled?
- Is proof of insurance required when declined?

## K2. Future protection direction

The renter-facing flow expects protection to be an Exotiq-side product/charge, separate from the operator rental charge.

Does the current payment/data model support this two-party billing concept?

If not, what would Lovable recommend conceptually?

## K3. Decline protection

For renter UX, declining protection should require explicit confirmation/consent.

Is there currently a place to store protection decline consent or renter acknowledgements?

---

# L. Notifications / Operator Workflow

## L1. Booking notifications

What notification mechanisms exist today?

Examples:

- Email
- SMS/Twilio
- In-app notifications
- GHL
- Webhooks
- Operator dashboard alerts

## L2. Operator approval

Does the operator need to approve renter bookings manually?

Or are bookings intended to be instant/auto-confirmed when payment and docs are complete?

## L3. Operational handoff

Where are pickup/handoff instructions stored?

Are there fields for:

- Pickup location
- Delivery location
- Handoff notes
- Operator contact
- Required documents
- Fuel/mileage policies

---

# M. Migration / Portability Away From Lovable

Gregory may eventually migrate away from Lovable orchestration and wants to avoid being handcuffed to any one tool. This is not an urgent request to migrate today, but we need visibility.

## M1. Lovable-managed assumptions

Please identify what parts of the current app are Lovable-managed or Lovable-dependent.

Examples:

- MCP configuration
- Supabase schema changes
- Edge functions
- Generated types
- Auth config
- Storage buckets
- Environment variables
- Deployment configuration
- Secrets
- Background jobs
- UI/component generation patterns

## M2. Migration inventory

If Gregory wanted to migrate the app out of Lovable later, what artifacts would need to be exported or documented?

Please include:

- Supabase schema/migrations
- RLS policies
- Edge functions
- Storage buckets/policies
- Auth settings/providers
- Environment variables/secrets
- Generated Supabase types
- App source code
- Build/deploy instructions
- MCP configuration
- Any Lovable-specific files/settings

## M3. Migration risk

What are the highest-risk parts of migrating away from Lovable?

Potential areas:

- RLS policy drift
- Edge function secrets
- Stripe webhook URLs/secrets
- Supabase generated types
- Auth redirect URLs
- Storage bucket permissions
- Environment variables
- Hidden Lovable/MCP assumptions

Please rank or describe the biggest risks.

## M4. Recommended migration timing

From Lovable's perspective, is it safer to migrate before building the renter-facing Exotiq Rent integration, or can we safely continue frontend/mock renter work now and migrate later?

Please explain tradeoffs.

---

# N. Current Renter Scaffold Review Request

A separate renter-facing mobile-web scaffold exists for Exotiq Rent. It is intended as frontend/product direction, not final backend integration.

Please review the concept and provide feedback on how it should connect to app.exotiq.ai over time.

Current route assumptions:

- `exotiq.rent` — marketplace root, not to be replaced yet
- `exotiq.rent/{tenantSlug}` — future operator/tenant storefront
- `exotiq.rent/{tenantSlug}/{vehicleSlug}` — vehicle detail / entry point
- `exotiq.rent/{tenantSlug}/{vehicleSlug}/book` — booking flow
- `exotiq.rent/booking/{bookingId}` — confirmation

Questions for Lovable:

1. Does this route model fit the current schema?
2. What should the first slug be called: tenant, team, operator, business, something else?
3. What backend lookup should power `/{tenantSlug}/{vehicleSlug}`?
4. Should vehicle slugs be unique per tenant or globally?
5. Should confirmation use public booking ref or UUID?
6. What should the renter app avoid doing because app.exotiq.ai already handles it?
7. What integration boundary would you recommend between Exotiq Rent and the SaaS backend?

---

# O. Near-Term Collaboration Recommendation

Please advise on the safest next sequence.

Potential sequence:

1. Lovable answers these discovery questions.
2. Avi/Gregory review answers and produce a refined integration direction.
3. Exotiq Rent continues frontend/mock polishing without touching production Supabase.
4. Lovable provides schema/tables/RLS/export details.
5. Gregory decides whether to migrate away from Lovable before backend integration.
6. Stripe is handled as a separate coordinated phase.
7. Exotiq Rent begins real data adapter integration only after schema/public-read/payment boundaries are agreed.

Does Lovable agree with this sequence? If not, what sequence would Lovable recommend?

---

# P. Specific Output Requested From Lovable

Please respond with:

1. A concise summary of current app.exotiq.ai architecture.
2. Current schema/table overview relevant to renter marketplace integration.
3. Confirmation/correction of entity naming: team/operator/tenant.
4. Public read/RLS recommendation for Exotiq Rent.
5. Current booking lifecycle/status model.
6. Current vehicle availability model.
7. Current pricing/fees model.
8. Current Stripe Connect/payment implementation summary.
9. Protection/coverage support, if any.
10. Migration/portability inventory and risks.
11. Recommended next steps before Exotiq Rent connects to real backend.
12. Any warnings about assumptions in this document.

Again: please do **not** build from this document yet. This is a discovery and alignment request.
