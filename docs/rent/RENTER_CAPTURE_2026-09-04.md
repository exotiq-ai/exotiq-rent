# Renter capture (MP-14) — runbook

**What it is.** Low-effort signup without accounts: a renter is an e-mail address with recorded consent, plus the things they asked for (a saved-cars list, an availability alert, first looks at new cars). Owner decision 2026-09-04: Exotiq marketplace owns customer data and marketing; membership/accounts are tabled.

**Where the data lives.** A separate, Exotiq-owned Supabase project **`exotiq-renters`** (ref `jnnryvujxbkxkncwyftg`, org `rgorxhqmvldzecemduqi`, us-west-1). Never the tenant command center's database. Schema: `supabase/migrations/20260904200000_renters.sql` (tables `renters`, `saved_cars`, `availability_alerts`, `capture_events`, `email_log`). RLS is on with no policies and anon/authenticated are revoked outright; only the service role (server-side route handlers and the daily function) can read or write.

**E-mail.** Resend, from `RENTERS_FROM_EMAIL` (verified senders on the account: `driveexotiq.com`, `exotiq.rent`; `exotiq.ai` is not verified). Double opt-in: nothing but the confirmation link goes out until `confirmed_at` is set; a booking made with the address counts as confirmation. Every message carries an unsubscribe link (HMAC-derived per renter, no lookup) that turns off marketing and cancels alerts.

## Environment (per Netlify site)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_RENTER_CAPTURE=on` | Renders the heart, forms, consent line, `/saved`, landing pages. Off = none of it exists. |
| `RENTERS_SUPABASE_URL` | `https://jnnryvujxbkxkncwyftg.supabase.co` |
| `RENTERS_SUPABASE_SERVICE_ROLE_KEY` | Server only. |
| `RESEND_API_KEY` | Server only. |
| `RENTERS_TOKEN_SECRET` | Random 32+ bytes. Rotating it invalidates every old unsubscribe link. |
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

- **Daily alerts:** `netlify/functions/availability-alerts.mts`, 15:00 UTC. Reads `public_fleet_busy` per (operator, window), e-mails once, expires past windows. Logs `alerts=N notified=N expired=N`.
- **Export the list:** service role, `select email, name, marketing_consent, consented_at, consent_source, confirmed_at, unsubscribed_at from renters where marketing_consent and confirmed_at is not null and unsubscribed_at is null`.
- **Delete a person:** `delete from renters where email = '…'` (cascades to saved cars and alerts).
- **Legal:** the privacy page describes this section only when the flag is on. Before any marketing send beyond the requested e-mails, set `RENTERS_POSTAL_ADDRESS` and confirm the T&C/privacy text (T-1).
