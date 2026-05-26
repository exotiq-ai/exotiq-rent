# app.exotiq.ai — Discovery Answers for Exotiq Rent

**Document type:** Discovery / context only. **Not** a build instruction, schema change request, or migration plan. Source of truth as of 2026-05-26, pulled from the live Supabase project (`jlgwbbqydjeokypoenoc`) plus the deployed edge functions. Anything described as "recommended" or "missing" is for the renter-side team to factor into their own plan — nothing here should be implemented without a separate, scoped approval.

---

## A. Product / App Boundary

**A1.** app.exotiq.ai is the **operator command center** — a multi-tenant SaaS. Day-to-day users are operator staff with five roles (owner, admin, manager, staff, viewer) enforced via the `user_roles` table and a `has_role()` SECURITY DEFINER function. A separate `super_admins` table covers internal Exotiq staff. **There are no renter accounts in the system today.**

**A2.** Treat exotiq.rent as a **separate renter-facing app consuming the same Supabase project.** Do not spin up a second database — one source of truth keeps inventory, availability, bookings, and payouts consistent.

**A3.** The current Supabase project is the source of truth for: teams, vehicles, vehicle_photos, locations, bookings, customers, documents, payments, partner_payouts, and Stripe Connect status (stored on `teams`). Nothing renter-relevant should live anywhere else.

---

## B. Naming / Schema

**B1.** Canonical operator entity = **`teams`** (not `operators`, not `tenants`).

1. Operator business → `teams`
2. Storefront slug → `teams.slug` (text, UNIQUE, indexed)
3. Globally unique — enforced by the unique constraint
4. Demo accounts live in the same table, flagged by `teams.is_demo_account = true`. Exclude these from any public listing
5. **There is no `marketplace_visible` / `is_public` flag yet** — needs to be added before launch

**B2.** Membership model:

- `profiles` — 1:1 with `auth.users`
- `team_members(team_id, user_id, is_active)` — membership
- `user_roles(user_id, role app_role, team_id)` — enum: owner, admin, manager, staff, viewer
- `super_admins(user_id)` — internal Exotiq staff
- Roles are always checked via `has_role(auth.uid(), 'admin')` (SECURITY DEFINER). **Never trust the client.**

**B3.** Canonical tables relevant to the renter marketplace (62 total in the schema):

| Concept | Table |
|---|---|
| Operator / tenant | `teams` |
| Locations | `locations` |
| Vehicles | `vehicles` |
| Vehicle media | `vehicle_photos` |
| Bookings | `bookings` |
| Customers / renters | `customers` |
| Documents | `documents` (+ `customers.id_document_url`, `customers.insurance_document_url`) |
| Payments | `payments`, `payment_receipts`, `payouts`, `partner_payouts`, `stripe_webhook_events` |
| Stripe Connect | Columns on `teams` (`stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled`, `stripe_onboarding_complete`, `platform_fee_percent`) |
| Pricing | `vehicles.current_rate`, `rate_3hr`, `rate_6hr`, `rate_multiday`; booking-level fees |
| Availability | Derived from `bookings`; no separate calendar table. `teams.rental_buffer_minutes` governs turnaround |
| Notifications | `notifications`, `notification_preferences` |
| Audit | `vehicle_change_log`, `role_audit_log`, `user_activity_log`, `work_order_events` |
| Protection / coverage | **Does not exist yet** |
| Add-ons / extras | Not modeled as discrete entities; only fixed fields (`gas_fee`, `delivery_fee`, `mileage_overage_fee`) |

---

## C. Public Marketplace / RLS / Data Access

**C1.** Today **no public reads are possible**. Every renter-relevant table (`vehicles`, `vehicle_photos`, `teams`, `bookings`, `customers`) has team-scoped RLS that requires `auth.uid()` to be a team member. Anonymous = denied.

Recommended pattern for Exotiq Rent: **dedicated read-only views and SECURITY DEFINER RPCs** that expose only safe columns. Suggested surface area:

- `public_teams(slug, name, logo_url, city, state, description)`
- `public_vehicles(team_slug, vehicle_slug, make, model, year, color, hero_image_url, rate_daily, rate_3hr, rate_6hr, rate_multiday)`
- `public_vehicle_photos(vehicle_id, url, thumbnail_url, display_order)` — only where `is_visible = true`
- RPC: `get_vehicle_availability(vehicle_id, start, end)`

**Do not loosen RLS on base tables.**

**C2.** Never expose publicly: `vin`, `license_plate`, `user_id`, `team_id` (internal), `stripe_account_id`, `stripe_customer_id`, `notes`, `customer_status`, `blacklist_reason`, `mileage`, `ops_status`, partner payout amounts, internal addresses, any `*_document_url`, any `damage_claims` data, any `customer_notes`.

**C3.** For the storefront page, the current schema supports name, `logo_url`, `timezone`, `settings` (jsonb). **Missing:** public description, market/city tags, hero image, public policies. Need to be added to `teams` or a new `team_public_profile` table.

---

## D. Vehicle Inventory + Media

**D1.** Vehicle truth:

1. Table: `vehicles`
2. Operator link: `vehicles.team_id` (FK → `teams.id`)
3. Public/bookable controls: `vehicles.status` (available, booked, maintenance, retired) and `vehicles.ops_status`. **No `marketplace_visible` flag exists — needs to be added.**
4. Pricing fields: `current_rate` (daily), `rate_3hr`, `rate_6hr`, `rate_multiday`, plus `mileage_overage_rate`, `default_mileage_limit`
5. Rates stored as `numeric(10,2)` **dollars**, not cents
6. **No vehicle slug field exists yet.** Recommend adding `vehicles.slug text` with a unique constraint per `team_id`
7. If slugs are added, recommend **unique per tenant, not globally** — the composite URL `/{teamSlug}/{vehicleSlug}` stays unambiguous

**D2.** Photos:

1. Yes, `vehicle_photos` table
2. Stored in Supabase Storage bucket `vehicle-photos`, which is **private**
3. URLs in the DB are signed/private — must be re-signed or proxied for public marketplace use. Recommend either a public CDN-style bucket OR an edge function that returns short-lived signed URLs
4. No dedicated `is_hero` flag. Convention is: lowest `display_order` where `is_visible = true`. The chosen hero is also persisted as `vehicles.image_url` (often AI-generated)
5. `thumbnail_url` and `enhanced_url` are populated by the existing photo pipeline (Gemini for analysis, Nano Banana for hero generation)
6. For Rent: use `enhanced_url ?? url`, lowest `display_order`, `is_visible = true`, `is_vehicle_confirmed = true`

**D3.** Status fields:

1. `status`: available, booked, maintenance, retired
2. Public-eligible: `status = 'available'` AND (future) `marketplace_visible = true`
3. Bookable: `status IN ('available', 'booked')` — booked vehicles still display with their unavailable dates
4. Maintenance: `status = 'maintenance'` plus `work_orders` and `maintenance_schedules`
5. Yes — marketplace visibility and operational availability are different concerns. Operational state lives in `ops_status` (clean_ready, washing, renter_has, etc.). The marketplace should only care about `status`, the new visibility flag, and computed date availability

---

## E. Availability + Calendar

**E1.** Current model:

- Bookings block dates via overlapping `start_date` / `end_date` where `status IN ('pending', 'confirmed', 'active')` (helper: `isBlockingBooking` in `src/lib/conflictDetection.ts`)
- Turnaround buffer: `teams.rental_buffer_minutes` (default 60)
- Maintenance holds: `status = 'maintenance'` on the vehicle OR an open row in `work_orders`
- **No separate blackout/blockout table**, no per-vehicle min-rental length, no same-day cutoff

**E2.** **Strongly recommend a SECURITY DEFINER RPC** such as `get_vehicle_availability(vehicle_id uuid, range_start timestamptz, range_end timestamptz)` returning blocked intervals. Do not let the renter app query `bookings` directly — it exposes PII.

**E3.** Today, double-booking is prevented at the application layer only (the conflict check in the booking dialog). **There is no database-level exclusion constraint.** Before opening to concurrent renter-side writes, recommend a `btree_gist` exclusion constraint on `bookings (vehicle_id WITH =, tstzrange(start_date, end_date) WITH &&) WHERE status IN ('pending', 'confirmed', 'active')`.

---

## F. Booking Lifecycle

**F1.** Table: `bookings`. Key fields: `vehicle_id`, `customer_id`, `team_id`, `start_date`, `end_date`, `pickup_location_id`, `dropoff_location_id`, `daily_rate`, `total_value`, `security_deposit_amount`, `delivery_fee`, `gas_fee`, `mileage_limit`, `mileage_overage_fee`, `discount_amount`, `rental_duration_type` (daily or hourly), `booking_source` (direct, drive_exotiq, marketplace, ota), `booking_ref` (sequential BK-01001), and platform fee snapshot columns. Pickup and dropoff are first-class (both text and FK forms exist). Booking refs are generated by a Postgres trigger.

**F2.** Statuses observed live: `pending, confirmed, active, completed, cancelled`. Payment statuses: `pending, deposit_paid, partial, paid`. **Missing for a marketplace flow:** `requested`, `pending_documents`, `pending_payment`, `declined`, `refunded`. Need to be added before renter launch.

**F3.** Recommended renter booking sequence (fits the current backend):

1. Renter picks dates → call availability RPC
2. Quote returned (rental subtotal + platform fee + protection placeholder + taxes)
3. Driver info captured → upsert into `customers` (team-scoped)
4. Document uploads → `documents` plus `customers.id_document_url`, `customers.insurance_document_url`
5. Create booking with `status = 'pending'`, `booking_source = 'marketplace'`. Platform fee snapshot trigger fires automatically
6. Stripe PaymentIntent (manual capture) for the rental, plus a separate PaymentIntent for the deposit hold
7. Operator approval — or auto-confirm if the team has opted in → `status = 'confirmed'`
8. Pickup → `status = 'active'`. Return → `status = 'completed'`

**F4.** For `/booking/{bookingId}`, use **`booking_ref` (BK-01234), not the UUID.** UUIDs leak ordering and produce ugly URLs; `booking_ref` is already human-friendly and unique.

---

## G. Customer / Renter / Driver Model

**G1.** `customers` table exists.

1. Created via the booking flow or manual operator entry
2. **Scoped to a team** (`team_id` column) — the same person across two operators = two rows today
3. No DB-level uniqueness on email or phone
4. **Customers are not auth users today.** They are records owned by operators. For Exotiq Rent the renter team should decide: stay guest-only, or create renter `auth.users` with a new `app_role = 'renter'`. Strong recommendation: real renter auth accounts plus a global `renters` table that is separate from operator-owned `customers`
5. `stripe_customer_id` exists on the row

**G2.** Guest checkout first is fine for v1, but plan for renter auth so booking history can survive across operators — otherwise renters re-upload documents forever.

**G3.** Driver fields all live on `customers` today: `full_name`, `email`, `phone`, `date_of_birth`, `address`, `drivers_license`, `license_expiry`, `insurance_provider`, `insurance_policy`, `insurance_expiry`, `id_verified`, `insurance_verified`, plus the document URLs. If a clear verification pipeline is desired, recommend an enum column such as `verification_status` (unverified, pending, approved, rejected).

---

## H. Documents / Verification / Storage

**H1.** The `documents` table is **vehicle-centric** (registration, insurance, title). Driver/insurance docs are stored as URL columns directly on `customers` (`id_document_url`, `insurance_document_url`). No expiration tracking beyond `license_expiry` and `insurance_expiry`. Verification status is a boolean per type.

**H2.** Storage buckets:

| Bucket | Public |
|---|---|
| customer-documents | private |
| vehicle-photos | private |
| damage-photos | private |
| expense-receipts | private |
| message-attachments | private |
| user-avatars | public |
| dashboard-banners | public |

RLS protects metadata at the row level. **The renter app should upload via an edge function** (which authenticates the renter, writes the file, and stamps the correct `team_id` / customer scoping). Direct browser uploads to private buckets risk wrong folder scoping.

**H3.** Yes — either create a pre-booking `draft_uploads` flow OR just create the booking row early with `status = 'pending_documents'` and attach files to it. Recommend the latter to keep a single lifecycle.

---

## I. Pricing / Fees / Extras

**I1.** Pricing:

1. Dollars (`numeric(10,2)`), not cents
2. Daily — yes
3. 3hr and 6hr — yes (on `vehicles.rate_3hr`, `rate_6hr`)
4. Multiday — yes (`vehicles.rate_multiday`)
5. Discounts — `bookings.discount_amount` + `discount_reason`
6. Delivery — `requires_delivery`, `delivery_address`, `delivery_fee`
7. Mileage — `mileage_limit`, `mileage_overage_fee`, `default_mileage_limit`, `mileage_overage_rate`
8. **No discrete add-ons / extras table.** Only the fixed fields above (gas, delivery)
9. **No tax engine.** Operators bake taxes in today

**I2.** Pricing is **operator-controlled.** An AI suggestion layer exists (`ai-pricing` edge function, `suggested_rate` column) but operators set the actual price. Exotiq admin has read-only insight; there is no override path today.

**I3.** Platform fee:

1. Per-team, configurable: `teams.platform_fee_percent` (default 0)
2. Snapshotted onto each booking at create/complete: `bookings.platform_fee_percent_snapshot`, `platform_fee_amount`, `platform_fee_base`
3. Fee base = rental subtotal only — excludes gas, delivery, mileage overage, deposit, and discount
4. **Not yet routed through Stripe.** Stripe `application_fee_amount` only fires for `booking_source = 'marketplace'` in `stripe-create-hold` and `create-payment-checkout`, and only on the deposit hold / checkout amount. Direct bookings: 0% fee. Marketplace: **hardcoded 20%** in those two edge functions, while the snapshot column uses the team's configured percentage. **These two paths are inconsistent and must be reconciled before renter launch.**
5. Visible to operators in the new Margin module (behind `featureFlags.margin`). Not visible to renters today

---

## J. Stripe / Payments / Connect

**J1.** Connect implementation:

1. **Express** accounts
2. `teams.stripe_account_id`
3. Onboarding via `stripe-connect-onboard` edge function, which returns a hosted onboarding link
4. `teams.stripe_charges_enabled`, `stripe_payouts_enabled`, `stripe_onboarding_complete`
5. Webhooks: `stripe-webhook` edge function exists
6. Idempotent: events stored in `stripe_webhook_events`, keyed by event id
7. Refunds: `stripe-create-refund`
8. Holds / deposits: `stripe-create-hold` (manual capture), `stripe-capture-hold`, `stripe-release-hold`. 7-day auth window
9. History: `stripe-payment-history`, `payments` table

**J2.** Current flow: **PaymentIntent on the connected account, manual capture.** Destination charges with `application_fee_amount`. Security deposit is a separate PaymentIntent with `capture_method = 'manual'`, held up to 7 days. Refunds via the Stripe Refund API. No SetupIntent flow today.

**J3.** Recommendation for the renter app:

- Reuse the `stripe-create-hold` pattern (destination charges + `application_fee_amount` on the operator's connected account)
- **Two PaymentIntents per booking:** (1) rental amount, manual capture, captured on pickup or confirm; (2) deposit hold
- **Exotiq protection** should be a separate **direct charge to the Exotiq platform account**, not the operator. Requires a second customer charge — keep clearly separated in `payments.payment_type = 'protection_premium'`
- **Application fee** = `platform_fee_percent` of the rental base, snapshotted into `bookings.platform_fee_amount` (already wired)
- SCA / 3DS: handled by Stripe Elements; set `automatic_payment_methods.enabled = true`
- Webhook recovery: extend `stripe-webhook` to advance booking status on `payment_intent.succeeded` and `charge.refunded`
- Status sync: the webhook is the source of truth, not the client redirect

**J4.** Agreed — **Stripe is its own coordination phase, not casually wired into renter UI work.** Minimum Stripe/data work that must land before renter booking integration goes to production:

1. Reconcile the hardcoded 20% vs `platform_fee_percent` mismatch
2. Apply fee on rental capture, not just deposit hold
3. Add `payment_type = 'protection_premium'` flow + direct-to-platform charge path
4. Extend the webhook to advance booking status
5. Add idempotency keys on PI creation keyed by `booking_id`

---

## K. Exotiq Protection / Coverage / Two-Party Billing

**K1.** **Does not exist in the current schema.** No table, no field. `damage_claims` exists but is post-incident, not pre-sold coverage.

**K2.** Two-party billing is not modeled. Recommended new tables:

- `protection_products(id, code, name, daily_premium, deductible, coverage_limits jsonb, is_active)`
- `booking_protection(booking_id, product_id, daily_premium_snapshot, total_premium, status, declined, decline_acknowledged_at, decline_acknowledgement_ip)`

Charge flow: separate PaymentIntent on the **Exotiq platform account** (no destination), tagged in `payments.payment_type = 'protection_premium'`.

**K3.** Decline consent: add to `booking_protection` (above) or extend the existing renter-acknowledgements pattern already used for the 8 mandatory rental checkboxes.

---

## L. Notifications / Operator Workflow

**L1.** Today: in-app `notifications` table, plus edge functions for email (Resend), Slack (`slack-notify`), Google Calendar push (`gcal-sync`), and weekly digests. **No SMS / Twilio. No GHL.**

**L2.** Manual approval today. Auto-confirm is a planned per-team setting; not implemented. Recommend `teams.settings->>'auto_confirm_marketplace_bookings'`.

**L3.** Pickup / handoff: `bookings.pickup_location_id`, `dropoff_location_id`, `pickup_location` (text fallback), `delivery_address`, `notes`. Operator contact = `teams.owner_id` plus `team_members`. Fuel/mileage policy = vehicle-level defaults with booking overrides. No structured "handoff_notes" — operators use `notes`.

---

## M. Migration / Portability Away From Lovable

**M1.** Lovable-dependent surfaces:

- `src/integrations/supabase/client.ts` and `types.ts` — auto-generated, do not edit, but trivially regenerated with `supabase gen types typescript`
- `.env` is Lovable-managed for `VITE_SUPABASE_*` keys
- Lovable manages MCP config and deployment
- Edge functions are deployed automatically by Lovable, but the source is plain Deno TypeScript in `supabase/functions/` — fully portable
- Storage buckets, RLS, triggers, and functions all live in `supabase/migrations/` — fully portable
- `featureFlags.ts` is project-owned, not Lovable-managed

**M2.** Migration inventory:

- `supabase/migrations/*.sql` (full history)
- `supabase/functions/*` (50+ edge functions)
- `supabase/config.toml`
- Storage bucket list (above) plus their RLS policies (export from dashboard or via `pg_dump --schema=storage`)
- Auth settings (providers: email + Google OAuth)
- Secrets: Stripe keys, Resend, Google OAuth, PredictHQ, ElevenLabs, Lovable AI Gateway key
- Generated types — regenerated via CLI on the new host
- App source: standard Vite + React, no Lovable runtime
- Deploy: any Vite host (Vercel, Netlify, Cloudflare Pages)

**M3.** Highest migration risks (ranked):

1. **Stripe webhook URL and signing secret** — must be updated in the Stripe Dashboard on cutover; in-flight events can be lost
2. **Auth redirect URLs** — Google OAuth and email magic links are bound to the current domains; new domains must be added before cutover
3. **Edge function secrets** — must be re-set on the new host
4. **Generated types drift** — regenerate after every migration on the new host
5. **Storage RLS** — bucket policies are easy to forget; verify private buckets stay private
6. **Rari / MCP edge functions** assume the Lovable AI Gateway key — works anywhere, but the key must be carried
7. **CSP headers** in `index.html` reference specific domains

**M4.** **Build the renter frontend on mocks now and migrate later.** Nothing about the renter integration depends on Lovable specifically — the integration boundary is Supabase and Stripe, both portable. Migrating before renter work adds risk with no benefit.

---

## N. Renter Scaffold Review

1. The route model fits the schema, with one caveat: vehicles need a slug column added
2. First slug should be called **`teamSlug`** in code (matches the DB field `teams.slug`). User-facing copy can still say "operator"
3. `/{teamSlug}/{vehicleSlug}` backend lookup: a `public_vehicle_by_slug(team_slug text, vehicle_slug text)` SECURITY DEFINER RPC. Single round trip, no PII leak
4. **Vehicle slugs unique per tenant, not globally.** The composite URL guarantees uniqueness. Add a `UNIQUE (team_id, slug)` index
5. Confirmation route: use **`booking_ref` (BK-01234), not the UUID**
6. The renter app must NOT: write directly to `bookings` / `customers` / `vehicles`, own business logic for pricing or availability, manage Stripe Connect onboarding, send operator notifications, or manage user roles
7. Recommended integration boundary: a thin set of SECURITY DEFINER RPCs plus edge functions:
   - `public_team_by_slug(slug)`
   - `public_team_fleet(slug)`
   - `public_vehicle_by_slug(team_slug, vehicle_slug)`
   - `get_vehicle_availability(vehicle_id, start, end)`
   - `get_vehicle_quote(vehicle_id, start, end, options)`
   - Edge function: `renter-create-booking` — validates, creates `customers` + `bookings`, returns PI client secrets
   - Edge function: `renter-upload-document` — writes to `customer-documents` with proper team scoping
   - Edge function: `renter-protection-charge` — separate direct charge to the Exotiq platform account

---

## O. Near-Term Collaboration Sequence

Agree with the proposed sequence. Suggested order:

1. Renter team reviews this doc
2. Add minimal schema prerequisites: `vehicles.slug`, `teams.marketplace_visible`, `team_public_profile` columns, `protection_products` and `booking_protection`, expanded booking statuses, the `btree_gist` exclusion constraint, public RPCs
3. Reconcile Stripe fee logic (per section J4) and stand up the renter PaymentIntent + protection charge flow on staging
4. Renter app integrates against staging RPCs while operator side keeps iterating
5. Cut over to production once webhook and RLS audits pass

Migration away from Lovable can happen at any point; it is not a blocker.

---

## P. Summary Index (for the brief's section P)

1. Architecture summary — A1 to A3
2. Schema overview — B3
3. Entity naming — **`teams`** (B1)
4. Public read / RLS — C1, C2, N.7
5. Booking lifecycle — F1 to F4
6. Availability — E1 to E3
7. Pricing / fees — I1 to I3
8. Stripe Connect — J1 to J4
9. Protection — K (does not exist; design proposed)
10. Migration inventory and risks — M1 to M4
11. Recommended next steps — O
12. Warnings about assumptions in the discovery doc:
    - The doc assumes an `operators` / `tenants` entity; reality is **`teams`**
    - The doc assumes public reads work; they do not — an RPC layer is required
    - The doc assumes a protection / coverage product exists; it does not
    - The doc assumes vehicle slugs exist; they do not
    - The doc assumes the platform fee is consistent; today it is split between team configuration (snapshot) and a hardcoded 20% (Stripe hold and checkout). Must be reconciled before renter launch

---

**Reminder:** This document is discovery and alignment material for the renter-side dev team. It is not a build instruction for either side. Any schema changes, edge functions, or RLS adjustments described as "recommended" or "missing" require a separate, scoped approval before implementation.
