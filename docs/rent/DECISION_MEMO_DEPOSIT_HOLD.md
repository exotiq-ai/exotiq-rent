# Decision memo — how the security deposit hold actually gets placed

**Audience:** Gregory (decides), Lovable (implements)
**Status: DECIDED 2026-07-25 — see "Decision" below. The options analysis is kept for the record.**
**Verified against:** deployed edge functions + live DB (2026-07-25), not the repo

---

## Decision (2026-07-25)

**The damage deposit is handed off entirely to the operator tenant.** Authorized
on their connected account, never passing through Exotiq, amount set by them in
the Command Center. Exotiq charges the rental + booking fee + protection at
booking — that is what secures the vehicle. The deposit is the only money an
operator collects directly.

Mechanically: renter saves a card to the **operator's** account via a
setup-mode Checkout (~T-72h), operator authorizes from the Command Center, then
releases or partially captures after return. Card-present at the counter stays
available as a fallback.

This resolves the custody problem the options below were wrestling with, rather
than picking a side of it: Exotiq never holds deposit funds, so the
balance-sheet and state-by-state deposit questions sit with the party that has
the damage relationship and the vehicle.

Two things were rejected along the way, both worth recording:

- **Charging the deposit instead of authorizing it.** Stripe does not return
  processing fees on refunds, so charge-then-refund burns ~2.9% on money always
  intended to go back — ~$290 on a $10,000 deposit, per rental, which can exceed
  the entire Exotiq booking fee on a short booking. Stripe's own guidance
  recommends manual auth/capture for exactly this pattern. It also doesn't solve
  the card-limit worry that motivated it: an authorization consumes the renter's
  available credit identically to a charge.
- **A Stripe Payment Link for the deposit.** Payment Links don't support setup
  mode, so they *charge*. Setup-mode Checkout is the primitive that saves a card
  for free.

Superseded by this decision: the 7-day-window framing below is still true, but
it's now the operator's constraint to manage inside the 72-hour window, not an
Exotiq scheduling problem. Extended authorizations (30 days, free on the
vehicle-rental MCC) remain worth confirming with Stripe as headroom.

Follow-ups: `docs/rent/OPERATOR_SOP_DAMAGE_DEPOSIT.md` (tenant-facing SOP) and
the Lovable handoff covering the setup-mode flow plus off-session confirm in
`stripe-create-hold`.

---

---

## The one-line problem

The deposit **amount** is now correct and server-authoritative end to end
(verified: Bugatti shows "Refundable hold at pickup $10,000", quote and
`resolve_deposit_cents` agree). But there is **no path that can actually place
that hold on a renter's card**, and the reason is structural, not a missing
call site.

Lovable's handoff says the smoke matrix is mine to run "through the renter path
once Claude wires it." I can't wire it, and I don't think it should be wired as
specified. Two findings explain why, and the second is the one that really
decides this.

---

## Finding 1 — the saved card and the hold live on different Stripe accounts

| | account | evidence |
|---|---|---|
| Renter's saved card | **Platform** | `rent-checkout` creates the customer with no `stripeAccount`, and sets `setup_future_usage: "off_session"` on a destination-charge PI. Its own header: *"saving the card platform-side… **No payment-method cloning anywhere**."* |
| Deposit hold PI | **Operator's connected** | `stripe-create-hold` → `stripe.paymentIntents.create(piParams, { stripeAccount: team.stripe_account_id })`, against a *separate* customer it looks up/creates on the connected account |

The hold PI is created with **no `payment_method`**. A platform-side payment
method cannot be used on a connected-account PI without **cloning it**, which
M6-D1 rev 2 explicitly forbids. `stripe-create-hold` returns a `client_secret`
— i.e. it expects *someone to confirm it client-side with a card*. That is the
operator-at-handoff flow it was originally built for, not a renter flow.

Separately, `stripe-create-hold` requires an **operator JWT + team membership**.
A renter is anonymous and can never satisfy that gate, so even a "renter
button" would need a whole new anon path gated on `booking_ref +
confirmation_token` (the pattern Lovable just used for `identity-create-session`).

## Finding 2 — card authorizations expire long before pickup

This is the decisive constraint. A card authorization is good for roughly
**7 days** (network-dependent, shorter on some cards). Bookings are taken months
ahead — the Bugatti quote above was for dates 40 days out.

So a hold **cannot** be placed at booking, at payment, or at ID verification.
It has to be placed **close to pickup**, whatever else we decide.

That directly contradicts a promise the renter app is making **today**, on the
confirmation page:

> "Security deposit hold is placed on your card after your identity is verified."

Verification happens minutes after payment, potentially months before pickup.
That line needs to change under every option below. I've left it alone so far
because the correct replacement depends on this decision.

---

## What already works (don't rebuild it)

The whole lifecycle exists and is operator-driven:

- `stripe-create-hold` — manual-capture PI on the connected account. **Amount is
  now server-resolved** via `resolve_deposit_cents`, rejects client `amount`,
  derives team from the booking. Good.
- `stripe-capture-hold` — `paymentIntents.capture`, partial capture supported.
- `stripe-release-hold` — `paymentIntents.cancel`, writes `hold_status: released`.

So "operator places, captures, or releases a hold" is **done**. The gap is only
in who triggers it and against which card.

---

## The options

### A. Scheduled off-session hold on the **platform** account, ~24–48h pre-pickup
Uses the card already saved platform-side. No cloning, no renter friction, fully
automatic.

- **Pro:** consistent with how rentals already flow (platform charges → transfers
  to operator). Zero renter friction. Deterministic timing.
- **Con:** Exotiq becomes the custodian of deposit funds on capture, which cuts
  against D1's "deposits are operator-owned." Damage capture would need a
  transfer to the operator — new money-movement code. Likely a
  regulatory/accounting question worth putting to your accountant before it's a
  commitment; I'm flagging it, not advising on it.
- **New work:** scheduler + off-session PI + capture→payout path.

### B. Operator places the hold at handoff, renter presents a card *(recommended for launch)*
Exactly what the existing three functions already do. The renter taps a card at
pickup like any rental counter.

- **Pro:** **ships with zero new architecture.** Deposits stay operator-owned per
  D1. No cloning. Authorization is placed at pickup, so the 7-day window is a
  non-issue. Amount is already correct and resolver-backed.
- **Con:** manual — depends on operator diligence. Renter must have a card at
  pickup (fair for this market, but it must be *said* up front, not discovered).
- **New work:** the CC needs a "Place deposit hold" action on the booking (it may
  already have one — Lovable to confirm whether any surface calls
  `stripe-create-hold`; they reported none does), plus the renter-facing copy
  change below.

### C. Clone the payment method to the connected account, scheduled pre-pickup
Keeps operator custody *and* automation.

- **Pro:** best end state — automatic, operator-owned, correctly timed.
- **Con:** reverses M6-D1 rev 2's no-cloning rule, which was a deliberate
  decision. Most new code of the three, on a launch-critical path.
- **New work:** PM clone + scheduler + off-session confirm on the connected
  account.

---

## Recommendation

**Ship B, plan C.**

B is the only option that requires no new money-movement architecture before
launch, and it's how the market already works — nobody is surprised to present
a card when collecting a supercar. It keeps D1 intact. The amount plumbing we
just finished is exactly what B needed.

C is the right destination once there's traffic to justify it, and it's a clean
follow-on: the resolver, the capture path and the release path all stay as-is;
only the trigger and the PM source change.

A is the least work of the two automated options but it's the one that changes
who holds renter money, and that shouldn't be decided to save a sprint.

---

## If B is chosen, here's the work

**Gregory**
1. Confirm B.
2. Give a tenant-level deposit floor for `teams.default_deposit_cents` (see the
   gap below). Suggest a conservative number for exotiq.
3. Confirm the renter-facing wording: *"Bring the card you'd like us to hold
   the deposit on — the hold is placed at pickup and released within 48 hours of
   return."*

**Lovable**
1. Add a **"Place deposit hold"** action on the booking in the CC, calling
   `stripe-create-hold` with `{ booking_id }` only. It should show the resolved
   amount before confirming, so staff never types a number.
2. **`stripe-capture-hold` and `stripe-release-hold` still derive the team from
   the caller's membership** (`.eq("user_id", user.id).limit(1).single()`) — the
   exact pattern you fixed in `stripe-create-hold`. A user in two teams hits the
   wrong connected account and the capture/cancel fails. Please apply the same
   booking-derived team + membership assertion to both.
3. **Set `teams.default_deposit_cents` per tenant, and gate marketplace
   visibility on a deposit source.** Right now it is NULL for *every* tenant
   including exotiq, so the only thing standing between a listed vehicle and a
   **$1,000** hold is its own per-vehicle override. All 55 exotiq vehicles have
   one today, so we're clean — but a newly added vehicle with a blank override
   silently resolves to $1,000 on a $400k car, and **fredo-d-lima's 21 vehicles
   all resolve to $1,000 right now** (inert only because that tenant is
   unlisted — flipping it visible exposes all of them at once). This is the same
   bug class as the silently-0% platform fee, and the same fix works.

**Claude (me)**
1. Replace the confirmation-page line *"Security deposit hold is placed on your
   card after your identity is verified"* with the agreed pickup wording, and
   add the same expectation to the Review step so it's set before booking, not
   discovered at handoff.
2. Keep "Refundable hold at pickup $X" as-is — it's already resolver-sourced and
   is accurate under B.
3. Re-run the money battery clicking the emailed links once the CC action exists,
   and verify the renter-facing half of the smoke matrix (that the displayed
   figure equals the `payment_intent.amount` the operator ends up placing).

**Smoke matrix** stays as written — override set / tenant-default only / neither
— but it runs from the **CC action**, not a renter path, and the three
`payment_intent.amount` values should each equal what the renter was shown on
the quote page for that vehicle.

---

## If A or C is chosen instead

Tell me and I'll redo my side: under both, the hold is automatic and the renter
copy becomes *"we'll place the hold on your saved card shortly before pickup"* —
which is friendlier than B, and is the reason C is worth getting to eventually.
Note that under both, the scheduler needs to handle a **failed** off-session
hold (insufficient funds, card expired between booking and pickup), including
notifying the renter and giving the operator a decision at handoff. That
failure path is most of the real work in A and C, and it's why B is the safer
thing to launch on.
