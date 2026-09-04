-- MP-14 review round (2026-09-04): consent is click-verified, alerts pause on
-- unsubscribe, rate limiting evidence, duplicate-alert guard, deletion hygiene.

-- Pending consent: a request records the ask; only the confirmation click (or
-- a token-verified booking) turns marketing_consent on.
alter table public.renters
  add column consent_requested_at timestamptz,
  add column consent_text_version text,
  add column alerts_paused_at timestamptz;

-- Unsubscribe tokens are HMAC-derived; this column was never written.
drop index if exists renters_unsub_token_idx;
alter table public.renters drop column unsubscribe_token_hash;

-- Per-IP / per-address rate limiting reads recent events.
alter table public.capture_events add column ip_hash text;
create index capture_events_ip_recent_idx on public.capture_events (ip_hash, created_at desc);
create index capture_events_renter_recent_idx on public.capture_events (renter_id, created_at desc);
create index email_log_recent_idx on public.email_log (to_email, kind, created_at desc);

-- One active alert per (renter, scope, window); a repeat submit is a no-op.
create unique index availability_alerts_active_unique
  on public.availability_alerts (renter_id, coalesce(team_slug, ''), coalesce(vehicle_slug, ''), start_on, end_on)
  where status = 'active';

-- A deletion request must not leave the address behind in the send log.
alter table public.email_log drop constraint email_log_renter_id_fkey;
alter table public.email_log add constraint email_log_renter_id_fkey
  foreign key (renter_id) references public.renters(id) on delete cascade;

-- The job claims a row before sending so a retry cannot double-send.
alter table public.availability_alerts drop constraint availability_alerts_status_check;
alter table public.availability_alerts add constraint availability_alerts_status_check
  check (status in ('active', 'notifying', 'notified', 'expired', 'cancelled'));
