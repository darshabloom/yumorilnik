-- Yumorilnik booking-request foundation, 26 October 2026.
-- Apply ONLY to Yumorilnik's own Supabase project after reviewing existing schema.
-- A "requested" booking does NOT reserve seats, issue tickets, or accept payment.
-- No service_role key is exposed to the browser.

create table if not exists public.bookings (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 client_request_id uuid not null unique,
 booking_reference text not null unique default ('YMR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 status text not null default 'requested' check (status in ('requested','cancelled')),
 currency text not null default 'NZD',
 total_cents bigint check (total_cents is null or total_cents>=0),
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 cancelled_by uuid references auth.users(id) on delete set null,
 cancellation_reason text,
 constraint bookings_cancel_consistent check ((status='cancelled')=(cancelled_at is not null))
);
create index if not exists bookings_event_created on public.bookings(event_id,created_at desc);
create index if not exists bookings_status_created on public.bookings(status,created_at desc);

create table if not exists public.booking_items (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
 ticket_name text not null,
 category text not null check(category in ('adult','child')),
 quantity integer not null check(quantity>0 and quantity<=20),
 unit_admission_cents bigint not null check(unit_admission_cents>=0),
 unique(booking_id,ticket_type_id)
);
create table if not exists public.booking_guests (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 guest_index integer not null check(guest_index>=0),
 category text not null check(category in ('adult','child')),
 full_name text not null check(length(full_name) between 1 and 160),
 email text,
 phone text,
 accompanying_adult_index integer,
 checked_in_at timestamptz,
 unique(booking_id,guest_index),
 constraint booking_guest_contact check(
  (category='adult' and email is not null and phone is not null and accompanying_adult_index is null)
  or (category='child' and accompanying_adult_index is not null and email is null and phone is null)
 )
);
create index if not exists booking_guests_booking on public.booking_guests(booking_id);
create table if not exists public.booking_selections (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 table_id uuid not null,
 table_label text not null,
 seat_number integer,
 guest_index integer,
 price_cents bigint check(price_cents is null or price_cents>=0),
 constraint booking_selection_type check(
  (seat_number is null and guest_index is null)
  or (seat_number>0 and guest_index>=0)
 )
);
create unique index if not exists booking_selections_one_named_seat
 on public.booking_selections(booking_id,table_id,seat_number) where seat_number is not null;
create unique index if not exists booking_selections_one_whole_table
 on public.booking_selections(booking_id,table_id) where seat_number is null;

-- Customer PII is never directly readable or writable with an anonymous key.
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_guests enable row level security;
alter table public.booking_selections enable row level security;
revoke all on public.bookings,public.booking_items,public.booking_guests,public.booking_selections from public,anon,authenticated;
grant select on public.bookings,public.booking_items,public.booking_guests,public.booking_selections to authenticated;

drop policy if exists yumorilnik_bookings_admin_read on public.bookings;
create policy yumorilnik_bookings_admin_read on public.bookings for select to authenticated
using(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
drop policy if exists yumorilnik_booking_items_admin_read on public.booking_items;
create policy yumorilnik_booking_items_admin_read on public.booking_items for select to authenticated
using(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
drop policy if exists yumorilnik_booking_guests_admin_read on public.booking_guests;
create policy yumorilnik_booking_guests_admin_read on public.booking_guests for select to authenticated
using(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
drop policy if exists yumorilnik_booking_selections_admin_read on public.booking_selections;
create policy yumorilnik_booking_selections_admin_read on public.booking_selections for select to authenticated
using(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));

-- Non-exposed helper schema. The public RPCs are SECURITY INVOKER wrappers.
create schema if not exists yumorilnik_internal;
revoke all on schema yumorilnik_internal from public;
grant usage on schema yumorilnik_internal to anon,authenticated;

create or replace function yumorilnik_internal.submit_booking_impl(
 p_event_id uuid,p_client_request_id uuid,p_tickets jsonb,p_guests jsonb,p_selections jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
 v_event record;
 v_ticket record;
 v_table record;
 v_input jsonb;
 v_guest jsonb;
 v_sel jsonb;
 v_line jsonb;
 v_saved jsonb;
 v_items jsonb:='[]'::jsonb;
 v_people jsonb:='[]'::jsonb;
 v_places jsonb:='[]'::jsonb;
 v_ticket_id uuid;
 v_table_id uuid;
 v_category text;
 v_name text;
 v_email text;
 v_phone text;
 v_parent integer;
 v_qty integer;
 v_adults integer:=0;
 v_children integer:=0;
 v_guest_index integer:=0;
 v_assigned_adults integer:=0;
 v_table_capacity integer:=0;
 v_seat_number integer;
 v_target integer;
 v_price bigint;
 v_total bigint:=0;
 v_all_priced boolean:=true;
 v_whole boolean;
 v_tickets_seen uuid[]:=array[]::uuid[];
 v_place_keys text[]:=array[]::text[];
 v_guest_seats integer[]:=array[]::integer[];
 v_booking_id uuid;
 v_reference text;
 v_existing record;
begin
 if p_event_id is null or p_client_request_id is null
  or jsonb_typeof(p_tickets)<>'array' or jsonb_typeof(p_guests)<>'array'
  or jsonb_typeof(p_selections)<>'array' then
  raise exception 'Invalid booking request' using errcode='22023';
 end if;
 -- Serialize writes per event and retry-safe submissions.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text,0));
 select event_id,booking_reference,status,total_cents into v_existing
 from public.bookings where client_request_id=p_client_request_id;
 if found then
  if v_existing.event_id<>p_event_id then
   raise exception 'Request identifier belongs to a different event' using errcode='22023';
  end if;
  return jsonb_build_object('reference',v_existing.booking_reference,
   'status',v_existing.status,'total_cents',v_existing.total_cents);
 end if;
 if jsonb_array_length(p_tickets) not between 1 and 20
  or jsonb_array_length(p_guests) not between 1 and 20
  or jsonb_array_length(p_selections)>20 then
  raise exception 'Too many booking entries' using errcode='22023';
 end if;
 select id,is_active,event_type,seating_mode,table_booking_mode into v_event
 from public.events where id=p_event_id and is_active=true and event_type='internal';
 if not found then raise exception 'Event is unavailable' using errcode='22023'; end if;
 v_whole:=v_event.seating_mode='tables' and v_event.table_booking_mode='whole_table';

 for v_input in select value from jsonb_array_elements(p_tickets) loop
  v_ticket_id:=(v_input->>'ticket_type_id')::uuid;
  v_qty:=(v_input->>'quantity')::integer;
  if v_qty is null or v_qty<1 or v_qty>20 or v_ticket_id=any(v_tickets_seen)
  then raise exception 'Invalid ticket quantities' using errcode='22023'; end if;
  v_tickets_seen:=array_append(v_tickets_seen,v_ticket_id);
  select id,name,price_cents,quantity_total,quantity_sold into v_ticket
  from public.ticket_types
  where id=v_ticket_id and event_id=p_event_id and is_active=true;
  if not found then raise exception 'Ticket type is unavailable' using errcode='22023'; end if;
  if v_ticket.quantity_total is not null and
   v_qty>greatest(0,v_ticket.quantity_total-coalesce(v_ticket.quantity_sold,0))
  then raise exception 'Not enough tickets available' using errcode='22023'; end if;
  if v_ticket.name ~* '(adult|взросл)' then v_category:='adult';v_adults:=v_adults+v_qty;
  elsif v_ticket.name ~* '(child|детск|ребён|ребен)' then v_category:='child';v_children:=v_children+v_qty;
  else raise exception 'Ticket category must be adult or child' using errcode='22023';
  end if;
  v_price:=case when v_event.seating_mode<>'general_admission' and v_category='adult'
   then 0 else v_ticket.price_cents end;
  if v_price is null or v_price<0 then raise exception 'Invalid ticket price' using errcode='22023'; end if;
  v_total:=v_total+v_price*v_qty;
  v_items:=v_items||jsonb_build_array(jsonb_build_object(
   'ticket_type_id',v_ticket.id,'ticket_name',v_ticket.name,
   'category',v_category,'quantity',v_qty,'unit_admission_cents',v_price));
 end loop;
 if v_adults+v_children<>jsonb_array_length(p_guests) or v_adults+v_children>20
  or (v_children>0 and v_adults=0)
 then raise exception 'Guests do not match ticket quantities' using errcode='22023';end if;

 for v_guest in select value from jsonb_array_elements(p_guests) loop
  v_name:=btrim(coalesce(v_guest->>'name',''));
  if length(v_name) not between 1 and 160 then raise exception 'Invalid guest name' using errcode='22023';end if;
  if v_guest_index<v_adults then
   v_category:='adult';
   v_email:=btrim(coalesce(v_guest->>'email',''));
   v_phone:=btrim(coalesce(v_guest->>'phone',''));
   if length(v_email)>254 or v_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(v_phone) not between 3 and 40
   then raise exception 'Adult contact details are missing' using errcode='22023';end if;
   v_parent:=null;
  else
   v_category:='child';v_email:=null;v_phone:=null;
   v_parent:=(v_guest->>'parent_index')::integer;
   if v_parent is null or v_parent<0 or v_parent>=v_adults then
    raise exception 'Child needs an accompanying adult' using errcode='22023';end if;
  end if;
  v_people:=v_people||jsonb_build_array(jsonb_build_object(
    'guest_index',v_guest_index,'category',v_category,'name',v_name,
    'email',v_email,'phone',v_phone,'parent_index',v_parent));
  v_guest_index:=v_guest_index+1;
 end loop;

 if v_event.seating_mode='general_admission' then
  if jsonb_array_length(p_selections)<>0 then
   raise exception 'General admission has no assigned seats' using errcode='22023';end if;
 elsif v_whole then
  if jsonb_array_length(p_selections)=0 then
   raise exception 'Select at least one table' using errcode='22023';end if;
 else
  if jsonb_array_length(p_selections)<v_adults then
   raise exception 'A named seat is required for every adult' using errcode='22023';end if;
 end if;
 for v_sel in select value from jsonb_array_elements(p_selections) loop
  v_table_id:=(v_sel->>'table_id')::uuid;
  select id,label,is_active,seats_top,seats_bottom,seats_left,seats_right,
   seat_price_cents,table_price_cents into v_table
  from public.seating_tables
  where id=v_table_id and event_id=p_event_id and is_active=true;
  if not found then raise exception 'Table is unavailable' using errcode='22023';end if;
  if v_whole then
   if v_table_id::text=any(v_place_keys) then raise exception 'Duplicate table' using errcode='22023';end if;
   v_place_keys:=array_append(v_place_keys,v_table_id::text);
   v_table_capacity:=v_table_capacity+v_table.seats_top+v_table.seats_bottom+v_table.seats_left+v_table.seats_right;
   v_price:=v_table.table_price_cents;
   v_seat_number:=null;v_target:=null;
  else
   v_seat_number:=(v_sel->>'seat_number')::integer;
   v_target:=(v_sel->>'guest_index')::integer;
   if v_seat_number is null or v_seat_number<1 or
    v_seat_number>(v_table.seats_top+v_table.seats_bottom+v_table.seats_left+v_table.seats_right)
    or v_target is null or v_target<0 or v_target>=v_adults+v_children
    or (v_table_id::text||':'||v_seat_number::text)=any(v_place_keys)
    or v_target=any(v_guest_seats)
   then raise exception 'Invalid or duplicate assigned seat' using errcode='22023';end if;
   v_place_keys:=array_append(v_place_keys,v_table_id::text||':'||v_seat_number::text);
   v_guest_seats:=array_append(v_guest_seats,v_target);
   if v_target<v_adults then v_assigned_adults:=v_assigned_adults+1;end if;
   v_price:=v_table.seat_price_cents;
  end if;
  if v_price is null then v_all_priced:=false;
  elsif v_price<0 then raise exception 'Invalid table price' using errcode='22023';
  else v_total:=v_total+v_price;
  end if;
  v_places:=v_places||jsonb_build_array(jsonb_build_object(
   'table_id',v_table.id,'table_label',v_table.label,
   'seat_number',v_seat_number,'guest_index',v_target,'price_cents',v_price));
 end loop;
 if v_whole and v_table_capacity<v_adults then
  raise exception 'Selected tables have insufficient capacity' using errcode='22023';end if;
 if v_event.seating_mode<>'general_admission' and not v_whole and
  v_assigned_adults<>v_adults then
  raise exception 'Every adult needs one named seat' using errcode='22023';end if;
 if not v_all_priced then v_total:=null;end if;

 insert into public.bookings(event_id,client_request_id,total_cents)
 values(p_event_id,p_client_request_id,v_total)
 returning id,booking_reference into v_booking_id,v_reference;
 for v_line in select value from jsonb_array_elements(v_items) loop
  insert into public.booking_items(booking_id,ticket_type_id,ticket_name,category,quantity,unit_admission_cents)
  values(v_booking_id,(v_line->>'ticket_type_id')::uuid,v_line->>'ticket_name',
   v_line->>'category',(v_line->>'quantity')::integer,(v_line->>'unit_admission_cents')::bigint);
 end loop;
 for v_saved in select value from jsonb_array_elements(v_people) loop
  insert into public.booking_guests(booking_id,guest_index,category,full_name,email,phone,accompanying_adult_index)
  values(v_booking_id,(v_saved->>'guest_index')::integer,v_saved->>'category',
   v_saved->>'name',v_saved->>'email',v_saved->>'phone',
   (v_saved->>'parent_index')::integer);
 end loop;
 for v_saved in select value from jsonb_array_elements(v_places) loop
  insert into public.booking_selections(booking_id,table_id,table_label,seat_number,guest_index,price_cents)
  values(v_booking_id,(v_saved->>'table_id')::uuid,v_saved->>'table_label',
   (v_saved->>'seat_number')::integer,(v_saved->>'guest_index')::integer,
   (v_saved->>'price_cents')::bigint);
 end loop;
 return jsonb_build_object('reference',v_reference,'status','requested','total_cents',v_total);
end;
$body$;

revoke all on function yumorilnik_internal.submit_booking_impl(uuid,uuid,jsonb,jsonb,jsonb) from public;
grant execute on function yumorilnik_internal.submit_booking_impl(uuid,uuid,jsonb,jsonb,jsonb) to anon,authenticated;
create or replace function public.submit_booking(
 p_event_id uuid,p_client_request_id uuid,p_tickets jsonb,p_guests jsonb,p_selections jsonb
) returns jsonb language sql security invoker set search_path='' as $body$
 select yumorilnik_internal.submit_booking_impl(p_event_id,p_client_request_id,p_tickets,p_guests,p_selections);
$body$;
revoke all on function public.submit_booking(uuid,uuid,jsonb,jsonb,jsonb) from public;
grant execute on function public.submit_booking(uuid,uuid,jsonb,jsonb,jsonb) to anon,authenticated;

create or replace function yumorilnik_internal.cancel_booking_impl(p_booking_id uuid,p_reason text)
 returns boolean language plpgsql security definer set search_path='' as $body$
declare v_updated integer;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users a
  where a.user_id=(select auth.uid()) and a.role in ('owner','admin')
 ) then raise exception 'Admin access required' using errcode='42501';end if;
 if p_reason is not null and length(p_reason)>500 then
  raise exception 'Cancellation reason too long' using errcode='22023';end if;
 update public.bookings set status='cancelled',cancelled_at=now(),
  cancelled_by=(select auth.uid()),cancellation_reason=nullif(btrim(p_reason),'')
 where id=p_booking_id and status='requested';
 get diagnostics v_updated=row_count;
 return v_updated=1;
end;
$body$;
revoke all on function yumorilnik_internal.cancel_booking_impl(uuid,text) from public;
grant execute on function yumorilnik_internal.cancel_booking_impl(uuid,text) to authenticated;
create or replace function public.cancel_booking(p_booking_id uuid,p_reason text)
 returns boolean language sql security invoker set search_path='' as $body$
 select yumorilnik_internal.cancel_booking_impl(p_booking_id,p_reason);
$body$;
revoke all on function public.cancel_booking(uuid,text) from public;
grant execute on function public.cancel_booking(uuid,text) to authenticated;

comment on table public.bookings is 'Unpaid booking REQUESTS. No seats are held or tickets issued; cancelled rows are retained as an audit trail.';
