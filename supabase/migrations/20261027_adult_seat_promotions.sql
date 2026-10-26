-- Yumorilnik adult-seat promotions. Existing TEST12 remains disabled.
-- This schema/management change does not activate paid bookings.
alter table public.booking_promotions
 add column if not exists discount_type text not null default 'percentage',
 add column if not exists amount_cents bigint,
 add column if not exists event_id uuid references public.events(id) on delete restrict,
 add column if not exists max_uses integer,
 add column if not exists times_used integer not null default 0;

alter table public.booking_promotions
 drop constraint if exists booking_promotions_discount_type_check;
alter table public.booking_promotions
 add constraint booking_promotions_discount_type_check
 check(discount_type in ('percentage','amount_off','fixed_price'));
alter table public.booking_promotions
 drop constraint if exists booking_promotions_amount_check;
alter table public.booking_promotions
 add constraint booking_promotions_amount_check
 check(
   (discount_type='percentage' and percent_off between 1 and 100 and amount_cents is null)
   or (discount_type in ('amount_off','fixed_price') and amount_cents between 0 and 10000000)
 );
alter table public.booking_promotions
 drop constraint if exists booking_promotions_usage_check;
alter table public.booking_promotions
 add constraint booking_promotions_usage_check
 check(max_uses is null or (max_uses>0 and times_used<=max_uses));
-- Existing TEST12 means 100% off all adult seats; preserve it as disabled.
update public.booking_promotions set discount_type='percentage',amount_cents=null
where code='TEST12';

-- Narrow admin read/write RPCs. Never grant direct anon table access.
create or replace function public.admin_list_booking_promotions()
returns table(code text,enabled boolean,discount_type text,percent_off integer,
 amount_cents bigint,event_id uuid,max_uses integer,times_used integer)
language plpgsql security definer set search_path='' as $body$
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')
 ) then raise exception 'Admin access required' using errcode='42501';end if;
 return query select p.code,p.enabled,p.discount_type,p.percent_off,p.amount_cents,
  p.event_id,p.max_uses,p.times_used from public.booking_promotions p order by p.code;
end;
$body$;
revoke all on function public.admin_list_booking_promotions() from public,anon;
grant execute on function public.admin_list_booking_promotions() to authenticated;

create or replace function public.admin_save_booking_promotion(
 p_code text,p_enabled boolean,p_discount_type text,p_percent_off integer,
 p_amount_cents bigint,p_event_id uuid,p_max_uses integer
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_code text:=upper(btrim(coalesce(p_code,'')));
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')
 ) then raise exception 'Admin access required' using errcode='42501';end if;
 if v_code !~ '^[A-Z0-9_-]{3,32}$' then
  raise exception 'Code must be 3-32 uppercase letters, digits, underscores or hyphens' using errcode='22023';end if;
 if p_discount_type not in ('percentage','amount_off','fixed_price')
  or (p_discount_type='percentage' and (p_percent_off is null or p_percent_off not between 1 and 100 or p_amount_cents is not null))
  or (p_discount_type<>'percentage' and (p_amount_cents is null or p_amount_cents not between 0 and 10000000))
  or (p_max_uses is not null and p_max_uses<=0)
 then raise exception 'Invalid promotion settings' using errcode='22023';end if;
 if p_event_id is not null and not exists(select 1 from public.events e where e.id=p_event_id)
 then raise exception 'Event not found' using errcode='22023';end if;

 insert into public.booking_promotions(code,enabled,discount_type,percent_off,amount_cents,event_id,max_uses)
 values(v_code,coalesce(p_enabled,false),p_discount_type,
   case when p_discount_type='percentage' then p_percent_off else 0 end,
   case when p_discount_type='percentage' then null else p_amount_cents end,
   p_event_id,p_max_uses)
 on conflict(code) do update set enabled=excluded.enabled,
 discount_type=excluded.discount_type,percent_off=excluded.percent_off,
 amount_cents=excluded.amount_cents,event_id=excluded.event_id,max_uses=excluded.max_uses
 where public.booking_promotions.times_used<=coalesce(excluded.max_uses,2147483647);
 if not found then raise exception 'Usage limit cannot be less than existing redemptions' using errcode='22023';end if;
 return true;
end;
$body$;
revoke all on function public.admin_save_booking_promotion(text,boolean,text,integer,bigint,uuid,integer)
 from public,anon;
grant execute on function public.admin_save_booking_promotion(text,boolean,text,integer,bigint,uuid,integer)
 to authenticated;

-- The live TEST12 redemption RPC specifically accepts TEST12 at 100%; it does
-- not yet apply other promotion types. Paid checkout MUST be integrated before
-- enabling codes that leave any amount owing.
comment on table public.booking_promotions is
 'Admin-configured adult-table-seat promotions; fixed amounts are per adult place. Child admission is never discounted. Live paid redemption remains disabled.';
