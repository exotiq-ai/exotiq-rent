// M6b: renter payment — hosted Stripe Checkout for an approved booking.
// Ref: exotiq-rent docs/rent/M6_MONEY_PLAN.md (M6-D1 rev 2) and
// docs/rent/patches/m6a-payment-foundations/README.md (design contract).
//
// EVOLVES the 2026-07-22 rent-checkout in place (Lovable flag #3) — the
// two-PI direct-charge draft is replaced by this hosted-Checkout design.
//
// Anonymous POST { booking_ref, token }. Everything else is derived
// server-side: the booking must be marketplace-sourced, token-matched,
// status 'pending_payment', and unexpired. Amounts come from the booking's
// fee snapshot — request bodies never carry totals.
//
// Charge model (M6-D1 rev 2): this Checkout charges the OPERATOR RENTAL
// on-session on the platform account as a destination charge
// (on_behalf_of + transfer_data → operator statement descriptor), saving
// the card platform-side (setup_future_usage: off_session). The webhook
// (rent-payment-webhook) then charges the smaller Exotiq portion
// off-session on the platform. No payment-method cloning anywhere.
//
// M6-D2 (each party absorbs own processing fee): transfer_data.amount nets
// the operator's estimated Stripe share out of the transfer.
//
// config.toml: verify_jwt = false (guest checkout; anon key passes gateway).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { resolveStripeMode, teamConnectedAccountId } from "../_shared/stripeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple per-IP limiter (matches rent-create-booking / demo-login).
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_HOUR = 30;

function allowRequest(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (!ip) return true;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry && entry.resetAt > now) {
    if (entry.count >= MAX_PER_HOUR) return false;
    entry.count += 1;
    return true;
  }
  rateLimitMap.set(ip, { count: 1, resetAt: now + 3_600_000 });
  return true;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[RENT-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

/** Operator's estimated Stripe processing share (M6-D2). Standard card
 * pricing; trued up post-settlement is a later nicety, estimate is fine. */
function stripeFeeEstimateCents(amountCents: number): number {
  return Math.round(amountCents * 0.029) + 30;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!allowRequest(req)) return json({ error: "Too many requests" }, 429);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const bookingRef = typeof body.booking_ref === "string" ? body.booking_ref.trim() : "";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!bookingRef || !token) return json({ error: "booking_ref and token are required" }, 400);

    // Token-gated booking load. Service role, but the token IS the renter's
    // credential — a wrong token reads nothing.
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, booking_ref, status, booking_source, confirmation_token, payment_due_at, " +
        "total_value, platform_fee_cents, protection_total_cents, protection_tier, " +
        "operator_payment_intent_id, customer_name, customer_email, team_id, vehicle_id",
      )
      .eq("booking_ref", bookingRef)
      .eq("booking_source", "marketplace")
      .maybeSingle();
    if (bookingError) throw bookingError;
    if (!booking || booking.confirmation_token !== token) {
      return json({ error: "Booking not found" }, 404);
    }
    if (booking.status !== "pending_payment") {
      return json({ error: `Booking is not awaiting payment (status: ${booking.status})` }, 409);
    }
    if (booking.operator_payment_intent_id) {
      // Rental already captured; only the Exotiq leg is settling (partial-
      // failure window). Never mint a second rental Checkout.
      return json({ error: "Payment is finalizing — check back shortly", code: "rental_already_paid" }, 409);
    }
    if (booking.payment_due_at && new Date(booking.payment_due_at).getTime() < Date.now()) {
      return json({ error: "The payment window for this booking has expired" }, 410);
    }
    if (booking.platform_fee_cents == null || booking.protection_total_cents == null) {
      // Pre-M6b booking without a fee snapshot — never guess amounts.
      logStep("Missing fee snapshot", { bookingRef });
      return json({ error: "This booking predates online payment — contact the operator" }, 409);
    }

    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id, slug, name, currency, stripe_account_id, stripe_test_account_id")
      .eq("id", booking.team_id)
      .single();
    if (teamError) throw teamError;

    const { data: vehicle } = await admin
      .from("vehicles")
      .select("name")
      .eq("id", booking.vehicle_id)
      .single();

    const mode = resolveStripeMode();
    const operatorAccountId = teamConnectedAccountId(team, mode);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const currency = (team.currency || "USD").toLowerCase();

    const rentalCents = Math.round(Number(booking.total_value) * 100);
    if (!Number.isFinite(rentalCents) || rentalCents <= 0) {
      return json({ error: "Booking amount is invalid" }, 409);
    }

    // Platform customer: dedupe by renter email (Lovable flag #9).
    const email = String(booking.customer_email || "").toLowerCase();
    let customerId: string | undefined;
    if (email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      customerId = existing.data[0]?.id;
      if (!customerId) {
        const created = await stripe.customers.create({
          email,
          name: booking.customer_name ?? undefined,
          metadata: { booking_ref: booking.booking_ref },
        });
        customerId = created.id;
      }
    }

    const origin = req.headers.get("origin") || "https://book.exotiq.rent";
    const returnBase = `${origin}/booking/${encodeURIComponent(booking.booking_ref)}?t=${encodeURIComponent(token)}`;

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        // Card-only: guarantees the saved PM is reusable off-session for the
        // Exotiq leg (M6a README / Lovable flag #2).
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `${vehicle?.name ?? "Vehicle"} rental — ${team.name}`,
                description: `Booking ${booking.booking_ref}`,
              },
              unit_amount: rentalCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          setup_future_usage: "off_session",
          on_behalf_of: operatorAccountId,
          transfer_data: {
            destination: operatorAccountId,
            amount: rentalCents - stripeFeeEstimateCents(rentalCents),
          },
          metadata: {
            booking_ref: booking.booking_ref,
            leg: "operator_rental",
            stripe_mode: mode,
          },
        },
        success_url: `${returnBase}&payment=success`,
        cancel_url: `${returnBase}&payment=cancelled`,
        metadata: {
          booking_ref: booking.booking_ref,
          leg: "operator_rental",
          stripe_mode: mode,
        },
      },
      { idempotencyKey: `rent-checkout-${booking.booking_ref}-${booking.payment_due_at ?? ""}` },
    );

    logStep("Checkout session created", { bookingRef, mode, sessionId: session.id });
    return json({ url: session.url });
  } catch (error) {
    console.error("[RENT-CHECKOUT] error", error);
    return json({ error: "Unable to start payment" }, 500);
  }
});
