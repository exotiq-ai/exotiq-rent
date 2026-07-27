# Operator SOP — collecting the damage deposit

Renter-facing wording is already live in checkout; this is the operator-facing
version, written to be sent to tenants as-is.

---

## Damage deposit — how it works on Drive Exotiq

The deposit is yours. It's authorized on **your** Stripe account, it never
passes through Exotiq, and you set the amount. Exotiq collects the rental, our
booking fee, and the protection plan at the time of booking — all settled
before you see the reservation. The deposit is the only money you collect
directly.

### 1. Set your amount

Command Center → the vehicle → rate card → **deposit**. Leave it blank to use
your tenant-wide default. Whatever you set is shown to the renter *before* they
book, so there are no surprises at handoff.

Set this on every vehicle you list. A blank deposit with no tenant default
falls back to a $1,000 platform floor, which is not what you want on a
six-figure car.

### 2. Get a card on file

**Normally you'll do this at pickup, in person** — same as any rental counter.

Two ways, both landing the card on *your* Stripe account:

- **At the counter (default):** open the booking → **Request card**. The renter
  gets a secure Stripe link and completes it on their own phone in about 30
  seconds. Your staff never touch the card number.
- **Ahead of time (optional):** send the same **Request card** link earlier if
  you'd rather know before you prep the vehicle. Useful on high-value cars.

Nothing is charged at this step. You'll see the card appear against the booking.

Why not at time of booking: a card authorization is only good for about
**7 days**, so a hold placed weeks ahead lapses before pickup. The card can be
saved any time; the *hold* has to be close to pickup.

### 3. Place the hold

Open the booking → **Place hold**. One click. The amount comes from your
settings — you never type a number.

This is an *authorization*: the funds are reserved on the renter's card, not
taken. Place it at pickup, or at most a few days before — never more than a week
out, or it expires before the rental starts.

### 4. After return — release or capture

- **Release** (the default, no damage) — the authorization is cancelled and the
  reservation on their card disappears. Costs you nothing.
- **Capture** — take the amount you're actually claiming, up to the authorized
  total. Partial capture is supported, so a $900 scratch on a $10,000 hold
  captures $900.

Release promptly. A stale authorization on a renter's card is the single most
common complaint in vehicle rental, and it's the kind of thing that turns into
a chargeback and a bad review.

### 5. If the renter can't cover the deposit

It happens, and it's a decision to make at the counter before you release keys —
not something to wave through.

- **Don't hand over a vehicle with no deposit authorization in place.**
- A different card is usually the fix. The link can be re-sent as many times as
  needed.
- If they genuinely can't cover it, note it on the booking so Exotiq support has
  the context, and tell us the same day. The renter has already paid the rental
  in full, so this needs handling rather than leaving.

### Don't key card numbers in by hand

It carries worse rates, you take on full fraud liability with no authentication,
and it pulls your staff into PCI scope. The **Request card** link is faster and
safer. If you want true card-present, use Stripe Tap to Pay on your own account.

### What Exotiq has already charged

By the time you see a confirmed booking, the renter has paid:

- the full rental (transferred to you, appearing under your own name on their
  statement)
- the Exotiq booking fee
- the Exotiq protection plan, if they bought one

A renter with Exotiq protection **still gets a deposit hold** — protection
covers damage liability, the deposit is your recourse at the vehicle. If a
renter pushes back on this, that's the distinction.

---

## Notes for us (not for tenants)

- The renter-facing figure comes from `public_vehicle_quote.deposit_cents`,
  which resolves via `resolve_deposit_cents(vehicle_id)`: per-vehicle override →
  tenant default → $1,000 floor. Shown at Review and Pay; no client math.
- Deposit collection is the **operator's** responsibility. Worth stating
  explicitly in the operator agreement so a missed deposit is unambiguously
  their loss, not an Exotiq liability. **Legal to confirm.**
- Steps 2–4 are **shipped**: `stripe-create-deposit-setup-session` (Request
  card), `stripe-create-hold` mode=off_session (Place hold), plus capture and
  release, all driven from the DepositPanel in the Payments tab. This SOP is
  sendable once the flow has been smoke-tested end to end.
- **The T-72h automatic sweep was deliberately parked, not forgotten.** Nothing
  emails the renter on a schedule; the operator initiates. Rationale: we have no
  data on how often a renter can't cover a deposit, and pre-window collection is
  a genuine tradeoff rather than an obvious win — asking before free
  cancellation expires surfaces an unaffordable deposit while the booking can
  still be lost cheaply, but it also hands a wavering renter an exit. Gregory is
  asking local customers which they prefer before we build to either.
- If we do automate later, note that **saving a card is not a funds check** —
  only placing the hold tests affordability. So a scheduled *card request* before
  the cancellation cutoff proves nothing; it would have to be a scheduled
  *hold* (feasible at ~4 days out, inside the 7-day window).
- Still open for Gregory: if a renter never produces a workable card, do they get
  a refund despite the cancellation policy? Recommend yes — they've paid in full
  and received no vehicle, which is a dispute they'd likely win anyway.
