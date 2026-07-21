# V1 backend plumbing — apply instructions (spark repo)

**Why this is a patch directory:** this session cannot push to
`exotiq-ai/exotiq-spark-mvp-flow` (`cursor[bot]` 403 — same access gap as the
original goal-brief blocker 1, in reverse). Per the established fallback,
the finished V1 work ships here, in the writable repo, with apply steps.
A spark-repo cloud agent (or Gregory locally) applies it in minutes.

## Contents

```
supabase/migrations/20260721180000_identity_verifications.sql
supabase/functions/identity-create-session/index.ts
supabase/functions/identity-webhook/index.ts
supabase/functions/identity-session-status/index.ts
```

## Apply steps (spark repo, one branch + PR)

1. Copy the four files into the same paths in `exotiq-spark-mvp-flow`.
2. Add to `supabase/config.toml`:

   ```toml
   [functions.identity-webhook]
   verify_jwt = false   # Stripe calls it; the signature is the auth

   [functions.identity-session-status]
   verify_jwt = false   # guest renters poll it; returns status only
   ```

3. Secrets (Supabase dashboard → Edge Functions → secrets): confirm
   `STRIPE_SECRET_KEY` (sandbox key) exists; add
   `STRIPE_IDENTITY_WEBHOOK_SECRET` after step 5.
4. Open PR; on merge, functions deploy via the established repo sync; the
   migration goes to Lovable with Prompt A
   (`exotiq-rent/docs/rent/ID_VERIFICATION_PLAN.md` §5).
5. In the Stripe sandbox dashboard → Developers → Webhooks: add an endpoint
   for `https://<project>.supabase.co/functions/v1/identity-webhook`
   subscribed to the five `identity.verification_session.*` events
   (`processing`, `verified`, `requires_input`, `canceled`, and — explicitly,
   it is not in the wildcard — `redacted`). Copy the signing secret into
   `STRIPE_IDENTITY_WEBHOOK_SECRET`.
6. Smoke: `stripe trigger identity.verification_session.verified` (Stripe
   CLI, test mode) or a dashboard-created test session; confirm the
   `identity_verifications` row + `customers.identity_status` flip.

## Design notes for the reviewing agent

- Writes are service-role only (no INSERT/UPDATE RLS policies on the ledger).
- The guest path re-derives the customer by email; client-supplied
  `customer_id` is only honored for authenticated team members of that
  customer's team (plan §8 impersonation note).
- V4 storage minimization: only `verified_name` + `document_expiry` are
  copied out of Stripe; the webhook never touches images, DOB, or ID numbers.
- 3rd failed attempt (V6) flips to `manual_review` and inserts Command
  Center notifications for the customer's team members.
- `customers.id_verified` / `id_verified_at` are also set on verified so the
  existing VerificationSection keeps working before the V2 UI rework.
