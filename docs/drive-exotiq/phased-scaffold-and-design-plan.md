# Drive Exotiq Renter Flow — Phased Scaffold + Design Recovery Plan

Date: 2026-05-17
Branch: `feat/drive-exotiq-booking-flow`

## Current Reality

We have a useful technical foundation, but the preview experience and visual fidelity are not yet acceptable.

### What is working

- Existing exotiq.rent homepage is still intact.
- New long-term route structure exists:
  - `/{operatorSlug}/{vehicleSlug}`
  - `/{operatorSlug}/{vehicleSlug}/book`
  - `/booking/{bookingId}`
- Booking domain layer exists:
  - `domain/booking/types.ts`
  - `domain/booking/totals.ts`
  - `domain/booking/mockData.ts`
  - `domain/booking/totals.test.ts`
- Tests/build have passed in prior verification.
- Supabase migrations were not added.
- Stripe is mocked/siloed for later.
- app.exotiq.ai reference inspection has informed future data mappings.

### What is not working

- Tunnel review is unreliable/confusing.
- Opening the tunnel root shows the old marketplace homepage, not the new booking flow.
- The old homepage appears broken on mobile and can go black / fail visually through the tunnel.
- Current booking UI is a rough approximation, not a faithful port of the canonical Gold + Editorial Type handoff.
- We need a proper preview route, a faithful visual port, and stronger QA checkpoints.

## Guiding Principle

Do not keep layering fixes onto the rough scaffold. Keep the good domain/routing foundation, but rebuild the visual layer from the canonical design source.

Canonical design source:

`/Users/gbot/.hermes/cache/documents/drive-exotiq-wire-frame-screens/drive-exotiq-wire-fram-screens/project/Drive Exotiq Booking Flow - Gold + Editorial Type.html`

Design source files:

- `styles.css`
- `frame.jsx`
- `icons.jsx`
- `screen1.jsx` / `S1_D`
- `screen-dates.jsx` / `S_Dates`
- `screen-driver.jsx` / `S_Driver`
- `screen-extras.jsx` / `S_Extras`
- `screen2.jsx` / `S2_A`
- `screen3.jsx` / `S3_C`
- `screen-pay.jsx` / `S_Pay`
- `screen4.jsx` / `S4_E`

---

## Phase 0 — Stabilize Preview and Review Workflow

Goal: make sure Gregory and reviewers always land on the correct experience and can actually see it.

### Tasks

1. Add `/preview` route.
   - Route should redirect or link directly to:
     `/desert-exotic-rentals/mclaren-750s-spider/book`
   - Keep `/` unchanged for now.

2. Add a lightweight preview landing page if redirect is not enough.
   - Show clear buttons:
     - “Vehicle screen”
     - “Booking flow”
     - “Confirmation”
   - Include a warning that this branch preview is the new renter flow, not the old marketplace homepage.

3. Stop relying on localtunnel root URL for review.
   - Share only `/preview` or direct booking links.

4. Prefer Vercel preview deployment if available.
   - Tunnel is fragile, can show interstitials, and can fail static assets.
   - Vercel preview will be much more reliable for mobile review.

### Acceptance Criteria

- `http://localhost:3000/preview` clearly lands on or points to the new booking flow.
- Tunnel `/preview` route works, if tunnel is used.
- Gregory no longer sees the old marketplace homepage by accident.

---

## Phase 1 — Freeze the Good Foundation

Goal: preserve what is useful and avoid churn.

### Keep

- Current branch.
- Long-term route strategy.
- Domain types.
- Totals tests.
- Mock data adapter direction.
- Backend scope docs.

### Fix small foundation issues

1. Replace any masked phone number in mock data with separate fields:
   - `displayPhone`: `+1 (480) 555-0142`
   - `telPhone`: `+14805550142`

2. Align mock totals with canonical design for now:
   - Rental: `$3,597`
   - Unlimited miles: `$597`
   - Taxes & fees: `$377`
   - Operator total: `$4,571`
   - Exotiq Protect: `$267`
   - Grand total: `$4,838`

3. Decide whether unlimited miles is a real line item or mock-only design artifact.
   - For visual parity, include it as a mock line item.
   - For future backend, mark it as an operator-configurable policy/fee.

### Acceptance Criteria

- `npm test` passes.
- Mock data contains no invalid phone values.
- Review and Pay screens can show canonical `$4,838` total.

---

## Phase 2 — Build the Real Phone Shell / App Chrome

Goal: make the app immediately look like the handoff before screen-specific work.

### Source to port

- `frame.jsx`
- relevant shell/status CSS from `styles.css`

### Required elements

- Outer dark page background.
- iPhone-style shell.
- Rounded phone body.
- 9:41 status bar.
- iOS-style status icons from `icons.jsx`.
- Dynamic Island / notch treatment.
- Top app bar:
  - Back arrow
  - centered Drive Exotiq logo/lockup
  - close icon
- Step row:
  - `02 / 08`
  - section label, e.g. `Dates`
  - progress bar style from design
- Bottom home indicator / safe area.

### Acceptance Criteria

- At first glance, the page looks like the canonical phone mockup, not a generic responsive page.
- Header chrome matches the design bundle closely.
- No old marketplace nav appears in the booking flow.

---

## Phase 3 — Port Core Visual Tokens Exactly

Goal: stop approximating colors/spacing/type.

### Token requirements

Production token names should use `accent`, not `cyan`:

- `--accent: #C8A664`
- `--accent-hover: #B8975A`
- `--accent-glow: rgba(200,166,100,0.16)`
- `--accent-glow-strong: rgba(200,166,100,0.30)`
- `--accent-ink: #1A1308`
- `--bg: #0D0F14`
- `--bg-deeper: #06070a`
- `--surface: #161922`
- `--surface-2: #1E2230`
- `--text-1: #F0F2F5`
- `--text-2: #9BA1B0`
- `--text-3: #5C6272`
- `--border: #2A2E3A`
- `--border-strong: #3A3F4F`
- `--error: #FF4D6A`
- `--warning: #FFB84D`

### Typography requirements

- Newsreader only for `.h-title` moments.
- Inter for all UI text, labels, prices, metadata, and buttons.
- Preserve optical sizing and letter spacing:
  - `font-variation-settings: 'opsz' 32`
  - `letter-spacing: -0.018em`

### Acceptance Criteria

- No new booking CSS references cyan-era naming.
- Visual tokens are scoped to booking flow, not global homepage.
- Type treatment matches canonical bundle.

---

## Phase 4 — Screen-by-Screen Visual Port

Goal: rebuild screens from canonical source functions, preserving live state where useful.

### 4.1 Vehicle — Screen 01 / Variant D

Port from:

- `screen1.jsx` / `S1_D`

Required:

- Hero McLaren image crop.
- Operator + From `$1,199/day` row.
- Newsreader vehicle title.
- 2x2 spec grid.
- Carousel dots.
- Instant Book / possible future “Concierge Approved” badge.
- Footnote.
- CTA: `Select dates`.

Acceptance:

- Looks visually close to canonical Vehicle phone.

### 4.2 Dates — Screen 02 / Variant A

Port from:

- `screen-dates.jsx` / `S_Dates`

Required canonical copy:

- Title: `When are you driving?`
- Subtitle: `3-day minimum · from $1,199/day`
- June 2026 calendar.
- Previous/next month controls.
- Continuous gold-tinted range band.
- Endpoint gold circles.
- Helper: `Tap a day to change · Pickup time set at next step`
- Total card:
  - `Jun 14 – 17 · 3 days`
  - `$1,199/day × 3`
  - `$3,597`
- CTA: `Continue`.

Acceptance:

- Dates screen is close enough to place side-by-side with canonical reference.

### 4.3 Driver — Screen 03

Port from:

- `screen-driver.jsx`

Required:

- Title: `Who's driving?`
- Subtitle: `We verify ahead of pickup · 60 seconds`
- Identity rows.
- Gold checks.
- Documents section.
- License verified card.
- Insurance upload card.
- Trust copy.
- CTA gated by verification state.

### 4.4 Extras — Screen 04

Port from:

- `screen-extras.jsx`

Required canonical copy/prices:

- Concierge delivery `+$150`
- Additional driver `$45/day`
- Photo package `$400`
- Late return `$75`
- `Skip — nothing here is required`
- `1 extra added +$150`

### 4.5 Protect — Screen 05 / Variant A

Port from:

- `screen2.jsx` / `S2_A`

Required:

- Premium selected.
- Standard unselected.
- Self-cover declined option demoted/dashed.
- Correct pricing.
- Proper warning treatment for decline.

### 4.6 Review — Screen 06 / Variant C

Port from:

- `screen3.jsx` / `S3_C`

Required canonical totals:

- Rental `$3,597`
- Unlimited miles `$597`
- Taxes & fees `$377`
- Charge from Desert Exotic `$4,571`
- Exotiq Protect `$267`
- Total `$4,838`

Acceptance:

- Two-party billing is unmistakable.

### 4.7 Pay — Screen 07

Port from:

- `screen-pay.jsx`

Required:

- Title: `Pay securely`
- Subtitle: `Final step · Stripe handles the wire`
- Total due card.
- Apple Pay button.
- Card form visual shell.
- Save card toggle.
- `SCA verified · Secured by stripe`
- CTA: `Pay $4,838`

Implementation note:

- For scaffold, keep it mocked.
- Add comment/adapter boundary that real implementation must use Stripe Elements, not raw card collection.

### 4.8 Confirmation — Screen 08 / Variant E

Port from:

- `screen4.jsx` / `S4_E`

Required:

- Hero McLaren image.
- Confirmed badge.
- Title: `Your McLaren is reserved.`
- Booking ID.
- Details grid.
- Operator card.
- SMS confirmation line.
- `Share your Exotiq`.
- `Add to calendar`.
- Entry animation.

---

## Phase 5 — State Integration After Visual Parity

Goal: preserve visual design while reconnecting interactivity.

Do not let state logic distort the handoff.

### Integrate

- Continue/back navigation.
- Date range derived totals.
- Extras toggles.
- Protection selection.
- Driver upload/verification mock states.
- Review edit links.
- Mock payment success.
- Confirmation route.

### Avoid for now

- Real Supabase.
- Real Stripe.
- Real document upload.
- Real SMS.

---

## Phase 6 — QA and Review Loop

Goal: prove the scaffold is actually reviewable and close to design.

### Automated checks

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

### Browser checks

- Localhost `/preview`.
- Localhost direct booking route.
- Tunnel `/preview`, if tunnel is used.
- Mobile viewport.
- Console errors.
- End-to-end click-through.

### Visual checks

Compare side-by-side:

- Canonical bundle on port `4177`.
- Next app on port `3000`.

For each screen, rate:

- Layout parity.
- Typography parity.
- Color parity.
- Copy parity.
- Interaction parity.

### Independent review

Use a review agent after the visual port, but instruct it to compare against canonical source, not generic UI taste.

---

## Phase 7 — Preview Delivery

Goal: give Gregory a preview that opens correctly and feels intentional.

Preferred:

- Vercel preview deployment from branch.

Fallback:

- Tunnel direct `/preview` route.

Preview links should be sent as:

- `/preview`
- direct Vehicle route
- direct Booking route
- direct Confirmation route

Never send only the tunnel root URL unless `/` intentionally routes to preview.

---

## Questions for Gregory

1. For branch previews, should `/preview` be enough, or should `/` temporarily redirect to the booking flow?

Recommendation: use `/preview`, leave `/` unchanged.

2. Should the Vehicle screen be part of the primary review flow, or should `/preview` begin at Dates?

Recommendation: show both, but make Booking Flow the primary CTA.

3. Should we match canonical totals exactly even if the future backend pricing will differ?

Recommendation: yes for design parity; future backend can replace totals later.

4. Do you want a Vercel preview deployment instead of tunnels?

Recommendation: yes if credentials/deployment are available. It will avoid localtunnel/Cloudflare weirdness.

---

## Definition of Done for 8/10 Scaffold

- Preview opens reliably.
- Reviewer sees new Drive Exotiq flow immediately.
- All 8 screens visually resemble canonical design.
- Flow clicks through end-to-end.
- Build/test/lint pass.
- No real backend/Stripe/Supabase pollution.
- Existing homepage remains untouched unless Gregory chooses a preview redirect.
- Code remains lean enough to refine, not throw away.
