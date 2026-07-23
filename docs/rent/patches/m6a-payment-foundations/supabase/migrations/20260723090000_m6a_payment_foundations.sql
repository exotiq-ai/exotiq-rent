-- M6a — Payment foundations (renter money flow)
-- Ref: exotiq-rent docs/rent/M6_MONEY_PLAN.md (decisions M6-D1..D6, 2026-07-23)
-- Additive except the status CHECK swap (widens allowed values; no data change),
-- mirroring the M5 pattern (20260722050000_renter_booking_writes.sql).

-- 1. Widen booking statuses with the payment-expiry terminal state (M6-D4).
--    'payment_expired' is deliberately ABSENT from every availability /
--    overlap status list and from the GiST exclusion predicate, so expiring
--    a booking releases its dates with no further action.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
CHECK (status = ANY (ARRAY[
  'pending', 'confirmed', 'active', 'completed', 'cancelled',
  'requested', 'pending_documents', 'pending_payment', 'declined', 'refunded',
  'payment_expired'
]));

-- 2. Payment tracking columns (M6-D1: two PaymentIntents per booking).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS platform_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN public.bookings.payment_due_at IS
  'M6-D4: pending_payment bookings expire 48h after operator approval; set by trigger, sweep releases the dates.';
COMMENT ON COLUMN public.bookings.operator_payment_intent_id IS
  'Direct charge on the operator''s connected account (rental). M6-D1.';
COMMENT ON COLUMN public.bookings.platform_payment_intent_id IS
  'Platform-account charge (Exotiq booking fee + protection, EXOTIQ.RENT descriptor). M6-D1.';

-- 3. Per-mode Stripe account mapping (sandbox-first, M6 plan §2).
--    Live account stays in stripe_account_id; test-mode Connect account for
--    the same team lives here. The _shared/stripeMode.ts helper picks by the
--    mode of STRIPE_SECRET_KEY, and hard-fails if the mapped id is missing —
--    money must never silently route to the wrong account.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS stripe_test_account_id text;

COMMENT ON COLUMN public.teams.stripe_test_account_id IS
  'Test-mode Stripe Connect account for sandbox payment runs (M6). Live id remains in stripe_account_id.';

-- 4. Approval stamps the 48h payment clock server-side, regardless of which
--    surface flips the status (M6-D4).
CREATE OR REPLACE FUNCTION public.set_payment_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending_payment'
     AND (OLD.status IS DISTINCT FROM 'pending_payment')
     AND NEW.payment_due_at IS NULL THEN
    NEW.payment_due_at := now() + interval '48 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_payment_due_at ON public.bookings;
CREATE TRIGGER trg_set_payment_due_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_due_at();

-- 5. Expiry sweep (M6d wires the scheduler; callable manually until then).
--    Marketplace-only: legacy operator-created bookings are never expired.
CREATE OR REPLACE FUNCTION public.expire_overdue_payment_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.bookings
     SET status = 'payment_expired'
   WHERE status = 'pending_payment'
     AND booking_source = 'marketplace'
     AND payment_due_at IS NOT NULL
     AND payment_due_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM anon;
REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_overdue_payment_bookings() TO service_role;
