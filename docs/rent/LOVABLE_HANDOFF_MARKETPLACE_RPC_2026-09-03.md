# Lovable handoff — Drive Exotiq marketplace read RPCs (M7f / MP-7)

**Date:** 2026-09-03 · **From:** Claude (renter app, `exotiq-ai/exotiq-rent`) · **For:** Lovable (`exotiq-spark-mvp-flow`, Supabase `jlgwbbqydjeokypoenoc`)
**Status:** request — nothing in this doc blocks the renter side today. The marketplace is live on a private staging URL using a fan-out over the RPCs you already ship. This asks for the two cross-tenant RPCs that replace that fan-out, plus one tenant flag.

## 0. What exists today (so you can see the shape we consume)

The renter app's `/browse` page (Drive Exotiq marketplace, one grid across tenants) currently builds its catalog server-side by calling, for each slug in a server-only env var `MARKETPLACE_TEAM_SLUGS`:

1. `public_team_by_slug(_team_slug)` → `RpcTeamRow`
2. `public_team_fleet(_team_slug)` → `RpcFleetVehicleRow[]`

then unions the rows, drops any vehicle without `hero_image_url`, and sorts/filters/paginates in the app. Two tenants are listed (`exotiq`, `exotics-by-the-bay`). This works and costs N calls per 5-minute revalidation window, not per pageview — but the tenant list lives in an env var instead of in the Command Center, and every new tenant would need a redeploy. That is the part this handoff fixes.

**Do not change the shape of `public_team_by_slug`, `public_team_fleet`, or `public_vehicle_by_slug`.** The storefronts and booking flow depend on them exactly as they are.

## 1. Tenant flag: `teams.marketplace_listed`

- `boolean not null default false`.
- Command Center → Business Profile: a toggle **"List my fleet on Drive Exotiq"** with one line of helper copy: *"Your cars appear on the Drive Exotiq marketplace alongside other operators. Renters still book directly with you; nothing about your storefront, pricing or payouts changes."*
- Opt-in semantics (default off). Please set it **true** for `exotiq` and `exotics-by-the-bay` in the same migration so the marketplace does not go empty when the app switches over.
- A team that is hidden / suspended / not public today (whatever rule `public_team_by_slug` applies) must never appear regardless of this flag — the RPCs below must reuse that rule, not re-implement it.

## 2. RPC `public_marketplace_teams()`

No arguments. `security definer`, `grant execute to anon`, same masking discipline as `public_team_by_slug` (no PII, no internal ids).

Returns one row per listed team:

| column | type | source / rule |
|---|---|---|
| `slug` | text | teams.slug |
| `name` | text | public business name (same value `public_team_by_slug.name` returns) |
| `city` | text null | same as `public_team_by_slug` |
| `state` | text null | 2-letter, same as `public_team_by_slug` |
| `timezone` | text null | same |
| `logo_url` | text null | same |
| `verified` | boolean | **false for now.** Column reserved for the Exotiq Verified program (VET-*); do not derive it from anything yet |

Filter: `marketplace_listed = true` AND the team passes the existing public-visibility rule.

## 3. RPC `public_marketplace_fleet()`

No arguments. `security definer`, `grant execute to anon`, same masking as `public_team_fleet`.

Returns one row per vehicle across all listed teams. **Every column of `public_team_fleet` with the same name and type**, plus:

| column | type | source / rule |
|---|---|---|
| `team_slug` | text | join key back to §2 and to the storefront URL `/{team_slug}/{vehicle_slug}` |
| `photo_count` | integer | number of gallery photos the vehicle has (hero counts as one). Used for the "featured" ordering |
| `verified` | boolean | false for now (see §2) |

Existing columns for reference (unchanged): `vehicle_slug, name, make, model, year, color, daily_rate (numeric dollars), hero_image_url, min_rental_days`.

Filters (all must hold):
- team `marketplace_listed = true` and publicly visible (§1 rule);
- vehicle passes exactly the visibility rule `public_team_fleet` applies today (hidden / inactive / archived excluded);
- vehicle **`unlisted = true` excluded** — the unlisted flag from the EBTB handoff §9 (bookable by direct URL, invisible on the storefront) must be invisible on the marketplace too. If that flag has not shipped yet, note it here rather than dropping the rule.

No ordering or pagination parameters are needed in this version: the app sorts and paginates in memory (fleets are tens of rows, not thousands). If you want to add `_limit`/`_offset` later, add them as optional arguments so the zero-argument call keeps working.

## 4. Acceptance tests (please run against live and paste results)

1. Anonymous `select * from public_marketplace_teams()` returns exactly the listed teams; `fredo` (hidden tenant) is absent even if someone sets its flag true.
2. `count(*) from public_marketplace_fleet()` equals the sum of `count(*) from public_team_fleet(slug)` over the listed teams, minus unlisted vehicles.
3. Flip `marketplace_listed` false on a team → its rows disappear from both RPCs within one call (no cache on the DB side).
4. Set a vehicle `unlisted = true` → it disappears from `public_marketplace_fleet()` but `public_vehicle_by_slug` still returns it.
5. No column in either RPC carries an email, phone, address, Stripe id, or internal uuid.
6. p95 under 300 ms for both calls from the SQL editor with the current data volume.

## 5. What the renter side does when this lands

- Swap `loadCatalog()` in `domain/booking/marketplaceService.ts` to one call of `public_marketplace_fleet()` + one of `public_marketplace_teams()`; delete `MARKETPLACE_TEAM_SLUGS`.
- "Featured" ordering starts using the real `photo_count`.
- Nothing else changes: cards, filters, storefront links and the booking flow are already built against these field names.

## 6. Questions for you (answer inline)

- Q1. Does the unlisted-vehicle flag (EBTB handoff §9) exist yet? Column name?
- Q2. Is there an existing "team is public" predicate function the new RPCs can reuse, or is it inline SQL in `public_team_by_slug`? (Reuse is preferred — one rule, one place.)
- Q3. Can `photo_count` come from the vehicle media table cheaply, or do you want a maintained column?
