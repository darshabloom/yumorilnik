-- Store child ages, including children occupying adult-priced seats.
alter table public.booking_guests add column if not exists age_years integer;
alter table public.booking_guests add constraint booking_guests_age_0_to_17 check (age_years between 0 and 17 or age_years is null);

create or replace function yumorilnik_internal.submit_family_booking_impl(
 p_event_id uuid,p_client_request_id uuid,p_tickets jsonb,p_guests jsonb,p_selections jsonb
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare
 v_result jsonb;
 v_booking_id uuid;
 v_adults integer;
 v_children integer;
 v_index integer;
 v_guest jsonb;
 v_guardian integer;
 v_hours integer;
 v_extra bigint:=0;
 v_is_seated_child boolean;
 v_nye boolean:=(p_event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid);
begin
 -- This lock matches the existing request serializer and prevents double-addition
 -- of six-hour charges when the browser retries an idempotent request.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text,0));
 select b.id into v_booking_id from public.bookings b
 where b.client_request_id=p_client_request_id;
 if found then
  select pg_catalog.jsonb_build_object('reference',b.booking_reference,
    'status',b.status,'total_cents',b.total_cents)
   into v_result from public.bookings b where b.id=v_booking_id;
  return v_result;
 end if;
 v_result:=yumorilnik_internal.submit_booking_impl(
   p_event_id,p_client_request_id,p_tickets,p_guests,p_selections);
 select b.id into v_booking_id from public.bookings b
 where b.client_request_id=p_client_request_id and b.event_id=p_event_id;
 if not found then raise exception 'Booking record not created' using errcode='22023';end if;

 select coalesce(sum(i.quantity) filter(where i.category='adult'),0),
        coalesce(sum(i.quantity) filter(where i.category='child'),0)
 into v_adults,v_children from public.booking_items i where i.booking_id=v_booking_id;

 if v_nye and exists(select 1 from public.booking_items i
  where i.booking_id=v_booking_id and i.category='child' and i.unit_admission_cents<>3000)
 then raise exception 'Child base admission must be NZ$30 before offering 3/6-hour childcare'
   using errcode='22023';end if;

 for v_index in 0..v_adults+v_children-1 loop
  v_guest:=p_guests->v_index;
  if v_index<v_adults then
   v_is_seated_child:=coalesce((v_guest->>'is_child_with_adult_seat')::boolean,false);
   if v_is_seated_child then
    v_guardian:=(v_guest->>'parent_index')::integer;
    if v_guardian is null or v_guardian not between 0 and v_adults-1
       or v_guardian=v_index
       or coalesce((p_guests->v_guardian->>'is_child_with_adult_seat')::boolean,false)
    then raise exception 'Choose a real accompanying adult for the child with a table seat'
      using errcode='22023';end if;
    -- Child's booking contact is their adult guardian, not the child's own address.
    if coalesce(v_guest->>'email','') is distinct from coalesce(p_guests->v_guardian->>'email','')
       or coalesce(v_guest->>'phone','') is distinct from coalesce(p_guests->v_guardian->>'phone','')
    then raise exception 'Child contact must match their accompanying adult'
      using errcode='22023';end if;
   else v_guardian:=null;
   end if;
   update public.booking_guests set is_child_with_adult_seat=v_is_seated_child,
      guardian_index=v_guardian where booking_id=v_booking_id and guest_index=v_index;
  else
   if v_nye then
    v_hours:=(v_guest->>'childcare_hours')::integer;
    if v_hours is null or v_hours not in(3,6) then
     raise exception 'Please select 3 or 6 hours of childcare for each child ticket'
       using errcode='22023';end if;
    v_extra:=v_extra+case when v_hours=6 then 3000 else 0 end;
    update public.booking_guests set childcare_hours=v_hours,
      childcare_price_cents=v_hours*1000
    where booking_id=v_booking_id and guest_index=v_index;
   end if;
  end if;
  if v_index>=v_adults or v_is_seated_child then
   if v_guest->>'age_years' is null or (v_guest->>'age_years') !~ '^[0-9]{1,2}
  update public.bookings set total_cents=total_cents+v_extra where id=v_booking_id;
 end if;
 select pg_catalog.jsonb_build_object('reference',b.booking_reference,'status',b.status,
    'total_cents',b.total_cents) into v_result from public.bookings b where b.id=v_booking_id;
 return v_result;
end;$body$;

     or (v_guest->>'age_years')::integer>17 then
    raise exception 'Child age must be between 0 and 17' using errcode='22023';
   end if;
   update public.booking_guests set age_years=(v_guest->>'age_years')::integer
    where booking_id=v_booking_id and guest_index=v_index;
  end if;
 end loop;
 if v_extra>0 then
  update public.bookings set total_cents=total_cents+v_extra where id=v_booking_id;
 end if;
 select pg_catalog.jsonb_build_object('reference',b.booking_reference,'status',b.status,
    'total_cents',b.total_cents) into v_result from public.bookings b where b.id=v_booking_id;
 return v_result;
end;$body$;
