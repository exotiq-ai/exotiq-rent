# Drive Exotiq Booking Flow — Agent Instructions

This repo contains the current exotiq.rent demo marketplace. Keep the existing homepage intact while building the new mobile-web renter booking flow alongside it.

Hard rules:
- Mobile-web, not native app.
- Use the long-term routes immediately:
  - `/{operatorSlug}/{vehicleSlug}` for Vehicle / Screen 01
  - `/{operatorSlug}/{vehicleSlug}/book` for Screens 02–07
  - `/booking/{bookingId}` for Confirmation / Screen 08
- Use Champagne Gold `#C8A664`, not cyan, in the new flow.
- Scope all new booking design tokens under booking-specific classes/CSS. Do not globally restyle the existing marketplace.
- Use Newsreader only for vehicle names and screen headlines.
- Use Inter for labels, prices, metadata, chrome, and all tabular/numeric UI.
- Preserve two-party billing in Review and Confirmation: operator charges and Exotiq Protect charges remain visually separate.
- Do not collect raw card data. Payment is mocked for this scaffold; Stripe is a future siloed project.
- Do not add Supabase migrations in this repo yet. Real schema will come from Lovable/app.exotiq.ai migration.
- Build production-shaped adapters and types, but keep data mocked locally.
- Keep code lean. No hallucinated screens, no bloated generic marketplace checkout, no global cyan-to-gold replacement.

Compatibility notes from app.exotiq.ai:
- Operator in renter UI maps to `teams` in the SaaS platform.
- Vehicle maps to `vehicles` plus `vehicle_photos`.
- Pickup data maps to `locations`.
- Renter/driver maps to `customers` plus `documents`.
- Booking ID in UI maps to `bookings.booking_ref` later.
- Payments map to existing `payments` table and Stripe Edge Functions later.
- Current SaaS rates appear dollar-based; renter UI should use cents internally and convert at adapter boundaries.
