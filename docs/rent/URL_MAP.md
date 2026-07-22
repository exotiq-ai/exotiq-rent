# Exotiq Rent — Public URL Map

> Final state of the URL flip, verified live 2026-07-22. One codebase, two
> Netlify sites, split by `NEXT_PUBLIC_SITE_MODE` (see `domain/booking/config.ts`).

| URL | Netlify site | Mode | Serves |
|-----|--------------|------|--------|
| `https://exotiq.rent` | `exotiqrent` (`1ec963dc-2d50-400d-bc1c-6049ce9d62e5`) | `marketplace` | Marketplace mockup at `/`. **All booking routes 404.** |
| `https://book.exotiq.rent` | `book-exotiq-rent` (`2fcbaa5b-d700-461d-bbd5-7af4917ef997`) | `booking` (default) | Gold Drive Exotiq flow. `/` → 307 → `/desert-exotic-rentals`. |
| `https://demo.exotiq.rent` | alias on `book-exotiq-rent` | `booking` | Same as book site (kept so old links work). |

## Verified route matrix (2026-07-22)

| Check | Result |
|-------|--------|
| `book.exotiq.rent/` | 307 → `/desert-exotic-rentals` ✅ |
| `book.exotiq.rent/desert-exotic-rentals` (+ vehicle, book) | 200 ✅ |
| `book.exotiq.rent/booking/BK-DEMO-001` | 200 ✅ |
| `book.exotiq.rent/preview` | 200 ✅ |
| `book.exotiq.rent/no-such-team/no-such-car` | 404 ✅ |
| `demo.exotiq.rent/` | 200 ✅ |
| `exotiq.rent/` | 200 (marketplace mockup) ✅ |
| `exotiq.rent/desert-exotic-rentals`, `/booking/*` | 404 (gated) ✅ |

## Operational notes

- Both sites build `main` of `exotiq-ai/exotiq-rent` with `npm run build`,
  publish `.next`, and get the Next.js runtime from `netlify.toml`
  (`@netlify/plugin-nextjs`). **Do not** remove that file — a site building
  this repo without the plugin serves nothing (the 2026-07-22 book-site 404).
- Site mode is the only intended per-site difference:
  `NEXT_PUBLIC_SITE_MODE=marketplace` is set on `exotiqrent` only.
- Data mode on both sites is currently **mock** (default). Supabase mode
  requires the three env vars listed in
  `docs/rent/CLAUDE_CODE_HANDOFF_2026-07-22.md` §4 and falls back to mock if
  any is missing.
- The old standalone `demo-exotiq-rent` Netlify site was deleted; the
  `demo.exotiq.rent` alias on `book-exotiq-rent` replaces it.
