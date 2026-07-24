-- M6a — Payment foundations (renter money flow) — REV 2 after Lovable review
-- Ref: exotiq-rent docs/rent/M6_MONEY_PLAN.md (decisions M6-D1..D7, 2026-07-23)
-- Rev 2 changes: PI columns REMOVED (reuse the already-deployed
-- exotiq_payment_intent_id / operator_payment_intent_id — Lovable flag #3);
-- payment_due_at now clamps to pickup (flag #4); payment_stripe_mode added
-- for the sandbox ledger guard (nit #3).
-- Additive except the status CHECK swap (widens allowed values; no data
-- change), mirroring the M5 pattern.

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

-- 2. Payment bookkeeping (M6-D1 PIs live in the existing
--    exotiq_payment_intent_id / operator_payment_intent_id columns).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_stripe_mode text;

COMMENT ON COLUMN public.bookings.payment_due_at IS
  'M6-D4: pending_payment expires at min(approval+48h, pickup-2h, floor now+2h); set by trigger, sweep releases the dates.';
COMMENT ON COLUMN public.bookings.payment_stripe_mode IS
  'test | live — stamped by the payment webhook so ledger/margin views can exclude sandbox traffic (M6a gate).';

-- 3. Per-mode Stripe account mapping (sandbox-first, M6 plan §2).
--    Live account stays in stripe_account_id; the test-mode Connect account
--    for the same team lives here (create in USD to match the tenant —
--    Lovable flag #10). The _shared/stripeMode.ts helper picks by the mode
--    of STRIPE_SECRET_KEY and hard-fails if the mapped id is missing.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS stripe_test_account_id text;

COMMENT ON COLUMN public.teams.stripe_test_account_id IS
  'Test-mode Stripe Connect account for sandbox payment runs (M6). Live id remains in stripe_account_id.';

-- 4. Approval stamps the payment clock server-side, whatever surface flips
--    the status. M6-D4 + Lovable flag #4: 48h, clamped so a booking never
--    sits pending_payment past its own pickup (2h buffer), with a 2h floor
--    for very late approvals.
CREATE OR REPLACE FUNCTION public.set_payment_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_pickup timestamptz;
  v_due timestamptz;
BEGIN
  IF NEW.status = 'pending_payment'
     AND (OLD.status IS DISTINCT FROM 'pending_payment')
     AND NEW.payment_due_at IS NULL THEN
    SELECT t.timezone INTO v_tz FROM public.teams t WHERE t.id = NEW.team_id;
    -- start_date is a date; midnight in the team's zone stands in for the
    -- pickup moment (pickup_time is free-form text and not parseable).
    v_pickup := NEW.start_date::timestamp AT TIME ZONE coalesce(v_tz, 'UTC');
    v_due := LEAST(now() + interval '48 hours', v_pickup - interval '2 hours');
    NEW.payment_due_at := GREATEST(v_due, now() + interval '2 hours');
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
