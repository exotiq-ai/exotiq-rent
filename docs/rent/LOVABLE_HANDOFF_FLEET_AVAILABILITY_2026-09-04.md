# Lovable handoff — batched availability for the fleet reads (MP-10)

**Date:** 2026-09-04 · **From:** Claude (renter app, `exotiq-ai/exotiq-rent`) on behalf of Gregory Ringler (owner) · **For:** Lovable (`exotiq-spark-mvp-flow`)
**Reply to:** Gregory, in the Lovable project chat.
**Status:** request, not urgent. Same environment picture as the two September handoffs: the LIVE booking app (`book.exotiq.rent`) must not change behaviour; the STAGED marketplace consumes new reads first. Everything here is **one new read-only function**; no existing function, table, trigger, edge function, Stripe or email path changes.

## Why

The filter renters expect most is "show me what I can actually rent on these dates". Today availability is a **per-vehicle** read (`public_vehicle_availability`, uncached, 180-day window), which is right for the vehicle page but cannot power a grid: filtering 68 cars would be 68 uncached calls per view. The marketplace and storefront grids are served from a 5-minute cache, and a date filter must not break that. The design that keeps both true: the grid stays cached, and one **uncached, batched** call returns only the cars that are **busy** in the renter's window; the app subtracts them. Busy sets are small, the app already holds the catalog, and nothing about the cached reads changes.

## 1. RPC `public_fleet_busy(_range_start date, _range_end date, _team_slug text default null)`

New function. `language sql stable security definer set search_path = public`; `revoke all … from public; grant execute … to anon, authenticated, service_role;` — same hygiene as the September functions.

Returns one row per vehicle that is **not rentable for the whole window**, across all marketplace-listed teams (or one team when `_team_slug` is given):

| column | type | rule |
|---|---|---|
| `team_slug` | text | the vehicle's team |
| `vehicle_slug` | text | the vehicle |

Definition of busy, for a window `[_range_start, _range_end]` inclusive of both dates, interpreted in **each vehicle's team timezone** exactly as `public_vehicle_availability` interprets its dates today:

- any booking on the vehicle whose stay overlaps the window and whose status is in the **same status set `public_vehicle_availability` treats as blocking today** (please paste that set in your reply — we do not want two definitions of "busy");
- any maintenance / manual block range that `public_vehicle_availability` already returns as unavailable;
- nothing else. Minimum-stay rules, lead time and after-hours pickup are applied app-side from fields the fleet reads already carry.

Scope: only vehicles the marketplace/storefront reads would return (listed team, `is_marketplace_vehicle`, not `marketplace_unlisted`); a hidden car never appears in this result either.

Constraints: `_range_end >= _range_start`; windows longer than 180 days return an error the same way `public_vehicle_availability` does; a window in the past returns an empty set (nothing to filter).

No pagination. Expected result size is tens of rows.

## 2. What the renter side does

- Renter picks dates in the filter bar/rail; the URL carries `?start=YYYY-MM-DD&end=YYYY-MM-DD`.
- Server renders the cached catalog, then calls `public_fleet_busy` with `cache: 'no-store'` and drops the busy cars. If the call fails, the grid shows all cars with a one-line notice ("We couldn't check availability for those dates; every car is shown") rather than failing the page.
- The chosen dates travel into the vehicle page and the booking flow's dates step (T-13), so a renter who filtered by dates does not re-enter them.
- The per-vehicle read on the vehicle page is unchanged.

## 3. Acceptance (SQL editor / REST, in order, paste back)

0. Baseline: `public_vehicle_availability` for three real vehicles over the next 30 days, saved.
1. *(anon, read-only)* `public_fleet_busy(today, today+2)` returns rows only for vehicles that `public_vehicle_availability` also reports as unavailable somewhere in that window — prove it for every returned row against the baseline's three vehicles plus two more picked at random.
2. *(anon, read-only)* For five vehicles absent from the busy result, `public_vehicle_availability` shows the whole window free.
3. *(mutating, rolled back)* Inside `begin; … rollback;`: insert a throwaway booking on a throwaway vehicle for a window → it appears in the busy set; set its status to a non-blocking value → it disappears; an overlapping maintenance block → appears. Roll back.
4. *(anon, read-only)* `_team_slug = 'exotics-by-the-bay'` returns only that team's rows; an unknown slug returns an empty set; `_range_end < _range_start` errors; a 200-day window errors.
5. *(read-only)* 20 calls with `explain (analyze, timing)` for a 3-day and a 30-day window; median and max. Target: under 300 ms at current volume, and the plan should use the bookings date indexes, not a sequential scan over bookings.
6. Live-app regression: `public_vehicle_availability` for the three baseline vehicles is byte-identical before and after (it is not touched, so this is a formality). Security advisor: no new findings.

## 4. How to hand back

One committed migration file; the reply includes the migration contents, the deployed signature, the blocking status set you used, and the results of §3 in order.

## 5. Questions

- Q1. Exactly which booking statuses does `public_vehicle_availability` treat as blocking today, and does it include `requested` / `pending_documents` holds? (Earlier red-team note: create-side overlap guard and the availability read disagreed on this.)
- Q2. Where do manual blocks / maintenance ranges live, and does `public_vehicle_availability` already read them?
- Q3. The availability instants work (busy_start_at / busy_end_at + timezone, still open from the August handoff) — will `public_fleet_busy` be defined on instants from day one, or on dates now and instants later? Either is fine if both reads agree.
