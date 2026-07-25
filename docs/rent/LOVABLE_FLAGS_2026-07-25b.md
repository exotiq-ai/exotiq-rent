# Lovable flags — from verifying the 2026-07-25 handoff (round 2)

I read the **deployed** source and queried the live DB via the Lovable MCP
rather than trusting the repo, so each item below says how it was verified.
Four items. Two are launch-blocking for the money flow; both are small fixes in
code you already own, and in two cases the correct helper already exists in the
same file.

Everything else in your handoff verified clean — details at the end.

---

## L1. [LAUNCH-BLOCKING] The renter's emailed pay link points at the Command Center

`supabase/functions/rent-approve-booking/index.ts`

```ts
const origin = req.headers.get("origin") || "https://book.exotiq.rent";
const payUrl = buildPayUrl(booking.booking_ref, String(booking.confirmation_token), origin);
```

**Why it breaks:** the Command Center calls this from the browser —
`src/contexts/FleetContext.tsx`:984, `supabase.functions.invoke('rent-approve-booking', …)`.
The functions endpoint is cross-origin from the CC, so the browser always sets
`Origin`, and it is the *operator* app's origin, not the renter's. The renter
therefore receives:

```
https://app.exotiq.ai/booking/BK-xxxxx?t=<token>
```

`app.exotiq.ai` has no `/booking/:ref` route, so the approved renter cannot
pay at all. The 48h `payment_due_at` clock runs the whole time and the sweep
then expires the booking.

**Why it survived our E2E:** the earlier sandbox money test reached the pay
page by direct navigation, never by clicking the emailed link. The link itself
was never exercised.

**Fix:** don't take the origin from the caller — the renter app is a fixed
destination. Drop the header read and let `buildPayUrl`'s default stand, or
read an explicit `RENTER_APP_ORIGIN` env var:

```ts
const origin = Deno.env.get("RENTER_APP_ORIGIN") ?? "https://book.exotiq.rent";
```

Same treatment anywhere else a renter-facing URL is derived from
`req.headers.get("origin")`.

---

## L2. [LAUNCH-BLOCKING] Receipt email's storefront + vehicle links don't resolve

`supabase/functions/rent-payment-webhook/index.ts`, in `confirmIfFullyPaid`:

```ts
const storefrontUrl = `https://${team?.slug ?? "book"}.exotiq.rent`;
const vehicleUrl = vehicle?.slug ? `${storefrontUrl}/vehicles/${vehicle.slug}` : storefrontUrl;
```

For the Exotiq tenant that is `https://exotiq.exotiq.rent`. **Verified dead:**
`dig` returns no record and `curl` fails to connect — there is no wildcard
`*.exotiq.rent`, only `exotiq.rent`, `book.exotiq.rent` and `demo.exotiq.rent`.
The path is wrong too: the renter app serves `/{teamSlug}/{vehicleSlug}`, not
`/vehicles/{slug}`.

So every paying renter gets a receipt whose "view your booking"/vehicle links
are broken.

**Fix:** you already have the right helpers in `_shared/rentFormat.ts` — the
same module this function already imports `buildPayUrl` from:

```ts
import { buildStorefrontUrl, buildVehicleUrl } from "../_shared/rentFormat.ts";

const storefrontUrl = buildStorefrontUrl(team?.slug ?? "");
const vehicleUrl = vehicle?.slug ? buildVehicleUrl(team?.slug ?? "", vehicle.slug) : storefrontUrl;
```

Both already produce `https://book.exotiq.rent/{slug}[/{vehicleSlug}]`, which
matches the deployed renter routes. `buildPayUrl`'s shape is correct and
already matches `/booking/{ref}?t={token}` — no change needed there.

---

## L3. [HIGH] Handoff item 20 is only half fixed — the unsafe overload still exists

You reported the `DEFAULT 0` removal on `create_marketplace_booking`. There are
**two overloads** live, and only the 14-arg one was fixed:

```
create_marketplace_booking(text,text,date,date,text,text,text,text,
  numeric,numeric,text, text,bigint,bigint)
  -- _protection_tier, _platform_fee_cents, _protection_total_cents : NO defaults  ✅

create_marketplace_booking(text,text,date,date,text,text,text,text,
  numeric,numeric,text, bigint,text,bigint,bigint)
  -- _deposit_cents bigint DEFAULT 0,
  -- _protection_tier text DEFAULT 'premium',
  -- _protection_cents bigint DEFAULT 0,
  -- _platform_fee_cents bigint DEFAULT 0        ← still defaults to a $0 fee
```

(From `pg_get_function_arguments` against the live DB.)

The deployed `rent-create-booking` passes named params with no `_deposit_cents`,
so it resolves to the safe overload — I verified that. But item 20's whole
premise was "a stale caller must hard-fail instead of silently writing a $0
fee," and a caller that passes `_deposit_cents` still resolves to the unsafe
overload and gets a $0 Exotiq fee with the deposit rolled into the charge.
The belt-and-suspenders isn't fastened while that signature exists.

**Fix:** `DROP FUNCTION` the 15-arg overload (or drop its defaults).

---

## L4. [MEDIUM · unblocks me] Make `email` optional on `identity-create-session` when the token validates

Not a bug — a small contract change that removes friction on the `/verify`
route I'm building.

The guest path currently requires `email` **and** `booking_ref` **and**
`confirmation_token`, then checks the email against `booking.customer_email`.
But `public_booking_by_ref` does not return `customer_email`, so a renter
arriving at `/verify?ref=…&token=…` from your `verifyIdRequested` email —
often on a different device, with no sessionStorage — gives me no way to
supply the email. I'd have to make them retype it purely to satisfy the
parameter.

The function already loads `booking.customer_email` for the comparison, so once
the opaque per-booking token matches, the email adds no security — it's a
second factor on top of a secret the attacker would already need.

**Ask:** when `booking_ref` + `confirmation_token` validate, treat `email` as
optional and derive the customer from the booking row. Keep the current strict
behaviour when `email` *is* supplied.

**Not blocking:** I'm shipping `/verify` with an email prompt so the flow works
against today's contract. If you make it optional I'll drop the prompt.

---

## Verified clean (no action)

Checked against the live DB / deployed source, all as you described:

- `bookings.exotiq_leg_attempt` — `integer NOT NULL DEFAULT 0` ✅
- `bookings.operator_payment_intent_id` / `exotiq_payment_intent_id` present ✅
- `teams.platform_fee_percent` — default now `10.00 NOT NULL` ✅ (closes the
  backend half of handoff #17; the renter now renders the server quote's fee,
  so a 0% tenant would charge 0% — this default is what prevents it)
- `teams.default_deposit_cents`, `vehicles.deposit_override_cents`,
  `resolve_deposit_cents(_vehicle_id uuid) → bigint` ✅
- `public_vehicle_quote` returns `deposit_cents` ✅ — already flowing to the
  renter; the deposit hold now displays ($1,500 on the Audi) after my PR #45
- `public_booking_by_ref(_booking_ref text, _token uuid)` returns
  `identity_verified` ✅ — what `/verify` will use
- `set_payment_due_at` trigger present; `computePaymentDueAt` does a clean
  `min(approval+48h, pickup−2h)` with no double tz shift ✅ (handoff #21)
- **Cluster C is properly closed** in `identity-create-session`: `EMAIL_RE`
  rejects `%`/`_` at the edge, the customer is derived from the token-validated
  booking, lookups use `.eq`, and there's a persistent 20/hr per-IP limit. The
  `qa-redteam-one@example.co%` hijack I confirmed exploitable is dead ✅
- `rent-payment-webhook` Cluster A hardening reads correctly: PI always
  persisted via `.is(...,null)` guard, terminal-state auto-refund with
  `reverse_transfer: true` + ops alert, attempt-scoped
  `exotiq-leg-{ref}-{attempt}` idempotency key ✅

## Not mine to do

**Committing the deployed edge functions to the SPARK repo (your item 4)** —
my Supabase token has no access to the Exotiq project, so I cannot pull the
deployed source to commit it. I can read files through the Lovable MCP but not
author commits to your repo's `supabase/functions/` from the deployed
runtime. This one has to stay with you, and it's the item I'd least want left
undone: a redeploy from `main` reverts every Phase 1/6 change above.
