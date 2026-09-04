-- MP-14 review round 3 (2026-09-04/05): consent binds to the link that named
-- it, links expire, phone is not stored, deletion is complete.

-- What the pending confirmation link stands for (comma list of
-- address|list|alert|consent) and when it was issued (7-day life).
alter table public.renters
  add column confirm_scope text,
  add column confirm_issued_at timestamptz;

-- Nothing reads the phone; the operator's system holds it for the rental.
alter table public.renters drop column phone;

-- A deletion request must not leave hashed-IP event rows behind either.
alter table public.capture_events drop constraint capture_events_renter_id_fkey;
alter table public.capture_events add constraint capture_events_renter_id_fkey
  foreign key (renter_id) references public.renters(id) on delete cascade;

create index renters_unconfirmed_age_idx on public.renters (created_at) where confirmed_at is null;
create index renters_confirm_issued_idx on public.renters (confirm_issued_at) where confirm_token_hash is not null;
