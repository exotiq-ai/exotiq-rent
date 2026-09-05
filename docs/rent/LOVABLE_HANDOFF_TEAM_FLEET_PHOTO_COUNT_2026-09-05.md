# Lovable handoff — `photo_count` on `public_team_fleet` (2026-09-05)

**Demo vs live:** this touches only the public read RPC the STAGED marketplace and the LIVE storefronts share. No writes, no tenant data change, no booking logic.

## Why
The marketplace grid (`public_marketplace_fleet`) already returns `photo_count` (visible, vehicle-confirmed gallery photos; 0 when the hero is the legacy `image_url`). The storefront grid reads `public_team_fleet`, which does not, so the same car shows "9 photos" on /browse and nothing on /exotiq. The app already maps the column when present (`RpcFleetVehicleRow.photo_count?`, `adaptFleetVehicle` → `Vehicle.photoCount`), so once the RPC carries it the storefront count lights up with no app change.

## Ask
Add a trailing `photo_count integer` column to `public_team_fleet(_team_slug text)` (and, for consistency, `public_vehicle_by_slug`) computed exactly as in `public_marketplace_fleet`. Same drop/create + re-grant + `pg_depend` check as MP-9's `body_type` change (a `RETURNS TABLE` shape cannot be changed with `CREATE OR REPLACE`); restore the PUBLIC/anon execute grants afterwards; confirm the three RPC signatures with a baseline diff before and after.

## Verify (anon, over REST)
`select photo_count from public_team_fleet('exotiq')` returns the same numbers as `public_marketplace_fleet()` for the same `vehicle_slug`s; `body_type` still trails before `photo_count`; the existing storefront tests in `exotiq-rent` (`npx vitest run`) stay green.
