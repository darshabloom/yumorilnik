-- Yumorilnik: restricted activation for a publicly usable TEST12 free-booking code.
-- DO NOT apply until the correct Yumorilnik project and email sending are configured.
-- Full-price checkout intentionally remains unavailable.
-- A confirmed free booking holds its seats; a mere requested booking does not.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
 check(status in ('requested','confirmed','cancelled'));
alter table public.bookings add column if not exists original_total_cents bigint;
alter table public.bookings add column if not exists promo_code text;
alter table public.bookings add column if not exists confirmed_at timestamptz;
alter table public.bookings add column if not exists confirmation_email_status text not null default 'not_queued'
 check(confirmation_email_status in ('not_queued','pending','sent','failed'));
create table if not exists public.booking_promotions(
 code text primary key,
 enabled boolean not null default false,
 percent_off integer not null default 100 check(percent_off between 0 and 100),
 created_at timestamptz not null default now()
);
insert into public.booking_promotions(code,enabled,percent_off)
values('TEST12',false,100) on conflict(code) do nothing;
alter table public.booking_promotions enable row level security;
revoke all on public.booking_promotions from public,anon,authenticated;

-- Email sending is not installed. This is an operator-only queue, not evidence of
-- delivery. It must be processed by an authenticated provider after configuration.
create table if not exists public.booking_confirmation_outbox(
 booking_id uuid primary key references public.bookings(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sent','failed')),
 attempts integer not null default 0,
 last_error text,
 sent_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.booking_confirmation_outbox enable row level security;
revoke all on public.booking_confirmation_outbox from public,anon,authenticated;

-- The existing public submit_booking RPC creates only unconfirmed requests.
-- This second, narrow RPC is the sole mechanism to confirm a free TEST12 reservation.
create or replace function yumorilnik_internal.submit_test12_impl(
 p_event_id uuid, p_client_request_id uuid, p_tickets jsonb,
 p_guests jsonb, p_selections jsonb, p_promo_code text
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare
 v_result jsonb;
 v_booking public.bookings%rowtype;
 v_selected record;
 v_existing record;
 v_whole boolean;
begin
 if p_promo_code is distinct from 'TEST12' then
  raise exception 'Invalid promotional code' using errcode='22023';
 end if;
 if not exists(select 1 from public.booking_promotions
   where code='TEST12' and enabled=true and percent_off=100) then
  raise exception 'TEST12 is not enabled' using errcode='22023';
 end if;
 -- Same lock used by submit_booking_impl, so concurrent confirmations for the
 -- same event are serialised in a single transaction.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text,0));
 select * into v_existing from public.bookings where client_request_id=p_client_request_id;
 if found and v_existing.status='confirmed' and v_existing.promo_code='TEST12'
    and v_existing.event_id=p_event_id then
  return pg_catalog.jsonb_build_object('reference',v_existing.booking_reference,
   'status','confirmed','total_cents',0,
   'confirmation_email_status',v_existing.confirmation_email_status);
 end if;
 if found then raise exception 'Request identifier already used' using errcode='22023'; end if;

 -- All guest identity and seating checks, ticket capacity checks and actual
 -- prices are recomputed by the existing database function, never the browser.
 v_result:=yumorilnik_internal.submit_booking_impl(
  p_event_id,p_client_request_id,p_tickets,p_guests,p_selections);
 select * into v_booking from public.bookings where client_request_id=p_client_request_id;
 if v_booking.total_cents is null then
  raise exception 'An event or table price is missing' using errcode='22023';
 end if;
 select (e.seating_mode='tables' and e.table_booking_mode='whole_table')
 into v_whole from public.events e where e.id=p_event_id;
 for v_selected in
  select s.table_id,s.seat_number from public.booking_selections s
  where s.booking_id=v_booking.id
 loop
  if exists(
   select 1 from public.booking_selections occupied
   join public.bookings b on b.id=occupied.booking_id
   where b.event_id=p_event_id and b.status='confirmed'
     and occupied.booking_id<>v_booking.id
     and occupied.table_id=v_selected.table_id
     and (v_whole or occupied.seat_number is null
       or occupied.seat_number=v_selected.seat_number)
  ) then raise exception 'The selected seat or table is no longer available'
   using errcode='23505';end if;
 end loop;
 -- Whole-table bookings also conflict with any existing named-seat reservations.
 if v_whole and exists(
  select 1 from public.booking_selections selected
  join public.booking_selections occupied on occupied.table_id=selected.table_id
  join public.bookings b on b.id=occupied.booking_id
  where selected.booking_id=v_booking.id and b.event_id=p_event_id
    and b.status='confirmed' and occupied.booking_id<>v_booking.id
 ) then raise exception 'A table has already been reserved' using errcode='23505';end if;

 update public.bookings set original_total_cents=v_booking.total_cents,
    total_cents=0,promo_code='TEST12',status='confirmed',
    confirmed_at=now(),confirmation_email_status='pending'
 where id=v_booking.id;
 insert into public.booking_confirmation_outbox(booking_id,status)
 values(v_booking.id,'pending');
 return pg_catalog.jsonb_build_object('reference',v_booking.booking_reference,
  'status','confirmed','total_cents',0,
  'confirmation_email_status','pending');
end;
$body$;
revoke all on function yumorilnik_internal.submit_test12_impl(uuid,uuid,jsonb,jsonb,jsonb,text) from public;
grant execute on function yumorilnik_internal.submit_test12_impl(uuid,uuid,jsonb,jsonb,jsonb,text) to anon,authenticated;
create or replace function public.submit_test12_booking(
 p_event_id uuid,p_client_request_id uuid,p_tickets jsonb,p_guests jsonb,
 p_selections jsonb,p_promo_code text
) returns jsonb language sql security invoker set search_path='' as $body$
 select yumorilnik_internal.submit_test12_impl(
  p_event_id,p_client_request_id,p_tickets,p_guests,p_selections,p_promo_code);
$body$;
revoke all on function public.submit_test12_booking(uuid,uuid,jsonb,jsonb,jsonb,text) from public;
grant execute on function public.submit_test12_booking(uuid,uuid,jsonb,jsonb,jsonb,text) to anon,authenticated;

-- Existing Marina cancellation RPC must also release confirmed free tickets:
create or replace function yumorilnik_internal.cancel_booking_impl(
 p_booking_id uuid,p_reason text
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_updated integer;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users a where a.user_id=(select auth.uid())
   and a.role in ('owner','admin')
 ) then raise exception 'Admin access required' using errcode='42501';end if;
 if p_reason is not null and length(p_reason)>500 then
  raise exception 'Cancellation reason too long' using errcode='22023';end if;
 update public.bookings set status='cancelled',cancelled_at=now(),
  cancelled_by=(select auth.uid()),cancellation_reason=nullif(btrim(p_reason),'')
 where id=p_booking_id and status in ('requested','confirmed');
 get diagnostics v_updated=row_count;
 return v_updated=1;
end;
$body$;

comment on table public.booking_promotions is 'TEST12 is public when enabled, but is off until Yumorilnik DB/email verification and launch approval.';
