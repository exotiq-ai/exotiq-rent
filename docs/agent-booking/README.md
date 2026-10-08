# Exotiq agent booking — paired frontend

This branch contains the integrated Next customer sign-in, explicit quote consent, account/status, renewal and identity/payment handoff work. The backend API and renter MCP live in the paired repository.

**Start with the [shared Claude continuation package](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/blob/codex/agent-booking-backend/docs/agent-booking/README.md)** and [full handoff](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/blob/codex/agent-booking-backend/docs/agent-booking/handoff.md).

| Repository | Branch |
|---|---|
| `exotiq-ai/exotiq-spark-mvp-flow` | `codex/agent-booking-backend` |
| `exotiq-ai/exotiq-rent` | `codex/agent-booking-frontend` |

Tested frontend implementation commit: `3411a4e49901441553e23772a829d4386067144b`. Fresh October 8 evidence: 673 frontend tests passed, 20 skipped, 12 actual local Next/Chromium cases passed, typecheck and exact generated-contract provenance passed. API/provider services in the browser suite are synthetic; no hosted confirmed booking or real named-agent acceptance is established.

The proposed immediate rehearsal is a real Exotiq Scottsdale demo request and inventory hold, observable in the operator system, before payment/Stripe Identity completion. Its target and exact acceptance state still require review. `exotiq-migration-staging` is reserved for migration. Current code does not promise 48 hours pending payment from initial submission, and the public demo may use mock data. Confirm bindings rather than treating a rendered success screen as a persisted booking.

The shared package includes plans, test summaries/evidence, Supabase investigation assignments, operational questions and the rehearsal procedure. Fetch/reconcile current branches before merge; the backend has concurrent `main` changes requiring explicit integration. Publication does not authorize deployment or hosted writes.
