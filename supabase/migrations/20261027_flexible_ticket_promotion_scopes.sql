-- Flexible ticket promotion configuration; does not enable redemption or payments.
-- TEST12 is kept disabled until legacy 100%-off booking RPC is replaced.
alter table public.booking_promotions
 add column if not exists applies_to text not null default 'adult',
 add column if not exists ticket_type_ids uuid[] not null default '{}',
 add column if not exists starts_at timestamptz,
 add column if not exists ends_at timestamptz,
 add column if not exists min_tickets integer,
 add column if not exists max_discount_cents bigint,
 add column if not exists internal_note text;
alter table public.booking_promotions
 add constraint booking_promotions_scope_valid check(applies_to in ('all','adult','child','selected'));
alter table public.booking_promotions
 add constraint booking_promotions_selected_valid check(
    (applies_to='selected' and cardinality(ticket_type_ids)>0)
    or (applies_to<>'selected' and cardinality(ticket_type_ids)=0)
 );
alter table public.booking_promotions
 add constraint booking_promotions_schedule_valid check(ends_at is null or starts_at is null or ends_at>starts_at);
alter table public.booking_promotions
 add constraint booking_promotions_minimum_valid check(min_tickets is null or min_tickets between 1 and 100);
alter table public.booking_promotions
 add constraint booking_promotions_cap_valid check(max_discount_cents is null or max_discount_cents>=0);
update public.booking_promotions set enabled=false,applies_to='all'
where code='TEST12';

-- Older endpoints cannot modify scope and could reactivate the legacy free code.
revoke execute on function public.admin_save_booking_promotion(text,boolean,text,integer,bigint,uuid,integer)
 from authenticated;

create or replace function public.admin_list_booking_promotions_v2()
returns table(
 code text,enabled boolean,discount_type text,percent_off integer,amount_cents bigint,
 event_id uuid,max_uses integer,times_used integer,applies_to text,ticket_type_ids uuid[],
 starts_at timestamptz,ends_at timestamptz,min_tickets integer,max_discount_cents bigint,internal_note text
) language plpgsql security definer set search_path='' as $body$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.admin_users a
  where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))
 then raise exception 'Admin access required' using errcode='42501';end if;
 return query select p.code,p.enabled,p.discount_type,p.percent_off,p.amount_cents,
  p.event_id,p.max_uses,p.times_used,p.applies_to,p.ticket_type_ids,
  p.starts_at,p.ends_at,p.min_tickets,p.max_discount_cents,p.internal_note
  from public.booking_promotions p order by p.code;
end;$body$;
revoke all on function public.admin_list_booking_promotions_v2() from public,anon;
grant execute on function public.admin_list_booking_promotions_v2() to authenticated;

create or replace function public.admin_save_booking_promotion_v2(
 p_code text,p_enabled boolean,p_discount_type text,p_percent_off integer,
 p_amount_cents bigint,p_event_id uuid,p_max_uses integer,p_applies_to text,
 p_ticket_type_ids uuid[],p_starts_at timestamptz,p_ends_at timestamptz,
 p_min_tickets integer,p_max_discount_cents bigint,p_internal_note text
) returns boolean language plpgsql security definer set search_path='' as $body$
declare
 v_code text:=upper(btrim(coalesce(p_code,'')));
 v_tickets uuid[]:=coalesce(p_ticket_type_ids,'{}'::uuid[]);
begin
 if (select auth.uid()) is null or not exists(select 1 from public.admin_users a
  where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))
 then raise exception 'Admin access required' using errcode='42501';end if;
 if v_code !~ '^[A-Z0-9_-]{3,32}$' then
  raise exception 'Invalid promotion code' using errcode='22023';end if;
 if p_discount_type not in ('percentage','amount_off','fixed_price')
 or (p_discount_type='percentage' and
     (p_percent_off is null or p_percent_off not between 1 and 100 or p_amount_cents is not null))
 or (p_discount_type<>'percentage' and (p_amount_cents is null or p_amount_cents not between 0 and 10000000))
 or (p_max_uses is not null and p_max_uses<=0)
 or p_applies_to not in ('all','adult','child','selected')
 or (p_applies_to='selected' and cardinality(v_tickets)=0)
 or (p_applies_to<>'selected' and cardinality(v_tickets)<>0)
 or (p_starts_at is not null and p_ends_at is not null and p_ends_at<=p_starts_at)
 or (p_min_tickets is not null and p_min_tickets not between 1 and 100)
 or (p_max_discount_cents is not null and p_max_discount_cents<0)
 or length(coalesce(p_internal_note,''))>500
 then raise exception 'Invalid promotion settings' using errcode='22023';end if;
 if p_event_id is not null and not exists(select 1 from public.events e where e.id=p_event_id)
 then raise exception 'Event not found' using errcode='22023';end if;
 if cardinality(v_tickets)<> (select count(distinct x) from unnest(v_tickets) as x)
 then raise exception 'Duplicate ticket types' using errcode='22023';end if;
 if exists(select 1 from unnest(v_tickets) as x
  where not exists(select 1 from public.ticket_types t where t.id=x
   and (p_event_id is null or t.event_id=p_event_id)))
 then raise exception 'Selected ticket type does not belong to the event scope' using errcode='22023';end if;

 -- Existing TEST12 checkout can discount children incorrectly, so it cannot
 -- be reactivated before the new scoped redemption RPC is implemented.
 if v_code='TEST12' and coalesce(p_enabled,false) then
  raise exception 'TEST12 activation requires the updated checkout' using errcode='22023';end if;

 insert into public.booking_promotions
 (code,enabled,discount_type,percent_off,amount_cents,event_id,max_uses,
  applies_to,ticket_type_ids,starts_at,ends_at,min_tickets,max_discount_cents,internal_note)
 values(v_code,coalesce(p_enabled,false),p_discount_type,
  case when p_discount_type='percentage' then p_percent_off else 0 end,
  case when p_discount_type='percentage' then null else p_amount_cents end,
  p_event_id,p_max_uses,p_applies_to,v_tickets,p_starts_at,p_ends_at,
  p_min_tickets,p_max_discount_cents,nullif(btrim(p_internal_note),''))
 on conflict(code) do update set
  enabled=excluded.enabled,discount_type=excluded.discount_type,
  percent_off=excluded.percent_off,amount_cents=excluded.amount_cents,
  event_id=excluded.event_id,max_uses=excluded.max_uses,
  applies_to=excluded.applies_to,ticket_type_ids=excluded.ticket_type_ids,
  starts_at=excluded.starts_at,ends_at=excluded.ends_at,
  min_tickets=excluded.min_tickets,max_discount_cents=excluded.max_discount_cents,
  internal_note=excluded.internal_note
 where public.booking_promotions.times_used<=coalesce(excluded.max_uses,2147483647);
 if not found then raise exception 'Usage limit below prior redemptions' using errcode='22023';end if;
 return true;
end;$body$;
revoke all on function public.admin_save_booking_promotion_v2(text,boolean,text,integer,bigint,uuid,integer,text,uuid[],timestamptz,timestamptz,integer,bigint,text) from public,anon;
grant execute on function public.admin_save_booking_promotion_v2(text,boolean,text,integer,bigint,uuid,integer,text,uuid[],timestamptz,timestamptz,integer,bigint,text) to authenticated;

comment on table public.booking_promotions is 'Promotions can target all admission ticket types, adults, children, or selected ticket IDs, and have optional event/date/usage controls. No paid checkout connected.';
