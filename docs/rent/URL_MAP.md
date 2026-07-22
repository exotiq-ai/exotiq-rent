# Exotiq Rent — Public URL Map

> Three sites, one repo. Updated 2026-07-22 after the live Exotiq tenant flip;
> all rows verified live. Modes come from `NEXT_PUBLIC_SITE_MODE` /
> `NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE` (see `domain/booking/config.ts`).

| URL | Netlify site | Site mode | Data mode | Serves |
|-----|--------------|-----------|-----------|--------|
| `https://exotiq.rent` | `exotiqrent` (`1ec963dc-2d50-400d-bc1c-6049ce9d62e5`) | `marketplace` | mock | Marketplace mockup at `/`. All booking routes 404. |
| `https://book.exotiq.rent` | `book-exotiq-rent` (`2fcbaa5b-d700-461d-bbd5-7af4917ef997`) | `booking` | **supabase (LIVE)** | Gold flow on the **live Exotiq fleet**. `/` → 307 → `/exotiq`. Legacy `exotiq-` URLs (pre-rename shares) 307 to `exotiq`. |
| `https://demo.exotiq.rent` | `demo-exotiq-rent` (`a2eef772-4503-47f8-8aa8-d100f04699a6`) | `booking` | mock | The gold **mock demo** (desert-exotic-rentals). Old demo links keep working. |

## Verified route matrix (2026-07-22, post-flip)

| Check | Result |
|-------|--------|
| `book.exotiq.rent/` | 307 → `/exotiq-` ✅ |
| `book.exotiq.rent/exotiq` | 307 → `/exotiq-` ✅ (temp until slug rename) |
| `book.exotiq.rent/exotiq-` | 200, live fleet (22 photo-backed of 52 visible) ✅ |
| `book.exotiq.rent/exotiq-/2017-audi-s8` | 200, live $500/day rate ✅ |
| `book.exotiq.rent/desert-exotic-rentals` | 404 (mock team absent in live mode — correct) ✅ |
| `demo.exotiq.rent/` + `/desert-exotic-rentals` | 200 (mock demo intact) ✅ |
| `exotiq.rent/` | 200 marketplace mockup; booking routes 404 ✅ |

## Book-site env (live pilot)

```
NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://jlgwbbqydjeokypoenoc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key — publishable, from spark repo .env>
NEXT_PUBLIC_DEFAULT_TEAM_SLUG=exotiq
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_live_… platform publishable key>
```

Without `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, identity verification falls
back to Stripe's hosted page; with it, the embedded modal is used. The slug
rename (`exotiq-` → `exotiq`) landed backend-side 2026-07-22 — the legacy
redirects in `next.config.js` keep pre-rename links alive.

## Operational notes

- All three sites build `main` with `npm run build`, publish `.next`, and get
  the Next.js runtime from `netlify.toml` (`@netlify/plugin-nextjs`). **Do
  not** remove that file — a site building this repo without the plugin
  serves nothing (the 2026-07-22 book-site 404).
- Per-site behavior lives ONLY in Netlify env vars, never in code or toml.
- Mock mode needs no env at all — a misconfigured live site degrades to the
  demo, not to a broken page.
