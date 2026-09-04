-- MP-14 (2026-09-04): renter capture, Exotiq-owned project `exotiq-renters`.
-- No accounts, no login: a renter is an e-mail address with recorded consent.
-- Everything here is server-only — the app's route handlers use the service
-- role; anon/authenticated are revoked outright and RLS is on with no
-- policies as a second lock.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table public.renters (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text,
  phone text,
  -- Marketing consent is explicit and dated; the source names the surface
  -- (booking | save_list | alert | footer) and the hashes support a dispute.
  marketing_consent boolean not null default false,
  consented_at timestamptz,
  consent_source text,
  consent_ip_hash text,
  consent_user_agent text,
  -- Double opt-in: nothing but the confirmation e-mail goes out until confirmed_at is set.
  confirmed_at timestamptz,
  confirm_token_hash text,
  confirm_sent_at timestamptz,
  unsubscribe_token_hash text,
  unsubscribed_at timestamptz,
  first_source text,
  first_path text,
  first_team_slug text,
  first_vehicle_slug text,
  first_booking_ref text,
  last_booking_ref text,
  bookings_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index renters_mailable_idx on public.renters (marketing_consent, confirmed_at) where unsubscribed_at is null;
create index renters_confirm_token_idx on public.renters (confirm_token_hash) where confirm_token_hash is not null;
create index renters_unsub_token_idx on public.renters (unsubscribe_token_hash) where unsubscribe_token_hash is not null;

create table public.saved_cars (
  renter_id uuid not null references public.renters(id) on delete cascade,
  team_slug text not null,
  vehicle_slug text not null,
  vehicle_name text,
  saved_at timestamptz not null default now(),
  primary key (renter_id, team_slug, vehicle_slug)
);

create table public.availability_alerts (
  id uuid primary key default gen_random_uuid(),
  renter_id uuid not null references public.renters(id) on delete cascade,
  team_slug text,        -- null: any listed operator
  vehicle_slug text,     -- null: any car of that operator (or any car at all)
  start_on date not null,
  end_on date not null,
  status text not null default 'active' check (status in ('active', 'notified', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  last_checked_at timestamptz,
  notified_at timestamptz,
  check (end_on > start_on)
);
create index availability_alerts_active_idx on public.availability_alerts (start_on) where status = 'active';

create table public.capture_events (
  id bigserial primary key,
  renter_id uuid references public.renters(id) on delete set null,
  kind text not null,
  source text,
  path text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.email_log (
  id bigserial primary key,
  renter_id uuid references public.renters(id) on delete set null,
  kind text not null,
  to_email citext not null,
  provider_id text,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger renters_touch before update on public.renters for each row execute function public.touch_updated_at();

-- Lock the public API surface: nothing here is readable or callable by the
-- anon or authenticated roles, now or for tables/functions added later.
alter table public.renters enable row level security;
alter table public.saved_cars enable row level security;
alter table public.availability_alerts enable row level security;
alter table public.capture_events enable row level security;
alter table public.email_log enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
