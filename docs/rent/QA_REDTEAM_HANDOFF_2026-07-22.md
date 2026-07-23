# QA / Red-Team Handoff — Drive Exotiq Renter Platform (2026-07-22)

> Start here. This reflects the deployed state as of 2026-07-22 evening —
> newer than the spark repo's red-team TODO (see §5 for what closed since).

## 1. Environments

| URL | Data | Purpose |
|-----|------|---------|
| `https://book.exotiq.rent` | **LIVE** (supabase, Exotiq tenant) | The system under test. Root → `/exotiq`. |
| `https://demo.exotiq.rent` | Mock | Reference behavior; nothing you do here touches real data. |
| `https://exotiq.rent` | Mock | Marketing mockup. All booking routes must 404 — that's a test. |

Every booking created on **book.exotiq.rent** is a real row that appears in
the Command Center (app.exotiq.ai) for the Exotiq team. That's expected —
use obviously-fake driver names (e.g. "QA Redteam One") so ops can spot them.

## 2. ⚠️ Read before testing identity verification

Stripe Identity is in **test mode** for the QA window (confirmed by Gregory,
2026-07-23). The renter app intentionally has no publishable key deployed, so
verification opens **Stripe's hosted page** in a new tab — in test mode it
offers simulated verification outcomes; no real ID is needed.

**Run the identity loop ONCE, total** (owner's instruction — do not spawn
repeated verification sessions). Sessions reuse: a verified email stays
verified until the document expires (V7), so that single run covers every
subsequent booking test under the same driver email. Test the *other* IDV
paths (missing email, restricted confirmation, polling UX) without starting
new Stripe sessions.

At launch: secrets flip back to live and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
(pk_live, on file) is restored on the book site — that re-enables the
embedded modal. The browser key and backend secret must always be the same
Stripe mode or the modal fails.

## 3. What to attack (in scope)

1. **Booking writes** — `rent-create-booking` via the Pay step ("Reserve").
   Server re-quotes, validates dates/driver, rate-limits 20/hr/IP.
   - Parallel-booking: two overlapping reserves on the same car — second
     must 409 ("Those dates were just taken").
   - Past dates, inverted ranges, junk driver fields → 400s.
2. **Confirmation token gating (D4)** — `/booking/{ref}` without `?t=` must
   show the restricted card only (status, no PII). Token guessing must fail.
3. **Tenant isolation** — anon RPCs must never leak non-marketplace teams,
   photo-less-vehicle handling, PII (no VIN, plate, Stripe IDs, emails).
   `hello@…` demo-tenant data must not be reachable via any slug.
4. **Identity loop** (see §2) — statuses `pending_documents` → verified via
   webhook; manual-review lockout; polling UX on the confirmation page.
5. **The URL split** — booking routes 404 on exotiq.rent; `/preview` 404s on
   the live site; legacy `exotiq-` slugs 307 to `exotiq`.
6. **Share surface** — `/share/{team}/{vehicle}` must never expose booking
   data; OG unfurl renders; unknown slugs 404.
7. **UI flow at phone size** — primary button visible on every step (this
   was a real bug, fixed 2026-07-22 in PR #23); calendar blocks past days;
   totals consistent across review → pay → confirmation.

## 4. Out of scope / known items (don't file these)

- **M6 money flow is not built.** No Stripe Checkout, no capture, no
  refunds. Bookings stop at `requested` / `pending_documents`. "Reserve"
  creates the booking without payment — by design at this stage.
- **Protection decline terms are placeholder copy** (legal text pending).
- **Cancellation/refund policy** is an open business decision.
- `marketplace_test_mode = true` on the Exotiq tenant (bypasses the 5-photo
  readiness gate) — intentional for the pilot.
- Two vehicles in `maintenance` status are hidden from the fleet (52 listed
  of 54 visible) — working as designed.

## 5. Reference docs

- `exotiq-spark-mvp-flow/docs/rent/MARKETPLACE_REDTEAM_TODO.md` — the
  original risk list (2026-07-21). **Closed since:** item 2 (booking
  endpoint shipped, M5), item 5 (DB-level GiST overlap constraint exists —
  verify, don't build), item 6 (photos seeded). Items 1/3/4 are your §3.
- `docs/rent/URL_MAP.md` — deploy topology + env.
- `docs/rent/ID_VERIFICATION_PLAN.md` — IDV decisions V1–V10 + test script.
- `docs/rent/MARKETPLACE_LAUNCH_CHECKLIST.md` — owner's phase plan.
- `docs/rent/CLAUDE_CODE_HANDOFF_2026-07-22.md` — morning-of state (URLs
  section superseded by URL_MAP).

## 6. Filing findings

Frontend bugs → issues/PRs on `exotiq-ai/exotiq-rent` (verification gate:
`npm ci && npm test && npx tsc --noEmit && npm run lint && npm run build`).
Backend/RPC/edge findings → spark repo; hosted Supabase is never touched
directly — changes go as patches under `docs/rent/patches/` or via Lovable.
