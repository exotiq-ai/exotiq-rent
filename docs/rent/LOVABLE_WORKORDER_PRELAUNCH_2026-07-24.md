# Lovable Work Order — Pre-Launch Blocker + Fixes (2026-07-24)

Standalone (no repo pull needed). From an authorized pre-launch E2E audit of
the Drive Exotiq marketplace: live sandbox (book.exotiq.rent, Stripe **test**
mode) plus an authenticated operator session at app.exotiq.ai.

**Read item 1 first — it is a launch blocker that lets a car be booked and
confirmed without payment.** Items 2–4 are hardening. Everything below is
backend / Command Center work.

Good news first: your red-team fixes all landed and verified — persistent rate
limiting trips at exactly 20, availability now matches create-overlap (plus
the 4 h unverified-hold sweep), booking-ref enumeration is closed, invalid
protection tiers 400 correctly, and the scheduler cron is registered. Webhook
signature enforcement, RLS, and PII gating all hold. A full payment settled
two statement legs and a full dual-leg refund released the dates.

---

## 1. 🔴 BLOCKER — Marketplace approval is unreachable, and the fallback skips payment

### What's wrong

Marketplace bookings are only ever created as `requested` or
`pending_documents`:

```ts
// supabase/functions/rent-create-booking/index.ts:137
const initialStatus = identityVerified ? "requested" : "pending_documents";
```

But **three separate layers gate approval on `status === 'pending'`**, which a
marketplace booking never has:

```ts
// 1. src/components/dashboard/BookEnhanced.tsx:255  — the Pending Approvals list
const pendingBookings = useMemo(() => {
  return bookings.filter(b => b.status === 'pending');
}, [bookings]);

// 2. src/contexts/FleetContext.tsx:951 — the approval router
const isMarketplaceApproval = booking?.booking_source === 'marketplace' &&
  booking.status === 'pending' &&      // never true
  status === 'confirmed';

// 3. supabase/functions/rent-approve-booking/index.ts:81 — the function itself
if (booking.status !== "pending") {
  return json({ error: `Booking cannot be approved from status: ${booking.status}` }, 409);
}
```

Consequences, in order of severity:

1. **Marketplace requests never appear in the Pending Approvals bar**, so
   there is no Approve button for them anywhere in the UI. (Confirmed live:
   BK-03456 is `requested`, and its detail modal offers only Edit / Change
   Vehicle / Add to Google.)
2. Because the router guard misses, `updateBookingStatus(id, 'confirmed')`
   falls through to the generic branch:
   ```ts
   const updates: Partial<Booking> = { status };   // 'confirmed'
   updates.confirmed_at = new Date().toISOString();
   ```
   → the booking jumps straight to **`confirmed`**, skipping
   `pending_payment`, `payment_due_at`, the pay link, and the approval email.
   **The renter is never asked to pay.** A car ends up reserved, confirmed,
   and collectable for $0.
3. `rent-approve-booking` would 409 anyway, so even a correct UI call fails.

The tell that this is a wiring miss rather than a design choice: the
**Dashboard alert is correct** — it announces *"1 marketplace request awaiting
review · Audi S8 Plus (QA E2E Approve)"* — and links to Bookings, where
nothing can act on it. The alert learned the real statuses; the actions
didn't.

(This also explains BK-03447 on 2026-07-22 reaching `pending_payment`: its
status was edited manually, and the DB trigger stamped `payment_due_at`.)

### What to do

1. Replace `'pending'` with the marketplace request status(es) in all three
   places. Accept **`requested`**. Decide explicitly whether
   `pending_documents` may be approved before ID verification —
   **recommendation: no**, keep ID verification as a precondition, and show
   those bookings as "awaiting renter ID" rather than approvable.
2. Add **Approve** and **Decline** actions to the booking detail modal for
   marketplace requests (today the modal has no way to act on one).
3. Make the Dashboard's "marketplace request awaiting review" alert deep-link
   to something actionable.
4. **Guard the fall-through:** in `updateBookingStatus`, a
   `booking_source === 'marketplace'` booking must never be settable directly
   to `confirmed` from a request status — that transition belongs to the
   payment webhook alone. Fail loudly instead of silently confirming.
5. Consider enforcing the same rule in the database (a trigger or CHECK that
   blocks `requested|pending_documents → confirmed` for marketplace rows), so
   no future UI path can reintroduce free cars.

### How to verify

Approve **BK-03456** (already `requested`, identity verified) in the Command
Center. It must become **`pending_payment`** with `payment_due_at` ≈ +48 h and
the renter must receive the approval email with a working pay link. If it
becomes `confirmed`, the bug is still live.

---

## 2. 🟠 Signed-URL TTL regressed to ~10 years (red-team F5 moved the wrong way)

Measured today from `public_team_fleet.hero_image_url`: `exp - iat = 3650
days` (previously 365). Root cause:

```ts
// supabase/functions/generate-hero-image/index.ts:216
.createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year
// ...line 270: persisted into vehicles.image_url
```

The database now stores effectively permanent credentials to a **private**
bucket, and the public RPC serves them verbatim. (`rent-public-media` does
this correctly at 1 h.)

**Fix — pick one:** make the `vehicle-photos` bucket public for marketing
images (they aren't sensitive, and this is the simplest correct answer), or
serve hero images through the 1 h media function. Either way, stop persisting
long-lived signed URLs into `vehicles.image_url`.

---

## 3. 🟠 "Record Payment" is offered on marketplace bookings

The booking detail **Payments** tab exposes a manual *Record Payment* action
even when `booking_source = 'marketplace'`, whose payments arrive
automatically via Stripe webhooks. This is precisely the path that produced
the reconciliation confusion on BK-03447 (a manual payment recorded alongside
the two real charges).

**Fix:** hide it for marketplace bookings, or require an explicit
"this is an out-of-band payment" confirmation that is clearly distinguished
from the automated legs.

---

## 4. 🟡 Rate-limiter tuning (the mechanism is good — these are edges)

The persistent counter works well. Three refinements:

1. **Rejected requests also increment** the counter (`INSERT … DO UPDATE SET
   count = count + 1` runs before the `count <= limit` check), so a client
   that keeps retrying can never recover inside the window even after it
   stops. Consider not counting rejections.
2. The window is **tumbling** (`floor(epoch/3600) * 3600`), which allows a 2×
   burst across a boundary — 40 booking creates inside two minutes. A sliding
   window or a smaller bucket would smooth that.
3. 20/hr is keyed on IP, which is **shared by NAT'd renters** (offices,
   mobile carriers, hotel wifi — plausible for this clientele). Consider a
   higher cap plus Turnstile, rather than a low IP cap alone.

---

## 5. Small backend request from the renter side

Add **`identity_verified`** (boolean) to `public_booking_by_ref`. The renter
app must never infer identity from booking status — it did, and it showed
"Identity verified" for a renter who had never verified (fixed on our side by
removing the inference, which now costs the renter one extra tap). With this
field the confirmation page can show verified state truthfully and instantly.

---

## Not for Lovable

- Renter-app fixes from this audit are already shipped (PRs #35–#38):
  WCAG AA contrast, heading semantics, brand-aware metadata, secure-link 404,
  the identity dead-end fix, and removal of dead `tel:` links.
- Decline-terms legal copy and the M6e live flip are Gregory's.
