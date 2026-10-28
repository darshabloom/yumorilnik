-- Yumorilnik SANDBOX ONLY Stripe Checkout.
-- Does not enable a payment method, real bookings, emails, or Stripe live mode.
-- Run ONLY in Supabase project vzzabkviwyarrdkevqco, after the 20261028 family migrations.
-- No customer-supplied prices or discounts can be trusted.
-- Test promo redemptions are recorded in booking_test_checkouts only; they do
-- not increment public.booking_promotions.times_used (real usage counter).
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
 check (status in ('requested','confirmed','cancelled','test_confirmed'));

create table if not exists public.booking_test_checkouts(
 booking_id uuid primary key references public.bookings(id) on delete restrict,
 event_id uuid not null references public.events(id) on delete restrict,
 stripe_session_id text unique,
 stripe_payment_intent_id text,
 state text not null check(state in ('creating','open','test_paid','expired','needs_review')),
 amount_cents bigint not null check(amount_cents>=0),
 currency text not null default 'nzd' check(currency='nzd'),
 promotion_code text,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 review_reason text
);
create index if not exists booking_test_checkouts_event_state
 on public.booking_test_checkouts(event_id,state);
alter table public.booking_test_checkouts enable row level security;
revoke all on public.booking_test_checkouts from public,anon,authenticated;
grant select on public.booking_test_checkouts to service_role;
grant usage on schema yumorilnik_internal to service_role;

-- The hold-availability guard is called only after obtaining the event advisory lock.
-- 'creating' and 'open' are NEVER released by a clock comparison alone:
-- a signed Stripe expiration notification must confirm a session is truly expired.
create or replace function yumorilnik_internal.test_checkout_places_available(p_booking_id uuid,p_event_id uuid)
returns boolean language sql security definer set search_path='' as $body$
 select not exists(
  select 1 from public.booking_selections mine
  join public.booking_selections taken on taken.table_id=mine.table_id
    and taken.booking_id<>mine.booking_id
    and (taken.seat_number is null or mine.seat_number is null
      or taken.seat_number=mine.seat_number)
  join public.bookings competing on competing.id=taken.booking_id and competing.event_id=p_event_id
  left join public.booking_test_checkouts other_hold on other_hold.booking_id=competing.id
  where mine.booking_id=p_booking_id and
   (competing.status in ('confirmed','test_confirmed')
      or other_hold.state in ('creating','open'))
 )
 and not exists(
  select 1 from public.booking_items mine
  join public.ticket_types type on type.id=mine.ticket_type_id
  where mine.booking_id=p_booking_id
    and type.quantity_total is not null
    and (
     greatest(
      coalesce(type.quantity_sold,0),
      coalesce((select sum(confirmed.quantity)
        from public.booking_items confirmed
        join public.bookings b on b.id=confirmed.booking_id
        where confirmed.ticket_type_id=mine.ticket_type_id
          and b.status in ('confirmed','test_confirmed')),0)
     )
     + coalesce((select sum(held.quantity)
       from public.booking_items held
       join public.booking_test_checkouts checkout on checkout.booking_id=held.booking_id
       join public.bookings hb on hb.id=held.booking_id
       where held.ticket_type_id=mine.ticket_type_id
        and held.booking_id<>p_booking_id and hb.status='requested'
        and checkout.state in ('creating','open')),0)
     + mine.quantity > type.quantity_total
    )
 );
$body$;
revoke all on function yumorilnik_internal.test_checkout_places_available(uuid,uuid) from public,anon,authenticated;
grant execute on function yumorilnik_internal.test_checkout_places_available(uuid,uuid) to service_role;

create or replace function public.prepare_test_checkout(
 p_event_id uuid, p_client_request_id uuid, p_tickets jsonb,
 p_guests jsonb, p_selections jsonb, p_promo_code text default null
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare
 v_booking public.bookings%rowtype;
 v_hold public.booking_test_checkouts%rowtype;
 v_promo public.booking_promotions%rowtype;
 v_code text:=nullif(upper(btrim(coalesce(p_promo_code,''))),'');
 v_adult_ticket uuid;
 v_child_ticket uuid;
 v_adult_count integer;
 v_eligible_sum bigint:=0;
 v_eligible_count integer:=0;
 v_discount bigint:=0;
 v_unit record;
 v_unit_eligible boolean;
 v_unit_discount bigint;
 v_due bigint;
 v_result jsonb;
begin
 -- This phase supports the known 2026 NYE seating and childcare model only.
 if p_event_id is distinct from '3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
  or p_client_request_id is null then
  raise exception 'Sandbox checkout is not configured for this event' using errcode='22023';
 end if;
 if exists(select 1 from public.events e where e.id=p_event_id and
   (e.seating_mode is distinct from 'tables'
      or e.table_booking_mode is distinct from 'individual_seats'))
 then raise exception 'This event is not configured for individual table seats' using errcode='22023';end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text,0));
 select * into v_booking from public.bookings where client_request_id=p_client_request_id;
 if found then
  select * into v_hold from public.booking_test_checkouts where booking_id=v_booking.id;
  if found and v_booking.event_id=p_event_id and
      v_hold.state in ('creating','open','test_paid') then
   return pg_catalog.jsonb_build_object(
    'booking_id',v_booking.id,'reference',v_booking.booking_reference,
    'amount_cents',v_hold.amount_cents,'currency','nzd',
    'state',v_hold.state,'stripe_session_id',v_hold.stripe_session_id);
  end if;
  raise exception 'This request ID was already used' using errcode='22023';
 end if;

 -- Canonical RPC validates names, category, parent, seat numbers, base prices,
 -- quantities and 3h/6h childcare duration without browser prices.
 v_result:=yumorilnik_internal.submit_family_booking_impl(
    p_event_id,p_client_request_id,p_tickets,p_guests,p_selections);
 select * into strict v_booking from public.bookings where client_request_id=p_client_request_id;
 if v_booking.total_cents is null or v_booking.total_cents<1 then
  raise exception 'Checkout requires complete positive ticket and seat prices' using errcode='22023';
 end if;
 select count(*) into v_adult_count from public.booking_guests g
 where g.booking_id=v_booking.id and g.category='adult';
 select i.ticket_type_id into v_adult_ticket from public.booking_items i
 where i.booking_id=v_booking.id and i.category='adult' limit 1;
 select i.ticket_type_id into v_child_ticket from public.booking_items i
 where i.booking_id=v_booking.id and i.category='child' limit 1;
 if (select count(*) from public.booking_items i
     where i.booking_id=v_booking.id and i.category='adult')>1
  or (select count(*) from public.booking_items i
     where i.booking_id=v_booking.id and i.category='child')>1
 then raise exception 'Sandbox checkout supports one adult and one child ticket type'
   using errcode='22023';end if;

 if v_code is not null then
  -- Admin-configured codes only. TEST12 is deliberately not accepted here.
  if v_code='TEST12' then raise exception 'TEST12 stays disabled in Stripe checkout'
   using errcode='22023';end if;
  select * into v_promo from public.booking_promotions p
  where p.code=v_code and p.enabled=true and
    (p.event_id is null or p.event_id=p_event_id)
    and (p.starts_at is null or p.starts_at<=now())
    and (p.ends_at is null or p.ends_at>now())
    and (p.min_tickets is null or p.min_tickets<=pg_catalog.jsonb_array_length(p_guests))
  for update;
  if not found then raise exception 'Promotional code is unavailable' using errcode='22023';end if;
  if v_promo.max_uses is not null and
   v_promo.times_used+
   (select count(*) from public.booking_test_checkouts c
     join public.bookings redeemed on redeemed.id=c.booking_id
     where c.promotion_code=v_code and
      (c.state in('creating','open') or
       (c.state='test_paid' and redeemed.status='test_confirmed')))
   >=v_promo.max_uses
  then raise exception 'Promotion usage limit reached' using errcode='22023';end if;

  -- Chargeable units are the seats actually assigned to adult-priced tickets,
  -- plus each child's actual 3h/6h price (not merely the base ticket price).
  for v_unit in
   select 'adult'::text category,v_adult_ticket ticket_type_id,
     s.price_cents::bigint unit_cents
   from public.booking_selections s
   where s.booking_id=v_booking.id and s.guest_index is not null
   union all
   select 'child'::text,v_child_ticket,g.childcare_price_cents::bigint
   from public.booking_guests g
   where g.booking_id=v_booking.id and g.category='child'
  loop
   if v_unit.unit_cents is null or v_unit.unit_cents<0 then
    raise exception 'Incomplete ticket price' using errcode='22023';end if;
   v_unit_eligible:=(v_promo.applies_to='all'
     or v_promo.applies_to=v_unit.category
     or (v_promo.applies_to='selected' and
        v_unit.ticket_type_id=any(v_promo.ticket_type_ids)));
   if v_unit_eligible then
    v_eligible_sum:=v_eligible_sum+v_unit.unit_cents;
    v_eligible_count:=v_eligible_count+1;
    if v_promo.discount_type='percentage' then
      v_unit_discount:=pg_catalog.floor(v_unit.unit_cents::numeric*v_promo.percent_off/100)::bigint;
    elsif v_promo.discount_type='amount_off' then
      v_unit_discount:=least(v_unit.unit_cents,v_promo.amount_cents);
    elsif v_promo.discount_type='fixed_price' then
      v_unit_discount:=greatest(0,v_unit.unit_cents-v_promo.amount_cents);
    else raise exception 'Invalid promotion type' using errcode='22023';
    end if;
    v_discount:=v_discount+v_unit_discount;
   end if;
  end loop;
  if v_eligible_count=0 then raise exception 'Promotion does not apply to these tickets'
     using errcode='22023';end if;
  if v_promo.max_discount_cents is not null then
   v_discount:=least(v_discount,v_promo.max_discount_cents);
  end if;
  v_discount:=least(v_discount,v_eligible_sum,v_booking.total_cents);
 end if;

 v_due:=v_booking.total_cents-v_discount;
 if v_due>0 and v_due<50 then
  raise exception 'Discounted amount is below the Stripe minimum of NZD 0.50'
   using errcode='22023';end if;
 update public.bookings set original_total_cents=v_booking.total_cents,
  total_cents=v_due,promo_code=v_code where id=v_booking.id;

 -- Insert a provisional seat hold BEFORE checking availability, under the
 -- same per-event advisory lock held by all sandbox payment transitions.
 insert into public.booking_test_checkouts(
   booking_id,event_id,state,amount_cents,currency,promotion_code,expires_at)
 values(v_booking.id,p_event_id,case when v_due=0 then 'test_paid' else 'creating' end,
  v_due,'nzd',v_code,now()+interval '45 minutes');

 if not yumorilnik_internal.test_checkout_places_available(v_booking.id,p_event_id) then
  raise exception 'One or more seats or tickets are already held or reserved'
    using errcode='23505';end if;

 if v_due=0 then
  -- Fully discounted SANDBOX bookings are NOT real tickets and emit NO emails.
  if v_code is null then raise exception 'Zero-price booking requires a promotion' using errcode='22023';end if;
  -- SANDBOX redemptions do not consume real booking_promotions.times_used.
  -- Active test holds and test_paid rows are counted separately.
  update public.bookings set status='test_confirmed',confirmed_at=now() where id=v_booking.id;
 end if;
 return pg_catalog.jsonb_build_object('booking_id',v_booking.id,
   'reference',v_booking.booking_reference,'amount_cents',v_due,'currency','nzd',
   'state',case when v_due=0 then 'test_paid' else 'creating' end);
end;$body$;
revoke all on function public.prepare_test_checkout(uuid,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.prepare_test_checkout(uuid,uuid,jsonb,jsonb,jsonb,text) to service_role;

create or replace function public.bind_test_checkout_session(
 p_booking_id uuid,p_session_id text,p_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_count integer;
begin
 if p_session_id is null or p_session_id not like 'cs_test_%' or
  p_expires_at is null or p_expires_at<now() or p_expires_at>now()+interval '24 hours'
 then raise exception 'Invalid Stripe test session' using errcode='22023';end if;
 update public.booking_test_checkouts set stripe_session_id=p_session_id,
  state='open',expires_at=p_expires_at,updated_at=now()
 where booking_id=p_booking_id and
   (state='creating' or (state='open' and stripe_session_id=p_session_id))
   and (stripe_session_id is null or stripe_session_id=p_session_id);
 get diagnostics v_count=row_count;
 return v_count=1;
end;$body$;
revoke all on function public.bind_test_checkout_session(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.bind_test_checkout_session(uuid,text,timestamptz) to service_role;

create or replace function public.complete_test_checkout_session(
 p_booking_id uuid,p_session_id text,p_intent_id text,
 p_amount_cents bigint,p_currency text
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare v_hold public.booking_test_checkouts%rowtype;
 v_booking public.bookings%rowtype;
 v_promo public.booking_promotions%rowtype;
begin
 select * into v_hold from public.booking_test_checkouts where booking_id=p_booking_id;
 if not found then raise exception 'Unknown sandbox booking' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_hold.event_id::text,0));
 select * into strict v_hold from public.booking_test_checkouts where booking_id=p_booking_id for update;
 select * into strict v_booking from public.bookings where id=p_booking_id for update;
 if v_hold.state='test_paid' and v_booking.status='test_confirmed' then
  return pg_catalog.jsonb_build_object('state','test_paid','reference',v_booking.booking_reference);
 end if;
 if v_hold.state not in ('creating','open') or v_booking.status<>'requested'
  or v_hold.stripe_session_id is distinct from p_session_id
  or v_hold.amount_cents is distinct from p_amount_cents
  or lower(coalesce(p_currency,''))<>'nzd'
  or p_intent_id is null
 then raise exception 'Stripe payment does not match a payable sandbox hold'
     using errcode='22023';end if;
 if not yumorilnik_internal.test_checkout_places_available(p_booking_id,v_hold.event_id) then
  update public.booking_test_checkouts set state='needs_review',
    review_reason='Payment succeeded but a conflicting seat or ticket reservation exists',
    stripe_payment_intent_id=p_intent_id,updated_at=now() where booking_id=p_booking_id;
  return pg_catalog.jsonb_build_object('state','needs_review',
    'reference',v_booking.booking_reference);
 end if;
 if v_hold.promotion_code is not null then
  select * into v_promo from public.booking_promotions where code=v_hold.promotion_code for update;
  if not found or not v_promo.enabled or
   (v_promo.max_uses is not null and
    v_promo.times_used+
    (select count(*) from public.booking_test_checkouts other_checkout
     join public.bookings redeemed on redeemed.id=other_checkout.booking_id
     where other_checkout.promotion_code=v_hold.promotion_code
      and other_checkout.booking_id<>p_booking_id
      and other_checkout.state='test_paid'
      and redeemed.status='test_confirmed') >= v_promo.max_uses)
  then
   update public.booking_test_checkouts set state='needs_review',
     review_reason='Promotion unavailable after payment',updated_at=now()
   where booking_id=p_booking_id;
   return pg_catalog.jsonb_build_object('state','needs_review',
     'reference',v_booking.booking_reference);
  end if;
  -- Test redemptions must never increment the real promo usage counter.
 end if;
 update public.booking_test_checkouts set state='test_paid',
   stripe_payment_intent_id=p_intent_id,updated_at=now()
 where booking_id=p_booking_id;
 -- No real reservation, check-in or confirmation emails are issued.
 update public.bookings set status='test_confirmed',confirmed_at=now()
 where id=p_booking_id;
 return pg_catalog.jsonb_build_object('state','test_paid',
   'reference',v_booking.booking_reference);
end;$body$;
revoke all on function public.complete_test_checkout_session(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.complete_test_checkout_session(uuid,text,text,bigint,text) to service_role;

create or replace function public.expire_test_checkout_session(
 p_booking_id uuid,p_session_id text
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_hold public.booking_test_checkouts%rowtype;
 v_changed integer;
begin
 select * into v_hold from public.booking_test_checkouts where booking_id=p_booking_id;
 if not found then return false;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_hold.event_id::text,0));
 update public.booking_test_checkouts set state='expired',updated_at=now()
 where booking_id=p_booking_id and stripe_session_id=p_session_id and state='open';
 get diagnostics v_changed=row_count;
 if v_changed=1 then
  update public.bookings set status='cancelled',cancelled_at=now(),
   cancellation_reason='Stripe sandbox Checkout session expired'
  where id=p_booking_id and status='requested';
 end if;
 return v_changed=1;
end;$body$;
revoke all on function public.expire_test_checkout_session(uuid,text) from public,anon,authenticated;
grant execute on function public.expire_test_checkout_session(uuid,text) to service_role;

-- Do not let an admin cancel a paid real booking without refund handling.
-- Sandbox payments can be cancelled because they are never live charges.
create or replace function yumorilnik_internal.cancel_booking_impl(
 p_booking_id uuid,p_reason text
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_updated integer;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.admin_users a
   where a.user_id=(select auth.uid()) and a.role in ('owner','admin')
 ) then raise exception 'Admin access required' using errcode='42501';end if;
 if p_reason is not null and length(p_reason)>500 then
  raise exception 'Cancellation reason too long' using errcode='22023';end if;
 if exists(select 1 from public.booking_test_checkouts h
  where h.booking_id=p_booking_id and h.state in('creating','open'))
 then raise exception 'Expire the Stripe Checkout session before cancelling a held seat'
  using errcode='22023';end if;
 update public.bookings set status='cancelled',cancelled_at=now(),
  cancelled_by=(select auth.uid()),cancellation_reason=nullif(btrim(p_reason),'')
 where id=p_booking_id and (status in('requested','test_confirmed') or
   (status='confirmed' and not exists(select 1 from public.booking_test_checkouts h
      where h.booking_id=p_booking_id)));
 get diagnostics v_updated=row_count;
 return v_updated=1;
end;$body$;
-- Keep existing authenticated public.cancel_booking wrapper unchanged.

-- Recovery of an unbound hold is allowed only after Stripe's maximum configured
-- session lifetime plus a conservative grace period, never by client cancellation.
create or replace function public.abandon_unbound_test_checkout(p_booking_id uuid)
returns boolean language plpgsql security definer set search_path='' as $body$
declare v_event uuid;v_changed integer;
begin
 select event_id into v_event from public.booking_test_checkouts where booking_id=p_booking_id;
 if v_event is null then return false;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_event::text,0));
 update public.booking_test_checkouts set state='expired',
  updated_at=now(),review_reason='Unbound sandbox session timed out after grace period'
 where booking_id=p_booking_id and state='creating'
   and stripe_session_id is null and created_at<now()-interval '90 minutes';
 get diagnostics v_changed=row_count;
 if v_changed=1 then
  update public.bookings set status='cancelled',cancelled_at=now(),
   cancellation_reason='Unbound Stripe sandbox Checkout timed out'
  where id=p_booking_id and status='requested';
 end if;
 return v_changed=1;
end;$body$;
revoke all on function public.abandon_unbound_test_checkout(uuid) from public,anon,authenticated;
grant execute on function public.abandon_unbound_test_checkout(uuid) to service_role;
