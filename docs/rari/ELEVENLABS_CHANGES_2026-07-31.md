# ElevenLabs changes required — Rari / FleetCopilot

**Date:** 2026-07-31
**Status:** OWNER ACTION REQUIRED in the ElevenLabs dashboard. Backend is deployed
and hardened; Rari's tools return 401 until the dashboard steps are done.

> Filed in exotiq-rent because it is the durable repo Gregory controls. The work
> itself is ElevenLabs dashboard configuration, not renter-app code.

---

## Pre-verified by Claude, 2026-07-31 04:15 UTC

The two credential-free checks from §8 were run before any dashboard work and
both PASS — the server side is correct, so anything that fails tomorrow is
dashboard configuration, not backend.

    GET /functions/v1/elevenlabs-tools/health
    → {"ok":true,"hasToolSecret":true,"authMode":"tool_token_only",
       "requestId":"req_ms8fj3mw_3poe19"}

    POST /functions/v1/elevenlabs-tools  (no Authorization header)
    → HTTP 401 {"error":"Authentication required",
                "reason":"missing_bearer_token",
                "requestId":"req_ms8fj3ti_q77gn8"}

The 401 is the important one: §8 step 2 says a 200 here would be a security
failure. It returns 401. The old hardcoded-demo-user fallback is genuinely gone.

Still to run tomorrow, because they need a signed-in session: §8 steps 3
(live session), 4 (cross-tenant isolation) and 5 (15-minute expiry).
Step 4 is the one that matters most — it is the actual test of the
vulnerability this work closed.

---

## 0. Why this is needed

The tools endpoint used to fall back to a hardcoded demo user when it couldn't
identify the caller, which meant one tenant could be served another tenant's
data. That fallback is gone. The endpoint is now fail-closed: the only accepted
credential is a short-lived, signed, per-session token minted by our app for the
logged-in user. ElevenLabs must forward that token on every tool call.

## 1. What the app already sends

`elevenlabs-session` mints a signed token (HS256, 15-minute expiry, payload
`{ userId, teamId, iat, exp }`) and starts the conversation with these dynamic
variables:

| Variable | Value |
| --- | --- |
| `secret__rari_tool_token` | The signed per-session tool token (**the one that matters**) |
| `user_id` | Supabase user id |
| `team_id` | Tenant/team id (may be absent for users with no team) |
| `user_name` | Display name |
| `current_date`, `current_datetime` | For date reasoning |

The `secret__` prefix makes ElevenLabs treat it as a secret dynamic variable and
allows it in headers.

## 2. Tool auth header

For **every** custom tool on agent `agent_0001k9d5pvdwfmvv7aq0mhaexgd6`:

- Method: `POST`
- URL: `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer {{secret__rari_tool_token}}`  ← the change

Remove if present (all now rejected):
- Static `Authorization` bearer using the Supabase anon or service key
- Any `apikey` header
- Hardcoded `user_id` / `team_id` / `DEMO_USER_ID` in body or headers
- Any per-tool "default user" value

## 3. Request body shape

```json
{
  "tool_name": "get_fleet_vehicles",
  "parameters": { "status": "available", "location": "Miami" }
}
```

Alternative: POST to `/elevenlabs-tools/<toolName>` with just the parameters
object. No resolvable tool name returns `400 Missing tool name`.

## 4. Tools to remove

- **`getWeatherInfo` — delete.** It returned randomly generated temperatures
  (fabricated data) and is removed from the backend. Delete every reference in
  the tool list and the system prompt.
- Any tool not in §5 — unknown names will not dispatch.

## 5. Supported tool names (exact, case-sensitive)

```
get_fleet_vehicles          get_bookings                get_recent_activity
getFleetMetrics             getLocationMetrics          getPaymentSummary
getVehicleDetails           getCustomerProfile          checkAvailability
getRevenueAnalysis          getTopPerformers            searchBookings
getDamageReports            getUpcomingMaintenance      getCustomerLifetimeValue
getVaultDocuments           getDemandForecast           getPricingRecommendation
getFleetPricingOverview     getEventImpact              getVehicleSpecs
getCarJoke                  logFeedback                 featureComingSoon
getVehicleProfitLoss        getFleetProfitLoss          getCompetitorRates
getSeasonalPricing          getFleetInsights            getActionItems
createBooking               updateBooking               sendCustomerMessage
get_vehicle_status          get_todays_schedule         get_booking_by_reference
search_customer             get_open_work_orders        create_booking_hold
```

Approval mode: auto-approve read-only tools; require approval for
`createBooking`, `updateBooking`, `sendCustomerMessage`, `create_booking_hold`.

## 6. System prompt edits

1. Delete any mention of weather or weather lookups.
2. Delete any mention of sample/demo vehicles (the old McLaren/Ferrari vault
   documents) — vault documents now come from the tenant's real records.
3. Add: "If a tool returns an authentication error, tell the user their session
   expired and to reopen Rari from inside the app. Never guess or invent fleet
   data."
4. Revenue is reported by rental window (when the rental occurs), not booking
   creation date — reflect that in any "revenue this month" wording.

## 7. MCP server — do not use

The `rari-mcp-server` SSE path is not the integration path. Conversational AI
agents use webhook custom tools (`elevenlabs-tools`). Remove the Rari MCP server
from the agent so it cannot shadow the webhook tools.

## 8. Verification after the change

1. Health check — **DONE, PASS** (see top of file)
2. Unauthenticated call rejected — **DONE, PASS, 401** (see top of file)
3. Live session: sign in as an Exotiq user, open Rari, ask "What vehicles do I
   have available?" → expect real Exotiq vehicles.
4. **Cross-tenant:** sign in as a Denver Exotic Rental Cars user, ask the same →
   expect Denver vehicles only, zero overlap with step 3.
5. Expiry: leave a session idle past 15 minutes, then ask → Rari should say the
   session needs restarting rather than returning data.

## 9. Failure codes

| HTTP | reason | Meaning / fix |
| --- | --- | --- |
| 401 | `missing_bearer_token` | Header not configured on that tool |
| 401 | `token_not_session_token` | Static key used instead of `{{secret__rari_tool_token}}` |
| 401 | `token_verification_failed` | Token expired or signature mismatch — restart session |
| 401 | `tool_token_secret_missing` | Server secret unset (our side) |
| 400 | Missing tool name | Body missing `tool_name` / wrong URL path |

Every response carries a `requestId` — include it when reporting a problem so the
matching edge function log can be pulled.
