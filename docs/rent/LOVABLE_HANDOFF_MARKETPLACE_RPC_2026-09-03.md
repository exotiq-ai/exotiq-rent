# Lovable handoff — Drive Exotiq marketplace read RPCs (M7f / MP-7)

**Date:** 2026-09-03 · **From:** Claude (renter app, `exotiq-ai/exotiq-rent`) on behalf of Gregory Ringler (owner) · **For:** Lovable (`exotiq-spark-mvp-flow`, Supabase project `jlgwbbqydjeokypoenoc`)
**Reply to:** Gregory, in the Lovable project chat. He relays to Claude.
**Status:** request, not urgent, blocks nothing live. The ask is **one new column (plus a one-time two-row seed on that column), two new read-only RPCs, and one Command Center toggle**. A **private, password-protected staging site** consumes the RPCs first; the live booking app does not consume them at all.

---

## 0. Read this first — which environment is which

Two renter-facing surfaces exist, and they share **one backend**: the production Supabase project you maintain. That is the entire reason for this section.

| | **LIVE booking app** | **STAGED marketplace** |
|---|---|---|
| URL | `https://book.exotiq.rent` | `https://drive-exotiq-staging.netlify.app` — password-protected, not linked from anywhere, not indexed |
| Who uses it | **Real renters and real tenants** (Exotiq, Exotics By The Bay), **real money** through Stripe live | Gregory and Claude only. No customers, no payments, no search engines |
| What it shows | One tenant storefront per URL (`/exotiq`, `/exotics-by-the-bay`) and the booking flow | A cross-tenant `/browse` grid over the same tenants' data, plus the same storefronts behind it |
| Code | `exotiq-rent` `main`, with the marketplace flag (`NEXT_PUBLIC_MARKETPLACE_BROWSE`) **off** | The same `main`, with that flag **on** (a Netlify env var on that one site) |
| Your involvement | **No code, config or DNS change to this app.** The database additions below must leave its three public RPCs returning exactly what they return today (test 7) | None needed to view it. This doc asks for backend additions the staged site will consume |

(A third host, `demo.exotiq.rent`, is a mock-data demo of the booking app. It does not read your Supabase project at all, so nothing here touches it.)

**What that means for the work below**

- The change to the shared database is **additive, plus one bounded write**: a new boolean column with `default false`, a single `UPDATE` that sets it on exactly two named rows (§2), two new **read-only** functions, and nothing else. No existing table's columns, no existing function's signature or output, no edge function, no Command Center booking or payment flow, no Stripe object, no email changes.
- **The live booking app never calls the new column or the new RPCs.** Only the staged marketplace will, and only after a separate change on our side. Implement this doc as written and `book.exotiq.rent` behaves identically before and after your migration.
- **You should have no access to Netlify env vars or DNS, and none is needed.** Listed only so nobody asks you for it: do not set `NEXT_PUBLIC_MARKETPLACE_BROWSE`, `MARKETPLACE_TEAM_SLUGS` or any other env var anywhere. The marketplace **page** goes public only when Gregory flips that flag on the live site, later.
- The two new RPCs, however, are **public reads the moment you deploy them** (anyone with the anon key can call them, and the anon key ships in every browser bundle). They therefore need the same masking, demo-account exclusion and `security definer` hygiene as the existing public RPCs — see §3 and §4.
- The one thing tenants will see in **your** product is the Command Center toggle in §2. It defaults to off, and until the marketplace launches, turning it on changes nothing a renter can see.
- Acceptance tests (§5) run against the production project because there is only one. Every read-only test runs as the `anon` role; every mutating test runs inside a transaction that is **rolled back**, on throwaway rows created inside that transaction. Real tenant rows are never written by a test. If you use Supabase branching, do the dry run there first; it still ends in production.

---

## 1. What exists today (so you can see the shape we consume)

The staged marketplace's `/browse` page builds its catalog server-side by calling, for each slug configured in a server-only env var `MARKETPLACE_TEAM_SLUGS` (set only on the staging site):

1. `public_team_by_slug(_team_slug)` → `RpcTeamRow`
2. `public_team_fleet(_team_slug)` → `RpcFleetVehicleRow[]`

then unions the rows, drops any vehicle without `hero_image_url`, and sorts, filters and paginates in the app. Two tenants are configured (`exotiq`, `exotics-by-the-bay`). This works and costs a handful of calls per 5-minute revalidation window, not per pageview. Its weakness is that the tenant list lives in an env var instead of in the Command Center, so every new tenant would need a redeploy. That is the part this handoff fixes.

**Do not change `public_team_by_slug`, `public_team_fleet`, or `public_vehicle_by_slug` in any way in this migration** — not their signatures, not their bodies, not their output. The live storefronts and booking flow depend on them exactly as they are. If something in this doc seems to require touching them, stop and ask instead.

## 2. Tenant flag: `teams.marketplace_listed`

**Important — an existing column with a similar name:** `teams.marketplace_visible` already exists and gates whether a storefront is publicly readable at all (rule today: `marketplace_visible = true AND is_demo_account = false AND is_deleted = false`). **`marketplace_listed` is a second, independent flag.** Do not rename, drop, migrate, default-change or reuse `marketplace_visible`; the new toggle reads and writes `marketplace_listed` only; whatever control already governs `marketplace_visible` stays as it is.

- `marketplace_listed boolean not null default false`. Additive column.
- Seed, in the same migration, right after the column is added — this is the one sanctioned write to real rows:

  ```sql
  update public.teams set marketplace_listed = true
   where slug in ('exotiq', 'exotics-by-the-bay');
  ```

  It must report **exactly 2 rows updated**; any other number, roll back and tell us. Touch no other column and no other row. Gregory owns the Exotiq tenant and is confirming with Exotics By The Bay before you run this; if he tells you otherwise, seed `exotiq` only and EBTB flips the toggle themselves. Seeding has no effect on the live booking app.
- Command Center → Business Profile: a toggle **"List my fleet on Drive Exotiq"** with one line of helper copy: *"Your cars will appear on the Drive Exotiq marketplace alongside other operators once it launches. Renters still book directly with you; nothing about your storefront, pricing or payouts changes."* Whoever can edit the Business Profile today can flip it. The toggle may ship after the migration; it does not have to be in the same deploy.
- A team that fails the existing public-visibility rule (the `marketplace_visible` gate above, or whatever `public_team_by_slug` applies today) must never appear in the marketplace regardless of this flag.

## 3. RPC `public_marketplace_teams()`

New function. No arguments. `language sql stable security definer set search_path = public` (or `''` with schema-qualified names). After creating it: `revoke all on function public.public_marketplace_teams() from public; grant execute on function public.public_marketplace_teams() to anon, authenticated;`.

**Return only the columns below.** Unlike `public_team_by_slug`, do **not** include `support_email`, `support_phone`, `pickup_address`, `pickup_instructions`, `public_description` or `currency` — the marketplace grid needs none of them and test 5 forbids the first three.

| column | type | source / rule |
|---|---|---|
| `slug` | text | `teams.slug` |
| `name` | text | public business name (same value `public_team_by_slug.name` returns) |
| `city` | text null | same as `public_team_by_slug` |
| `state` | text null | 2-letter, same as `public_team_by_slug` |
| `timezone` | text null | same |
| `logo_url` | text null | same |
| `verified` | boolean | return the literal `false`. **Do not add a table column.** Reserved for a later verification program |

Filter: `marketplace_listed = true` AND the team passes the existing public-visibility rule.

**On reusing that rule:** if a shared predicate function already exists, call it. If the rule is inline SQL in `public_team_by_slug`, **copy it verbatim** into the two new functions with a comment `-- mirrors public_team_by_slug visibility rule as of <migration name>`. Do not extract it into a helper and do not rewrite the live functions to call one — that refactor is welcome later, separately, with a before/after diff.

## 4. RPC `public_marketplace_fleet()`

New function. No arguments. Same `language sql stable security definer set search_path` and revoke/grant pattern as §3.

Returns one row per vehicle across all listed teams: **every column `public_team_fleet` returns today, with the same name and type** (the deployed function is authoritative; for reference the current set is `vehicle_slug, name, make, model, year, color, daily_rate (numeric dollars), hero_image_url, min_rental_days` — if yours differs, include the actual list in your reply), plus:

| column | type | source / rule |
|---|---|---|
| `team_slug` | text | join key back to §3 and to the storefront URL `/{team_slug}/{vehicle_slug}` |
| `photo_count` | integer | count of media rows for the vehicle; if there are none but `hero_image_url` is set, `1`. **Compute it inside the function** (a correlated `count(*)` or `LATERAL` over the media relation). No new column on `vehicles`, no trigger, no backfill |
| `verified` | boolean | literal `false` (see §3) |

Filters (all must hold):
- team `marketplace_listed = true` and publicly visible (§2 rule, mirrored as described in §3);
- vehicle passes the visibility rule `public_team_fleet` applies today (mirror it the same way; if `public_team_fleet`'s team check differs from `public_team_by_slug`'s, tell us which you used);
- vehicle **`unlisted = true` excluded** — the unlisted flag from the EBTB handoff (`docs/rent/LOVABLE_HANDOFF_EXOTICS_BY_THE_BAY_2026-08-17.md` §9: bookable by direct URL, invisible on the storefront) must be invisible on the marketplace too. **If `vehicles.unlisted` (or its equivalent) does not exist yet, do not create it and do not modify `public_team_fleet`.** Ship the new RPCs without that predicate, leave a `-- TODO unlisted` comment where it goes, and answer Q1. Adding the filter to `public_marketplace_fleet()` later is additive; adding it to `public_team_fleet` is a live change and is out of scope here.

No ordering or pagination parameters in this version: the app sorts and paginates in memory (tens of rows, not thousands). If you later add `_limit` / `_offset`, replace the function in place with defaulted arguments — never leave two overloads, PostgREST cannot resolve the zero-argument call then.

## 5. Acceptance tests (SQL editor, in this order, paste results back)

Read-only tests run as the `anon` role: wrap them in `begin; set local role anon; ...; rollback;` (or call `/rest/v1/rpc/<name>` with the project anon key and paste the response). Mutating tests run inside `begin; ... rollback;` on rows created by raw `insert` inside that same transaction — never through the Command Center onboarding flow (no emails, no Stripe objects), and never on a real tenant's rows. Nothing persists; no `delete` is needed.

0. **Baseline, before applying the migration.** For each of `exotiq` and `exotics-by-the-bay`, save the ordered output of `select * from public_team_by_slug(s)`, `select * from public_team_fleet(s) order by vehicle_slug`, and `select * from public_vehicle_by_slug(s, <first vehicle_slug>)`.
1. *(anon, read-only)* `select * from public_marketplace_teams()` returns exactly `exotiq` and `exotics-by-the-bay`, and does **not** contain `fredo-d-lima` (Saucy Rentals, the hidden former pilot tenant). Do not set any column on `fredo-d-lima` or any other real team.
2. *(anon, read-only)* `select count(*) from public_marketplace_fleet()` equals the sum of `select count(*) from public_team_fleet(s)` over the two listed teams, **exactly** — unless `public_team_fleet` still returns `unlisted` vehicles, in which case say so in Q1 and the marketplace count equals the sum minus those rows. A mismatch is never resolved by changing `public_team_fleet`.
3. *(mutating, rolled back)* Inside one transaction: insert a throwaway team (slug `zz-test-marketplace`, `marketplace_listed = true`, passing the visibility gate) with one throwaway vehicle that belongs to it. Both RPCs now include them. Set the throwaway team `marketplace_listed = false` → both RPCs exclude them on the next call. Then set it back to `true` and `marketplace_visible = false` → still excluded (the existing gate wins). Roll back.
4. *(mutating, rolled back — only if `unlisted` exists)* Inside one transaction: same throwaway team and vehicle; set the vehicle `unlisted = true` → absent from `public_marketplace_fleet()`, still returned by `public_vehicle_by_slug`. Roll back.
5. *(anon, read-only)* No column in either RPC carries an email, a phone number, a street address, a Stripe id, or an internal uuid. (`city` and `state` are expected.) Also confirm `select * from public.teams limit 1` under `set local role anon` still fails — RLS unchanged.
6. *(read-only)* Run each function 20 times with `explain (analyze, timing)`; report median and max execution time. Target: under 300 ms at the current data volume.
7. **Live-app regression, after the migration:** re-run the three baseline queries from step 0 for both tenants and paste both sets. They must be identical to the baseline. Also run the Supabase security advisor and confirm no new warnings (in particular none about a mutable `search_path` on the new functions).

## 6. What happens on our side when this lands

- The code swap — `loadCatalog()` in `domain/booking/marketplaceService.ts` becomes one call of `public_marketplace_fleet()` plus one of `public_marketplace_teams()`, and `MARKETPLACE_TEAM_SLUGS` goes away — lands on `main`, which both sites build from. It changes nothing on the live site because every caller of it sits behind the marketplace flag, which is off there. We re-run our canary after it deploys.
- The staged marketplace starts using the real `photo_count` for its "featured" ordering.
- Nothing else changes: cards, filters, storefront links and the booking flow are already built against these field names.

## 7. How to hand back

Ship the column, the two-row seed, both functions and their grants as **committed migration file(s)** in `exotiq-spark-mvp-flow/supabase/migrations/` (one file is fine; if you split, list every name), applied through your normal migration path — not typed into the SQL editor. Only the §5 tests belong in the SQL editor.

Reply in the project chat with: the migration file contents, the two RPC signatures as deployed, the results of §5 in order (including step 0 and test 7), whether any rate limiting applies to `/rest/v1/rpc/*` today, and answers to §8. Claude then switches the staged site over and verifies; you will hear back if anything differs from this contract.

## 8. Questions for you (answer inline)

- Q1. Does the unlisted-vehicle flag (EBTB handoff §9) exist yet? Column name? Does `public_team_fleet` already exclude it?
- Q2. Is the team public-visibility rule a shared predicate function today, or inline SQL in `public_team_by_slug`? (Tell us; do not refactor it in this migration.)
- Q3. Which relation did you count `photo_count` from, and is the per-row count cheap at current volume?
