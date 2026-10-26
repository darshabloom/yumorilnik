-- Yumorilnik opt-in marketing contacts. Apply ONLY to Yumorilnik Supabase.
-- No ticket buyer is subscribed automatically. The extra optional consent action
-- is available only after a real booking request succeeds.
create table if not exists public.marketing_contacts(
 id uuid primary key default gen_random_uuid(),
 email text not null unique,
 full_name text not null,
 status text not null default 'subscribed' check(status in ('subscribed','unsubscribed')),
 consent_at timestamptz not null default now(),
 consent_source text not null default 'booking_request_checkbox',
 source_booking_id uuid references public.bookings(id) on delete set null,
 source_event_id uuid references public.events(id) on delete set null,
 unsubscribe_token uuid not null unique default gen_random_uuid(),
 unsubscribed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint marketing_email_valid check(
  email=lower(email) and length(email) between 3 and 254 and email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 ),
 constraint marketing_unsubscribe_consistent check(
  (status='unsubscribed')=(unsubscribed_at is not null)
 )
);
create index if not exists marketing_contacts_status_consent on public.marketing_contacts(status,consent_at desc);
alter table public.marketing_contacts enable row level security;
revoke all on public.marketing_contacts from public,anon,authenticated;
grant select on public.marketing_contacts to authenticated;
drop policy if exists marketing_contacts_admin_read on public.marketing_contacts;
create policy marketing_contacts_admin_read on public.marketing_contacts for select to authenticated
using(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));

-- Booking request idempotency UUID is an unguessable session secret.
-- This narrow function never exposes the guest/booking record or other contact data.
-- Do not enable public submissions without anti-spam / traffic controls.
create or replace function yumorilnik_internal.marketing_opt_in_impl(
 p_client_request_id uuid,p_adult_guest_index integer
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_booking record;v_guest record;v_status text;
begin
 if p_client_request_id is null or p_adult_guest_index is null or p_adult_guest_index<0
 then return false;end if;
 select id,event_id,status,created_at into v_booking from public.bookings
 where client_request_id=p_client_request_id;
 if not found or v_booking.status<>'requested'
 or v_booking.created_at < now()-interval '24 hours'
 then return false;end if;
 select full_name,email into v_guest from public.booking_guests
 where booking_id=v_booking.id and guest_index=p_adult_guest_index and category='adult';
 if not found or v_guest.email is null then return false;end if;
 insert into public.marketing_contacts(email,full_name,consent_at,consent_source,source_booking_id,source_event_id)
 values(lower(btrim(v_guest.email)),btrim(v_guest.full_name),now(),'booking_request_checkbox',v_booking.id,v_booking.event_id)
 on conflict(email) do nothing;
 select status into v_status from public.marketing_contacts
 where email=lower(btrim(v_guest.email));
 -- Previously unsubscribed addresses remain unsubscribed: a booking form does not
 -- override a recorded opt-out, even if another person enters that email.
 return coalesce(v_status='subscribed',false);
end;
$body$;
revoke all on function yumorilnik_internal.marketing_opt_in_impl(uuid,integer) from public;
grant execute on function yumorilnik_internal.marketing_opt_in_impl(uuid,integer) to anon,authenticated;
create or replace function public.marketing_opt_in(
 p_client_request_id uuid,p_adult_guest_index integer
) returns boolean language sql security invoker set search_path='' as $body$
 select yumorilnik_internal.marketing_opt_in_impl(p_client_request_id,p_adult_guest_index);
$body$;
revoke all on function public.marketing_opt_in(uuid,integer) from public;
grant execute on function public.marketing_opt_in(uuid,integer) to anon,authenticated;

-- Possession of a long unguessable UUID token authorises opt-out only.
-- No personal details are returned.
create or replace function yumorilnik_internal.marketing_unsubscribe_impl(
 p_token uuid
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_exists boolean;
begin
 if p_token is null then return false;end if;
 update public.marketing_contacts set status='unsubscribed',unsubscribed_at=now(),updated_at=now()
 where unsubscribe_token=p_token and status='subscribed';
 select exists(select 1 from public.marketing_contacts where unsubscribe_token=p_token) into v_exists;
 return v_exists;
end;
$body$;
revoke all on function yumorilnik_internal.marketing_unsubscribe_impl(uuid) from public;
grant execute on function yumorilnik_internal.marketing_unsubscribe_impl(uuid) to anon,authenticated;
create or replace function public.marketing_unsubscribe(p_token uuid)
returns boolean language sql security invoker set search_path='' as $body$
 select yumorilnik_internal.marketing_unsubscribe_impl(p_token);
$body$;
revoke all on function public.marketing_unsubscribe(uuid) from public;
grant execute on function public.marketing_unsubscribe(uuid) to anon,authenticated;

-- An admin can honour an unsubscribe received by reply or phone immediately.
create or replace function yumorilnik_internal.marketing_admin_unsubscribe_impl(
 p_contact_id uuid
) returns boolean language plpgsql security definer set search_path='' as $body$
declare v_exists boolean;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.admin_users a
 where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))
 then raise exception 'Admin access required' using errcode='42501';end if;
 update public.marketing_contacts set status='unsubscribed',unsubscribed_at=now(),updated_at=now()
 where id=p_contact_id and status='subscribed';
 select exists(select 1 from public.marketing_contacts where id=p_contact_id) into v_exists;
 return v_exists;
end;
$body$;
revoke all on function yumorilnik_internal.marketing_admin_unsubscribe_impl(uuid) from public;
grant execute on function yumorilnik_internal.marketing_admin_unsubscribe_impl(uuid) to authenticated;
create or replace function public.marketing_admin_unsubscribe(
 p_contact_id uuid
) returns boolean language sql security invoker set search_path='' as $body$
 select yumorilnik_internal.marketing_admin_unsubscribe_impl(p_contact_id);
$body$;
revoke all on function public.marketing_admin_unsubscribe(uuid) from public;
grant execute on function public.marketing_admin_unsubscribe(uuid) to authenticated;

comment on table public.marketing_contacts is 'Only opted-in adults; opt-out persists and booking requests alone do not confer consent.';
