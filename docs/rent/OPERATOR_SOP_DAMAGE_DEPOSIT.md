# Operator SOP — collecting the damage deposit

Operator-facing, written to be sent to tenants as-is. Reflects the FINAL
2026-07-26 decision (`DECISION_MEMO_DEPOSIT_HOLD.md`): Exotiq exited the deposit
entirely.

---

## Damage deposit — how it works on Drive Exotiq

**The deposit is yours, and Exotiq is not involved in it at all.** No hold, no
card on file, no link, no Stripe object on our side. You collect it directly
from the renter at pickup.

Exotiq collects the rental, our booking fee, and the protection plan at the time
of booking — all settled before you ever see the reservation. The deposit is the
only money you collect yourself.

### 1. Collect it at pickup, however you like

Card, cash, your own terminal — your call, your policy, your amount.

This was decided on operator feedback, and that was the deciding argument:
keeping the deposit offline means you are **not restricted to card-only**. Any
flow we mediated would have narrowed your options.

### 2. What the renter has already been told

Before they book, our checkout says:

> "{Your business} collects a refundable damage deposit at pickup. Amount and
> accepted payment methods vary by operator — they'll confirm before handoff."

We deliberately quote **no figure**, so you are free to set and vary your own,
and nothing we show can be argued back at you when your number differs. The same
line appears on their confirmation page.

### 3. Optional — run a card hold on your own Stripe account

If you'd rather authorize a card than take cash, the Command Center still has
**Place hold / Capture / Release** on the booking. That runs entirely on your own
connected Stripe account, and nothing in Exotiq depends on it.

If you use it: an authorization is good for about **7 days**, so place it at
pickup, not days ahead. Release promptly on return — a stale hold on a renter's
card is the single most common complaint in vehicle rental.

### 4. Setting a reference amount (optional)

Command Center → the vehicle → rate card → **deposit**, or a tenant-wide default
in Team Settings. This is **your reference only** — it tells your staff what to
ask for. It is not shown to renters and Exotiq never charges it.

### 5. If the renter can't cover the deposit

A decision to make at the counter, before you release keys — not something to
wave through.

- **Don't hand over a vehicle with no deposit in place.**
- A different card or payment method is usually the fix.
- If they genuinely can't cover it, note it on the booking and tell Exotiq
  support the same day. The renter has already paid the rental in full, so this
  needs handling rather than leaving — a renter who paid and got no car is a
  chargeback waiting to happen.

### What Exotiq has already charged

By the time you see a confirmed booking, the renter has paid:

- the full rental — transferred to you, appearing under **your own name** on
  their statement
- the Exotiq booking fee
- the Exotiq protection plan, if they bought one

**A renter with Exotiq protection still owes you a deposit if that's your
policy.** Protection covers damage liability; the deposit is your recourse at
the vehicle. If a renter pushes back, that's the distinction — and since the
amount is entirely yours, so is the decision to waive or reduce it.

---

## Notes for us (not for tenants)

- Renters are shown **no deposit figure anywhere**. `public_vehicle_quote`
  returns `deposit_cents = 0` and excludes it from `operator_total_cents` /
  `grand_total_cents`; the renter app renders a no-amount disclosure
  unconditionally (`DepositDisclosure`).
- `resolve_deposit_cents` and the tenant/vehicle deposit columns survive as
  **Command Center reference data only**.
- `stripe-create-deposit-setup-session` is deprecated and returns **410**. The
  `depositCardRequested` email and the `receiptConfirmed` deposit sentence are
  removed. Nothing emails a renter about a deposit.
- `stripe-create-hold` / `capture` / `release` remain as an optional operator
  tool. **Caveat before recommending them:** they hardcode
  `teams.stripe_account_id` instead of resolving through
  `teamConnectedAccountId(team, mode)`, so in sandbox they send a live account
  id with a test key and fail. Fix that before telling any tenant to use step 3.
- Deposit collection is the **operator's** responsibility. Worth stating
  explicitly in the operator agreement so a missed deposit is unambiguously
  their loss, not an Exotiq liability. **Legal to confirm.**
- Marketplace readiness still gates on `teams.deposit_source_confirmed_at`,
  which now guards a number Exotiq never uses. It is harmless but it is
  unnecessary onboarding friction — worth removing or repurposing.
