# GOAL: Stripe Identity — ID Verification for Renters

**Written:** 2026-07-21. **Owner:** Gregory. **Executing agent:** goal-mode
sessions on this repo (renter UI) + `exotiq-spark-mvp-flow` (edge functions,
migrations) + Lovable (Command Center UI, migration apply).

**Status (2026-07-21 evening): V1 BUILT AND APPLIED** — decisions V1–V10
recorded in §6; backend plumbing landed in `exotiq-spark-mvp-flow` PR #24
(from the patch set in `docs/rent/patches/idv/`, plus an `is_active`
team-member drift fix made there; 6/6 behavioral RLS tests green). **V3
renter UI done in mock mode** (exotiq-rent PR #9, stacked on #6). Remaining:
merge spark PR #24 → Stripe webhook endpoint + `STRIPE_IDENTITY_WEBHOOK_SECRET`
→ Lovable Prompts A/B (§5) → live-mode facade wiring in exotiq-rent → V4
sandbox test (§7). Sandbox/test mode only until Gregory explicitly approves
live.

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

Stripe Identity `VerificationSession` (type `document` + matching selfie,
sandbox first), one integration serving both surfaces.

**Placement (V1 ruling): verification happens AFTER payment, as the final
step that confirms the booking.** Pay → Confirmation screen immediately
prompts "Verify your identity" → booking sits in `pending_documents` until
`verified` → then it moves to confirmed/operator approval. A returning
already-verified renter (V7) skips the step entirely. Safeguards that make
post-payment placement safe:

- The deposit hold is only placed **after** verification succeeds.
- Unverified after 24h → reminder email to renter + notification to the
  operator in the Command Center.
- 3 failed self-serve attempts (V6) → manual review flag + operator
  notification; cancellation/refund per the 72h policy if it can't be
  resolved. Payment is never blocked by verification issues — worst case is
  a clean refund, not a lost checkout.

```
Renter app (exotiq-rent)          Command Center (Lovable UI)
  Confirmation "Verify ID"          "Send verification link" per customer
  (post-payment, per V1)
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

### V0 — Stripe account setup (Gregory — MOSTLY DONE 2026-07-21)

1. ~~Enable Identity in the Stripe sandbox~~ **done** (platform account, V8).
2. Remaining: set the Identity **branding** (Exotiq gold/black + logo) shown
   in the verification modal, and confirm a dashboard-created test session
   completes with a simulated document.
3. Exit gate: test session verified from the dashboard.

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

Per the V1 ruling, verification lives **after payment**:

1. **Confirmation screen** gains a "Confirm your booking — verify your
   identity" card (gold, first position, above the charges): loads
   Stripe.js, calls `verifyIdentity(clientSecret)`, shows processing state,
   polls `identity-session-status`, then flips the booking header from
   "Pending verification" to "Confirmed". Already-verified returning renters
   (V7) see the Verified state immediately and no prompt.
2. **Driver step** stops implying license upload in live mode: the license
   card becomes an informational "You'll verify your ID right after booking
   — have it ready" note; insurance card unchanged (V5). Mock/demo mode
   keeps today's one-tap simulation end to end — no env, no Stripe, demo
   unaffected.
3. Failure UX: `last_error.reason` shown with retry, max 3 attempts (V6),
   then "We're reviewing your booking — the operator has been notified."
4. Copy: replace the "deleted within 30 days" line with the V9 wording
   (§6a).

### V4 — End-to-end sandbox test (Gregory + agent; accounts per V10)

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
> linking to the session in the Stripe dashboard. Add a team notification
> when a customer's verification enters manual review (3 failed attempts,
> webhook sets the flag) and when a booking is unverified 24h after
> payment. Keep insurance upload exactly as is. Flip `idVerification`
> feature flag to enabled. **Do not add any ID image upload or storage —
> images stay in Stripe (DPA §3.8).**

## 6. Decision register — ANSWERED (Gregory, 2026-07-21, in-chat)

| # | Question | Decision |
|---|---|---|
| V1 | When must a renter verify? | **After payment, as the last step — verification confirms the booking, never blocks the checkout.** Shape in §2: `pending_documents` after pay, deposit hold only after verified, reminder at 24h, refund path if unresolvable. Operator can still trigger ad-hoc links from the Command Center. |
| V2 | Document only, or + selfie? | **Document + selfie, all inside Stripe's system.** No image ever touches Exotiq/Lovable infrastructure. |
| V3 | Does verification gate booking confirmation? | **Yes** — `pending_documents` until verified (D3 lifecycle). |
| V4 | What do we store in our DB? | **Status, session id, verified full name, document expiry, timestamps — nothing else.** Staff view detail in the Stripe dashboard. |
| V5 | Insurance handling unchanged? | **Yes** — separate path as today. |
| V6 | Failure policy? | **3 self-serve retries**, then manual-review flag **with a notification to the operator (tenant) in the Command Center**. |
| V7 | Reuse across operators? | **Yes, marketplace-wide, "if compliantly done correctly":** the verification belongs to the Exotiq platform (renters verify with Exotiq, not with an operator), only the status/name/expiry is shared with operators — never documents. Expired document forces re-verification (V9). |
| V8 | Which Stripe account? | **Existing platform account, sandbox first.** |
| V9 | Retention/redaction? | **Recommended policy accepted-in-principle, final copy pending (§6a):** our status row lives until document expiry (return customers stay verified, no 30-day cliff); the Stripe session (images/PII) is redacted at document expiry or 12 months after verification, whichever is first, and immediately on a data-deletion request. Renter UI copy to be updated to match (the current "deleted within 30 days" line predates this design). |
| V10 | What is `hello@exotiq.ai`? | **The Command Center demo account (and the Exotiq Stripe login).** The demo **customer** for testing is **Gregory, `gregory.ringler@gmail.com`**, already in the Command Center DB. Test script (§7) updated. |

### 6a. V9 retention rationale (for the privacy policy and renter copy)

Stripe imposes no 30-day limit; redaction timing is the platform's call under
its own privacy policy, with two hard edges from Stripe's side: **biometric
identifiers (the selfie check) are retained by Stripe no longer than 1 year**
regardless, and redaction is irreversible, takes up to 4 days, and wipes the
session, reports, events, and files. Hence the recommendation: **redact at
document expiry or 12 months post-verification (whichever first)** — inside
Stripe's biometric ceiling, long enough for disputes and damage claims, and
return customers within the window stay verified because *our status row*,
not the stored images, is what gates booking. Renter-facing copy for V3:
"Identity documents are processed and stored securely by Stripe, our
verification partner — Exotiq never stores your ID. Verified status lasts
until your document expires." Gregory approves final wording with the
decline-terms legal pass (Phase 1 of the launch checklist).

## 7. Sandbox test script (V4)

Accounts (per V10): **operator/tenant login = `hello@exotiq.ai`** (Command
Center demo account; also the Exotiq Stripe login); **demo customer =
Gregory, `gregory.ringler@gmail.com`** (already in the Command Center DB).

1. **Renter side:** on the staging renter app in supabase mode, complete a
   booking through payment with `gregory.ringler@gmail.com` as the driver
   email; on the confirmation screen tap **Verify your identity**, complete
   the Stripe test-mode modal with **simulated success**. Watch the booking
   flip from "Pending verification" to "Confirmed" after the webhook
   (~seconds in test mode).
2. **Command Center side:** log in as `hello@exotiq.ai`, open Verification,
   confirm the Gregory customer shows **ID Verified** without manual
   refresh; check `identity.verification_session.verified` in the webhook
   log (Stripe dashboard → Developers → Events).
3. **Failure path:** second test customer, simulated failure (expired
   document) three times; confirm `requires_input` badge, renter-side retry
   copy, and the manual-review notification reaching the `hello@exotiq.ai`
   tenant (V6).
4. **Cross-surface:** operator-initiated link for a third customer from the
   Command Center; complete it on a phone; confirm status lands in both apps.
5. **Reuse check (V7):** start a second booking as
   `gregory.ringler@gmail.com` with a different operator's vehicle; confirm
   no verification prompt appears and the booking confirms directly.
6. Record results in this file under a "Test log" heading; screenshots into
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
