# Backend Scope for First Scaffold

Do not implement production backend in this pass.

Included now:
- Mock booking data adapter shaped to future app.exotiq.ai data.
- Pure client/server-safe totals derivation in cents.
- Mock upload/verification states.
- Mock payment contract and success path.
- Route structure compatible with real operator/vehicle links.

Excluded now:
- Supabase SQL migrations.
- Real Supabase client integration.
- Real Stripe Connect, split charges, or $5,000 hold lifecycle.
- Real GoHighLevel/Twilio SMS.
- Operator dashboard changes.

Future integration targets:
- `teams` as operators.
- `vehicles` and `vehicle_photos` as catalog source.
- `locations` for pickup details.
- `customers` and `documents` for driver/renter verification.
- `bookings.booking_ref` for public confirmation IDs.
- `payments` and existing Stripe Edge Functions for money movement.
