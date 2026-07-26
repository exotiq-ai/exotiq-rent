# Canned replies — "why am I being asked for a card again?"

Three audiences. Send the first to renters, give the second to tenant support
staff, and use the third when a renter refuses.

---

## 1. To the renter (the main one)

> **Subject: Re: Adding a card for your deposit**
>
> Hi {FirstName},
>
> Good question — nothing has gone wrong with your booking, and you haven't been
> charged twice.
>
> Your rental is fully paid. That went to us at Drive Exotiq when you booked, and
> it's settled.
>
> The card we're asking for is for the **refundable damage deposit**, which is
> held by {OperatorName} — the company handing you the keys — on their own
> payment account, not ours. That's deliberate: it means your deposit sits with
> the people responsible for the vehicle, and we never hold it.
>
> Two things worth knowing:
>
> - **It's a hold, not a charge.** {OperatorName} reserves {DepositAmount} on your
>   card shortly before pickup. The money isn't taken. It's released after you
>   return the car, assuming no damage.
> - **We ask ~72 hours ahead** because a card hold only lasts about a week. Doing
>   it earlier would mean it expires before your rental starts.
>
> You'll only do this once with {OperatorName} — if you book with them again, the
> card is already on file.
>
> The link is secure and hosted by Stripe; we never see your card number.
>
> {SupportSignature}

### Shorter version, for chat or SMS

> Nothing's wrong — your rental is paid in full. This card is for the refundable
> damage deposit, which {OperatorName} holds on their own account rather than us.
> It's a hold, not a charge: {DepositAmount} is reserved just before pickup and
> released after you return the car. We ask ~72h ahead because card holds only
> last about a week. One time only — book with them again and the card's already
> saved.

---

## 2. Internal note for tenant support staff

**What the renter is seeing:** a Stripe page asking to save a card, ~72 hours
before pickup, after they already paid in full at booking.

**Why it exists:** the rental, the Exotiq booking fee, and the protection plan
are collected by Exotiq at booking, on Exotiq's payment account. The damage
deposit is *yours* and is authorized on *your* account. Those are two different
merchants, so the renter's card has to be saved with you separately — we can't
pass their card details from our account to yours, and we wouldn't want to.

**The three questions you'll actually get:**

| They ask | You say |
|---|---|
| "Am I being charged twice?" | No. The rental is paid. This is a hold for the damage deposit, and it's released after return. |
| "Why not use the card I already paid with?" | Payment security rules stop us moving your card details between companies. You save it once with us directly. |
| "Why now and not at pickup?" | We can do it at pickup if you prefer — this just gets it out of the way so handoff is quick. |

**What not to say:** don't call it a "second payment" or a "deposit payment."
It's an authorization. Renters hear "payment" and start a dispute.

**If it's genuinely their last resort:** you can take the deposit at handoff
instead. Re-send the same link and let them complete it on their phone at the
counter — 30 seconds, and you never touch their card number.

---

## 3. If a renter refuses outright

> I understand. To be straightforward about where that leaves us: {OperatorName}
> needs a deposit authorization in place before releasing the vehicle — that's
> standard for this class of car and it's their policy, not a payment step of
> ours.
>
> Two options:
>
> 1. Complete it at pickup instead. {OperatorName} can take it in person when you
>    collect the car.
> 2. If you'd rather not proceed, tell us before {CancellationDeadline} and we'll
>    sort out your cancellation.
>
> Happy to get {OperatorName} on the phone with you if it's easier.

**Escalation rule:** if a renter refuses and pickup is inside 24 hours, don't
leave it to the counter — flag it to the operator the same day so they can decide
whether to hold the vehicle or release the dates.

---

## Volume-reduction notes (for us, not for sending)

Expect the spike in the first two or three weeks and mostly on first-time
renters. Levers, cheapest first:

1. **Already shipped:** checkout discloses it at booking — *"they'll email you a
   secure link about 72 hours before pickup to put a card on file."* The ask is
   pre-framed, not cold.
2. **Add the same line to `receiptConfirmed`** (Lovable). Today the expectation
   is set at checkout, then nothing until the link arrives — potentially weeks of
   silence, which is where surprise comes from.
3. **Subject line should pre-answer it:** "Add a card for your damage deposit —
   {Operator}, booking {REF}". Avoid "action required" and anything that reads as
   a billing problem.
4. **Say the amount in the email**, matching the figure shown at checkout. A
   number they recognize reads as continuity; a missing one reads as a new charge.
5. **Track it.** If support volume stays high past a month, that's evidence the
   flow is wrong rather than just new — and the fallback is operator-collects-at-
   pickup, which needs no renter email at all.
