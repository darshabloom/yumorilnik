-- Complimentary invitations are separate from Stripe payments and ordinary campaign budgets.
create table if not exists public.complimentary_bookings (
 booking_id uuid primary key references public.bookings(id) on delete restrict,
 promo_code text not null references public.booking_promotions(code),
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
alter table public.complimentary_bookings enable row level security;
revoke all on public.complimentary_bookings from anon,authenticated;

create or replace function public.confirm_complimentary_booking(
 p_event_id uuid,p_client_request_id uuid,p_tickets jsonb,p_guests jsonb,
 p_selections jsonb,p_promo_code text,p_token_hash text,p_expected_amount_cents bigint
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_event constant uuid := '3f6fa4d1-aaca-4326-9c01-5774cffca2f5';
 v_promo public.booking_promotions%rowtype;
 v_booking public.bookings%rowtype;
 v_existing public.complimentary_bookings%rowtype;
 v_price bigint;
begin
 if p_event_id is distinct from v_event
    or upper(trim(coalesce(p_promo_code,''))) <> 'FRIENDNY27'
    or p_expected_amount_cents is distinct from 0
    or p_client_request_id is null
    or coalesce(p_token_hash,'') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_tickets) <> 'array'
    or jsonb_typeof(p_guests) <> 'array'
    or jsonb_typeof(p_selections) <> 'array'
    or jsonb_array_length(p_tickets) <> 1
    or jsonb_array_length(p_guests) <> 1
    or jsonb_array_length(p_selections) <> 1
    or (p_tickets->0->>'quantity')::integer is distinct from 1
    or (p_selections->0->>'guest_index')::integer is distinct from 0
    or (p_guests->0->>'is_child_with_adult_seat')::boolean is distinct from false
    or nullif(trim(coalesce(p_guests->0->>'email','')),'') is null
 then raise exception 'Invalid complimentary booking request' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text,0));
 select * into v_booking from public.bookings where client_request_id=p_client_request_id for update;
 if found then
   select * into v_existing from public.complimentary_bookings where booking_id=v_booking.id;
   if found and v_existing.token_hash=p_token_hash and v_existing.revoked_at is null
     and v_booking.status='confirmed' and v_booking.total_cents=0
   then return jsonb_build_object('state','confirmed','booking_id',v_booking.id,'reference',v_booking.booking_reference,'amount_cents',0);end if;
   raise exception 'Request was already used' using errcode='22023';
 end if;
 select * into v_promo from public.booking_promotions
  where code='FRIENDNY27' for update;
 if not found or v_promo.enabled is distinct from true or v_promo.event_id is distinct from v_event
   or v_promo.applies_to <> 'adult' or v_promo.discount_type <> 'percentage'
   or v_promo.percent_off <> 100 or v_promo.max_uses is distinct from 1
   or v_promo.times_used <> 0
   or (v_promo.starts_at is not null and v_promo.starts_at>now())
   or (v_promo.ends_at is not null and v_promo.ends_at<=now())
 then raise exception 'Complimentary invitation unavailable' using errcode='22023';end if;
 if exists(
  select 1 from public.restricted_seating_tables t
  where t.event_id=p_event_id and t.table_id=(p_selections->0->>'table_id')::uuid
 ) then raise exception 'Choose a standard, unrestricted seat' using errcode='22023';end if;
 perform yumorilnik_internal.submit_family_booking_impl(
  p_event_id,p_client_request_id,p_tickets,p_guests,p_selections);
 select * into strict v_booking from public.bookings where client_request_id=p_client_request_id for update;
 if (select count(*) from public.booking_items where booking_id=v_booking.id and category='adult' and quantity=1)<>1
   or (select count(*) from public.booking_items where booking_id=v_booking.id)<>1
   or (select count(*) from public.booking_guests where booking_id=v_booking.id and category='adult' and is_child_with_adult_seat=false)<>1
   or (select count(*) from public.booking_selections where booking_id=v_booking.id and guest_index=0 and seat_number is not null)<>1
 then raise exception 'Only one adult seat may be complimentary' using errcode='22023';end if;
 select price_cents into v_price from public.booking_selections
  where booking_id=v_booking.id and guest_index=0;
 if v_price is null or v_price<50 or v_booking.total_cents is distinct from v_price
 then raise exception 'Complimentary seat price could not be verified' using errcode='22023';end if;
 if not yumorilnik_internal.checkout_places_available(v_booking.id,p_event_id)
 then raise exception 'Seat is already reserved' using errcode='23505';end if;
 insert into public.complimentary_bookings(booking_id,promo_code,token_hash)
  values(v_booking.id,'FRIENDNY27',p_token_hash);
 update public.bookings set original_total_cents=v_price,total_cents=0,
  promo_code='FRIENDNY27',status='confirmed',confirmed_at=now()
 where id=v_booking.id;
 update public.booking_promotions set times_used=times_used+1 where code='FRIENDNY27' and times_used=0;
 if not found then raise exception 'Invitation already redeemed' using errcode='23505';end if;
 return jsonb_build_object('state','confirmed','booking_id',v_booking.id,'reference',v_booking.booking_reference,'amount_cents',0);
end $$;
revoke all on function public.confirm_complimentary_booking(uuid,uuid,jsonb,jsonb,jsonb,text,text,bigint) from public,anon,authenticated;
grant execute on function public.confirm_complimentary_booking(uuid,uuid,jsonb,jsonb,jsonb,text,text,bigint) to service_role;