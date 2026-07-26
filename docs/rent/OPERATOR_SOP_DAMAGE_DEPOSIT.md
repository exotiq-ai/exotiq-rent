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

### 2. Renter puts a card on file (~72 hours before pickup)

The renter is emailed a secure Stripe link to save a card **to your account**.
Nothing is charged. You'll see the card appear against the booking in Command
Center.

This is deliberately not at time of booking: a card authorization is only good
for about **7 days**, so a hold placed weeks ahead would lapse before pickup.

### 3. Place the hold

Open the booking → **Place hold**. One click. The amount comes from your
settings — you never type a number.

This is an *authorization*: the funds are reserved on the renter's card, not
taken. Place it inside the 72-hour window, not earlier.

### 4. After return — release or capture

- **Release** (the default, no damage) — the authorization is cancelled and the
  reservation on their card disappears. Costs you nothing.
- **Capture** — take the amount you're actually claiming, up to the authorized
  total. Partial capture is supported, so a $900 scratch on a $10,000 hold
  captures $900.

Release promptly. A stale authorization on a renter's card is the single most
common complaint in vehicle rental, and it's the kind of thing that turns into
a chargeback and a bad review.

### 5. If there's no card on file by 24 hours before pickup

Your call, and you should make it before the vehicle is prepped:

- collect at handoff before releasing the keys, or
- cancel the reservation.

Don't hand over a vehicle with no deposit authorization in place. If you cancel
for this reason, note it on the booking so Exotiq support has the context.

### At the counter

If you'd rather handle it in person, **re-send the same link** and let the
renter complete it on their own phone — 30 seconds, and your staff never touch
the card number.

Avoid keying card numbers in by hand. It carries worse rates, you take on full
fraud liability with no authentication, and it pulls your staff into PCI scope.
If you want true card-present, use Stripe Tap to Pay on your own account.

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
- Steps 2 and 3 depend on Lovable shipping the setup-mode card-on-file flow and
  the off-session confirm in `stripe-create-hold`. Until then step 5's
  "collect at handoff" is the only working path — don't send this SOP to tenants
  before that lands, or it describes a button that isn't there.
