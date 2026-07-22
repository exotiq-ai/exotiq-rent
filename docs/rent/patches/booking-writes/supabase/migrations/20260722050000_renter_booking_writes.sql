-- M5: renter booking writes (goal brief M5 + marketplace testing handoff gap #1).
-- Ref: exotiq-rent docs/rent/RENTER_APP_GOAL.md; DECISIONS D2/D3/D4/D6.
--
-- Additive except the status CHECK swap (widens allowed values; no data change).

-- 1. D3 lifecycle states -----------------------------------------------------

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
CHECK (status = ANY (ARRAY[
  'pending', 'confirmed', 'active', 'completed', 'cancelled',
  'requested', 'pending_documents', 'pending_payment', 'declined', 'refunded'
]));

-- 2. D4: confirmation access token (bookingRef alone reveals nothing) --------

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS idx_bookings_booking_ref ON public.bookings(booking_ref);

-- 3. DB-level double-booking guard (FLAGGED F-BUG-1-DB) -----------------------
-- Scoped to marketplace-source blocking rows so legacy operator data with
-- historical overlaps cannot fail the apply. Marketplace-vs-operator overlap
-- is handled by the pre-check inside create_marketplace_booking below;
-- extending the constraint fleet-wide is a follow-up after a data-cleanup
-- pass (needs Lovable to dedupe existing operator overlaps first).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_no_marketplace_overlap;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_no_marketplace_overlap
EXCLUDE USING gist (
  vehicle_id WITH =,
  tstzrange(start_date, end_date, '[)') WITH &&
) WHERE (
  booking_source = 'marketplace'
  AND status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
);

-- 4. Transactional booking creation (service-role only) ----------------------
-- One SQL function = one transaction: re-check overlap against ALL blocking
-- bookings (operator + marketplace), upsert the guest customer (D6), insert
-- the booking. The edge function does validation/rate-limit/identity/quote
-- and calls this; anon/authenticated cannot execute it directly.

CREATE OR REPLACE FUNCTION public.create_marketplace_booking(
  _team_slug text,
  _vehicle_slug text,
  _start_date date,
  _end_date date,
  _pickup_time text,
  _customer_name text,
  _customer_email text,
  _customer_phone text,
  _daily_rate numeric,
  _total_value numeric,
  _initial_status text
)
RETURNS TABLE (booking_id uuid, booking_ref text, confirmation_token uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team public.teams%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_customer_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_pickup text;
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF _initial_status NOT IN ('requested', 'pending_documents') THEN
    RAISE EXCEPTION 'invalid_initial_status';
  END IF;

  SELECT t.* INTO v_team FROM public.teams t WHERE t.slug = _team_slug;
  IF NOT FOUND OR NOT public.is_marketplace_team(v_team.id) THEN
    RAISE EXCEPTION 'team_not_available';
  END IF;

  SELECT v.* INTO v_vehicle
  FROM public.vehicles v
  WHERE v.team_id = v_team.id AND v.slug = _vehicle_slug;
  IF NOT FOUND OR NOT public.is_marketplace_vehicle(v_vehicle.id) THEN
    RAISE EXCEPTION 'vehicle_not_available';
  END IF;

  -- Same local time on pickup and return day, in the team's timezone.
  v_start := ((_start_date::text || ' ' || coalesce(_pickup_time, '10:00 AM'))::timestamp)
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  v_end   := ((_end_date::text || ' ' || coalesce(_pickup_time, '10:00 AM'))::timestamp)
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  IF v_end <= v_start THEN
    RAISE EXCEPTION 'invalid_date_range';
  END IF;

  -- Friendly overlap pre-check against ALL blocking bookings (any source).
  -- The exclusion constraint above is the concurrency-safe backstop for
  -- marketplace rows racing each other.
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.vehicle_id = v_vehicle.id
      AND b.status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
      AND tstzrange(b.start_date, b.end_date, '[)') && tstzrange(v_start, v_end, '[)')
  ) THEN
    RAISE EXCEPTION 'dates_unavailable';
  END IF;

  -- Guest checkout (D6): attach to the team's CRM by email, create if new.
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.team_id = v_team.id AND lower(c.email) = lower(_customer_email)
  ORDER BY c.created_at
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (user_id, team_id, email, full_name, phone)
    VALUES (v_team.owner_id, v_team.id, lower(_customer_email), _customer_name, _customer_phone)
    RETURNING id INTO v_customer_id;
  END IF;

  INSERT INTO public.bookings (
    user_id, team_id, vehicle_id, customer_id,
    customer_name, customer_email, customer_phone,
    start_date, end_date,
    pickup_location,
    daily_rate, total_value,
    status, booking_source
  ) VALUES (
    v_team.owner_id, v_team.id, v_vehicle.id, v_customer_id,
    _customer_name, lower(_customer_email), _customer_phone,
    v_start, v_end,
    'Arranged with operator',
    _daily_rate, _total_value,
    _initial_status, 'marketplace'
  )
  RETURNING * INTO v_booking;

  -- Best-effort audit trail; never fail the booking over it.
  BEGIN
    INSERT INTO public.user_activity_log (user_id, team_id, action, details)
    VALUES (
      v_team.owner_id, v_team.id, 'marketplace_booking_created',
      jsonb_build_object('booking_ref', v_booking.booking_ref, 'vehicle_slug', _vehicle_slug, 'source', 'rent-create-booking')
    );
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN QUERY SELECT v_booking.id, v_booking.booking_ref, v_booking.confirmation_token, v_booking.status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text) FROM authenticated;

-- 5. D4: public confirmation read (token-gated) -------------------------------
-- Without the token: existence + status only. With it: the renter-safe
-- summary. Never exposes customer PII, internal ids, or notes.

CREATE OR REPLACE FUNCTION public.public_booking_by_ref(_booking_ref text, _token uuid DEFAULT NULL)
RETURNS TABLE (
  booking_ref text,
  status text,
  team_slug text,
  team_name text,
  vehicle_slug text,
  vehicle_name text,
  start_at timestamptz,
  end_at timestamptz,
  total_cents bigint,
  currency text,
  authorized boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.booking_ref,
    b.status,
    CASE WHEN b.confirmation_token = _token THEN t.slug END AS team_slug,
    CASE WHEN b.confirmation_token = _token THEN t.name END AS team_name,
    CASE WHEN b.confirmation_token = _token THEN v.slug END AS vehicle_slug,
    CASE WHEN b.confirmation_token = _token THEN v.name END AS vehicle_name,
    CASE WHEN b.confirmation_token = _token THEN b.start_date END AS start_at,
    CASE WHEN b.confirmation_token = _token THEN b.end_date END AS end_at,
    CASE WHEN b.confirmation_token = _token THEN round(b.total_value * 100)::bigint END AS total_cents,
    t.currency,
    (b.confirmation_token = _token) AS authorized
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.booking_ref = _booking_ref
    AND b.booking_source = 'marketplace'
$$;

GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO anon, authenticated;
