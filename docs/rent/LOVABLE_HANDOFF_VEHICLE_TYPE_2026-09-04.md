# Lovable handoff — vehicle type on the public fleet reads (MP-9)

**Date:** 2026-09-04 · **From:** Claude (renter app, `exotiq-ai/exotiq-rent`) on behalf of Gregory Ringler (owner) · **For:** Lovable (`exotiq-spark-mvp-flow`)
**Reply to:** Gregory, in the Lovable project chat.
**Status:** request, not urgent. Same environment picture as the 2026-09-03 marketplace handoff: the LIVE booking app (`book.exotiq.rent`) must not change behaviour; the STAGED marketplace consumes new fields first. Everything here is additive.

## Why

Renters filter by what a car *is* before they filter by make: supercar, sports car, luxury sedan, luxury SUV, grand tourer. The public fleet reads expose make/model/year/colour but no type, so neither the tenant storefront nor the marketplace can offer that facet. The Command Center already knows the car well enough to classify it; this asks for one nullable column and for it to ride along on the three fleet-shaped RPCs.

## 1. Column: `vehicles.body_type`

- `text null`, additive. Values from a fixed vocabulary, lower-case slugs: `supercar`, `sports-car`, `luxury-sedan`, `luxury-suv`, `grand-tourer`, `convertible`, `hypercar`. Enforce with a `check` constraint listing exactly these (we will ask before adding to the list; do not free-text it).
- Command Center → vehicle edit: a single select **"Vehicle type"** with those labels, optional. If a sensible default can be inferred from an existing field (category, tags), backfill with a migration that is easy to audit; otherwise leave null and tenants set it.
- No effect on the booking flow, pricing, availability, Stripe or email.

## 2. Surface it, additively, on the three fleet-shaped public RPCs

Add a trailing column `body_type text` (null when unset) to the `RETURNS TABLE` of:

- `public_team_fleet(_team_slug, _require_hero)` — used by the live storefront grid.
- `public_marketplace_fleet()` — used by the staged marketplace.
- `public_vehicle_by_slug(_team_slug, _vehicle_slug)` — used by the vehicle page.

Adding a trailing column to a `RETURNS TABLE` is the one change to a live function this asks for. It is additive: the renter app reads rows by column name, never by position, so existing consumers ignore the new field. Please do **not** reorder, rename or retype any existing column, and please replace each function in place (same signature, no second overload).

## 3. Acceptance (SQL editor, paste back)

0. Baseline before: `select * from public_team_fleet('exotiq') order by vehicle_slug` and the same for `exotics-by-the-bay`, saved.
1. After: same queries return the same rows in the same order with one extra trailing column `body_type`; every previous column identical.
2. `select body_type, count(*) from public_marketplace_fleet() group by 1` — the vocabulary only, plus null.
3. Set `body_type` on a throwaway vehicle inside `begin; … rollback;` to a value outside the vocabulary → the check constraint rejects it.
4. `public_vehicle_by_slug('exotiq', <slug>)` carries `body_type`.
5. Security advisor: no new findings.

## 4. What the renter side does when it lands

`RpcFleetVehicleRow.body_type?: string | null` (optional, so older responses still parse); a **Type** facet (chips) on the marketplace filters and on the new storefront filter bar; nothing else changes.

## 5. Questions

- Q1. Is there an existing category/tag field on `vehicles` the backfill can use? If so, paste its distinct values.
- Q2. Does the Command Center's generated type file regenerate automatically on migration, or is that a manual step on your side?
