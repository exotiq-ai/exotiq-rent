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

## Measured cost (375x812; px that scroll out of view, Dates is the live page with the cookie strip)

| Step | Before | After |
|---|---|---|
| Dates | 98 | about 79 with the slim line (strip 59px to 33px) |
| Driver | 70 spare | about 74 spare |
| Review | 383 | about 387 |

No new wrapped lines on any step.

## Behaviour change to be aware of (consent control)

The inline one-tap master switch is gone from the collapsed row. Turning optional cookies on or off is now Change, then the Analytics and Advertising switches in the card (two taps). The card and the consent logic (`cookieControlsModel`, `PostHogInit`) are unchanged. This needs the owner's compliance read before it ships.

## Guard rails

`tests/design/legibility.test.ts`: every text grey holds 7:1 and APCA Lc 62 on every surface; nothing under 11px; no plain `text-dim`/`text-dim2` on words. `scripts/type-audit.js` re-measures any page (paste it into a console at phone width).

## Existing tests updated on purpose

The repo pins its design with ticket-scoped golden and census tests (MP-15, MP-16, MP-24, MP-25, MP-26, MP-28, MP-30). Where a value or class changed deliberately, its pin was updated and the reason written at the pin: token baselines, the type scale (rem, weights), golden HTML (letter-spacing and padding class strings only), recorded hashes, and the MP-25 census (frozen-file hashes for the changed files, and the lockstep rule now knows the exact markup substitutions in `legibilityMarkup`). Two planted self-checks that relied on the old dim greys use dim or a thinner bar instead.

## Left for later (not legibility)

Larger tap areas on the calendar arrows (32px) and header buttons (40px); the Confirmation money notes one tier brighter again (they use `faint`, now Lc 68); the optional Dates layout nudges (shorter calendar rows, the instruction folded into the subtitle, a compact Pickup time). Each touches golden-pinned markup, so each is its own change.
