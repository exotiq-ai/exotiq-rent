// Stripe Identity: create or reuse a VerificationSession (ID plan V1).
// Ref: exotiq-rent docs/rent/ID_VERIFICATION_PLAN.md (V1-V10, 2026-07-21).
//
// Two callers:
//   1. Command Center (operator JWT): { customer_id } — caller must be a
//      member of the customer's team. Returns the hosted url to send/copy.
//   2. Renter app (guest, post-payment): { email, booking_ref } — the
//      customer is re-derived server-side from email (+ booking once M5
//      lands). Client-supplied customer ids are never trusted (plan §8).
//
// Sessions are reused while open (created/processing/requires_input with
// attempt_count < 3) so failed attempts stay on one session ledger row.
// document + matching selfie per decision V2. No PII beyond name/expiry is
// ever written to our DB (DPA 3.8).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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

const logStep = (step: string, details?: Record<string, unknown>) => {
  // Never log client secrets or PII.
  console.log(
    `[IDENTITY-CREATE-SESSION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`,
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));

    // --- Resolve the customer, never trusting client-supplied ids for the
    // --- guest path.
    let customerId: string | null = null;

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = jwt
      ? await admin.auth.getUser(jwt)
      : { data: { user: null } };

    if (userData?.user && body.customer_id) {
      // Operator path: verify team membership over the customer's team.
      const { data: customer, error } = await admin
        .from("customers")
        .select("id, team_id")
        .eq("id", body.customer_id)
        .maybeSingle();
      if (error || !customer) return json({ error: "Customer not found" }, 404);

      const { data: membership } = await admin
        .from("team_members")
        .select("id")
        .eq("team_id", customer.team_id)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!membership) return json({ error: "Not authorized for this customer" }, 403);
      customerId = customer.id;
    } else {
      // Renter/guest path: re-derive by email (+ booking_ref context).
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return json({ error: "email is required" }, 400);
      }
      const { data: customer, error } = await admin
        .from("customers")
        .select("id")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !customer) {
        // Do not leak whether an email exists beyond this generic shape.
        return json({ error: "No booking found for this email" }, 404);
      }
      customerId = customer.id;
    }

    // --- Already verified? (decision V7: marketplace-wide reuse) -----------
    const { data: existingVerified } = await admin
      .from("identity_verifications")
      .select("id, status, document_expiry")
      .eq("customer_id", customerId)
      .eq("status", "verified")
      .maybeSingle();
    if (
      existingVerified &&
      (!existingVerified.document_expiry ||
        new Date(existingVerified.document_expiry) > new Date())
    ) {
      return json({ status: "verified", reused: true });
    }

    // --- Reuse an open session when possible -------------------------------
    const { data: openRow } = await admin
      .from("identity_verifications")
      .select("id, stripe_verification_session_id, status, attempt_count")
      .eq("customer_id", customerId)
      .in("status", ["created", "processing", "requires_input"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openRow && openRow.attempt_count >= MAX_SELF_SERVE_ATTEMPTS) {
      return json({ status: "manual_review" }, 409);
    }

    if (openRow) {
      const session = await stripe.identity.verificationSessions.retrieve(
        openRow.stripe_verification_session_id,
      );
      if (session.status !== "canceled") {
        logStep("Reusing session", { customerId, status: session.status });
        return json({
          session_id: session.id,
          client_secret: session.client_secret,
          url: session.url,
          status: openRow.status,
        });
      }
    }

    // --- Create a fresh session --------------------------------------------
    const session = await stripe.identity.verificationSessions.create(
      {
        type: "document",
        options: {
          document: {
            require_matching_selfie: true, // decision V2
            allowed_types: ["driving_license", "passport", "id_card"],
          },
        },
        metadata: {
          customer_id: customerId,
          booking_ref: String(body.booking_ref ?? ""),
        },
      },
      { idempotencyKey: `idv-${customerId}-${Date.now()}` },
    );

    const { error: insertError } = await admin
      .from("identity_verifications")
      .insert({
        customer_id: customerId,
        stripe_verification_session_id: session.id,
        status: "created",
        booking_ref: body.booking_ref ?? null,
      });
    if (insertError) throw insertError;

    await admin
      .from("customers")
      .update({ identity_session_id: session.id, identity_status: "created" })
      .eq("id", customerId);

    logStep("Session created", { customerId });
    return json({
      session_id: session.id,
      client_secret: session.client_secret,
      url: session.url,
      status: "created",
    });
  } catch (error) {
    console.error("[IDENTITY-CREATE-SESSION] error", error);
    return json({ error: "Unable to start verification" }, 500);
  }
});
