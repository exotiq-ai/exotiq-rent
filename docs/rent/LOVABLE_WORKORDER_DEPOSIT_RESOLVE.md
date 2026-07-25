# Work order — wire the deposit hold to `resolve_deposit_cents` (BLOCKED, do not swap yet)

**Status: the swap must not be made today.** Doing it as specified would cut
every deposit hold to the $1,000 platform floor, including a **$9,000
under-hold on the Bugatti Chiron**. Two unit/wiring problems have to close
first, both in the SPARK database. Verified against the live DB, not the repo.

---

## Why the swap is currently unsafe

`resolve_deposit_cents(vehicle_id)` falls through: vehicle override → tenant
default → `100000` ($1,000). On the Exotiq tenant **both upstream sources are
empty**, so it returns the floor for every vehicle:

```sql
select v.slug, v.default_security_deposit as quote_shows,
       v.deposit_override_cents, t.default_deposit_cents,
       public.resolve_deposit_cents(v.id) as hold_would_be
  from vehicles v join teams t on t.id = v.team_id
 where t.slug = 'exotiq';
```

| vehicle | quote shows renter | `deposit_override_cents` | `teams.default_deposit_cents` | `resolve_deposit_cents` |
|---|---|---|---|---|
| 2023-bugatti-chiron-sport | **$10,000** | NULL | NULL | **$1,000** |
| 2023-ferrari-488-gtb | $5,000 | NULL | NULL | $1,000 |
| 2023-audi-r8-v10-plus | $1,500 | NULL | NULL | $1,000 |
| 2017-audi-s8 | $1,500 | NULL | NULL | $1,000 |

**Every vehicle mismatches.** The real per-vehicle deposits live in the
pre-existing `vehicles.default_security_deposit` column, which is what
`public_vehicle_quote` reads today — the new `*_cents` columns were added but
never populated.

### Unit trap 1 — the columns are in different units

`vehicles.default_security_deposit` is in **dollars** (`1500.00`).
`deposit_override_cents` / `default_deposit_cents` / `resolve_deposit_cents`
are in **cents** (`100000`).

A naive backfill `deposit_override_cents = default_security_deposit` sets the
Bugatti's deposit to **$100.00**. The correct backfill multiplies by 100:

```sql
update public.vehicles
   set deposit_override_cents = round(default_security_deposit * 100)::bigint
 where default_security_deposit is not null
   and default_security_deposit > 0
   and deposit_override_cents is null;
```

Verify before and after with the table query above — `hold_would_be` must
equal `quote_shows × 100` for every row.

### Unit trap 2 — `stripe-create-hold` takes dollars, the RPC returns cents

`supabase/functions/stripe-create-hold/index.ts` currently does:

```ts
const { booking_id, amount, ... } = await req.json();
amount: Math.round(amount * 100),          // ← amount arrives in DOLLARS
...
await supabaseClient.from("payments").insert({ amount, ... })  // ← dollars again
```

`resolve_deposit_cents` returns **cents**. Dropping it straight into `amount`
double-converts to 100× the intended hold. When you make the swap:

```ts
const { data: depositCents, error } = await admin
  .rpc('resolve_deposit_cents', { _vehicle_id: vehicleId });
if (error) throw error;

piParams.amount = Number(depositCents);        // already cents — do NOT × 100
// payments.amount is a dollar column:
paymentsRow.amount = Number(depositCents) / 100;
```

---

## Required order of operations

1. **Backfill** `deposit_override_cents` (and/or set `teams.default_deposit_cents`
   per tenant) using the `× 100` statement above. Verify every row.
2. **Rewire `public_vehicle_quote`** to return
   `resolve_deposit_cents(v.id) as deposit_cents` instead of
   `coalesce(v.default_security_deposit, 0) * 100`. Until this lands, the quote
   and the hold read different columns by construction — which is the exact
   divergence this work order exists to prevent.
3. **Swap `stripe-create-hold`** to derive the amount server-side (below).
4. **Then** run the smoke matrix.

Doing 3 before 1 and 2 is the failure mode described at the top.

---

## The `stripe-create-hold` change itself

Beyond the amount source, the function currently cannot serve a marketplace
renter at all — flagging because it affects how you wire step 3:

- **No `vehicle_id` input.** It takes `booking_id` + `amount`. To call
  `resolve_deposit_cents` it needs `vehicle_id`, which it should look up from
  the booking — never accept it from the client:
  ```ts
  const { data: bk } = await admin.from('bookings')
    .select('id, vehicle_id, team_id').eq('id', booking_id).maybeSingle();
  if (!bk) throw new Error('Booking not found');
  ```
- **Stop accepting `amount`.** Per the work order, `booking_id` becomes the
  only money-relevant input. Reject the request if `amount` is present, so a
  stale caller fails loudly instead of setting its own hold (same reasoning as
  the `create_marketplace_booking` DEFAULT-0 removal).
- **Team is derived from the *caller's* membership, not the booking:**
  ```ts
  .from("team_members").select("team_id").eq("user_id", user.id).limit(1).single()
  ```
  For a marketplace booking the hold must be placed on the **booking's**
  team's connected account. Deriving it from whoever happens to be logged in
  is wrong the moment a user belongs to more than one team. Use `bk.team_id`
  and assert the caller is a member of it.

---

## What I did on the renter side (exotiq-rent)

**Nothing to swap — there is no deposit amount source in this repo.** Verified:
`exotiq-rent` has no `supabase/` or `src/` tree (the only match was an archived
copy under `docs/rent/patches/`), and no hold-placement code at all — zero hits
for `capture_method`, `create-hold`, or `manual_capture`. The hold is entirely
operator-side in SPARK.

Work order items 3 and 4 were already satisfied before this request:

- **Item 3** — `public_vehicle_quote` already returns `deposit_cents`, and the
  renter app already renders it (PR #45). What it does *not* do is source it
  from `resolve_deposit_cents` — that's step 2 above, and it's yours.
- **Item 4** — the checkout already displays the quote's `deposit_cents` with
  **no `?? 1000` fallback**; the figure is never computed client-side.
  Relabelled to **"Refundable hold at pickup"** on both the Review and Reserve
  steps per the request.

**One deliberate deviation:** item 4 asked me to hard-fail the page if the RPC
omits `deposit_cents`. I did not, and I'd push back on it. Killing checkout
over one missing field would take every booking offline the moment the quote
shape changes, and a renter seeing *no* deposit line is not misled the way a
wrong number would mislead them — the misleading-number case is what the
`platform_fee_cents` rule exists to prevent, and that rule already fires here
because the whole quote blocks on failure. A missing field is a schema
regression, which belongs in CI, and `adaptQuote`'s contract tests already
assert the mapping in both directions (absent → 0, present → passthrough).
Say the word and I'll add the hard-fail.

---

## Smoke matrix — I cannot run this

The three Stripe test PI IDs can't come from me:

1. `stripe-create-hold` is JWT + team-membership gated and lives in your
   project; I have no operator credential and cannot invoke it. (I also won't
   authenticate as one — entering credentials isn't something I do.)
2. It needs `STRIPE_SECRET_KEY` and places the PI on the **operator's
   connected account**, both server-side in SPARK.
3. There is still **no renter-side caller** for the hold (the open audit item),
   so there's no renter path I could drive to trigger one.

Once steps 1–3 land, the matrix is yours to run and it is worth running exactly
as specified — override set, tenant default only, neither set — asserting
`payment_intent.amount` equals the quote page's figure in each case. I'll
verify the renter-facing half (that the quote and the checkout display move to
the resolved number) as soon as step 2 is deployed, and re-run the money
battery clicking the emailed links.
