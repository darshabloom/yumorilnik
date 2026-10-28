-- Yumorilnik event check-in: least-privilege staff access.
-- Staff see confirmed guest names, seats and child supervision duration,
-- but never contact information, revenue, promo codes or payment details.
create table if not exists public.checkin_staff_access(
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(event_id,user_id)
);
alter table public.checkin_staff_access enable row level security;
revoke all on public.checkin_staff_access from public,anon,authenticated;

create or replace function yumorilnik_internal.has_checkin_access(p_event_id uuid)
returns boolean language sql stable security definer set search_path='' as $body$
 select (select auth.uid()) is not null and (
  exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))
  or exists(select 1 from public.checkin_staff_access s
   where s.event_id=p_event_id and s.user_id=(select auth.uid()) and s.active)
 );
$body$;
revoke all on function yumorilnik_internal.has_checkin_access(uuid) from public,anon;
grant execute on function yumorilnik_internal.has_checkin_access(uuid) to authenticated;

create or replace function public.staff_available_events()
returns table(id uuid,title text,event_date date) language plpgsql security definer set search_path='' as $body$
begin
 if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501';end if;
 return query select e.id,e.title,e.event_date from public.events e
 where yumorilnik_internal.has_checkin_access(e.id) order by e.event_date desc;
end;$body$;
revoke all on function public.staff_available_events() from public,anon;
grant execute on function public.staff_available_events() to authenticated;

create or replace function public.staff_list_event_guests(p_event_id uuid)
returns table(
 booking_id uuid,booking_reference text,guest_index integer,full_name text,
 is_child boolean,childcare_hours integer,guardian_name text,
 table_label text,seat_number integer,checked_in_at timestamptz
) language plpgsql security definer set search_path='' as $body$
begin
 if not yumorilnik_internal.has_checkin_access(p_event_id) then
  raise exception 'Check-in access denied' using errcode='42501';end if;
 return query select b.id,b.booking_reference,g.guest_index,g.full_name,
  (g.category='child' or g.is_child_with_adult_seat),
  g.childcare_hours,guardian.full_name,s.table_label,s.seat_number,g.checked_in_at
 from public.bookings b
 join public.booking_guests g on g.booking_id=b.id
 left join public.booking_guests guardian on guardian.booking_id=b.id
  and guardian.guest_index=coalesce(g.guardian_index,g.accompanying_adult_index)
 left join public.booking_selections s on s.booking_id=b.id and s.guest_index=g.guest_index
 where b.event_id=p_event_id and b.status='confirmed'
 order by b.booking_reference,g.guest_index;
end;$body$;
revoke all on function public.staff_list_event_guests(uuid) from public,anon;
grant execute on function public.staff_list_event_guests(uuid) to authenticated;

create or replace function public.staff_set_guest_checkin(
 p_booking_id uuid,p_guest_index integer,p_arrived boolean
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_event uuid;v_changed integer;
begin
 select b.event_id into v_event from public.bookings b where b.id=p_booking_id and b.status='confirmed';
 if v_event is null or not yumorilnik_internal.has_checkin_access(v_event) then
  raise exception 'Confirmed booking or check-in permission not found' using errcode='42501';end if;
 update public.booking_guests set checked_in_at=case when coalesce(p_arrived,false) then now() else null end
 where booking_id=p_booking_id and guest_index=p_guest_index;
 get diagnostics v_changed=row_count;
 return v_changed=1;
end;$body$;
revoke all on function public.staff_set_guest_checkin(uuid,integer,boolean) from public,anon;
grant execute on function public.staff_set_guest_checkin(uuid,integer,boolean) to authenticated;

create or replace function public.admin_assign_checkin_staff(p_event_id uuid,p_email text,p_active boolean)
returns boolean language plpgsql security definer set search_path='' as $body$
declare v_user_id uuid;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in('owner','admin'))
 then raise exception 'Admin access required' using errcode='42501';end if;
 if not exists(select 1 from public.events e where e.id=p_event_id) then
  raise exception 'Event not found' using errcode='22023';end if;
 select u.id into v_user_id from auth.users u where lower(u.email)=lower(btrim(p_email)) limit 1;
 if v_user_id is null then raise exception 'Staff member must sign in with Google once before access can be granted'
  using errcode='22023';end if;
 insert into public.checkin_staff_access(event_id,user_id,active)
 values(p_event_id,v_user_id,coalesce(p_active,false))
 on conflict(event_id,user_id) do update set active=excluded.active;
 return true;
end;$body$;
revoke all on function public.admin_assign_checkin_staff(uuid,text,boolean) from public,anon;
grant execute on function public.admin_assign_checkin_staff(uuid,text,boolean) to authenticated;

create or replace function public.admin_list_checkin_staff(p_event_id uuid)
returns table(email text,active boolean) language plpgsql security definer set search_path='' as $body$
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in('owner','admin'))
 then raise exception 'Admin access required' using errcode='42501';end if;
 return query select u.email::text,s.active from public.checkin_staff_access s
 join auth.users u on u.id=s.user_id where s.event_id=p_event_id order by u.email;
end;$body$;
revoke all on function public.admin_list_checkin_staff(uuid) from public,anon;
grant execute on function public.admin_list_checkin_staff(uuid) to authenticated;
