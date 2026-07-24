// M6b: Stripe webhook for the renter payment flow.
// Ref: exotiq-rent docs/rent/M6_MONEY_PLAN.md (M6-D1 rev 2) and
// docs/rent/patches/m6a-payment-foundations/README.md.
//
// Registered in Stripe (per mode) for:
//   - checkout.session.completed   (operator rental paid on-session)
//   - payment_intent.succeeded     (Exotiq leg async-confirm path)
//   - payment_intent.payment_failed
//
// State rule (Lovable flag #6): 'confirmed' fires ONLY when both legs have
// succeeded, evaluated from the booking row — never from a single event —
// so redelivery and reordering are harmless. Events dedupe via the
// stripe_webhook_events table.
//
// Partial failure (rental paid, Exotiq leg declined): the booking STAYS
// pending_payment with an ops alert in user_activity_log; the renter
// retries from the confirmation page. Never silently confirmed.
//
// config.toml: verify_jwt = false (Stripe calls this, not a user).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";
import { resolveStripeMode } from "../_shared/stripeMode.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[RENT-PAYMENT-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Confirm iff both legs succeeded (idempotent; safe under redelivery). */
async function confirmIfFullyPaid(db: ReturnType<typeof admin>, bookingRef: string, mode: string) {
  const { data: booking } = await db
    .from("bookings")
    .select("id, status, operator_payment_intent_id, exotiq_payment_intent_id, paid_at")
    .eq("booking_ref", bookingRef)
    .maybeSingle();
  if (!booking) return;
  if (booking.status !== "pending_payment") return; // already confirmed / expired / declined
  if (!booking.operator_payment_intent_id || !booking.exotiq_payment_intent_id) return;

  const { error } = await db
    .from("bookings")
    .update({
      status: "confirmed",
      paid_at: booking.paid_at ?? new Date().toISOString(),
      payment_stripe_mode: mode,
    })
    .eq("id", booking.id)
    .eq("status", "pending_payment"); // guard against races
  if (!error) logStep("Booking confirmed", { bookingRef });
}

async function opsAlert(db: ReturnType<typeof admin>, bookingRef: string, action: string, details: Record<string, unknown>) {
  // Best-effort — mirrors the M5 audit-trail pattern.
  try {
    const { data: booking } = await db
      .from("bookings")
      .select("user_id, team_id")
      .eq("booking_ref", bookingRef)
      .maybeSingle();
    if (!booking) return;
    await db.from("user_activity_log").insert({
      user_id: booking.user_id,
      team_id: booking.team_id,
      action,
      details: { booking_ref: bookingRef, ...details },
    });
  } catch (_) {
    // never fail the webhook over telemetry
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("RENT_PAYMENT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[RENT-PAYMENT-WEBHOOK] RENT_PAYMENT_WEBHOOK_SECRET not set");
    return new Response("Misconfigured", { status: 500 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature") ?? "";
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (err) {
    console.error("[RENT-PAYMENT-WEBHOOK] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const db = admin();
  const mode = resolveStripeMode();

  // Dedupe via the existing stripe_webhook_events table (Lovable flag #6).
  // APPLY NOTE: align column names with the deployed table if they differ.
  const { error: dedupeError } = await db
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type });
  if (dedupeError) {
    // Unique violation → already processed; anything else → let Stripe retry.
    if ((dedupeError as { code?: string }).code === "23505") {
      logStep("Duplicate event skipped", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }
    console.error("[RENT-PAYMENT-WEBHOOK] dedupe insert failed", dedupeError);
    return new Response("Dedupe failure", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingRef = session.metadata?.booking_ref;
        if (!bookingRef || session.metadata?.leg !== "operator_rental") break;
        const operatorPi = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
        if (!operatorPi) break;

        logStep("Rental paid", { bookingRef, operatorPi });
        await db
          .from("bookings")
          .update({ operator_payment_intent_id: operatorPi, payment_stripe_mode: mode })
          .eq("booking_ref", bookingRef)
          .eq("status", "pending_payment");

        // Second leg: the Exotiq portion, off-session on the platform, using
        // the payment method the Checkout just saved.
        const { data: booking } = await db
          .from("bookings")
          .select("booking_ref, status, platform_fee_cents, protection_total_cents, exotiq_payment_intent_id")
          .eq("booking_ref", bookingRef)
          .maybeSingle();
        if (!booking || booking.status !== "pending_payment") break;
        if (booking.exotiq_payment_intent_id) {
          await confirmIfFullyPaid(db, bookingRef, mode);
          break;
        }

        const exotiqCents = Number(booking.platform_fee_cents ?? 0) + Number(booking.protection_total_cents ?? 0);
        if (exotiqCents <= 0) {
          // Fee-free booking (e.g. 0% + declined protection): rental alone completes it.
          await db
            .from("bookings")
            .update({ exotiq_payment_intent_id: "none_required" })
            .eq("booking_ref", bookingRef);
          await confirmIfFullyPaid(db, bookingRef, mode);
          break;
        }

        const rentalPi = await stripe.paymentIntents.retrieve(operatorPi);
        const paymentMethod = typeof rentalPi.payment_method === "string"
          ? rentalPi.payment_method
          : rentalPi.payment_method?.id;
        const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (!paymentMethod || !customer) {
          await opsAlert(db, bookingRef, "renter_payment_partial_failure", {
            reason: "saved payment method or customer missing for the Exotiq leg",
          });
          break;
        }

        try {
          const exotiqPi = await stripe.paymentIntents.create(
            {
              amount: exotiqCents,
              currency: rentalPi.currency,
              customer,
              payment_method: paymentMethod,
              off_session: true,
              confirm: true,
              statement_descriptor_suffix: "EXOTIQ RENT",
              description: `Exotiq booking fee + protection — ${bookingRef}`,
              metadata: { booking_ref: bookingRef, leg: "exotiq_fee_protection", stripe_mode: mode },
            },
            { idempotencyKey: `exotiq-leg-${bookingRef}` },
          );
          await db
            .from("bookings")
            .update({ exotiq_payment_intent_id: exotiqPi.id })
            .eq("booking_ref", bookingRef);
          if (exotiqPi.status === "succeeded") {
            await confirmIfFullyPaid(db, bookingRef, mode);
          }
          // Non-terminal PI statuses resolve via payment_intent.succeeded.
        } catch (chargeError) {
          logStep("Exotiq leg declined", { bookingRef });
          await opsAlert(db, bookingRef, "renter_payment_partial_failure", {
            reason: "exotiq fee+protection charge declined off-session",
            detail: chargeError instanceof Error ? chargeError.message : String(chargeError),
          });
          // Booking stays pending_payment; renter retries from the
          // confirmation page (rent-checkout refuses non-pending states, so
          // the retry surface is the Exotiq leg alone via this webhook path
          // when Stripe retries, or ops follow-up).
        }
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingRef = pi.metadata?.booking_ref;
        if (!bookingRef || pi.metadata?.leg !== "exotiq_fee_protection") break;
        await db
          .from("bookings")
          .update({ exotiq_payment_intent_id: pi.id })
          .eq("booking_ref", bookingRef)
          .eq("status", "pending_payment");
        await confirmIfFullyPaid(db, bookingRef, mode);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingRef = pi.metadata?.booking_ref;
        if (!bookingRef) break;
        await opsAlert(db, bookingRef, "renter_payment_failed", {
          leg: pi.metadata?.leg ?? "unknown",
          reason: pi.last_payment_error?.message ?? "payment_failed",
        });
        break;
      }

      default:
        logStep("Ignored event", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("[RENT-PAYMENT-WEBHOOK] handler error", error);
    // Release the dedupe row so Stripe's redelivery actually reprocesses —
    // otherwise the duplicate check would swallow the retry of failed work.
    // Per-leg idempotency keys keep the retry from double-charging.
    await db.from("stripe_webhook_events").delete().eq("event_id", event.id);
    return new Response("Handler error", { status: 500 });
  }
});
