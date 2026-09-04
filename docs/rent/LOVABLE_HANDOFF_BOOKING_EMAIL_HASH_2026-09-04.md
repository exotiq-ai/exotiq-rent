# Lovable handoff — bind `public_booking_by_ref` to the renter's e-mail (MP-14)

**Scope: the LIVE booking backend (`exotiq-spark-mvp-flow` / Supabase `jlgwbbqydjeokypoenoc`).** One additive column on an existing public read; no behaviour change for existing callers.

## Why
Drive Exotiq's renter capture (MP-14) wants to treat a completed booking as proof that the renter owns the e-mail address they typed, so the consent they ticked at the Review step can apply without a confirmation click. Today `public_booking_by_ref(_booking_ref, _token)` proves possession of a booking token but returns no e-mail, so the app cannot tell whether the address in the request is the booking's address. Until it can, the app sends a confirmation e-mail instead (safe, one more tap).

## Change
Add a trailing column to `public_booking_by_ref`'s `RETURNS TABLE`:

```sql
customer_email_hash text   -- sha256(lower(trim(customer_email))) as hex; NULL unless the token matched
```

- Computed with `encode(digest(lower(trim(b.customer_email)), 'sha256'), 'hex')` (pgcrypto), **only when `authorized` is true**; `NULL` for the restricted (no/invalid token) view.
- Never return the e-mail itself.
- `CREATE OR REPLACE` cannot change `RETURNS TABLE` — drop and recreate, then re-grant `EXECUTE` to `anon, authenticated` exactly as before (same rule as MP-9's fleet RPC change).
- Migration file naming: as usual; please paste back the applied file name.

## App side (already in place, forward-compatible)
`domain/renters/capture.ts` `verifyBooking()` compares `sha256(lower(email))` with `customer_email_hash` when the column is present. Until then every booking capture takes the confirmation-click path.

## Verification (anon, REST)
```
POST /rest/v1/rpc/public_booking_by_ref {"_booking_ref":"BK-…","_token":"<token>"}  → row.customer_email_hash = 64 hex chars
POST /rest/v1/rpc/public_booking_by_ref {"_booking_ref":"BK-…","_token":null}      → customer_email_hash null
```
