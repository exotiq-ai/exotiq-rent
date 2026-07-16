# Drive Exotiq Beautiful + Maintainable Plan

> **For Hermes:** Use subagent-driven-development only for isolated, non-overlapping lanes. Avi remains final integrator/reviewer. Do not allow two agents to edit the same file at once.

**Goal:** Upgrade the current Drive Exotiq renter-facing scaffold from a working preview into a visually faithful, maintainable, review-ready mobile-web flow without adding premature Supabase or Stripe complexity.

**Architecture:** Preserve the existing Next.js 14 App Router repo and keep the old marketplace homepage untouched. The Drive Exotiq renter flow remains isolated under `components/drive-exotiq`, `domain/booking`, and the long-term app routes. The next pass should separate reusable shell/primitives, split the large booking flow into step components, and tighten the UI against the canonical Gold + Editorial Type handoff.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, lucide-react, next/font, Vitest.

**Current branch:** `feat/drive-exotiq-booking-flow`

**Current status at plan creation:**
- Scaffold exists and local production preview has been verified after clearing rogue dev processes.
- Active known-good preview process sequence: kill all dev/start/tunnel processes, clear `.next`, run tests/build, then run exactly one `next start`.
- Current uncommitted working tree includes `components/drive-exotiq/BookingFlow.tsx` and `docs/drive-exotiq/frontend-polish-punch-list.md` changes.
- Current component sizes: `BookingFlow.tsx` ~262 lines, `BookingChrome.tsx` ~114 lines, `VehicleEntryPage.tsx` ~64 lines.
- Main maintainability risk: `BookingFlow.tsx` is still a mixed state machine + step renderer + UI details file.
- Main product risk: visual fidelity is directionally good but not yet screen-by-screen canonical.

---

## Non-Goals

Do not do these in this pass:
- No Supabase migrations.
- No real Supabase client dependency.
- No real Stripe Connect / PaymentIntent / card collection / hold / refund / webhook logic.
- No GHL/Twilio notifications.
- No old marketplace homepage redesign.
- No operator dashboard changes.
- No full account/My Bookings/cancellation system.
- No raw card fields, even static-looking ones.

---

## Definition of Done

This phase is complete when:
1. The Drive Exotiq screens visually track the canonical handoff much more closely.
2. `BookingFlow.tsx` is reduced to a small state orchestration shell.
3. Each step screen is in its own file with clear props.
4. Shared phone shell, typography, buttons, cards, rows, and money display are reusable primitives.
5. Protection decline requires explicit confirmation/consent.
6. Review, Pay, and Confirmation all preserve two-party billing.
7. Payment UI remains tokenized/mock and clearly non-PCI.
8. Route validation remains intact.
9. Verification passes:
   - `npm test`
   - `npx tsc --noEmit`
   - `npm run lint` with warnings only
   - `npm run build`
   - browser click-through Vehicle → Dates → Driver → Extras → Protect → Review → Pay → Confirmation
   - no browser console errors.
10. A clean commit or PR is ready.

---

# Phase 0 — Stabilize and Snapshot Current Work

## Task 0.1: Kill duplicate servers and lock a clean baseline

**Objective:** Prevent stale `.next` and localtunnel confusion before editing.

**Files:** None.

**Steps:**
1. Stop tracked background processes for this project if any are running.
2. Check untracked OS listeners:
   ```bash
   lsof -nP -iTCP:3000 -sTCP:LISTEN || true
   ps ax -o pid,ppid,stat,command | egrep 'next dev|next start|npm run dev|npm run start|localtunnel|node .*lt' | grep -v egrep || true
   ```
3. Kill any stale `next dev`, `next start`, or localtunnel process bound to this project.
4. Clear generated cache:
   ```bash
   python3 - <<'PY'
   import shutil, pathlib
   p = pathlib.Path('.next')
   shutil.rmtree(p, ignore_errors=True)
   print('cleared_next', not p.exists())
   PY
   ```

**Expected:** No server is bound to port 3000; `.next` is absent.

---

## Task 0.2: Run baseline verification

**Objective:** Confirm the starting point is green before refactoring.

**Files:** None unless failures are discovered.

**Commands:**
```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

**Expected:** All pass. Lint/build may retain known old marketplace warnings.

---

## Task 0.3: Commit or stash current scaffold before polish

**Objective:** Preserve a known-good checkpoint.

**Files:** All current scaffold files.

**Steps:**
1. Inspect:
   ```bash
   git status --short
   git diff --stat
   ```
2. If the diff is acceptable, commit a checkpoint:
   ```bash
   git add app/[operatorSlug] app/booking app/preview components/drive-exotiq domain/booking docs/drive-exotiq package.json package-lock.json
   git commit -m "feat: scaffold drive exotiq renter booking flow"
   ```
3. If not ready to commit, create a temporary patch backup:
   ```bash
   git diff > /tmp/drive-exotiq-before-polish.patch
   ```

**Expected:** There is a recoverable checkpoint before major UI surgery.

---

# Phase 1 — Design System and Shared Primitives

## Task 1.1: Create route-scoped design constants

**Objective:** Replace repeated literal classes and colors with a small, readable Drive Exotiq UI vocabulary.

**Files:**
- Create: `components/drive-exotiq/ui/tokens.ts`

**Implementation sketch:**
```ts
export const driveColors = {
  bg: '#0D0F14',
  outerBg: '#06070a',
  panel: '#161922',
  line: '#2A2E3A',
  muted: '#9BA1B0',
  faint: '#5C6272',
  text: '#F0F2F5',
  gold: '#C8A664',
  buttonInk: '#1A1308',
  error: '#FF4D6A',
  warning: '#FFB84D',
} as const;

export const driveType = {
  headline: "var(--font-drive-newsreader), Georgia, serif",
  ui: "var(--font-drive-inter), system-ui, sans-serif",
} as const;
```

**Verification:**
```bash
npx tsc --noEmit
```

---

## Task 1.2: Extract shared UI primitives

**Objective:** Make screens easier to read and visually consistent.

**Files:**
- Create: `components/drive-exotiq/ui/DriveButton.tsx`
- Create: `components/drive-exotiq/ui/DriveCard.tsx`
- Create: `components/drive-exotiq/ui/DriveHeading.tsx`
- Create: `components/drive-exotiq/ui/DriveRows.tsx`
- Create: `components/drive-exotiq/ui/Money.tsx`

**Required primitives:**
- `DriveButton` with variants: `primary`, `secondary`, `ghost`, `dangerQuiet`.
- `DriveCard` with optional selected/warning states.
- `StepHeader` / `DriveHeading` using Newsreader only for screen title.
- `DetailRow` for label/value rows.
- `Money` rendering cents via `formatMoney`.

**Rules:**
- No global CSS rewrite.
- No dependency on marketplace components.
- No emoji.

**Verification:**
```bash
npx tsc --noEmit
```

---

## Task 1.3: Rename/refine the phone shell API

**Objective:** Make `BookingChrome.tsx` a stable reusable shell instead of an incidental component.

**Files:**
- Modify: `components/drive-exotiq/BookingChrome.tsx`

**Target API:**
```ts
export type PhoneStepMeta = {
  index: number;
  total: number;
  label: string;
};

export function PhoneViewport(props: {
  children: React.ReactNode;
  step?: PhoneStepMeta;
  onBack?: () => void;
  backDisabled?: boolean;
  closeHref?: string;
  bottomOverlay?: React.ReactNode;
})
```

**Acceptance criteria:**
- Vehicle, booking, and confirmation can share the same shell.
- Logo/status bar/home indicator remain consistent.
- Step indicator can render numbered style or bar style based on prop.

**Verification:**
```bash
npx tsc --noEmit
```

---

# Phase 2 — Split BookingFlow Into Maintainable Step Components

## Task 2.1: Define step component props and flow model

**Objective:** Make the state contract explicit before moving JSX.

**Files:**
- Create: `components/drive-exotiq/flow/types.ts`

**Implementation sketch:**
```ts
import type { BookingCart, ExtraSelection, ProtectionTier } from '@/domain/booking/types';

export type BookingStepId = 'dates' | 'driver' | 'extras' | 'protect' | 'review' | 'pay';

export type StepScreenProps = {
  cart: BookingCart;
  onContinue: () => void;
  onBack?: () => void;
};

export type DatesStepProps = StepScreenProps & {
  onPickupTimeChange: (value: string) => void;
};

export type DriverStepProps = StepScreenProps & {
  insuranceUploaded: boolean;
  onInsuranceUploaded: () => void;
};

export type ExtrasStepProps = StepScreenProps & {
  selectedExtraIds: Set<string>;
  onToggleExtra: (extra: ExtraSelection) => void;
};

export type ProtectStepProps = StepScreenProps & {
  onSelectProtection: (tier: ProtectionTier) => void;
  declineConsent: boolean;
  onDeclineConsentChange: (value: boolean) => void;
};
```

**Verification:**
```bash
npx tsc --noEmit
```

---

## Task 2.2: Extract DatesStep

**Objective:** Move screen 02 out of `BookingFlow.tsx`.

**Files:**
- Create: `components/drive-exotiq/flow/DatesStep.tsx`
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Visual target:**
- Title: `When are you driving?`
- Subcopy: `3-day minimum · from $1,199/day`
- Calendar selected range remains Jun 14–17.
- Pickup time appears before CTA.
- CTA never overlaps content.

**Verification:**
```bash
npx tsc --noEmit
```
Browser check: click `/book`, confirm Dates renders and Continue advances.

---

## Task 2.3: Extract DriverStep

**Objective:** Move screen 03 out of `BookingFlow.tsx` and improve document hierarchy.

**Files:**
- Create: `components/drive-exotiq/flow/DriverStep.tsx`
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Visual target:**
- Title: `Who's driving?`
- Add `Documents` section label.
- Verified license card and upload insurance card are visually distinct.
- Continue disabled until mock insurance upload.

**Verification:**
Browser check: Continue disabled, Upload insurance enables Continue.

---

## Task 2.4: Extract ExtrasStep

**Objective:** Move screen 04 out of `BookingFlow.tsx`.

**Files:**
- Create: `components/drive-exotiq/flow/ExtrasStep.tsx`
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Visual target:**
- Title: `Add to your trip` unless Gregory chooses current copy.
- Subcopy: `Optional · curated by the operator`.
- Selected state is unmistakable but not loud.
- Skip remains available.

**Verification:**
Browser check: toggling extras updates selected summary and totals later.

---

## Task 2.5: Extract ProtectStep and add decline consent

**Objective:** Make protection choice product-safe and maintainable.

**Files:**
- Create: `components/drive-exotiq/flow/ProtectStep.tsx`
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Required behavior:**
- Premium remains selected by default.
- Decline is visually demoted.
- If user selects decline, show warning consent checkbox or explicit confirmation panel.
- Continue is disabled for decline until consent is checked.
- Do not add scary legal overkill; keep it concise and premium.

**Verification:**
Browser check: select decline → Continue disabled → consent → Continue enabled.

---

## Task 2.6: Extract ReviewStep

**Objective:** Move review screen into a dedicated file and improve split-billing density.

**Files:**
- Create: `components/drive-exotiq/flow/ReviewStep.tsx`
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Visual target:**
- Clear booking summary.
- Separate operator charge and Exotiq Protect charge.
- No fake/unbacked fees just for visual parity.
- Totals still come from `calculateBookingTotals`.

**Verification:**
Unit tests still pass; browser review step shows two-party billing.

---

## Task 2.7: Extract PayStep

**Objective:** Keep payment safe, restrained, and clearly mocked.

**Files:**
- Create: `components/drive-exotiq/flow/PayStep.tsx`
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Required behavior:**
- No raw card number, CVC, expiry inputs, or fake static card fields.
- Show tokenized test method language.
- Show operator charge vs Exotiq Protect charge before payment.
- Mock pay routes to `/booking/EXQ-2026-K7P4`.

**Verification:**
Search check:
```bash
rg "CVC|card number|4242|expiry" components/drive-exotiq || true
```
Expected: no raw-card UI copy unless explicitly explaining that raw card data is not collected.

---

## Task 2.8: Reduce BookingFlow to orchestration only

**Objective:** Make `BookingFlow.tsx` easy to reason about.

**Files:**
- Modify: `components/drive-exotiq/BookingFlow.tsx`

**Target:**
- Holds state.
- Computes cart/totals.
- Determines current step metadata.
- Renders `<PhoneViewport>` and current step component.
- Ideally under ~140 lines.

**Verification:**
```bash
wc -l components/drive-exotiq/BookingFlow.tsx
npx tsc --noEmit
```

---

# Phase 3 — Screen-by-Screen Beauty Pass Against Canonical Design

## Task 3.1: Serve canonical design locally

**Objective:** Review against the real design, not memory.

**Command:**
```bash
cd /Users/gbot/.hermes/cache/documents/drive-exotiq-wire-frame-screens/drive-exotiq-wire-fram-screens/project
python3 -m http.server 4177
```

**Canonical URL:**
`http://localhost:4177/Drive%20Exotiq%20Booking%20Flow%20-%20Gold%20+%20Editorial%20Type.html`

**Verification:** Open canonical and scaffold side-by-side in browser/vision.

---

## Task 3.2: Vehicle screen polish

**Objective:** Match selected `S1_D` more closely without overbuilding.

**Files:**
- Modify: `components/drive-exotiq/VehicleEntryPage.tsx`

**Check against canonical:**
- `01 / 08 · Vehicle` rhythm.
- Operator/price metadata.
- Newsreader vehicle title spacing.
- 2x2 spec grid hierarchy.
- Bottom CTA rhythm.

**Verification:** Browser vision comparison against canonical `S1_D`.

---

## Task 3.3: Booking step polish batch A — Dates, Driver, Extras

**Objective:** Make the early flow feel editorial and intentional.

**Files:**
- Modify: `DatesStep.tsx`
- Modify: `DriverStep.tsx`
- Modify: `ExtrasStep.tsx`

**Acceptance criteria:**
- Copy matches canonical unless safety/product reason says otherwise.
- Input/selection cards feel consistent.
- CTA placement is stable.
- No cramped or floating sections.

**Verification:** Browser click-through to Protect with no console errors.

---

## Task 3.4: Booking step polish batch B — Protect, Review, Pay

**Objective:** Improve decision confidence and payment clarity.

**Files:**
- Modify: `ProtectStep.tsx`
- Modify: `ReviewStep.tsx`
- Modify: `PayStep.tsx`

**Acceptance criteria:**
- Premium protection feels recommended, not forced.
- Decline path requires explicit confirmation.
- Review/Pay both show two-party billing.
- Pay remains tokenized/mock.

**Verification:** Browser click-through to confirmation with no console errors.

---

## Task 3.5: Confirmation polish

**Objective:** Make the payoff screen feel premium and car-specific.

**Files:**
- Modify: `app/booking/[bookingId]/page.tsx` if needed.
- Modify: component containing `ConfirmationScreen` if split from `BookingFlow.tsx`.

**Acceptance criteria:**
- Title remains `Your McLaren is reserved.`
- Split charges remain visible.
- Operator card is clear.
- Next steps are concise.
- `tel:` link uses a valid phone value, not masked text.

**Verification:** Browser console clean on `/booking/EXQ-2026-K7P4`.

---

# Phase 4 — Mock Service Boundary and Data Cleanliness

## Task 4.1: Separate display phone from callable phone

**Objective:** Avoid invalid `tel:` values while preserving masked display if wanted.

**Files:**
- Modify: `domain/booking/types.ts`
- Modify: `domain/booking/mockData.ts`
- Modify: components that render phone/call links.

**Implementation direction:**
```ts
phone: {
  display: '(480) 555-0142',
  e164: '+14805550142',
}
```

**Acceptance criteria:**
- UI may display formatted phone.
- `href="tel:..."` always uses E.164.
- Search finds no masked phone in tel hrefs.

---

## Task 4.2: Introduce booking service mocks

**Objective:** Prepare for future backend without using real Supabase.

**Files:**
- Create: `domain/booking/service.ts`
- Modify: route files to call service functions.

**Service API sketch:**
```ts
export async function getVehicleBookingContext(operatorSlug: string, vehicleSlug: string) { ... }
export async function getBookingConfirmation(bookingId: string) { ... }
export async function createMockBooking(cart: BookingCart) { ... }
```

**Acceptance criteria:**
- Routes no longer directly know mock global data internals.
- Confirmation loads by `bookingId`, even if mock-backed.
- Still no Supabase dependency.

---

## Task 4.3: Align totals with canonical/product expectation

**Objective:** Decide whether current derived totals or canonical visual totals should win.

**Files:**
- Modify: `domain/booking/totals.ts`
- Modify: `domain/booking/totals.test.ts`
- Modify: `domain/booking/mockData.ts`

**Decision needed before implementation:**
Canonical visual values mention:
- Rental: `$3,597`
- Unlimited miles: `$597`
- Taxes & fees: `$377`
- Operator total: `$4,571`
- Protect: `$267`
- Grand total: `$4,838`

Current scaffold totals differ because extras/taxes are simplified.

**Recommendation:** Keep derived totals honest unless Gregory wants exact canonical demo numbers. If exact visual demo numbers are desired, encode them as named mock line items, not hardcoded UI strings.

---

# Phase 5 — QA, Review, and Delivery

## Task 5.1: Static verification

**Commands:**
```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

**Expected:** All pass; warnings only if inherited/known.

---

## Task 5.2: Browser interaction smoke

**Objective:** Verify the whole funnel.

**Steps:**
1. Start one clean server.
2. Open `/preview`.
3. Open Vehicle.
4. Click Select dates.
5. Continue through Dates.
6. Upload mock insurance.
7. Continue through Extras.
8. Test Protect premium path.
9. Test Protect decline consent path separately.
10. Continue Review.
11. Mock Pay.
12. Land on Confirmation.
13. Check browser console.

**Expected:** No JS errors, no stale chunk failures, no stuck CTA.

---

## Task 5.3: Independent review

**Objective:** Catch issues Avi misses.

**Review lanes:**
1. Spec compliance review.
2. Code maintainability review.
3. Visual/product review against canonical handoff.

**Instructions to reviewer:**
- Do not edit files.
- Report request changes / approve.
- Specifically check no raw card collection UI and split billing is visible.

---

## Task 5.4: Commit and preview delivery

**Objective:** Package a clean branch for Gregory.

**Steps:**
```bash
git status --short
git add components/drive-exotiq domain/booking app docs package.json package-lock.json
git commit -m "feat: polish drive exotiq booking flow"
```

**Preview choice:**
- Preferred: Vercel preview deployment or authenticated Cloudflare named tunnel.
- Temporary: localtunnel after clean production start.

**Localtunnel warning:** It can show an IP interstitial and has unstable subdomains. Do not rely on it for polished stakeholder review if Vercel is available.

---

# Recommended Execution Order

1. Phase 0 baseline and checkpoint.
2. Phase 1 primitives.
3. Phase 2 component split.
4. Static verification.
5. Phase 3 visual polish screen batches.
6. Browser smoke.
7. Phase 4 data/service cleanup.
8. Final verification/review.
9. Commit and deliver.

# Risk Controls

- One editor/file owner at a time.
- No parallel edits to `BookingFlow.tsx`.
- Commit after the baseline and after the component split before visual experimentation.
- Clear `.next` before every final review server.
- Never run `next dev` and `next start` on the same port during review.
- Keep root `/` untouched.
- Preserve route structure and backend/Stripe scope locks.
