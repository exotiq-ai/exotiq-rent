# Drive Exotiq Frontend Polish Punch List

Generated from current scaffold review plus canonical `Drive Exotiq Booking Flow - Gold + Editorial Type.html` comparison.

## Overall

- Current: Scaffold now has the correct phone shell, route structure, gold/editorial direction, and end-to-end flow.
- Target: Bring visual density, copy, and interaction details closer to the canonical Claude Design handoff while preserving safer Stripe/mock-payment boundaries.
- Priority: high.

## Screen 01 Vehicle

- Current: Vehicle screen follows the selected dashboard direction and has route validation, phone shell, hero, metadata, specs, and CTA.
- Target: Match canonical `S1_D` more tightly: `01 / 08 Vehicle`, operator/price metadata, premium editorial title spacing, spec grid hierarchy, bottom CTA rhythm.
- Fix: Compare side-by-side in browser vision; adjust spacing/card density only after confirming exact visual deltas.
- Priority: medium.

## Screen 02 Dates

- Current: Screen title is `Select your dates.` and subcopy is `Three-day minimum. Pickup time is set before review.` Calendar works visually, but the canonical title is more conversational.
- Target: Canonical says `When are you driving?` with `3-day minimum · from $1,199/day`; month nav exists in canonical but scaffold is static.
- Fix: Update title/subcopy, consider adding non-functional previous/next month buttons if they improve fidelity without implying full date picker behavior. Keep CTA after pickup time and no overlap.
- Priority: high.

## Screen 03 Driver

- Current: Title is `Driver details.` with Gregory mock data; upload state works and Continue enables after insurance upload.
- Target: Canonical says `Who's driving?`, includes a clearer `Documents` section label, and uses more structured cards for verified vs upload states.
- Fix: Update title/subcopy and add a `Documents` label above upload cards. Consider separating data card rows closer to canonical.
- Priority: high.

## Screen 04 Extras

- Current: Title is `Curate the trip.` with good premium tone, default delivery selected, skip option, selected summary.
- Target: Canonical says `Add to your trip`; extras have operator-curated copy and slightly different prices.
- Fix: Decide whether to keep current premium copy or align exactly to canonical. If aligning, change title to `Add to your trip` and subcopy to `Optional · curated by the operator`.
- Priority: medium.

## Screen 05 Protect

- Current: Premium default-selected, standard available, decline demoted/warning style.
- Target: Canonical has `Self-cover · decline protection` with stronger warning. Product requirement says decline requires explicit warning/consent.
- Fix: Add a second consent state for decline protection. User should not proceed with decline after one casual tap.
- Priority: blocker for Phase 2.

## Screen 06 Review

- Current: Split billing is preserved: Operator charge and Exotiq Protect charge are separate. Total is clear.
- Target: Canonical `S3_C` has more detailed operator line items and stronger visual grouping. Current scaffold omits unlimited miles line item from canonical, but that may be good because totals are simpler.
- Fix: Keep two-party billing; improve card visual density and header copy to `Review your booking` if closer to canonical. Do not add fake/untested fees just to match visual totals.
- Priority: high.

## Screen 07 Pay

- Current: Safer than canonical: mocked/tokenized payment, no raw card fields, no fake card number/CVC. This intentionally diverges from canonical to respect Stripe/PCI boundary.
- Target: Keep restrained pay feel but add clearer split semantics: operator charge vs Exotiq Protect charge before pay. Avoid canonical raw-card visuals.
- Fix: Add a compact payment summary showing Operator and Exotiq Protect charges separately above the tokenized mock method.
- Priority: high.

## Screen 08 Confirmation

- Current: Confirmation is car-specific, split charges are visible, call operator link uses valid tel URL. But the component still uses `createInitialCart()` internally and is not loaded by booking ID.
- Target: Canonical confirmation payoff; future backend compatibility means confirmation should read from a mock confirmation adapter by `bookingId`.
- Fix: In Phase 3, move confirmation data loading into service layer. In Phase 2, only adjust visual spacing/copy if needed.
- Priority: medium for visual, high for Phase 3 backend shape.

## Shared Technical Polish

- Current: Build passes with warnings from old marketplace images, layout font link, and Newsreader override message.
- Target: Fewer noisy warnings if possible without restyling old marketplace.
- Fix: Investigate route-scoped next/font usage and avoid global changes. Leave old marketplace `<img>` warnings alone unless explicitly asked.
- Priority: medium.

## Interaction QA

- Current: End-to-end browser smoke works after ensuring only one server is bound to port 3000 and `.next` is clean.
- Target: Repeat smoke after each polish batch.
- Fix: Always kill stale port 3000 process, clear `.next`, start one server, curl routes, then browser-click through.
- Priority: high.
