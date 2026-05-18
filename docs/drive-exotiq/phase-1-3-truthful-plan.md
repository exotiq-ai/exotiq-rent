# Drive Exotiq Booking Scaffold Phase 1-3 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill only for isolated review or implementation lanes. Avi remains final integrator/reviewer. Do not allow parallel agents to edit the same files.

**Goal:** Lock the current Drive Exotiq renter-facing booking scaffold, refine the front-end visual/product quality, and prepare a clean backend-shaped adapter layer without implementing real Supabase or Stripe.

**Architecture:** The current `exotiq-rent` app remains a Next.js 14 App Router frontend. The old marketplace homepage stays untouched at `/`. The new Drive Exotiq flow lives alongside it under long-term routes using mock data and production-shaped contracts. Phase 1 stabilizes and commits the current scaffold; Phase 2 improves visual/product fidelity; Phase 3 introduces a mock service boundary so later Supabase/Stripe work can plug in cleanly.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, lucide-react, next/font, Vitest.

**Active branch:** `feat/drive-exotiq-booking-flow`

**Current truthful status:**
- Scaffold exists but is uncommitted.
- `package.json` and `package-lock.json` are modified for Vitest.
- New untracked paths exist under `app/[operatorSlug]/`, `app/booking/`, `app/preview/`, `components/drive-exotiq/`, `domain/booking/`, and `docs/`.
- The flow currently uses mock data directly in some places.
- `ConfirmationScreen` still calls `createInitialCart()` rather than loading a confirmation record by `bookingId`.
- Prior verification passed: `npx tsc --noEmit`, `npm test`, `npm run lint`, and `npm run build`.
- Lint/build warnings remain from the old marketplace `<img>` usage and `app/layout.tsx` Montserrat font loading. These are not blockers for the scaffold but should be documented.
- Next dev can produce stale `.next` chunk errors if build/dev caches are mixed. Kill server, clear `.next`, restart before review.

---

## Non-Goals for Phases 1-3

Do not implement these yet:
- Supabase migrations.
- Real Supabase client dependency.
- Real Stripe Connect / PaymentIntent / hold / refund / webhook logic.
- GHL/Twilio notifications.
- Operator dashboard changes.
- Full marketplace homepage redesign.
- Account/My Bookings/cancellation flows.

---

## Phase 1 — Lock Current Scaffold

**Goal:** Make the current scaffold reliable, verified, committed, and safe to review.

### Task 1.1: Confirm no duplicate dev/background servers

**Objective:** Avoid stale process notifications and duplicated effort across Telegram topics.

**Files:** None.

**Steps:**
1. Check background processes with Hermes `process(action="list")`.
2. If any old `npm run dev` or `npm run start` process is running for `/Users/gbot/projects/exotiq-rent`, kill it unless it is the one intentionally used for review.
3. Check OS-level port state if needed:
   `lsof -nP -iTCP:3000 -sTCP:LISTEN`

**Expected:** Only one intentional server process is running, or none before verification.

---

### Task 1.2: Clean Next cache before final browser verification

**Objective:** Prevent stale chunk errors such as `Cannot find module './819.js'`.

**Files:** Deletes generated `.next` only.

**Command:**
```bash
python3 - <<'PY'
import shutil, pathlib
p=pathlib.Path('.next')
shutil.rmtree(p, ignore_errors=True)
print('cleared_next', not p.exists())
PY
```

**Expected:** `cleared_next True`

---

### Task 1.3: Run full static verification

**Objective:** Prove code is build-green before visual review.

**Files:** None unless failures are discovered.

**Commands:**
```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
```

**Expected:**
- TypeScript passes.
- Vitest passes.
- Lint passes with warnings only.
- Build passes.

**Known acceptable warnings for now:**
- Old marketplace `<img>` warnings.
- `app/layout.tsx` custom Montserrat font warning.
- Possible `Newsreader` font override warning if build still succeeds.

---

### Task 1.4: Start a single clean review server

**Objective:** Serve the verified build/dev app for route smoke checks.

**Option A — Dev review:**
```bash
npm run dev
```

**Option B — Production-style review:**
```bash
npm run build
npm run start -- -p 3000
```

**Important:** Do not run `npm run build` while expecting an already-running `next start` process to remain valid; restart the server after any build.

---

### Task 1.5: HTTP smoke routes

**Objective:** Verify the long-term route shape and bad-slug handling.

**Command:**
```bash
for path in \
  /preview \
  /desert-exotic-rentals/mclaren-750s-spider \
  /desert-exotic-rentals/mclaren-750s-spider/book \
  /booking/EXQ-2026-K7P4 \
  /bad/bad/book; do
  printf "$path "
  curl -s -o /tmp/exq.out -w '%{http_code}\n' http://127.0.0.1:3000$path
done
```

**Expected:**
- `/preview` -> 200
- `/desert-exotic-rentals/mclaren-750s-spider` -> 200
- `/desert-exotic-rentals/mclaren-750s-spider/book` -> 200
- `/booking/EXQ-2026-K7P4` -> 200
- `/bad/bad/book` -> 404

---

### Task 1.6: Browser interaction smoke

**Objective:** Prove the renter can complete the flow end-to-end.

**Start URL:**
`http://127.0.0.1:3000/preview`

**Steps:**
1. Click Vehicle screen.
2. Click Select dates.
3. Dates screen: click Continue.
4. Driver screen: click Proof of insurance, then Continue.
5. Extras screen: Continue.
6. Protect screen: Continue.
7. Review screen: verify Operator and Protection split billing, then Proceed to payment.
8. Pay screen: verify no raw card fields, then Pay.
9. Confirmation screen: verify car-specific title and split charges.
10. Open browser console and capture warnings/errors.

**Expected:**
- No JS errors.
- No React key warnings.
- No CTA overlap.
- Confirmation route is `/booking/EXQ-2026-K7P4`.

---

### Task 1.7: Fix only blocker issues found by smoke

**Objective:** Keep Phase 1 focused and avoid scope creep.

**Allowed Phase 1 fixes:**
- Broken route / 500.
- Console errors.
- React warnings introduced by the new Drive Exotiq code.
- CTA overlap blocking user interaction.
- Raw-card-looking payment UI regression.
- Missing split billing on Review or Confirmation.
- Invalid `tel:` links.

**Not Phase 1 fixes:**
- Large refactors.
- Real backend integration.
- Rewriting old marketplace warnings.

---

### Task 1.8: Commit the locked scaffold

**Objective:** Save a stable checkpoint before polishing.

**Command:**
```bash
git add package.json package-lock.json app/[operatorSlug] app/booking app/preview components/drive-exotiq domain docs/drive-exotiq

git commit -m "feat: scaffold drive exotiq booking flow"
```

**Expected:** One commit containing the current end-to-end scaffold.

---

## Phase 2 — Frontend Fidelity and Product Refinement

**Goal:** Move the scaffold from “works and looks good” to “premium, review-worthy, and closer to the canonical Gold + Editorial handoff.”

### Task 2.1: Serve canonical design bundle locally

**Objective:** Compare against source-of-truth design, not memory.

**Design path:**
`/Users/gbot/.hermes/cache/documents/drive-exotiq-wire-frame-screens/drive-exotiq-wire-fram-screens/project/`

**Command:**
```bash
cd /Users/gbot/.hermes/cache/documents/drive-exotiq-wire-frame-screens/drive-exotiq-wire-fram-screens/project
python3 -m http.server 4177
```

**Open:**
`http://localhost:4177/Drive%20Exotiq%20Booking%20Flow%20-%20Gold%20+%20Editorial%20Type.html`

---

### Task 2.2: Create a visual punch list

**Objective:** Document exact front-end differences before editing.

**Files:**
- Create/modify: `docs/drive-exotiq/frontend-polish-punch-list.md`

**Screens to compare:**
- Vehicle: `S1_D`
- Dates: `S_Dates`
- Driver: `S_Driver`
- Extras: `S_Extras`
- Protect: `S2_A`
- Review: `S3_C`
- Pay: `S_Pay`
- Confirmation: `S4_E`

**Punch list format:**
```md
## Screen 01 Vehicle
- Current:
- Target:
- Fix:
- Priority: blocker/high/medium/low
```

---

### Task 2.3: Refine shared phone shell/chrome only if needed

**Objective:** Keep all screens visually consistent.

**Files:**
- Modify: `components/drive-exotiq/BookingChrome.tsx`

**Check:**
- iPhone-style frame.
- Status bar.
- Notch/bezel on desktop preview.
- Drive Exotiq logo bar.
- Progress indicator.
- Home indicator.
- Close X remains semantic `Link` with accessible label.

**Verification:** Visual smoke on Vehicle, Booking, Confirmation.

---

### Task 2.4: Refine Vehicle screen

**Objective:** Keep selected `S1_D` dashboard direction rather than generic marketplace hero.

**Files:**
- Modify: `components/drive-exotiq/VehicleEntryPage.tsx`

**Must preserve:**
- `01 / 08 · Vehicle` style progress.
- Operator + gold price metadata.
- Newsreader vehicle title.
- 2x2 big-number spec grid.
- Gold bottom CTA.
- Long-term route link to `/desert-exotic-rentals/mclaren-750s-spider/book`.

**Verification:** Vehicle route renders and CTA works.

---

### Task 2.5: Refine Dates/Driver/Extras/Protect/Review/Pay screens

**Objective:** Improve fidelity without changing core architecture.

**Files:**
- Modify: `components/drive-exotiq/BookingFlow.tsx`
- Optionally split only if low-risk into:
  - `components/drive-exotiq/screens/DatesScreen.tsx`
  - `components/drive-exotiq/screens/DriverScreen.tsx`
  - `components/drive-exotiq/screens/ExtrasScreen.tsx`
  - `components/drive-exotiq/screens/ProtectScreen.tsx`
  - `components/drive-exotiq/screens/ReviewScreen.tsx`
  - `components/drive-exotiq/screens/PayScreen.tsx`

**Must preserve:**
- Premium protection default-selected.
- Decline visually demoted.
- No raw card fields.
- Split billing in Review.
- CTA after required content in DOM and visually.

**Verification:** Complete browser click-through.

---

### Task 2.6: Add explicit decline protection consent

**Objective:** Make decline protection legally/product-wise clearer.

**Files:**
- Modify: `components/drive-exotiq/BookingFlow.tsx`
- Add tests only if the state moves into domain utilities.

**Behavior:**
- Selecting `decline` should require an explicit second consent before Continue.
- Copy should mention full financial responsibility and later authorization hold.
- Default remains `premium`.

**Acceptance criteria:**
- User cannot accidentally proceed with decline via one casual tap.
- Standard/premium remain one-tap choices.

---

### Task 2.7: Tighten Pay screen semantics

**Objective:** Keep payment restrained and Stripe-safe.

**Files:**
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Must preserve:**
- No fake card number, expiry, CVC, or raw card input.
- Mock/tokenized language.
- Separate semantic mention of Operator charge and Exotiq Protect charge.
- No trust-badge clutter.

---

### Task 2.8: Clean route-scoped font warnings if practical

**Objective:** Reduce noisy warnings without restyling old marketplace.

**Files to inspect/modify:**
- `components/drive-exotiq/fonts.ts`
- `app/layout.tsx`
- possibly Drive Exotiq route wrappers only

**Constraints:**
- Do not globally restyle the existing marketplace homepage.
- Keep Newsreader only for headings/vehicle voice.
- Keep Inter for labels/prices/UI.

**Acceptance:**
- Build still passes.
- No new global style regressions.

---

### Task 2.9: Commit frontend polish

**Command:**
```bash
git add components/drive-exotiq app/[operatorSlug] app/booking app/preview docs/drive-exotiq

git commit -m "polish: refine drive exotiq booking UI"
```

---

## Phase 3 — Backend-Shaped Adapter Layer

**Goal:** Stop treating mock data as the long-term interface. Add service contracts that can later be backed by Supabase/app.exotiq.ai and Stripe without rewriting the UI.

### Task 3.1: Extend domain types for sessions and confirmations

**Objective:** Model booking lifecycle without real persistence.

**Files:**
- Modify: `domain/booking/types.ts`
- Test: `domain/booking/session.test.ts`

**Types to add:**
```ts
export type BookingSessionStatus = 'draft' | 'ready_for_payment' | 'paid_mock' | 'confirmed';

export type BookingSession = BookingCart & {
  sessionId: string;
  status: BookingSessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type BookingConfirmation = {
  bookingId: string;
  session: BookingSession;
  confirmedAt: string;
};
```

**TDD:** Add a test that a mock session can be created from operator/vehicle and contains derived totals.

---

### Task 3.2: Create mock booking service

**Objective:** Centralize route/page interactions behind an adapter.

**Files:**
- Create: `domain/booking/mockService.ts`
- Test: `domain/booking/mockService.test.ts`

**Functions:**
```ts
export function getVehicleBookingPage(operatorSlug: string, vehicleSlug: string)
export function createBookingSession(input: { operatorSlug: string; vehicleSlug: string }): BookingSession | null
export function updateBookingSession(session: BookingSession, patch: Partial<BookingCart>): BookingSession
export function uploadRenterDocument(session: BookingSession, type: 'license' | 'insurance'): BookingSession
export function createMockPayment(session: BookingSession): BookingConfirmation
export function getBookingConfirmation(bookingId: string): BookingConfirmation | null
```

**Acceptance:**
- Unknown slugs return null.
- Confirmation lookup supports `EXQ-2026-K7P4`.
- Totals remain centralized through `calculateBookingTotals`.

---

### Task 3.3: Move routes to service layer

**Objective:** Routes should not call low-level mock data directly where a service contract exists.

**Files:**
- Modify: `app/[operatorSlug]/[vehicleSlug]/page.tsx`
- Modify: `app/[operatorSlug]/[vehicleSlug]/book/page.tsx`
- Modify: `app/booking/[bookingId]/page.tsx`

**Expected behavior:**
- Vehicle route uses `getVehicleBookingPage`.
- Book route uses `getVehicleBookingPage` or `createBookingSession` seed data.
- Confirmation route uses `getBookingConfirmation(bookingId)` and 404s unknown booking IDs.

---

### Task 3.4: Update ConfirmationScreen to accept confirmation data

**Objective:** Remove hard dependency on `createInitialCart()` inside confirmation UI.

**Files:**
- Modify: `components/drive-exotiq/BookingFlow.tsx`
- Better later: move confirmation into `components/drive-exotiq/ConfirmationScreen.tsx`

**Current issue:**
`ConfirmationScreen({ bookingId })` calls `createInitialCart()` internally.

**Target:**
`ConfirmationScreen({ confirmation }: { confirmation: BookingConfirmation })`

**Acceptance:**
- `/booking/EXQ-2026-K7P4` renders from mock service data.
- Unknown booking ID 404s.
- Split billing still visible.

---

### Task 3.5: Document future Supabase/Stripe boundaries

**Objective:** Make backend handoff explicit for future work.

**Files:**
- Modify: `docs/drive-exotiq/backend-scope.md`
- Create: `docs/drive-exotiq/backend-adapter-contracts.md`

**Document:**
- `operator` -> `teams`
- `location` -> `locations`
- `vehicle` -> `vehicles` + `vehicle_photos`
- `bookingId` -> `bookings.booking_ref`
- `driver` -> `customers` + `documents`
- payment mock -> future `payments` + Stripe Edge Functions
- Cents in renter flow vs possible dollar numbers in SaaS DB.
- Stripe Standard vs Express discrepancy.
- 10% vs 20% platform fee discrepancy.

---

### Task 3.6: Commit adapter layer

**Command:**
```bash
git add domain/booking app/[operatorSlug] app/booking components/drive-exotiq docs/drive-exotiq

git commit -m "feat: add mock booking service contracts"
```

---

## Final Phase 1-3 Verification Checklist

Run after each phase and before handoff:

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
```

Then route smoke:
```bash
for path in \
  /preview \
  /desert-exotic-rentals/mclaren-750s-spider \
  /desert-exotic-rentals/mclaren-750s-spider/book \
  /booking/EXQ-2026-K7P4 \
  /bad/bad/book \
  /booking/BAD-ID; do
  printf "$path "
  curl -s -o /tmp/exq.out -w '%{http_code}\n' http://127.0.0.1:3000$path
done
```

Expected after Phase 3:
- `/preview` -> 200
- vehicle route -> 200
- book route -> 200
- known confirmation -> 200
- bad vehicle/book route -> 404
- bad booking ID -> 404

Browser acceptance:
- Vehicle -> Dates -> Driver -> Extras -> Protect -> Review -> Pay -> Confirmation works.
- No browser JS errors.
- No React key warnings from Drive Exotiq components.
- No raw-card-looking payment UI.
- Review and Confirmation show two-party billing.
- Decline protection requires explicit consent.

---

## Recommended Execution Order Now

1. Execute Phase 1 completely and commit.
2. Execute Phase 2 high-priority polish only, then commit.
3. Pause for Gregory review.
4. Execute Phase 3 adapter layer after visual direction is accepted, unless backend handoff becomes urgent sooner.
