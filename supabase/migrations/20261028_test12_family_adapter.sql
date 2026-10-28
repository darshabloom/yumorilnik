-- Follow family-booking migration. Keep TEST12 disabled until launch decision.
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
   where code='TEST12' and enabled=true and percent_off=100
    and discount_type='percentage' and applies_to='all'
    and (event_id is null or event_id=p_event_id)
    and (starts_at is null or starts_at<=now())
    and (ends_at is null or ends_at>now())
    and (min_tickets is null or min_tickets<=pg_catalog.jsonb_array_length(p_guests))
    and (max_uses is null or times_used<max_uses)
    and max_discount_cents is null) then
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
 v_result:=yumorilnik_internal.submit_family_booking_impl(
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
 update public.booking_promotions set times_used=times_used+1
 where code='TEST12' and enabled=true and (max_uses is null or times_used<max_uses);
 if not found then raise exception 'TEST12 use limit reached' using errcode='22023';end if;
 insert into public.booking_confirmation_outbox(booking_id,status)
 values(v_booking.id,'pending');
 return pg_catalog.jsonb_build_object('reference',v_booking.booking_reference,
  'status','confirmed','total_cents',0,
  'confirmation_email_status','pending');
end;
$body$;
