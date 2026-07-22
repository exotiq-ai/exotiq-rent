// Stripe Identity webhook: the source of truth for verification status.
// Ref: exotiq-rent docs/rent/ID_VERIFICATION_PLAN.md (V1-V10, 2026-07-21).
//
// Handles: identity.verification_session.processing / verified /
// requires_input / canceled / redacted. Stores only status, verified name,
// and document expiry (decision V4) - never images, ID numbers, or DOB.
// On the 3rd failed attempt (V6): status -> manual_review + notifications
// to the customer's team members in the Command Center.
//
// config.toml: verify_jwt = false (Stripe calls this; auth is the signature).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const MAX_SELF_SERVE_ATTEMPTS = 3; // decision V6

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(
    `[IDENTITY-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`,
  );
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    console.error("[IDENTITY-WEBHOOK] missing STRIPE_SECRET_KEY or STRIPE_IDENTITY_WEBHOOK_SECRET");
    return new Response("Configuration error", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("[IDENTITY-WEBHOOK] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!event.type.startsWith("identity.verification_session.")) {
    return new Response(JSON.stringify({ ignored: event.type }), { status: 200 });
  }

  const session = event.data.object as Stripe.Identity.VerificationSession;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: row } = await admin
    .from("identity_verifications")
    .select("id, customer_id, attempt_count, status")
    .eq("stripe_verification_session_id", session.id)
    .maybeSingle();
  if (!row) {
    // Session not ours (e.g. created manually in the dashboard) - ack anyway.
    logStep("Unknown session acked", { event: event.type });
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const patch: Record<string, unknown> = {};
  let customerPatch: Record<string, unknown> | null = null;
  let notifyManualReview = false;

  switch (event.type) {
    case "identity.verification_session.processing":
      patch.status = "processing";
      customerPatch = { identity_status: "processing" };
      break;

    case "identity.verification_session.verified": {
      patch.status = "verified";
      patch.verified_at = new Date().toISOString();
      patch.last_error_code = null;
      patch.last_error_reason = null;
      // Pull ONLY name + expiry from verified outputs (decision V4).
      try {
        const expanded = await stripe.identity.verificationSessions.retrieve(
          session.id,
          { expand: ["verified_outputs"] },
        );
        const outputs = expanded.verified_outputs;
        if (outputs?.first_name || outputs?.last_name) {
          patch.verified_name =
            [outputs.first_name, outputs.last_name].filter(Boolean).join(" ");
        }
        const report = expanded.last_verification_report;
        if (typeof report === "string") {
          const fullReport = await stripe.identity.verificationReports.retrieve(
            report,
            { expand: ["document"] },
          );
          const expiry = fullReport.document?.expiration_date;
          if (expiry?.year && expiry.month && expiry.day) {
            patch.document_expiry = `${expiry.year}-${String(expiry.month).padStart(2, "0")}-${String(expiry.day).padStart(2, "0")}`;
          }
        }
      } catch (err) {
        console.error("[IDENTITY-WEBHOOK] verified_outputs fetch failed (status still applied)", err);
      }
      customerPatch = {
        identity_status: "verified",
        id_verified: true,
        id_verified_at: new Date().toISOString(),
      };
      break;
    }

    case "identity.verification_session.requires_input": {
      const attempts = (row.attempt_count ?? 0) + 1;
      patch.attempt_count = attempts;
      patch.last_error_code = session.last_error?.code ?? null;
      patch.last_error_reason = session.last_error?.reason ?? null;
      if (attempts >= MAX_SELF_SERVE_ATTEMPTS) {
        patch.status = "manual_review";
        customerPatch = { identity_status: "manual_review" };
        notifyManualReview = true;
      } else {
        patch.status = "requires_input";
        customerPatch = { identity_status: "requires_input" };
      }
      break;
    }

    case "identity.verification_session.canceled":
      patch.status = "canceled";
      customerPatch = { identity_status: "canceled" };
      break;

    case "identity.verification_session.redacted":
      patch.status = "redacted";
      patch.redacted_at = new Date().toISOString();
      patch.verified_name = null;
      customerPatch = { identity_status: "redacted", identity_session_id: null };
      break;

    default:
      return new Response(JSON.stringify({ ignored: event.type }), { status: 200 });
  }

  const { error: updateError } = await admin
    .from("identity_verifications")
    .update(patch)
    .eq("id", row.id);
  if (updateError) {
    console.error("[IDENTITY-WEBHOOK] ledger update failed", updateError);
    return new Response("Database error", { status: 500 });
  }

  if (customerPatch) {
    await admin.from("customers").update(customerPatch).eq("id", row.customer_id);
  }

  // Decision V6: notify the tenant's team members on manual review.
  if (notifyManualReview) {
    const { data: customer } = await admin
      .from("customers")
      .select("id, full_name, team_id")
      .eq("id", row.customer_id)
      .maybeSingle();
    if (customer?.team_id) {
      const { data: members } = await admin
        .from("team_members")
        .select("user_id")
        .eq("team_id", customer.team_id);
      const rows = (members ?? []).map((m) => ({
        user_id: m.user_id,
        type: "identity_manual_review",
        title: "ID verification needs review",
        message:
          `${customer.full_name ?? "A customer"} failed ID verification ${MAX_SELF_SERVE_ATTEMPTS} times. Review in Verification.`,
        data: { customer_id: customer.id },
      }));
      if (rows.length > 0) {
        await admin.from("notifications").insert(rows);
      }
    }
  }

  logStep("Applied", { event: event.type, status: patch.status });
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
