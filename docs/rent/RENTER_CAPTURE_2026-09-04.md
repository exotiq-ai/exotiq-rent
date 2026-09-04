# Renter capture (MP-14) — runbook

**What it is.** Low-effort signup without accounts: a renter is an e-mail address with recorded consent, plus the things they asked for (a saved-cars list, an availability alert, first looks at new cars). Owner decision 2026-09-04: Exotiq marketplace owns customer data and marketing; membership/accounts are tabled.

**Where the data lives.** A separate, Exotiq-owned Supabase project **`exotiq-renters`** (ref `jnnryvujxbkxkncwyftg`, org `rgorxhqmvldzecemduqi`, us-west-1). Never the tenant command center's database. Schema: `supabase/migrations/20260904200000_renters.sql`, `20260904230000_renters_review.sql`, `20260905000000_renters_round3.sql` (tables `renters`, `saved_cars`, `availability_alerts`, `capture_events`, `email_log`). RLS is on with no policies and anon/authenticated are revoked outright; only the service role (server-side route handlers and the daily function) can read or write.

**E-mail.** Resend, from `RENTERS_FROM_EMAIL` (verified senders on the account: `driveexotiq.com`, `exotiq.rent`; `exotiq.ai` is not verified). Double opt-in: nothing but the confirmation link goes out until `confirmed_at` is set; a booking counts as confirmation only when the tenant DB verifies the booking reference **and its confirmation token** (`public_booking_by_ref` returns `authorized`). Every message carries an unsubscribe link (HMAC-derived per renter, no lookup; verified against `RENTERS_TOKEN_SECRET` then `RENTERS_TOKEN_SECRET_PREVIOUS`) plus RFC 8058 `List-Unsubscribe` headers. Unsubscribing turns marketing off, pauses alerts (`alerts_paused_at`), cancels active alerts and retires any pending confirmation link. Both links land on a page with a button; the write happens on POST only, so mail scanners that follow links change nothing.

**Consent model (review rounds 2026-09-04).** Every pending confirmation link carries a SCOPE (`confirm_scope`: address, list, alert, consent) and a seven-day life; the click applies exactly that scope, and the confirm page states it. A booking proves the address only once `public_booking_by_ref` returns `customer_email_hash` (handoff `LOVABLE_HANDOFF_BOOKING_EMAIL_HASH_2026-09-04.md`); until then bookings take the click path.

**Consent model detail.** A bare POST never turns `marketing_consent` on: it records `consent_requested_at` + `consent_source` + `consent_text_version` (see `domain/renters/consentText.ts`) + keyed IP hash + user agent, and the confirmation click applies it (`consented_at`). The one exception is a token-verified booking with the box ticked. Unsubscribed addresses need a fresh click before anything but the confirmation goes out again.

**Abuse limits.** Per connection: 30 capture events / 10 min (keyed IP hash on `capture_events`). Per address: 6 / 10 min. Confirmation e-mails: one per 10 min, five per day per address (one per day for a paused/unsubscribed address). Saved-list and alert-set e-mails: one per hour per address. Active alerts: five per renter; identical active alerts are ignored; alerts of addresses still unconfirmed, or paused by an unsubscribe, after 7 days are expired by the daily job; a click whose link did not name alerts cancels any un-clicked alerts on that address. Route returns 429 with renter-facing copy when a limit is hit, 502 `mail_failed` when Resend refuses (the form says so instead of "Done.").

## Environment (per Netlify site)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_RENTER_CAPTURE=on` | Renders the heart, forms, consent line, `/saved`, landing pages. Off = none of it exists. |
| `RENTERS_SUPABASE_URL` | `https://jnnryvujxbkxkncwyftg.supabase.co` |
| `RENTERS_SUPABASE_SERVICE_ROLE_KEY` | Server only. |
| `RESEND_API_KEY` | Server only. |
| `RENTERS_TOKEN_SECRET` | Random 32+ bytes behind unsubscribe links and the IP evidence key. |
| `RENTERS_TOKEN_SECRET_PREVIOUS` | Set to the old value for ≥30 days after rotating the secret so delivered unsubscribe links keep working (CAN-SPAM). |
| `RENTERS_FROM_EMAIL` | e.g. `Drive Exotiq <hello@exotiq.rent>` |
| `RENTERS_REPLY_TO` | default `hello@exotiq.ai` |
| `RENTERS_POSTAL_ADDRESS` | Printed in the e-mail footer once set (CAN-SPAM for marketing sends). |

Local copies of the secrets: `~/.exotiq/renters.env` (chmod 600). Route handlers return 503 when any server variable is missing; the UI flag alone shows controls that then fail politely.

## Surfaces

- Heart on every card and the vehicle page → `localStorage` (`dx.saved.v1`) → `/saved` → "E-mail me this list" (`source: save_list`).
- "Tell me when it's free" on the dates-empty states (browse: any car; storefront: that operator) and in the booking calendar when the chosen range crosses a blocked day (`source: alert`).
- Consent checkbox at the Review step (unchecked) → posted with the booking reference when the booking is created (`source: booking`); never blocks the booking.
- Footer line "First look at new cars" (`source: footer`, consent implied by the action).

## Operations

- **Daily alerts:** `netlify/functions/availability-alerts.mts`, 15:00 UTC. Candidates: the operator's own storefront fleet for operator/car alerts (storefronts exist for tenants outside the marketplace), the marketplace fleet for "any car"; a candidate must have a public hero and a minimum stay that fits the window (the grid's rules). Reads `public_fleet_busy` per (operator, window), claims the row (`notifying`) before sending so a retry cannot double-send, e-mails once, expires past windows and week-old unconfirmed alerts. Logs `alerts=N notified=N expired=N released=N expiredPast=N expiredUnconfirmed=N expiredTokens=N purged=N`.
- **Retention (runs inside the daily job, 15:00 UTC — check the function is deployed on the production site once the flag goes on there):** seven-day-old confirmation links are dropped; addresses that never confirmed are deleted after 30 days (rows holding a live link are spared until it expires); week-old alerts of unconfirmed or paused addresses are expired.
- **Export the list:** service role, `select email, name, marketing_consent, consented_at, consent_source, confirmed_at, unsubscribed_at from renters where marketing_consent and confirmed_at is not null and unsubscribed_at is null`.
- **Manual unsubscribe (mailto or e-mail request), within 10 business days — owner: hello@exotiq.ai mailbox:** `update renters set marketing_consent=false, unsubscribed_at=now(), alerts_paused_at=now(), consent_requested_at=null, confirm_token_hash=null, confirm_scope=null where email='…'; update availability_alerts set status='cancelled' where renter_id=(select id from renters where email='…') and status in ('active','notifying'); insert into capture_events (renter_id, kind, meta) select id, 'unsubscribed', '{"manual":true}' from renters where email='…';` (the event row is the dated record that the opt-out was honoured).
- **Delete a person:** `delete from renters where email = '…'` (cascades to saved cars, alerts, capture events and the e-mail log). Resend keeps its own delivery logs: purge the address there too (Resend dashboard → Logs) when honouring a deletion.
- **Legal:** the privacy page describes this section only when the flag is on. Before any marketing send beyond the requested e-mails, set `RENTERS_POSTAL_ADDRESS` and confirm the T&C/privacy text (T-1).
