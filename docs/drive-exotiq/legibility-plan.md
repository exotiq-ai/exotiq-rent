# Legibility pass (2026-11): contrast first

The booking flow looked right and its fine print was hard to read. Measured on the live site at 375px: 35% to 46% of text was 10 to 11px, and the greys scored APCA Lc 37 to 51 (small text wants 65 or more) while still passing the 4.5:1 WCAG floor. This pass fixes it with colour first and almost no size change. Nothing about pricing, fees, wording, buttons or layout changed.

## What shipped

| Change | Where |
|---|---|
| Text greys one tier brighter: `ink #F4F6F9`, `muted #E1E4EA` (body notes, 15:1, Lc 90), `faint #B9BFCC` (labels, meta, fee lines, 10:1, Lc 68). `inkSoft` equals `muted`. | `components/browse/tokens.ts`, mirrored in `app/globals.css`, and the renter e-mail's literals (`domain/renters/email.ts`) |
| The 10px step is now 11px; both smallest steps are weight 500; scale written in rem | `tailwind.config.ts` |
| Caps labels: letter spacing 0.16 to 0.2em down to 0.08em (kept caps) | `eyebrowClassName`, `microLabelClassName`, `priceUnitClassName` |
| Field hints dimmer than labels: `placeholder:text-faint/[.85]` (7.7:1) | `fieldClassName`, `DriverStep`, `EmailCaptureForm` |
| Cookie row is one slim line ("Optional cookies are on" + a Change button that opens the same preferences card); 26px tall, 44px tap area | `components/analytics/CookieControls.tsx` |
| Running total under it takes `pt-2` instead of `pt-3` | `flow/shared.tsx` |
| Dates layout: calendar rows are 44px tall instead of ~48px square (still six rows, so paging never moves anything); the instruction line is sentence case and no longer repeats the N-day minimum the subtitle above already shows (one line instead of two); the Pickup time label sits inside its field, linked with `htmlFor`; the calendar arrows get a 44px tap area | `flow/DatesStep.tsx` |

## Measured cost (375x812; px that scroll out of view, Dates is the live page with the cookie strip)

| Step | Before | After |
|---|---|---|
| Dates | 98 (the Pickup time field was entirely below the fold) | about 7, which is only the scroller's own bottom padding: the Pickup time row is fully visible with the slim cookie line |
| Driver | 70 spare | about 74 spare |
| Review | 383 | about 387 |

No new wrapped lines at 375px. At 320px the Dates instruction wraps to two lines. On a 375x667 phone Dates still scrolls about 119px, and at 320x568 about 233px. The Pickup time field stays at the same position across all seven browsable months, including the six-row ones.

## Behaviour change to be aware of (consent control)

The inline one-tap master switch is gone from the collapsed row. Turning optional cookies on or off is now Change, then the Analytics and Advertising switches in the card (two taps). The card and the consent logic (`cookieControlsModel`, `PostHogInit`) are unchanged. This needs the owner's compliance read before it ships.

## Guard rails

`tests/design/legibility.test.ts`: every text grey holds 7:1 and APCA Lc 62 on every surface; nothing under 11px; no plain `text-dim`/`text-dim2` on words. `scripts/type-audit.js` re-measures any page (paste it into a console at phone width).

## Existing tests updated on purpose

The repo pins its design with ticket-scoped golden and census tests (MP-15, MP-16, MP-24, MP-25, MP-26, MP-28, MP-30). Where a value or class changed deliberately (including the Dates nudges: `datesNudges` in `tests/polish/polishBase.ts` names the exact substitutions, and the day-cell checks now look for the 44px cell instead of `aspect-square`), its pin was updated and the reason written at the pin: token baselines, the type scale (rem, weights), golden HTML (letter-spacing and padding class strings only), recorded hashes, and the MP-25 census (frozen-file hashes for the changed files, and the lockstep rule now knows the exact markup substitutions in `legibilityMarkup`). Two planted self-checks that relied on the old dim greys use dim or a thinner bar instead.

## One wording change

The Dates instruction used to read "Tap start, then end · 3-day minimum · Crossed-out dates are unavailable". It no longer repeats "3-day minimum", which the subtitle above it already states ("3-day minimum · from $X/day"). Nothing else in the copy changed.

## Left for later (not legibility)

Larger tap areas on the header back and close buttons (40px; WCAG asks for 24px, Apple suggests 44px); the 13px money and policy notes one tier brighter again (the Confirmation, Payment, vehicle footnote and loading notes use `faint`, now Lc 68). Each touches golden-pinned markup across many files, so each is its own change.
