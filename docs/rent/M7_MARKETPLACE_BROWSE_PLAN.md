# M7 — Cross-tenant browse + desktop parity

**Written:** 2026-07-30. **For:** Gregory. **Status:** plan, not started.
**Supersedes nothing.** This is the buildable half of
`MARKETPLACE_LAUNCH_CHECKLIST.md` Phase 7; the owner-clock half of that phase
(legal set, inventory, operator onboarding, go-live) is unchanged and still
gates the public announcement.

---

## Decisions locked (2026-07-30)

| Question | Answer |
|---|---|
| What is the page for? | **Real renter funnel** + **desktop parity for the existing pilot** |
| How does v1 get cross-tenant inventory? | **Fan-out now, commission the RPC in parallel** |
| Where does it live? | **`book.exotiq.rent/browse`** — no `SITE_MODE` surgery, no risk to the live deploy |
| Design language | **Gold editorial (`#C8A664` / `#0D0F14`, Newsreader + Inter), desktop-scaled** — layout ported from the old mockup, tokens from the booking flow |

Consequence of picking book.exotiq.rent: `exotiq.rent` keeps serving the cyan
mockup untouched for now, and the deploy-topology fight is deferred, not won.
Revisit when M7 is proven.

---

## Step zero — four facts to verify before anyone writes code

These are all snapshots from 2026-07-22..25 and every one of them is
load-bearing. Verify before building, not after.

1. **Does a cross-tenant read RPC already exist?** This repo has no binding to
   one and no mirrored SQL for one, but the five read RPCs' SQL lives in
   `exotiq-spark-mvp-flow`, not here. One message to Lovable settles it:
   ```sql
   select proname, pg_get_function_arguments(oid)
   from pg_proc
   where pronamespace = 'public'::regnamespace and proname like 'public_%';
   ```
   Also ask for the bodies of `public.is_marketplace_team` and
   `public.is_marketplace_vehicle` — they are called at
   `docs/rent/patches/booking-writes/.../20260722050000_renter_booking_writes.sql:78,85`
   but their definitions are not in this repo, so what they actually gate is
   unverified.

2. **How many tenants are `marketplace_visible` right now?** Unresolved in the
   docs: `REDTEAM_REPORT_2026-07-24.md:97` found two;
   `LOVABLE_WORKORDER_REDTEAM_2026-07-24.md:20` asked Lovable to hide
   `fredo-d-lima`; `LOVABLE_HANDOFF_CONSOLIDATED_2026-07-25.md:202` *still*
   describes that tenant as visible. Nothing confirms the flag was flipped.

3. **How many vehicles have hero images, per visible tenant?** "22 of 52" is a
   2026-07-22 figure recorded while photo seeding was open work.
   `getSupabaseTeamStorefront` drops photo-less vehicles
   (`domain/booking/supabaseService.ts:66`), so this number *is* the browse grid.

4. **Two Netlify sites or three?** `netlify.toml:1-3` says two, with
   demo.exotiq.rent an **alias** on `book-exotiq-rent`. `URL_MAP.md:9-11` says
   three, with demo holding its own site id and its own data mode. If the toml
   is right, demo shares book's env and is already serving **live** Supabase
   data. This changes the guard design in M7c — check the Netlify UI.

---

## What is actually built (and what is not)

**Built and reusable as-is:**

- The 6-step booking flow, its server-authoritative quote contract, Stripe
  Connect two-leg payments, and Stripe Identity — which is already
  **platform-wide rather than per-tenant**, and is the precedent to cite when
  asking Lovable for a cross-tenant read.
- Every step component and every primitive in
  `components/drive-exotiq/flow/shared.tsx` is width-agnostic with a tiny prop
  surface. The phone assumptions are concentrated in three components:
  `PhoneViewport`, `ScreenShell`, `Sticky`.
- `domain/booking/` — the mock|supabase facade pattern, adapters, and contract
  tests. New marketplace reads follow the same shape.

**Not built:**

- **Any cross-tenant read.** All five public RPCs take `_team_slug` as their
  first argument (`domain/booking/rpcClient.ts:105,110,114,127,141`). The app
  has exactly seven network call sites and none is tenant-agnostic except the
  token-gated `public_booking_by_ref`.
- **Any desktop layout.** One responsive breakpoint exists in the entire
  booking flow: `md:bottom-5` at `flow/shared.tsx:62`. There is nothing latent
  to switch on.
- **Any SEO surface.** No `robots.ts`, no `sitemap.ts`, no canonical, no
  `NEXT_PUBLIC_SITE_URL`.
- **Any analytics or error monitoring.** Zero instrumentation across `app/`,
  `components/`, `domain/`.
- **`/terms` and `/privacy` routes.** The mockup footer renders them as dead
  `<button>` elements (`components/marketplace/MarketplaceApp.tsx:315-317`).

**A visual reference, not a scaffold:** `components/marketplace/*` is 3.9k
lines of client-only mockup — one real route, `pushState` hash pseudo-nav, a
12-row hardcoded array whose `Vehicle` type has **no slug and no tenant
identity** (`data.ts:3-25`), fabricated city counts, invented price arithmetic
(`VehicleDetailPage.tsx:111-144`), and a fake card-number input
(`BookingPage.tsx:342`). Port its layout and card recipe. Port none of its data
plumbing. Do **not** delete individual files from it —
`MarketplaceApp.tsx:12-13,486,490` imports and renders them, so a partial
delete fails `next build`.

---

## Three landmines nobody wrote down

1. **A new `/browse` route ships to every deploy.** All sites build `main`. The
   moment `app/browse/page.tsx` merges it is live on book.exotiq.rent *and*
   demo.exotiq.rent — and on demo (mock mode) it would publish three fictitious
   operators (Desert Exotic Rentals, Mile High Exotics, Vegas Supercar
   Collective, `domain/booking/mockData.ts:8,29,50`) on a public domain as real
   marketplace inventory. **The guard ships in the same commit as the route.**

2. **`getDataMode()` throws rather than degrading** (`config.ts:31-38`). Any env
   reshuffle is fail-loud: set the mode var before the key vars and the whole
   site 500s. Env changes need an explicit ordering and a rollback step.

3. **`next.config.js` `redirects()` are evaluated at build time** and baked into
   the deploy. Anything gated on a new env var there needs a redeploy to take
   effect — it is not a Netlify-UI toggle.

**And one Next.js correctness note:** `export const revalidate = 300` on a page
that reads `searchParams` does **not** produce ISR in Next 14 — reading
searchParams forces dynamic rendering, so every browse request is a Netlify
function invocation. What *does* cache is the underlying RPC fetch (verified:
`next: { revalidate: 300 }` on a POST with an Authorization header does cache in
Next 14.2.35, because `autoNoCache` only fires when `revalidate === 0` and the
cache key hashes the request body). Design for cached fetches + dynamic HTML.
Do not promise cached HTML.

---

## Phases

Each phase is one `/goal` invocation and ends with a stated gate. M7a and M7b
have **no backend dependency** and can start immediately.

### M7a — Marketplace facade + mock implementation

No new routes, no UI. Establish the data seam so the rest is a swap.

- `domain/booking/publicContracts.ts` — add `MarketplaceQuery`,
  `MarketplaceListing` (`{ team: Operator; vehicle: Vehicle; photoCount: number }`),
  `MarketplaceFacets`, `MarketplacePage` (`{ listings, totalCount, limit, offset }`).
  Compose from the existing `Operator`/`Vehicle` types.
- `domain/booking/marketplaceQuery.ts` — single source of truth for
  `searchParams` ⇄ `MarketplaceQuery`, whitelisting sort values and clamping
  `limit`/`offset`. Filters live in the URL, never in `useState`.
- `domain/booking/mockMarketplaceService.ts` — flatMap over `mockOperators` ×
  `mockVehicles` with the real filter/sort/paginate semantics. 3 tenants, 3
  cities, real specs and photos. This is what unblocks everything else.
- `domain/booking/service.ts` — add `getMarketplaceListings(query)` and
  `getMarketplaceFacets()` to the facade, following the existing mock|supabase
  switch at lines 34-46. No existing caller changes.
- Vitest coverage for query parsing, filtering, sorting, pagination, and the
  zero-result case.

**Gate:** `npm run test` green, `npm run build` green, no route or UI change.

### M7b — Desktop gold chrome + browse UI (mock-backed)

- `components/exotiq/tokens.ts` — extract the gold palette, fonts, radii, and
  shadow recipes actually used by the booking flow. New code reads tokens; do
  **not** attempt a repo-wide refactor of the 1,038 existing hex literals.
- `components/browse/BrowseChrome.tsx` — desktop nav + footer. Port the layout
  and scroll-transparency behavior from `MarketplaceApp.tsx:21-166,171-323`,
  render it in gold tokens, replace every `navigate()` callback with
  `next/link`.
- `components/browse/{ListingCard,ListingGrid,FilterRail,FilterSheet,EmptyState}.tsx`
  — port the layout from `SearchPage.tsx` / `shared.tsx:53-167`, gold tokens,
  every control writes to the URL. Grid spine:
  `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` inside
  `max-w-7xl px-4 sm:px-6 lg:px-8`. Cards link to `/{teamSlug}/{vehicleSlug}`.
  Drop rating / trips / instant-book — no live source for any of them.
  **`EmptyState` must actually render on zero results** — the mockup silently
  falls back to showing every vehicle from every other city
  (`SearchPage.tsx:105`), which is how "New York (75 vehicles)" shows Scottsdale
  cars.
- `app/browse/page.tsx` — server component, reads `searchParams`, calls the
  facade. **Ships with its guard** (see M7c). `app/browse/loading.tsx` skeleton.
- Filter axes are city, make (structured — not the mockup's name-substring
  match), price range, and sort. Category and instant-book have no live field.

**Gate:** `/browse` renders 3 mock operators across 3 cities at 375 / 768 /
1440px; filters are shareable URLs; zero-result state is real; no cyan anywhere.

### M7c — Live fan-out + deploy guards

- `domain/booking/marketplaceService.ts` — supabase-mode fan-out.
  Tenant slugs come from a server-only `MARKETPLACE_TEAM_SLUGS` (comma-
  separated); in mock mode they derive from `mockOperators`. Fan out
  `fetchPublicTeam` + `fetchPublicTeamFleet` per slug **in parallel** under the
  existing `next: { revalidate: 300 }`, so the cost is N calls per revalidation
  window from the server's IP — not per pageview from renters' IPs. A failing
  slug degrades (skip that tenant, log) rather than failing the page.
- **Route guard, same commit as the route:** `/browse` returns `notFound()`
  unless `getSiteMode() === 'booking'` **and** `NEXT_PUBLIC_MARKETPLACE_BROWSE
  === 'on'`. Absence of the env var means 404. Set it only on
  `book-exotiq-rent`. This keeps fictitious mock operators off demo.exotiq.rent
  and keeps `/browse` from appearing on exotiq.rent, where every booking route
  404s.
- Structure `marketplaceService.ts` so the RPC swap in M7f replaces one
  function body and nothing else.

**Gate:** `/browse` renders real inventory on a preview deploy with
`MARKETPLACE_TEAM_SLUGS` set; returns 404 with the env absent; demo and
exotiq.rent verified 404.

### M7d — Desktop parity for the existing pilot surfaces

This is the half of the ask with live traffic behind it today. Do it properly.

- Add the missing `'use client'` to `components/drive-exotiq/BookingChrome.tsx`
  — it exports `onClick`/`onBack`-taking components with no directive and only
  works today because every server call site passes no handlers.
- Split `PhoneViewport` into `PhoneFrame` (the `h-dvh max-w-[480px]` cage) and a
  composable shell, so desktop can wrap the same content without nested `<main>`
  landmarks.
- Make the close-X target a prop instead of the hardwired `href="/"`
  (`BookingChrome.tsx:60`), which currently dumps a renter onto one arbitrary
  tenant.
- Normalize `ProtectStep.tsx` — it is the one step of six that nests `<Sticky>`
  inside `<ScreenShell>` (line 72 inside line 39), so any shell change breaks
  exactly it, silently. Fix before touching the shell, not after.
- Make `ScreenShell`'s `pb-48` and `Sticky`'s `absolute bottom-4` width-aware.
- **Storefront (`/{team}`) and vehicle detail (`/{team}/{vehicle}`) get real
  desktop layouts.** These have live pilot traffic and are stuck in the 480px
  cage today.
- **Booking flow desktop = centered column + vehicle/operator summary rail.**
  Reuses all six step components unchanged. A full desktop rebuild means a new
  date picker — the `grid-cols-7 aspect-square` calendar is ~1400px tall
  uncapped — and is explicitly out of scope.
- Fix the phone-scale `sizes="480px"/"448px"/"393px"` image hints on any surface
  that now renders wider.

**Gate:** storefront, vehicle, book, and confirmation all look deliberate at
1440px; mobile is pixel-unchanged; the live flow still passes its click-through.

### M7e — SEO, analytics, legal surface

Required because this is a **real renter funnel**, not a demo.

- Add `NEXT_PUBLIC_SITE_URL` (per-site) — `MetadataRoute.Sitemap` needs absolute
  URLs and one build serves multiple hosts. Nothing like it exists today.
- `app/robots.ts` — allow `/browse` + storefronts + detail on book;
  `Disallow: /` when `NEXT_PUBLIC_MARKETPLACE_BROWSE` is off (protects
  demo.exotiq.rent's mock data from indexing); always disallow `/verify`,
  `/booking/*`, `/share/*`.
- `app/sitemap.ts` — `/browse`, each tenant storefront, and each
  `(team_slug, vehicle_slug)`. Under fan-out this reuses the same call. Returns
  empty when browse is off.
- Canonical URLs on browse and detail; `noindex,follow` on non-primary facet
  permutations so faceted crawl does not explode.
- **Analytics:** pick one (Plausible / PostHog / GA4) and instrument the funnel —
  browse → detail → book → confirm. Today there is literally zero
  instrumentation, so the only question a discovery marketplace exists to answer
  is unanswerable.
- **Error monitoring** on the renter path. Per
  `LOVABLE_HANDOFF_CONSOLIDATED_2026-07-25.md` item 28, the one event where
  money is captured and the booking is not (`renter_payment_partial_failure`)
  currently has no alerting path at all. Driving marketplace traffic into that
  funnel multiplies its volume.
- **`/terms` and `/privacy` routes must exist before public launch.** Content is
  owner-clock (lawyer pass, `MARKETPLACE_LAUNCH_CHECKLIST.md:222`); the routes
  and footer links are agent work.

**Gate:** sitemap and robots correct per host; funnel events firing; legal
routes resolve.

### M7f — RPC swap (when Lovable delivers)

Replace the fan-out body in `marketplaceService.ts` with a single
`public_marketplace_fleet` call. Add `fetchMarketplaceListings` /
`fetchMarketplaceFacets` to `rpcClient.ts` using the existing generic `rpc<T>()`
helper at line 89 (~40 lines, not a refactor) and `adaptMarketplaceListing` to
`adapters.ts`. Contract tests against the RPC shapes, mock mode stays green with
no env.

**Gate:** identical UI, one network call instead of N, mock mode still green.

---

## Parallel track — the RPC contract for Lovable

Send after step zero confirms nothing equivalent already exists.

```sql
public_marketplace_fleet(
  _city           text    default null,
  _state          text    default null,
  _makes          text[]  default null,
  _min_daily_rate numeric default null,
  _max_daily_rate numeric default null,
  _sort           text    default 'featured',
  _limit          int     default 24,
  _offset         int     default 0
) RETURNS TABLE (
  team_slug, team_name, team_logo_url, team_city, team_state,
  vehicle_slug, name, make, model, year, color,
  daily_rate, currency, min_rental_days,
  hero_image_url, photo_count,
  pickup_city, pickup_state,
  total_count bigint          -- window count, so pagination needs no 2nd call
)
```

`SECURITY DEFINER`, `GRANT EXECUTE TO anon`.

**Non-negotiables:**

- Visibility gating is **internal only** — reuse the existing
  `public.is_marketplace_team` / `is_marketplace_vehicle` helpers. Never accept
  a caller-supplied `team_id` (`lovable-ecosystem-context.md:292-299`).
- `_limit` hard-capped server-side at 60.
- `_sort` whitelisted to `featured|price_asc|price_desc|newest` — reject
  anything else rather than interpolating it.
- Never expose `vin`, `license_plate`, `team_id`, `stripe_account_id`,
  `mileage`, `ops_status`, `notes`, or any `*_document_url`.
- Add per-IP rate limiting on the public read RPCs. Per
  `lovable-ecosystem-context.md:280,818` this is listed as a **requirement, not
  a shipped control** — the 20/30/10 buckets in `PRELAUNCH_AUDIT:162` are on the
  *write* edge functions only.

**Also useful, lower priority:**

- `public_marketplace_facets()` → `(facet_type, facet_value, facet_label, count)`
  for `city|make|price_band`. Required because the mockup's city counts are
  fabricated and a real page must show real ones.
- `public_marketplace_teams(_limit, _offset)` → slug, name, logo, description,
  city, state, `vehicle_count`, `min_daily_rate`. Powers an operator-directory
  view **and** removes the `MARKETPLACE_TEAM_SLUGS` env var. Note the tension
  with the `_limit` cap above: sitemap enumeration must paginate in a loop.
- **One listability predicate.** Today a tenant can be `marketplace_visible`
  while still lacking a Stripe Connect account for the active mode
  (`stripeMode.ts:35` throws without one), photos, or a non-zero
  `platform_fee_percent` — and the failure lands *after* the renter commits. Ask
  for `public.is_marketplace_listable(team_id uuid) RETURNS boolean` ANDing
  `is_marketplace_team` + Stripe account present for the active mode + photo bar
  + `platform_fee_percent > 0`, and have the fleet RPC filter on it.
  **Do not include `deposit_source_confirmed_at`** — `DECISION_MEMO_DEPOSIT_HOLD.md:51-55`
  (FINAL, 2026-07-26) explicitly swaps the readiness gate *away* from it, and
  the deposit SOP was retired in commits `8548614` / `7619c81`.

---

## Standalone tickets — not M7 prerequisites, do them anyway

1. **Backfill `platform_fee_percent`.** The column is `NOT NULL DEFAULT 0.00`,
   so `public_vehicle_quote`'s `coalesce(..., 10)` can never fire
   (`LOVABLE_HANDOFF_CONSOLIDATED_2026-07-25.md:198`). Any un-backfilled tenant
   shows the renter a "Booking fee (10%)" line that is **never charged**. This
   is a live revenue-and-disclosure leak on the storefront path already in
   production, independent of any marketplace.
2. **Get the five renter money functions committed** to `exotiq-spark-mvp-flow`
   (`rent-checkout`, `rent-payment-webhook`, `rent-cancel-booking`,
   `rent-refund-booking`, `rent-approve-booking`). Per
   `CLAUDE_REPLY_TO_LOVABLE_PLAN_2026-07-25.md:11-27` they exist only as deployed
   artifacts; any redeploy from `main` silently deletes them and **the failure
   mode is invisible**. Highest-consequence item on the board, costs this repo
   zero engineering.
3. **Fix the Command Center revenue rollup.** It counts `requested`,
   `pending_payment`, `payment_expired` and `refunded` bookings at 100% of value
   (`LOVABLE_HANDOFF_CONSOLIDATED_2026-07-25.md:251`) — a refunded booking is
   reported as earned revenue. You cannot recruit operators onto a marketplace
   whose dashboard overstates what they earned.
4. **Add whatever origin `/browse` ships on to the backend's fixed renter-origin
   constant.** It is currently inferred from the `Origin` header, which is what
   caused the L1 pay-link bug.

---

## Explicit non-goals for M7

- Flipping `exotiq.rent` to booking mode or retiring the cyan mockup. Deferred
  by decision; revisit once `/browse` is proven on book.
- A true responsive rebuild of the six booking steps (new date picker).
- Availability-date filtering on the grid. It is the filter renters most expect
  and the one that breaks the caching story — availability is a separate
  per-vehicle `no-store` RPC over a 180-day window. Revisit after v1 traffic.
- Renter accounts, favorites, trips, messages. There is no renter auth concept
  in the system at all — the flow is fully tokenized-anonymous. The mockup's
  Trips / Favorites / Messages pages are fiction.
- Deep-linking a marketplace card into `/{team}/{vehicle}/book` with dates
  pre-filled. `BookingFlow` holds `step` in a plain `useState(1)` with no URL or
  router state, so this is net-new plumbing, and it skips the page where the
  renter sees photos, minimum stay, and mileage policy. Cards link to the detail
  page.

---

## Marketplace governance — one question with no code in it

Exotiq is simultaneously the platform and the pilot tenant. On a cross-tenant
grid, Exotiq's own cars rank alongside its operators' cars, with Exotiq
controlling the ranking. Decide the self-preferencing and disclosure position
**before** the first operator recruiting call, because it is far harder to
change after launch than any decision on this page. Sorting is a `_sort`
parameter; the promise you make to operators about placement is not.

---

## 2026-08-21 REFRESH — verified deltas since this plan was written (plan remains authoritative with these amendments)

**Done since 2026-07-30, delete from scope:** T-8 shipped the tenant-aware
close-X (`closeHref` prop — M7d's exact ask); `platform_fee_percent` backfilled
2026-07-31 (standalone #1 done); the five renter money functions are committed
to the spark repo (standalone #2 done, verified in the 08-17 audit);
`ProtectStep` was DELETED (protection is now a Review-step toggle, T-12) — its
nesting landmine no longer exists; the flow is 4 steps + confirmation, not 6.

**Step-zero facts, re-verified 2026-08-21:** (1) NO cross-tenant RPC exists
(`public_marketplace_fleet`/`_teams` both PGRST202) — fan-out first, send the
contract below to Lovable in parallel. (2) Two tenants marketplace-visible:
`exotiq` + `exotics-by-the-bay`; `fredo-d-lima` confirmed hidden. (3) Photo
counts need a fresh pull at build time. (4) Netlify topology: staging gets its
OWN new site (decision below), making the toml-vs-URL_MAP question moot for M7.

**New decisions (Gregory, 2026-08-21):** BRAND = "Drive Exotiq" everywhere
(closes the open brand-string question; driveexotiq.com will eventually point
at the exotiq.rent marketplace). STAGING: build in this repo behind the
existing env guards, deploy a NEW Netlify site for staging; formal launch is
an env flip on the exotiq.rent site — no code port. GOVERNANCE: published
ranking criteria (Verified > listing quality > renter sort), applied
identically to Exotiq's own fleet, disclosed publicly — locked before operator
recruiting. ANALYTICS: PostHog. DESIGN: the cyan mockup's LAYOUT is the
confirmed reference (Gregory: liked everything but the colors) — port layout,
render in booking-flow gold, exactly as M7b already specifies.

**New integration since planning: Exotiq Verified** (kb/wiki/
exotiq-verified-program.md). The browse grid carries the Verified badge and
the ranking criteria above; VET-8 (badge surfaces) and M7b/M7c should land as
neighbors. Also: T-13 (prefilled ?start&end links) now exists — the plan's
"deep-link with dates" non-goal is partially superseded; cards still link to
the detail page, but detail→book may carry dates once T-13 ships.

**Sequencing note:** availability-date filtering stays out of v1 (unchanged),
and the availability-instants contract Lovable owes (T-16) is unrelated to the
browse grid — do not couple them.

### 2026-09-04 — M7f landed (MP-7)

Lovable applied `teams.marketplace_listed` (opt-in, seeded for `exotiq` and
`exotics-by-the-bay`) plus `public_marketplace_teams()` and
`public_marketplace_fleet()` on 2026-09-03 (migrations `20260903234727` +
two follow-ups); contract and their verified reply live in
`LOVABLE_HANDOFF_MARKETPLACE_RPC_2026-09-03.md`. The renter side now reads
those two zero-argument RPCs in `domain/booking/marketplaceService.ts`
(`buildCatalog`); the M7c fan-out and the `MARKETPLACE_TEAM_SLUGS` env var
referenced above are retired — a tenant appears by flipping the Command
Center toggle. The sitemap needs no pagination loop: the fleet RPC returns
the whole catalog. `photo_count` now drives the "featured" ordering.
