# Exotiq Rent — Public URL Map

> One repo, three Netlify sites. Updated **2026-08-07** (root redirected to book,
> slug rename complete). Modes come from `NEXT_PUBLIC_SITE_MODE` /
> `NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE` (see `domain/booking/config.ts`).

| URL | Netlify site | Serves |
|-----|--------------|--------|
| `https://exotiq.rent` | `exotiqrent` (`1ec963dc-2d50-400d-bc1c-6049ce9d62e5`) | **301 → `book.exotiq.rent` (path preserved).** No longer builds the repo — auto-builds are paused and a redirect-only deploy is published. See "Root redirect" below. |
| `https://book.exotiq.rent` | `book-exotiq-rent` (`2fcbaa5b-d700-461d-bbd5-7af4917ef997`) | **THE PRODUCT.** Gold booking flow on the **live Exotiq fleet** (`booking` mode, supabase data). `/` → 307 → `/exotiq`. The only site touched by the Stripe live flip. |
| `https://demo.exotiq.rent` | `demo-exotiq-rent` (`a2eef772-4503-47f8-8aa8-d100f04699a6`) | Gold **mock demo** (desert-exotic-rentals), `booking` mode + mock data. Zero live-money surface. Old demo links keep working. |

## Verified route matrix (2026-08-07)

| Check | Result |
|-------|--------|
| `exotiq.rent/` | 301 → `book.exotiq.rent/` ✅ |
| `exotiq.rent/<anything>` | 301 → `book.exotiq.rent/<anything>` (splat preserved) ✅ |
| `book.exotiq.rent/` | 307 → `/exotiq` ✅ |
| `book.exotiq.rent/exotiq` | 200, live fleet ✅ (slug rename complete — the old `exotiq-` hop is gone) |
| `book.exotiq.rent/exotiq/2017-audi-s8` | 200, live rate ✅ |
| `demo.exotiq.rent/` | 307 → `/desert-exotic-rentals`, 200 ✅ |

## Root redirect (2026-08-07)

`exotiq.rent` used to serve the cyan marketplace mockup (old brand, fake pricing,
mock card form). It now **301-redirects to `book.exotiq.rent`** so the root
domain lands visitors on the real, gold, live product.

- **Mechanism:** auto-builds on the `exotiqrent` site are **paused**
  (`build_settings.stop_builds = true`) and a manual redirect-only deploy is
  published (`_redirects`: `/*  https://book.exotiq.rent/:splat  301!`).
  This is why it is not a repo change — a host-conditional redirect cannot live
  in the shared `netlify.toml` (Netlify redirect conditions do not include Host).
- **The cyan marketplace is not gone.** Its code still lives in this repo under
  `components/marketplace/` (buildable anytime with `NEXT_PUBLIC_SITE_MODE=marketplace`),
  extra tweaks are preserved on branch `backup/local-main-pre-sync-2026-08-05`,
  and a standalone scaffold copy is archived at
  `Drive Exotiq Marketplace/_archive/cyan-marketplace-scaffold-2026-02.zip`.
- **To restore the mockup at the root:** set `stop_builds = false` on the
  `exotiqrent` site and trigger a deploy of `main` (rebuilds it in marketplace
  mode). The redirect deploy is then superseded.
- **Long game:** the gold marketplace rebuild (`M7_MARKETPLACE_BROWSE_PLAN.md`)
  eventually reclaims the root with the real brand.

## Book-site env (live pilot)

```
NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://jlgwbbqydjeokypoenoc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key — publishable, from spark repo .env>
NEXT_PUBLIC_DEFAULT_TEAM_SLUG=exotiq
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_live_… platform publishable key>
```

Without `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, identity verification falls back to
Stripe's hosted page; with it, the embedded modal is used. Legacy `exotiq-` share
URLs still 307 to `exotiq` via `next.config.js`.

## Operational notes

- `book.exotiq.rent` and `demo.exotiq.rent` build `main` with `npm run build`,
  publish `.next`, and get the Next.js runtime from `netlify.toml`
  (`@netlify/plugin-nextjs`). **Do not** remove that file — a site building this
  repo without the plugin serves nothing (the 2026-07-22 book-site 404).
- `exotiqrent` no longer builds the repo (see Root redirect). It will not pick up
  repo changes until auto-builds are re-enabled.
- Per-site behavior lives ONLY in Netlify env vars / per-site deploys, never in
  code or shared toml.
- Mock mode needs no env at all — a misconfigured live site degrades to the
  demo, not to a broken page.
