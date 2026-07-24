# Drive Exotiq Transactional Emails (M6d)

Five fully-baked, self-contained HTML templates matching the booking
platform's design system (dark frame, gold #C8A664, serif headlines with
Georgia fallback). **No assembly, no CSS inlining, no dependencies** — the
edge function does plain `{{VARIABLE}}` string replacement and sends.
Table-based and inline-styled for Gmail / Apple Mail / Outlook; the design
holds with images disabled (there are none to load except the optional
Newsreader webfont, which degrades to Georgia).

Source of truth: `source/generate.py` (one shared shell + per-template
bodies). Edit there, re-run `python3 generate.py`, never hand-edit the baked
files.

## Templates, subjects, and when to send

| File | Send when | Suggested subject |
|------|-----------|-------------------|
| `payment-approved.html` | status → `pending_payment` | You're approved — complete your {{VEHICLE_SHORT}} booking |
| `payment-reminder.html` | `payment_due_at − 24h`, still `pending_payment` | 24 hours left to lock in your {{VEHICLE_SHORT}} |
| `receipt-confirmed.html` | status → `confirmed` (paid) | Confirmed — your {{VEHICLE_SHORT}} receipt |
| `refund-confirmation.html` | status → `refunded` | Refunded in full — booking {{BOOKING_REF}} |
| `payment-expired.html` | status → `payment_expired` | The payment window closed — booking {{BOOKING_REF}} |

Preheader text is baked into each file already.

## Variables

| Variable | Example | Used in |
|----------|---------|---------|
| `{{BOOKING_REF}}` | BK-03447 | all |
| `{{OPERATOR_NAME}}` | Exotiq | all |
| `{{VEHICLE_NAME}}` | Audi S8 Plus | all |
| `{{VEHICLE_SHORT}}` | Audi S8 | approved, reminder |
| `{{DATE_RANGE}}` | Aug 8–11 | all |
| `{{PICKUP_TIME}}` | 10:00 AM | all |
| `{{LOCATION}}` | Scottsdale, AZ | all |
| `{{RENTAL_AMOUNT}}` | $1,500.00 | approved, receipt, refund |
| `{{EXOTIQ_AMOUNT}}` | $1,017.00 | approved, receipt, refund |
| `{{TOTAL_DUE}}` | $2,517.00 | approved, reminder |
| `{{TOTAL_PAID}}` | $2,517.00 | receipt |
| `{{TOTAL_REFUNDED}}` | $2,517.00 | refund |
| `{{PAYMENT_DEADLINE}}` | Jul 26, 8:54 PM MST | approved, reminder — format `payment_due_at` in the TEAM's timezone with zone label |
| `{{PAY_URL}}` | https://book.exotiq.rent/booking/BK-03447?t=… | approved, reminder — the tokened confirmation URL |
| `{{CONFIRMATION_URL}}` | same tokened URL | receipt |
| `{{STOREFRONT_URL}}` | https://book.exotiq.rent/exotiq | refund |
| `{{VEHICLE_URL}}` | https://book.exotiq.rent/exotiq/2017-audi-s8 | expired |

Amounts: rental = `total_value`; Exotiq = `platform_fee_cents +
protection_total_cents`. Always format server-side with currency symbol.

## Sending rules

- **Always include a `text/plain` part.** Short version: greeting, one
  sentence of status, amounts, the URL, booking ref. Derive per template.
- **Never put a 1-hour signed media URL in an email** — emails outlive the
  signature. These templates deliberately embed no vehicle photos.
- From: bookings@exotiq.rent (or the configured transactional sender);
  reply-to should reach the operator or support.
- The tokened URL is the renter's credential — send only to the booking's
  `customer_email`.

## QA checklist

Render each template with test data (all `{{…}}` resolved — grep for `{{`
after interpolation), send to a Gmail + Apple Mail + Outlook seed, confirm:
dark background holds, gold button renders, serif headline falls back to
Georgia gracefully, preheader shows in the inbox list, plain-text part
present.
