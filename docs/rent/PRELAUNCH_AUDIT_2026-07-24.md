# Pre-Launch Audit — Drive Exotiq Marketplace (2026-07-24)

Authorized pre-launch E2E audit and QA of the renter platform (`exotiq-rent`)
and the backend / Command Center (`exotiq-ai/exotiq-spark-mvp-flow`), run
against the **live sandbox** (book.exotiq.rent, Stripe **test** mode) plus an
authenticated operator session at app.exotiq.ai. Every test booking created
during the audit is listed in §6 for cleanup.

---

## VERDICT: **NO-GO for live payments today — one launch blocker.**

Everything renter-facing works and looks the part. The money machine's
*plumbing* is proven end-to-end in sandbox (a real payment settled two
statement legs on 2026-07-24, and a full dual-leg refund released the dates).
But the **operator cannot approve a marketplace booking through the Command
Center**, and the path they *can* take marks a booking `confirmed` **without
collecting payment**. Until B1 is fixed, going live means cars can be booked
for free.

B2 and B3 were also launch-blocking; both were **found and fixed during this
audit** (PRs #37, #38). B1 is backend/CC and belongs to Lovable.

Fix B1, re-run the §7 gate, and this flips to GO.

---

## 1. Launch blockers

### B1 — Operators cannot approve marketplace bookings; the available path takes the money out of the flow
**Owner: Lovable (backend + Command Center) · CONFIRMED by code + live UI**

Marketplace bookings are created only as `requested` or `pending_documents`:

```ts
// supabase/functions/rent-create-booking/index.ts:137
const initialStatus = identityVerified ? "requested" : "pending_documents";
```

Three independent layers all gate approval on a status that value can never be:

| Layer | Code | Effect |
|-------|------|--------|
| Approvals list | `BookEnhanced.tsx:255` — `bookings.filter(b => b.status === 'pending')` | Marketplace requests are **never listed**, so no Approve button exists for them anywhere in the UI |
| CC approval router | `FleetContext.tsx:951` — `booking.status === 'pending' &&` | Never routes to `rent-approve-booking`; **falls through to the generic update** |
| Edge function | `rent-approve-booking/index.ts:81` — `if (booking.status !== "pending") return 409` | Rejects every real marketplace booking |

**The damage is in the fall-through.** When the guard misses, `updateBookingStatus`
runs its generic branch:

```ts
const updates: Partial<Booking> = { status };   // status === 'confirmed'
updates.confirmed_at = new Date().toISOString();
```

So the booking goes straight to **`confirmed`** — skipping `pending_payment`,
`payment_due_at`, the payment link, and the approval email. The renter is
never asked to pay, and the operator's dashboard shows a confirmed booking.
**A car is reserved, confirmed, and handed over for $0.**

**Live evidence:** BK-03456 (`requested`, identity verified) does not appear
in the Bookings page's Pending Approvals bar, and the booking detail modal
offers only Edit / Change Vehicle / Add to Google — no Approve or Decline.
Meanwhile the **Dashboard** correctly announces *"1 marketplace request
awaiting review · Audi S8 Plus (QA E2E Approve)"* and links to Bookings,
where nothing can be done with it. That inconsistency is the tell: the alert
was taught the real statuses, the actions were not.

This also explains BK-03447 on 2026-07-22: it reached `pending_payment`
because its status was edited manually, not approved — the DB trigger stamped
`payment_due_at` on the transition.

**Fix:** replace `'pending'` with the marketplace request statuses in all
three places (accept `requested`; decide explicitly whether
`pending_documents` may be approved before ID verification — recommendation:
no). Add Approve/Decline actions to the booking detail modal for marketplace
requests, and make the Dashboard alert link to something actionable. Then
re-run the §7 gate.

---

## 2. Launch blockers found **and fixed** during this audit

### B2 — Identity verification was a dead end on the live site (FIXED, PR #38)
The hosted-page handoff called `window.open()` **after an `await`**, so the
user-gesture context was gone and the browser blocked the popup. Observed
live: the renter sits on *"Verifying…"* indefinitely — no error, no tab, no
way to verify. The platform's central safety promise, silently unusable.
Now the hosted URL renders as a real anchor ("Continue to secure
verification"); a tap is a trusted gesture that always opens. New tab rather
than redirect because the session sets no `return_url`.
**Verified:** anchor renders against the production backend, and a full
test-mode verification completed → `identity-session-status: verified`.

### B3 — The app claimed "Identity verified" when nothing had been verified (FIXED, PR #37)
The confirmation page inferred identity from booking status: anything not
`pending_documents` rendered *"Identity verified — booking confirmed"*. But
bookings leave that status when an **operator approves or edits them**.
**Proven live:** BK-03447 displayed "Identity verified" while the backend
reported `identity_verified: false` for that renter's email — no
`identity_verifications` row had ever existed. A false assurance to the
renter, and to any operator who reads the renter's page before handing over a
six-figure car. Identity state now comes only from identity data.

---

## 3. High severity

### H1 — Signed-URL TTL regressed to ~10 years (was 365 days)
**Owner: Lovable.** Red-team finding F5 moved the wrong way. Measured today
from `public_team_fleet.hero_image_url`: `exp - iat = 3650 days`. Root cause:

```ts
// supabase/functions/generate-hero-image/index.ts:216
.createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year
```

…persisted into `vehicles.image_url` (line 270) and served verbatim by the
public RPC, so the DB holds effectively permanent credentials to a *private*
bucket. `rent-public-media` does this correctly (1 h). **Fix:** either make
the vehicle-photos bucket public for marketing images (they are not
sensitive) or serve hero images through the 1 h media function; stop
persisting long-lived signed URLs.

### H2 — Dead `tel:` links, including the only CTA on live storefronts (FIXED, PR #38)
Live teams expose no phone by design (public RPCs withhold operator PII →
`adapters.ts` sets `phone: ''`), but three affordances rendered
`href="tel:"`. The worst was the storefront's **sticky footer, where the only
prominent button on every live storefront was a dead phone link**. All three
are now conditional and the storefront reclaims the space.

### H3 — "Record Payment" is offered on marketplace bookings
**Owner: Lovable.** The booking detail Payments tab shows a manual **Record
Payment** action even for `booking_source = 'marketplace'`, whose payments
arrive automatically via Stripe webhooks. This is exactly the path that
produced the 2026-07-24 reconciliation confusion (a manual payment recorded
against BK-03447 alongside the real charges). **Fix:** hide or hard-warn it
for marketplace bookings.

---

## 4. Medium / low

| # | Finding | Owner | Status |
|---|---------|-------|--------|
| M1 | WCAG AA contrast failures — `#5C6272` measured **3.14:1** on the frame and **2.60:1** in stat tiles (needs 4.5:1). Now `#848A9A` (4.59–5.55:1), text usages only | Claude | **FIXED** PR #35 |
| M2 | Storefront rendered 52 vehicle cards with **zero** headings (h1 only); detail page had no substructure. Now h1/h2/h3 = 1/1/52 | Claude | **FIXED** PR #35, #36 |
| M3 | Root layout hardcoded marketplace branding, so booking pages (including 404s) inherited "Exotiq Rent \| The Marketplace…". Now site-mode aware | Claude | **FIXED** PR #35 |
| M4 | After the enumeration fix, a confirmation link missing its `?t=` hard-404'd with a generic "wrong turn" — the likeliest cause is a truncated email link. Route-scoped 404 now explains the secure link (noindex) | Claude | **FIXED** PR #35 |
| M5 | **Mock mode renders any booking ref as a full, plausible confirmation** — `demo.exotiq.rent/booking/BK-ANYTHING` shows "Your McLaren is reserved". Acceptable on a demo site; would be a serious leak if mock ever served real traffic. Worth a banner or ref check | Claude | Open (deliberate demo behavior) |
| M6 | Rate limiter: **rejected requests also increment** the counter, so a client that keeps retrying cannot recover within the window; and the **tumbling** window (`floor(epoch/3600)`) permits a 2× burst across a boundary (40 creates in two minutes). Also consider that 20/hr/IP is shared by NAT'd renters (offices, mobile carriers) | Lovable | Open (tuning) |
| L1 | Back/close controls are 40×40 px — passes WCAG 2.5.8 (24 px) but under Apple's 44 pt guidance. Deliberately left: enlarging re-adds header padding that was trimmed by design | Claude | Won't fix |

---

## 5. Confirmed working (the important negatives)

Re-verified live today unless noted.

| Area | Result |
|------|--------|
| **Red-team F1** rate limiting | **Fixed** — persistent Postgres counter; trips at exactly 20. Fails open on DB error, per-endpoint buckets (20/30/10), Turnstile hook pre-wired |
| **F2** false availability | **Fixed** — availability and create-overlap now share one status set; new 4 h auto-expiry for unverified holds. Verified end-to-end: three staged holds appear as busy |
| **F3** ref enumeration | **Fixed** — token now required; tokenless reads return zero rows |
| **F4** invalid protection tier | **Fixed** — `400 protection must be one of: premium, standard, decline` (previously silently charged premium) |
| **F6** tenant sunset | **Fixed** — Saucy Rentals hidden, Exotiq live |
| **F7** scheduler cron | **Fixed** — registered in migration `20260724205504` |
| Webhook forgery | Both payment and identity webhooks **reject unsigned bodies (400)** — a "paid" event cannot be forged |
| RLS on base tables | anon reads of `bookings` / `customers` / `teams` blocked |
| PII in public RPCs | No VIN, plate, owner/customer email, Stripe IDs, cost basis, or notes |
| SQL injection | Parameterized; `' OR '1'='1` and `; DROP TABLE` return empty |
| Token gating (D4) | Wrong/missing token exposes nothing; correct token exposes no customer PII |
| Booking validation | Past dates, inverted range, zero-night, bad email, short phone → 400; non-marketplace and demo tenant → 404 |
| Operator refund auth | 401 without an operator session; 401 with the anon key |
| Cancel/refund lifecycle | Unpaid cancel → `cancelled` (no Stripe activity); paid free-window cancel → **both legs refunded**, `refunded`, dates released; double-cancel → 409 |
| Money E2E (2026-07-22) | book → approve → pay → **two statement legs** ($1,500 → operator via destination charge; $1,017 `EXOTIQ RENT` on platform) → `confirmed` + receipt |
| Identity flow | Test-mode verification completed → session `verified` → **V7 reuse works**: a new booking with that email is created as `requested` with `identity_verified: true` |
| Pre-approval payment guards | `rent-checkout` 409s on any booking not in `pending_payment`; 409s again once paid (`rental_already_paid`) |
| Live mobile / a11y (375 px) | No horizontal overflow; all images have alt text; no unlabeled icon controls; 52 of 54 images lazy-loaded; gallery thumbs individually labeled; 0 contrast failures after M1 |
| URL split | Booking routes 404 on exotiq.rent; `/preview` 404s live; legacy `exotiq-` slug redirects; demo-tenant share 404s |
| Share surface | No rate or booking data on the hype card (a `$9` in the HTML is a Next.js RSC marker, not a price) |
| Operator payment display | Unpaid marketplace booking reads Total $1,500 / Paid $0 / Balance $1,500 — correct operator-side view (they receive the rental only) |

---

## 6. Test data to clean up

All created by this audit against the Exotiq tenant, drivers named `QA …`:

| Ref | Dates | State | Note |
|-----|-------|-------|------|
| BK-03451 | Dec 9–12 2026 | pending_documents | staged for pay+refund |
| BK-03452 | Dec 16–19 2026 | pending_documents | staged for decline card |
| BK-03453 | Jul 26–27 2026 | pending_documents | staged for <72 h forfeit |
| BK-03454 | Jan 12–15 2027 | pending_documents | identity session created |
| BK-03455 | Feb 9–12 2027 | pending_documents | anchor-fix verification |
| BK-03456 | Mar 9–12 2027 | **requested** | the B1 reproduction — keep until B1 is fixed, then use it to verify |
| BK-03447 | Aug 8–11 2026 | refunded | 2026-07-22 money E2E (already refunded) |
| BK-03448/49/50 | various | cancelled | earlier red-team probes |

The 4 h unverified-hold sweep should clear the `pending_documents` ones
automatically; `BK-03456` will not expire (it is `requested`) — cancel it once
B1 is verified.

---

## 7. Re-run gate after B1 is fixed

1. Approve **BK-03456** from the Command Center → status must become
   **`pending_payment`** (not `confirmed`), `payment_due_at` ≈ +48 h, and the
   renter must receive the approval email with a working pay link.
2. Pay it with `4242 4242 4242 4242` → two PaymentIntents, booking
   `confirmed`, receipt renders, `payment_stripe_mode = 'test'`.
3. Decline path with `4000 0000 0000 0002` → booking stays `pending_payment`,
   renter can retry.
4. Off-session failure with `4000 0025 0000 3155` → rental captured, Exotiq
   leg fails → booking stays `pending_payment`, ops alert logged, checkout
   returns `rental_already_paid`.
5. Redeliver a processed webhook event → `{received, duplicate}`, no double
   charge.
6. Cancel a paid booking **inside** 72 h → 409 without `acknowledge_forfeit`;
   with it → `cancelled`, **no refund**.
7. Operator declines a **paid** booking → `rent-refund-booking` fires → both
   legs refunded, `refunded`.
8. Confirm test-mode rows are excluded from revenue/margin reporting.

---

## 8. Still owned by Gregory

- **Protection decline-terms legal copy** is still placeholder text, and that
  checkbox binds a real renter to real liability the moment real money moves.
  This remains a launch gate independent of B1.
- **M6e live flip** (secrets swap + one ~$1 statement check) — after B1.
- Rotate the Command Center password shared in chat during this audit.
