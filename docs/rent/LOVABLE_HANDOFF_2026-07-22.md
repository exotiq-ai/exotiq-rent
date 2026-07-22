# Lovable / Command Center Handoff — Exotiq Tenant Live Flip (2026-07-22)

> From the exotiq-rent Claude Code session. Context: book.exotiq.rent is being
> flipped to supabase data mode serving the **Exotiq tenant**
> (`c1de6533-ab44-4973-a123-007a8007b5ba`) instead of the fredo-d-lima pilot.
> Verified live via the public RPCs before writing this. Backend state per
> `exotiq-spark-mvp-flow/docs/rent/MARKETPLACE_TESTING_HANDOFF.md` (2026-07-22)
> is excellent — most of the old P3 list is already done. What remains:

## 1. Rename the Exotiq team slug: `exotiq-` → `exotiq` (P0 for the URL)

`teams.slug` for the Exotiq tenant is **`exotiq-`** (trailing hyphen — looks
like slug generation from a name with a trailing space/character). Gregory
wants the public URL `book.exotiq.rent/exotiq`.

- `public_team_by_slug('exotiq')` currently returns empty; `'exotiq-'` works.
- Rename to `exotiq` (and fix whatever name field regenerates it, or the next
  save may flip it back).
- The renter app ships a **temporary** 307 `/exotiq` → `/exotiq-` so the clean
  URL works meanwhile. After the rename we flip
  `NEXT_PUBLIC_DEFAULT_TEAM_SLUG=exotiq` on Netlify and delete the redirect —
  tell us when it lands.

## 2. Platform fee is 0.00 — Gregory decision required before real money

`public_vehicle_quote` returns `platform_fee_percent: 0.0` for Exotiq, so live
renters see **no booking fee** (only protection) on Exotiq's own fleet. All
surfaces now read `teams.platform_fee_percent` (the 20% hardcode retirement is
confirmed deployed), so a single UPDATE aligns everything. Options:

- Set `10` per the D1/D9 register (consistent with marketplace operators), or
- Keep `0` for Exotiq's own fleet (fee-to-self is a wash) — but then the
  renter-facing fee copy stays hidden on this storefront.

Gregory rules; Lovable applies.

## 3. Seed hero photos — 30 of 52 visible vehicles have none

The renter storefront filters photo-less vehicles, so the live fleet shows
**22 of 52**. Seeding `vehicles.image_url` (or a `vehicle_photos` row) for the
other 30 doubles the storefront instantly. This was already on the old P3
list; it matters more now that the Exotiq fleet IS the public storefront.

## 4. Fix the Exotiq team timezone: `America/New_York` → `America/Phoenix`

`public_team_by_slug` returns `timezone: America/New_York` with
`city: Scottsdale, AZ`. Availability busy-ranges are interpreted in the team's
local zone, so pickup/return dates can drift a day at the edges. One-field fix
in Command Center team settings (Arizona does not observe DST —
`America/Phoenix`).

## 5. Provide the Stripe **test publishable key** (nice-to-have)

The renter app's Identity modal wants `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
It is not in the spark repo or the app.exotiq.ai bundle. Until provided, the
renter app now **falls back to Stripe's hosted verification page** (same
session, same webhook), so this does not block the flip — the key just
upgrades the UX to the embedded modal.

## 6. Awareness (no action)

- `marketplace_test_mode: true` on the Exotiq tenant bypasses the 5-photo
  readiness gate. Fine for the pilot; revisit before opening to real tenants.
- Booking statuses (`requested`/`pending_documents`) and the operator UI
  coloring are confirmed done on the Command Center side — thank you.
- The fredo-d-lima pilot tenant remains available as a second live tenant for
  cross-tenant isolation testing.

---

*Verification used only the public anon-key RPC surface; no hosted Supabase
writes from this side, per the standing rule.*
