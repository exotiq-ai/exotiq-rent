# Live canaries — renter flow + Stripe config

Decision (2026-08-01, go-live night): automated tests against production stop
**one step short of the card**. Recurring automated real-money charges were
rejected — repeated authorize/refund cycles look like card-testing fraud to
Stripe Radar and issuing banks (worst possible signature for a days-old live
account), refunds don't return processing fees, and every run would pollute
real ledgers, operator statements, and availability calendars. Real-money
smoke tests stay **manual and rare**: a human enters the card, and the
downstream verification (both payment legs, fee split, webhook rows, refund)
is done live against Stripe.

Two canaries run daily at 08:00 Phoenix via `.github/workflows/canary.yml`;
a red run emails the repo watchers.

## 1. Renter flow (`scripts/canary/renter-canary.ts`)

Exercises the real production path with no payment: storefront + fleet reads,
a premium-protection quote with every money invariant asserted (four-component
Exotiq leg, grand-total composition, platform-fee percent, per-day state fee,
`deposit_cents == 0`, and server premium rate == the UI's advertised rate via
a direct import of `domain/booking/totals`), then a real booking request →
token-authorized read-back (snapshot total == quoted total) → immediate
cancellation. Cancellation runs in a `finally`, so the worst a broken run
leaves behind is one `requested` booking from driver **"Exotiq Canary —
automated check"** (`canary@exotiq.ai`) to decline in the Command Center.

Expected Command Center noise per run: one booking request + one cancellation,
both canary-named. If that gets annoying, the clean fix is Lovable-side
notification suppression for `canary@exotiq.ai` — not turning the canary off.

Needs only public config (Supabase URL, anon key — the same values shipped in
every browser bundle), so the job has no secrets.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://jlgwbbqydjeokypoenoc.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> \
bun scripts/canary/renter-canary.ts
```

## 2. Stripe live config (`scripts/canary/stripe-live-monitor.ts`)

Read-only drift detection against the live Stripe account: the four webhook
endpoints created 2026-08-01 exist, are **enabled** (Stripe silently
auto-disables endpoints whose deliveries keep failing — how the sandbox
webhook died for ten days), and carry their expected events; **no unexpected
endpoint targets our function URLs** (a duplicate means double delivery where
one copy can never verify — cleaned up once already on go-live night); the
four subscription prices are active; an active billing-portal configuration
exists.

### One-time setup (owner)

1. Live Stripe dashboard → Developers → API keys → **Create restricted key**,
   read-only: Core resources **Read**, Webhook Endpoints **Read**, Billing
   **Read**, Connect **Read**. Nothing else — a leaked read-only key can't
   move money or change config.
2. GitHub → `exotiq-ai/exotiq-rent` → Settings → Secrets and variables →
   Actions → new secret **`STRIPE_MONITOR_KEY`** = that `rk_live_…` key.

Until the secret exists the job exits green with a notice, so enabling it
later is zero-friction.

## What is deliberately NOT covered, and where it lives instead

- **Card entry / payment completion / webhook-to-confirmed flip** — sandbox
  E2E with test cards (manual today; automation candidate once a sandbox
  renter build target exists again post-flip), plus rare manual live smoke
  tests per `docs/payments/STRIPE_LIVE_CUTOVER_RUNBOOK.md` Phase 5.
- **Operator approval → `rent-checkout` session creation** — needs an
  operator credential, which this canary deliberately does not hold. Upgrade
  path: a Command-Center service account scoped to a canary tenant; the
  canary would then approve its own booking, call `rent-checkout`, assert the
  Checkout Session's destination-charge shape and four-component Exotiq leg,
  and cancel — still no card. Requires owner sign-off on the credential.
- **`stripe_webhook_events` freshness by consumer** — needs DB access this
  repo doesn't hold (standing rule: no direct Supabase access from agents).
  Endpoint `status == enabled` is the API-visible proxy; Stripe also emails
  on sustained failures.
