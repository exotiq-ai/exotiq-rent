# GOAL: Stripe Identity — ID Verification for Renters

**Written:** 2026-07-21. **Owner:** Gregory. **Executing agent:** goal-mode
sessions on this repo (renter UI) + `exotiq-spark-mvp-flow` (edge functions,
migrations) + Lovable (Command Center UI, migration apply).

**Status: BLOCKED ON DECISION REGISTER (§6).** Answer the questions, then
sessions execute phase by phase. Sandbox/test mode only until Gregory
explicitly approves live.

---

## 1. Why this exists (the TODO being resolved)

The Command Center's verification screen
(`exotiq-spark-mvp-flow/src/components/dashboard/VerificationSection.tsx`)
has ID upload **disabled** behind a feature flag with this note:

> `DPA §3.8: ID image uploads disabled on Lovable path. Re-enable via Stripe
> Identity / Persona integration.`

Meaning: government-ID images may not travel through or rest in the
Lovable-managed stack, per the data processing agreement. The renter app has
the same gap — the Driver step's license upload is a mock. **Stripe Identity
is the compliant path:** documents go browser → Stripe directly; our systems
store only statuses and references, never ID images.

Related but distinct: **insurance documents.** Stripe Identity does not
verify insurance. Insurance proof keeps its existing separate path (operator
upload today, renter upload in M5 via private bucket). This plan touches it
only to keep the two statuses side by side in the UI.

## 2. What we're building (architecture in one page)

Stripe Identity `VerificationSession` (type `document`, sandbox first), one
integration serving both surfaces:

```
Renter app (exotiq-rent)          Command Center (Lovable UI)
  Driver step "Verify ID"           "Send verification link" per customer
        │                                   │
        ▼                                   ▼
  identity-create-session  ◄── edge function (spark repo) ──►  creates/reuses
        │        VerificationSession, metadata {customer_id, booking_ref},
        │        idempotency key = customer reference
        ▼
  stripe.verifyIdentity(clientSecret)  → Stripe-hosted modal (renter) or
  hosted link via email (Command Center path)
        │
        ▼
  Stripe webhooks → identity-webhook (edge function, spark repo)
        verified / requires_input / processing / canceled / redacted
        │
        ▼
  customers table columns (status, session id, timestamps, expiry) 
        │                                   │
        ▼                                   ▼
  Renter app polls status RPC         VerificationSection reads columns
  ("Verified" pill goes green)        (badges flip without manual work)
```

Hard rules (inherit the goal brief, plus):

- **No ID images or ID numbers in our DB, storage, or logs — ever.** We
  store: session id, status, verified name, document expiry, timestamps.
  Images and extracted PII live in Stripe; staff view them in the Stripe
  dashboard.
- Client secrets are fetched per session, never logged, never in URLs.
- Webhook is the source of truth for status; the client redirect/modal
  result is UX-only.
- The renter app promise "documents deleted within 30 days of return" is
  honored via scheduled session **redaction** (V9).
- Test mode until Gregory approves live. Test-mode sessions verify with
  Stripe's simulated documents — no real IDs in sandbox.

## 3. Phases

### V0 — Stripe account setup (Gregory, one sitting, with agent guidance)

1. In the Stripe **sandbox** dashboard: enable Identity (Settings →
   Identity), accept the Identity terms, set the branding (Exotiq gold/black,
   logo) shown in the verification modal.
2. Confirm which Stripe account this runs on (V8) — expected: the platform
   account that already runs Connect/subscriptions.
3. No code. Exit gate: a test VerificationSession can be created from the
   dashboard ("Create test session") and completed with a simulated document.

### V1 — Backend plumbing (spark repo; agent builds, Lovable applies)

1. Migration (additive): `identity_verifications` table
   (`customer_id`, `stripe_verification_session_id`, `status`,
   `last_error_code`, `verified_name`, `document_expiry`, `created_at`,
   `verified_at`, `redacted_at`) + view/columns so `customers.id_verified`
   keeps working for the existing Command Center UI. RLS: team-scoped
   SELECT, no client INSERT/UPDATE (webhook-only via service role).
2. Edge functions: `identity-create-session` (authenticated: operator JWT or
   renter booking context; reuses open sessions; idempotency key per
   customer), `identity-webhook` (signature-verified; updates the table;
   handles all six event types), `identity-session-status` (safe polling
   endpoint returning status only).
3. Secrets: `STRIPE_SECRET_KEY` (sandbox) + new `STRIPE_IDENTITY_WEBHOOK_SECRET`.
4. Verified with Stripe CLI webhook replay + unit tests. Exit gate: session
   created → simulated verify → webhook flips the row, all in sandbox.

### V2 — Command Center surface (LOVABLE HANDOFF — §5)

Replace the disabled "Upload ID" button with "Verify ID via Stripe" (creates
session, emails/copies the hosted link), live status badges from the new
columns, "View in Stripe" deep link, and a manual-review state for
`requires_input`. Feature flag `idVerification` flips on.

### V3 — Renter app surface (this repo; agent builds)

Driver step: the license `UploadCard` becomes a **Verify your identity**
card → loads Stripe.js, calls `verifyIdentity(clientSecret)`, shows
processing state, polls `identity-session-status`, flips the pill to
Verified. Mock mode keeps the current one-tap simulation (demo unaffected —
no env, no Stripe). Failure shows `last_error.reason` with a retry (max per
V6). Insurance card unchanged.

### V4 — End-to-end sandbox test with `hello@exotiq.ai` (Gregory + agent)

The full loop, scripted in §7. Exit gate: one verification started in the
renter app and one started from the Command Center both land `verified`,
visible in **both** surfaces, with webhook (not polling) as the thing that
flipped them.

**After V4:** live-mode checklist (real keys, live webhook endpoint, Identity
terms on live account, pricing awareness — Stripe charges per verification)
sits parked until Gregory says "go live" in writing.

## 4. What each party owns

| Party | Owns |
|---|---|
| Gregory | V0 dashboard setup, decision register §6, sandbox test V4, live approval |
| Agent (this repo) | V3 renter UI, mock-mode preservation, tests |
| Agent (spark repo) | V1 migrations + three edge functions + webhook tests |
| Lovable | Applying the V1 migration (established path), V2 Command Center UI |

## 5. Lovable handoff (copy-paste when V1 merges)

> **Prompt A (migration apply):** Apply migration
> `<timestamp>_identity_verifications.sql` from repo main. It is additive:
> one new table + two nullable columns on `customers`
> (`identity_session_id`, `identity_status`). No data backfill. Do not
> modify RLS beyond what the file contains. Report applied/failed per your
> drift-report format.
>
> **Prompt B (Command Center UI):** In VerificationSection, replace the
> disabled "Upload ID" button (DPA §3.8 note) with a "Verify ID via Stripe"
> action calling the `identity-create-session` edge function and presenting
> the returned hosted verification URL (copy link + optional email send).
> Show status from `customers.identity_status`
> (`processing / verified / requires_input / redacted`) as badges matching
> the existing verified/partial/unverified design. Add "View in Stripe"
> linking to the session in the Stripe dashboard. Keep insurance upload
> exactly as is. Flip `idVerification` feature flag to enabled. **Do not
> add any ID image upload or storage — images stay in Stripe (DPA §3.8).**

## 6. Decision register — answer these to unblock (defaults pre-filled)

| # | Question | Recommended default |
|---|---|---|
| V1 | **When must a renter verify?** | At the Driver step during booking (before payment step is reachable). Operator can also trigger ad-hoc from Command Center for phone bookings. |
| V2 | **Document only, or document + selfie?** | Document + selfie for exotics (stronger match of person-to-ID; slightly higher per-verification cost and friction). |
| V3 | **Does verification gate booking confirmation?** | Yes — per D3 lifecycle, a booking sits in `pending_documents` until ID `verified` (+ insurance per V5). Demo/mock mode unaffected. |
| V4 | **What do we store in our DB?** | Status, session id, verified full name, document expiry date, timestamps. Nothing else — no images, no ID numbers, no DOB. Staff view detail in Stripe dashboard. |
| V5 | **Insurance handling unchanged?** | Yes — separate manual/upload path as today; this plan only shows the two statuses side by side. |
| V6 | **Failure policy?** | 2 self-serve retries on `requires_input`, then flag for manual review in Command Center; operator decides. |
| V7 | **Reuse across operators?** | Yes — a verified renter (matched by customer identity) stays verified marketplace-wide until document expiry; per-operator re-verification off. |
| V8 | **Which Stripe account?** | The existing platform account (same one running Connect + subscriptions), sandbox first. Renter verifications never live on operator connected accounts. |
| V9 | **Retention/redaction?** | Auto-redact the Stripe session 30 days after rental return (matches the promise already in the renter UI), immediate redaction on data-deletion requests (hooks into existing `confirm-data-deletion` flow). |
| V10 | **What is `hello@exotiq.ai` exactly?** | Assumed: your Command Center test/operator login AND the email used as the test renter. Confirm both roles (or tell me which), so the V4 script uses it correctly. |

## 7. The `hello@exotiq.ai` sandbox test script (V4)

1. **Renter side:** on the staging/live renter app in supabase mode, start a
   booking, enter `hello@exotiq.ai` as the driver email, tap Verify ID,
   complete the Stripe test-mode modal with **simulated success**. Watch the
   pill flip after webhook (~seconds in test mode).
2. **Command Center side:** log in as `hello@exotiq.ai`, open Verification,
   confirm the same customer shows **ID Verified** without a refresh fight;
   check `identity.verification_session.verified` arrived in the webhook log.
3. **Failure path:** second customer, simulated failure (expired document),
   confirm `requires_input` badge + renter-side retry copy.
4. **Cross-surface:** operator-initiated link for a third customer from the
   Command Center; complete it on a phone; confirm status lands in both apps.
5. Record results in this file under a "Test log" heading; screenshots into
   the PR.

## 8. Risks and flags

- **Stripe Identity is priced per verification** (live mode). V2 selfie adds
  cost. Sandbox is free — test freely.
- Guest checkout (D6) means renter sessions are keyed to `customers` rows,
  not auth users; the create-session function must resolve/create the
  customer server-side and never trust a client-supplied `customer_id` for
  an existing verified identity (impersonation risk — it must re-derive by
  email + booking context).
- The M5 `renter-upload-document` plan (insurance) and this plan both touch
  the Driver step — sequence V3 before M5's insurance upload to avoid rework.
- Cutover note: `identity_verifications` is an additive repo migration, so
  it replays onto the new Supabase project automatically — no special
  cutover handling.
