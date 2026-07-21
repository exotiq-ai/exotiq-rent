-- Stripe Identity verification plumbing (ID verification plan V1).
-- Ref: exotiq-rent docs/rent/ID_VERIFICATION_PLAN.md (decisions V1-V10, 2026-07-21).
--
-- Additive only. No ID images or ID numbers are ever stored here (DPA 3.8):
-- only session references, statuses, verified name, and document expiry.

-- 1. Verification session ledger -------------------------------------------

CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  stripe_verification_session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'processing', 'verified', 'requires_input', 'canceled', 'redacted', 'manual_review')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_reason TEXT,
  verified_name TEXT,
  document_expiry DATE,
  booking_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  redacted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_customer
  ON public.identity_verifications(customer_id);

-- 2. Customer quick-read columns (Command Center reads these directly) ------

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS identity_session_id TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS identity_status TEXT;

-- 3. updated_at maintenance --------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_identity_verification_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_identity_verifications_updated_at ON public.identity_verifications;
CREATE TRIGGER trg_identity_verifications_updated_at
  BEFORE UPDATE ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_identity_verification_updated_at();

-- 4. RLS: team-scoped read, service-role-only writes -------------------------
-- Clients never insert or mutate rows; only the identity-webhook /
-- identity-create-session edge functions (service role) do.

ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can view identity verifications" ON public.identity_verifications;
CREATE POLICY "Team members can view identity verifications"
ON public.identity_verifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = identity_verifications.customer_id
      AND (c.user_id = auth.uid() OR public.is_team_member_of_record(auth.uid(), c.team_id))
  )
);

-- No INSERT/UPDATE/DELETE policies on purpose: writes are service-role only.
