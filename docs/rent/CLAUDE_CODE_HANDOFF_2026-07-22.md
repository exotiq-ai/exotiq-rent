# Claude Code Handoff — Exotiq Rent (2026-07-22)

> Paste this file (or point Claude Code at it) when resuming work on the
> renter-facing booking platform. Read alongside the mission docs in the spark
> repo (`exotiq-ai/exotiq-spark-mvp-flow`, branch `main`).

---

## 1. What this project is

**Two-repo architecture:**

| Repo | Role |
|------|------|
| `exotiq-ai/exotiq-rent` | Renter-facing Next.js 14 app (this repo). Mock + live data modes. No Supabase migrations here. |
| `exotiq-ai/exotiq-spark-mvp-flow` | Schema, RPCs, edge functions, RLS, Stripe webhooks. Applied via Lovable / owner path. |

**Mission brief:** `exotiq-spark-mvp-flow/docs/rent/RENTER_APP_GOAL.md`  
**Checkpoint (spark):** `exotiq-spark-mvp-flow/docs/rent/CHECKPOINT.md` (note: trailing sections are stale on M4/M5 — see §6 below)  
**Decisions:** `exotiq-spark-mvp-flow/docs/rent/DECISIONS.md` (all 10 locked 2026-07-15)

**Goal mode skill (Cursor):** `.cursor/skills/goal/SKILL.md` — same workflow applies in Claude Code: read goal → checkpoint → verify gate → branch + PR.

---

## 2. Where things left off (last ~2 days)

### Merged to `exotiq-rent` `main` (newest first)

| PR | Milestone | Summary |
|----|-----------|---------|
| **#13** | Site split | `NEXT_PUBLIC_SITE_MODE` = `booking` (default) vs `marketplace`. Booking routes 404 in marketplace mode. Root redirect to demo storefront only in booking mode. |
| **#12** | M5 | Live `createRenterBooking` → `rent-create-booking` edge function. Token-gated confirmation. Backend patch in `docs/rent/patches/booking-writes/` (applied to spark repo). |
| **#11** | M4 | Supabase-mode reads: RPC clients, adapters, `getSupabaseTeamStorefront` / `getSupabaseVehicleContext`. Photo quality gate (hide vehicles without hero image in live mode). |
| **#10** | IDV live | Wire identity verification to edge functions when `NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=supabase`. |
| **#9** | IDV UI | Post-payment `IdentityVerificationCard` on confirmation page (Stripe modal + polling). |
| **#6** | M0 polish | Month navigation, editable driver form, branded 404. |
| **#3–#5** | M0 + D-register | Fee base (rental only, D9), protection $89/$289 (D5), decline terms checkbox, mock catalog expansion, storefront buildout. |

**Test suite:** 29 tests, all green. Verification gate: `npm ci && npm test && npx tsc --noEmit && npm run lint && npm run build`.

### Merged / applied on spark repo (backend)

- **M2/M3** — RLS hardening, public read RPCs, `rent-public-media` (applied to hosted DB).
- **IDV V1–V4** — `identity-create-session`, `identity-webhook`, `identity-session-status` + migration. Sandbox loop verified end-to-end. PR #26 fixed manual_review lockout.
- **M5** — `20260722050000_renter_booking_writes.sql` + `rent-create-booking` (applied 2026-07-22). Drift fixes: `user_activity_log` columns, `public_booking_by_ref.authorized` coalesce.
- **PR #23** — Retired 20% marketplace fee hardcode in checkout functions (Lovable must redeploy those functions).

### Open PRs (docs only, safe to merge)

- **#7** — `docs/rent/MARKETPLACE_LAUNCH_CHECKLIST.md` (owner checklist phases 0–7)
- **#8** — `docs/rent/ID_VERIFICATION_PLAN.md` (V1–V10 decisions + test script)

---

## 3. URL flip plan (what we intended)

Gregory wanted to **separate the public marketing site from the gold booking demo**:

| URL | Mode | Experience |
|-----|------|------------|
| **`https://exotiq.rent`** | `NEXT_PUBLIC_SITE_MODE=marketplace` | Gulf-blue marketplace mockup at `/` (Coming Soon overlay, search hero, mock fleet). **All booking-flow routes return branded 404.** |
| **`https://book.exotiq.rent`** | default (`booking`) | Gold Drive Exotiq booking flow. `/` → 307 redirect to `/desert-exotic-rentals`. Full storefront + book + confirmation routes. |
| **`https://demo.exotiq.rent`** | alias → `book.exotiq.rent` | Same as book site (kept so old links work). Old standalone `demo-exotiq-rent` Netlify site was **deleted**. |

### Code switches (already on `main`)

```typescript
// domain/booking/config.ts
getSiteMode()  // 'marketplace' | 'booking' (default)
getDataMode()  // 'mock' | 'supabase' (default mock; needs 3 env vars)
```

```javascript
// next.config.js redirects()
// marketplace mode → no root redirect (serves MarketplaceApp at /)
// booking mode → / redirects to /desert-exotic-rentals
```

**Route gating:** `app/[operatorSlug]/*`, `app/booking/*`, `app/preview` call `notFound()` when `getSiteMode() === 'marketplace'`.

### Netlify operations already done (2026-07-22 ~16:15 UTC)

| Site ID | Name | Domain | Env |
|---------|------|--------|-----|
| `1ec963dc-2d50-400d-bc1c-6049ce9d62e5` | exotiqrent | exotiq.rent | `NEXT_PUBLIC_SITE_MODE=marketplace` |
| `2fcbaa5b-d700-461d-bbd5-7af4917ef997` | book-exotiq-rent | book.exotiq.rent + demo.exotiq.rent alias | *(none set yet)* |

### Live verification status (as of handoff)

| Check | Result |
|-------|--------|
| `https://exotiq.rent/` | **200** — marketplace mockup ✅ |
| `https://exotiq.rent/desert-exotic-rentals` | **404** — booking gated ✅ |
| `https://book.exotiq.rent/` | **404** — **BROKEN** ❌ |
| `https://book.exotiq.rent/desert-exotic-rentals` | **404** — **BROKEN** ❌ |

**Root cause of book site 404:** The new Netlify site was created via API **without `@netlify/plugin-nextjs`**. The working `exotiq.rent` site has that plugin (pinned v5). Without it, publishing `.next` as a static dir serves nothing useful.

**Fix (first priority for Claude Code or Gregory on Netlify):**

1. Add `@netlify/plugin-nextjs` to `book-exotiq-rent` (match exotiqrent config).
2. Trigger a clean rebuild (`clear_cache: true`).
3. Copy env vars from the old working booking deploy (see §4).
4. Re-smoke all four URLs above.

---

## 4. Environment variables

### Site mode (build-time)

```bash
# exotiq.rent only:
NEXT_PUBLIC_SITE_MODE=marketplace

# book.exotiq.rent: omit or set booking (default)
# NEXT_PUBLIC_SITE_MODE=booking
```

### Data mode (optional live pilot)

Mock mode is the **default** and needs no env. Supabase mode requires all three:

```bash
NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://jlgwbbqydjeokypoenoc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<stripe test publishable key>
```

**Important:** `getDataMode()` falls back to mock if any required var is missing — a misconfigured deploy still works as the demo, just not live.

**Pilot tenant (live reads/writes):**

- Account: `saucy@exotiq.ai`
- Display name: Saucy Rentals (may also appear as **Fredo D'Lima's Fleet** — naming bug on Gregory's side)
- Team slug: `fredo-d-lima`
- `hello@exotiq.ai` is the **demo tenant** — excluded from public marketplace visibility; do not use for live storefront tests

**Exotiq internal tenant (`hello@exotiq.ai`):** 52 marketplace-visible vehicles but only ~22 have hero images; live UI filters photo-less vehicles.

---

## 5. Feature inventory (what's built)

### Booking flow (mock + live)

- Storefront `/{teamSlug}`, vehicle detail, 6-step book flow (dates → extras → driver → protect → review → pay)
- **Reserve without payment** (M5): Pay step creates booking via `rent-create-booking`, redirects to confirmation with `?t=<token>`
- Token-gated confirmation lookup (`public_booking_by_ref`)
- Post-payment identity verification card (Stripe Identity sandbox)

### Business rules implemented (D-register)

- **D1/D9:** Platform fee = 10% of **rental subtotal only** (excludes extras, deposits, protection). Two-party billing copy throughout.
- **D5:** Protection Premium $289/day (default), Standard $89/day, Decline $0 with explicit liability checkbox.
- **D3:** New booking statuses `requested` / `pending_documents` (backend); Command Center UI **not yet** updated by Lovable.
- **D4:** Confirmation tokens on bookings.

### Key files

```
domain/booking/
  config.ts          # site mode + data mode
  service.ts         # facade (mock vs supabase)
  totals.ts          # fee + protection math (mock quotes)
  rpcClient.ts       # M3/M5 RPC + edge function clients
  adapters.ts        # RPC row → domain types
  supabaseService.ts # live storefront + booking create/lookup
  identityClient.ts  # live IDV session/status

components/drive-exotiq/
  BookingFlow.tsx           # reserve → confirmation
  IdentityVerificationCard.tsx
  ConfirmationScreen.tsx
  flow/*Step.tsx

docs/rent/patches/
  booking-writes/    # M5 spark patch (APPLIED)
  idv/               # was in PR #8 branch; applied to spark via PR #24
```

---

## 6. Outstanding work (prioritized)

### P0 — Fix book.exotiq.rent deploy

- [ ] Install `@netlify/plugin-nextjs` on site `2fcbaa5b-d700-461d-bbd5-7af4917ef997`
- [ ] Set Supabase/Stripe env vars on book site for live pilot (or leave mock-only until Gregory confirms)
- [ ] Rebuild + verify: `/` → redirect → storefront → book flow → confirmation

### P1 — Complete URL flip verification

- [ ] Confirm `demo.exotiq.rent` alias resolves (DNS may need time)
- [ ] Confirm no stale traffic to deleted `demo-exotiq-rent` Netlify site
- [ ] Document final URL map for Gregory (one-pager in PR or checklist)

### P2 — End-to-end live smoke (after book site fixed)

Per spark checkpoint + ID plan §7:

1. Browse `fredo-d-lima` storefront in supabase mode on book.exotiq.rent
2. Complete booking for available dates (check `public_vehicle_availability` first)
3. Confirmation page → start Stripe Identity → verify
4. Booking appears in Command Center with correct status

**Known gotcha:** Parallel booking test — second create for same dates must 409.

### P3 — Lovable / Command Center (not exotiq-rent)

- [ ] UI for `requested` / `pending_documents` booking statuses + operator notifications
- [ ] IDV Prompt B polish: rename "Link sent" badge, confirm email-send button works
- [ ] Seed hero photos for ~30 Exotiq vehicles missing images
- [ ] Redeploy `create-payment-checkout` + `stripe-create-hold` after PR #23 fee fix
- [ ] Fleet-wide `btree_gist` exclusion constraint (after historical overlap dedupe)

### P4 — Gregory decisions / housekeeping

- [ ] **M6 money flow (BLOCKER for payment):** D1 ruling = two separate statement charges (operator rental + Exotiq fee/protection). May 27 single-checkout plan is obsolete. No Stripe Checkout wiring until Gregory approves model.
- [ ] Set Exotiq tenant `platform_fee_percent` to 10 (was 0.00; checkout had hardcoded 20% — retired in spark PR #23)
- [ ] Approve/rewrite protection **decline terms** legal copy (ProtectStep has placeholder language)
- [ ] Merge exotiq-rent PR #7 + #8 (docs)
- [ ] Migration export artifacts still outstanding from Lovable support (gates DB cutover, not current demo)

### P5 — Not started

- **M6:** Stripe hosted checkout, deposit hold, webhooks, refund windows, protection charge
- **Marketplace gold treatment:** Eventually flip `exotiq.rent` from mockup to real marketplace UI
- **Next.js 15 / major deps:** Flag only per goal doc policy

---

## 7. Verification gate (run before every commit)

```bash
npm ci
npm test                    # 29 tests
npx tsc --noEmit
npm run lint                # warnings OK
npm run build
```

**Route smoke (local, booking mode):**

```bash
npm run build && npm run start &
# Expect 200:
#   /desert-exotic-rentals
#   /desert-exotic-rentals/mclaren-750s-spider
#   /desert-exotic-rentals/mclaren-750s-spider/book
#   /booking/BK-DEMO-001
#   /preview
# Expect 404: /no-such-team/no-such-car
```

With `NEXT_PUBLIC_SITE_MODE=marketplace`: `/` = 200, all booking routes = 404.

---

## 8. Secrets & access

| Secret | Where |
|--------|-------|
| `NETLIFY_AUTH_TOKEN` | Cursor Cloud Agents → Secrets (works; used for site ops) |
| Supabase anon key | Netlify env on book site (not yet set) |
| Stripe publishable (test) | Netlify env on book site |
| Stripe Identity | Backend edge secrets (`STRIPE_IDENTITY_SECRET_KEY`, webhook secret) — already in spark/Lovable |

**Do not** touch hosted Supabase directly from agents. Backend changes → patch under `docs/rent/patches/` or PR to spark repo.

---

## 9. Suggested first session for Claude Code

```
1. Read this handoff + spark docs/rent/RENTER_APP_GOAL.md + CHECKPOINT.md
2. Fix book.exotiq.rent Netlify (@netlify/plugin-nextjs + rebuild)
3. Set book site env vars; smoke URLs
4. Optional: wire book.exotiq.rent to supabase mode + fredo-d-lima pilot
5. Update spark CHECKPOINT.md with URL flip status (if writable)
6. Open PR for any code fixes; never push to main
```

---

## 10. Netlify API quick reference

```bash
# List site
curl -s "https://api.netlify.com/api/v1/sites/2fcbaa5b-d700-461d-bbd5-7af4917ef997" \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN"

# Trigger rebuild
curl -s -X POST "https://api.netlify.com/api/v1/sites/2fcbaa5b-d700-461d-bbd5-7af4917ef997/builds" \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clear_cache": true}'
```

Plugin install is typically done in Netlify UI: Site → Build & deploy → Plugins → `@netlify/plugin-nextjs`, or via `netlify.toml` in repo (none exists today — consider adding one to prevent drift).

---

*Handoff written 2026-07-22 by Cursor cloud agent after site-mode split + Netlify URL flip attempt.*
