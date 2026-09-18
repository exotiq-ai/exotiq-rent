# Browser analytics release — operating notes

## Scope

This release instruments the Exotiq public storefront, vehicle pages and booking-request steps. It does not turn a booking request into a sale. Meta CAPI, durable server-side attribution and paid-booking events remain a separate backend release. Session replay is off.

Production guard: exact host `book.exotiq.rent`, Supabase data mode, explicit tracking enabled, Exotiq tenant only. The apex domain currently redirects there; the redirect deployment is build-stopped and must remain untouched. Demo and preview hosts do not send tracking.

## Environment contract

Set only on the **book-exotiq-rent production build**:

- `NEXT_PUBLIC_TRACKING_ENABLED=true`
- `NEXT_PUBLIC_META_PIXEL_ID=1603562574756003`
- `NEXT_PUBLIC_POSTHOG_KEY=<public project token>` — never a `phs_` or `phx_` secret
- `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` or `https://eu.i.posthog.com` according to the actual project
- Preserve existing Supabase configuration and default-team slug.

`NEXT_PUBLIC_*` values require rebuilding; setting a variable alone does not update a deployed bundle. Missing PostHog credentials must not disable Meta, and vice versa. Private management keys stay outside git and client bundles.

## Events

| First-party event | Meaning | Meta counterpart |
|---|---|---|
| `$pageview` | One permitted public navigation | PageView |
| `storefront_view` | Exotiq storefront visible | None beyond PageView |
| `vehicle_view` | Vehicle detail visible | ViewContent |
| `book_start` | Dates/request flow opened | None |
| `book_step` | Driver/review/request step reached | None |
| `booking_created` | Request successfully accepted by backend | Lead |

There is deliberately no browser Purchase or AddPaymentInfo event. Actual hosted checkout is available only after operator approval. Existing `confirmation_view` calls on private pages must not load the SDK; those pages need server-side safe reporting in the next release.

## Privacy behavior

- Explicit independent analytics/advertising opt-ins. No pre-consent interaction replay.
- Global Privacy Control blocks advertising.
- No automatic DOM capture or replay. Only sanitized explicit properties.
- Analytics keys/tokens are separate from renter confirmation/identity credentials.
- Private confirmation, verification, saved-list and renter token routes must not run SDKs.
- Public→private navigation must replace the document; removing a React component does not unload a third-party script.
- Preferences can be changed after the first choice. Revocation unloads scripts and clears the site's tracking identifiers, without deleting booking/session credentials.
- Email marketing consent is not tracking permission.

## Compact cookie controls

- No application-wide top privacy banner or automatic modal. Eligible vehicle and booking pages place a quiet 44px row above the primary action; storefronts expose it in page flow.
- `Optional cookies` shows Off / On / Custom. The combined control is an accessible tri-state checkbox styled as a switch; Custom switches fully off rather than silently enabling the other category.
- Details opens a small nonmodal card, without a backdrop. Analytics and Advertising apply immediately and independently. GPC disables Advertising. Escape, Close, outside click and focus leaving dismiss the card.
- Automatic row visibility reuses the existing host, route, provider, credential-URL and referrer guards. `/ark/...`, demo and private pages do not become tracked because of the visual change.
- Existing preferences may expose a discreet manual entry outside the tracked route. `/privacy` always provides a manual Privacy preferences control; opening or choosing there does not load either SDK.
- The root component owns consent and navigation only; responsive controls share the same state. Consent storage, event contracts, SDK loading, withdrawal cleanup/reload and cross-tab synchronization remain unchanged.

### Browser release checks

With the local production build on port 3219 and a fixture PostHog key of `phc_trackingqatest123`:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright-core QA_REAL_META=1 node scripts/analytics-browser-qa.cjs
PLAYWRIGHT_MODULE=/path/to/playwright-core node scripts/compact-cookie-qa.cjs
PLAYWRIGHT_MODULE=/path/to/playwright-core QA_BROWSER=webkit node scripts/compact-cookie-qa.cjs
```

Set `QA_OUTPUT_DIR` for separate receipts/screenshots. Set `QA_LOCAL_ORIGIN=https://book.exotiq.rent` and `QA_LIVE=1` to recheck deployed code, still intercepting provider traffic and blocking booking/customer/payment writes. These tests prove browser behavior and intercepted transport, **not provider ingestion**. Chromium/WebKit mobile viewport tests are not actual Instagram-app verification. Never upload a local fixture build to production; release through Git/main so Netlify uses its production environment.

## Dashboard recipes

Create these in the correct PostHog project once management access is verified; do not claim creation from this file:

1. **Exotiq Rent — Acquisition & Requests**
   - Daily distinct public visitors and successful request counts.
   - Funnel: vehicle_view → book_start → book_step(step=2) → book_step(step=3) → booking_created.
   - Separate storefront → vehicle funnel because vehicle-targeted ads may skip storefront.
   - Campaign/ad/placement and device breakdowns.
   - Top vehicle views and requests.
2. **Exotiq Rent — Tracking Health**
   - Allowed event counts by host and schema version.
   - Missing campaign parameters on paid-social landings.
   - Booking-request error categories when implemented.

Do not create apparently live revenue/ROAS panels until backend `booking_paid` and ad spend ingestion exist. Gross booking value is not platform revenue. Filter internal QA events out; document their test markers.

API management requires `project:read`, `dashboard:read/write`, `insight:read/write` and `query:read` permissions. Ingestion only needs the public project token. PostHog documentation: https://posthog.com/docs/api/personal-api-keys and https://posthog.com/docs/open-api-spec/dashboards_create.

## Release gates

1. Unit regression tests, TypeScript, lint and production build.
2. Independent security/correctness review.
3. Browser QA: rejected consent; analytics-only; ads-only; grant/withdraw; GPC; storefront→vehicle→book navigation; full-document private transition; direct private URL; storage unavailable; demo host.
4. No sensitive values in decoded requests; inspect actual request bodies and URLs.
5. Git/main-triggered deployment; check live production commit and real emitted PageView/ViewContent. Do not submit fake leads or purchases into the production pixel.
6. Verify PostHog ingestion using read access, not just a 200 ingestion response.

## Rollback

Revert the release commit or set `NEXT_PUBLIC_TRACKING_ENABLED=false` and trigger a production rebuild. Confirm no SDK requests in a fresh browser. Leave payments/booking data and the apex redirect untouched. Server outbox workers are not part of this release; when introduced they will need their own kill switch.
