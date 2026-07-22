// Stripe Identity: safe status polling for the renter confirmation screen.
// Ref: exotiq-rent docs/rent/ID_VERIFICATION_PLAN.md (V1-V10, 2026-07-21).
//
// GET /identity-session-status?session=<vs_...>
// -> { status, last_error_reason?, attempts_remaining }
//
// Returns status ONLY - no PII, no client secret. The renter app polls this
// after stripe.verifyIdentity() resolves, until the webhook lands `verified`.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_SELF_SERVE_ATTEMPTS = 3; // decision V6

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const sessionId = new URL(req.url).searchParams.get("session")?.trim() ?? "";
  if (!sessionId.startsWith("vs_")) {
    return json({ error: "session query param (vs_...) is required" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: row, error } = await admin
    .from("identity_verifications")
    .select("status, attempt_count, last_error_reason")
    .eq("stripe_verification_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[IDENTITY-SESSION-STATUS] lookup failed", error);
    return json({ error: "Lookup failed" }, 500);
  }
  if (!row) return json({ error: "Unknown session" }, 404);

  return json({
    status: row.status,
    last_error_reason:
      row.status === "requires_input" ? row.last_error_reason : undefined,
    attempts_remaining: Math.max(0, MAX_SELF_SERVE_ATTEMPTS - (row.attempt_count ?? 0)),
  });
});
