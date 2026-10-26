-- Add recipient-specific delivery tracking without exposing booking PII to browsers.
-- Apply ONLY to the connected Yumorilnik project after the booking and TEST12 migrations.
create table if not exists public.booking_confirmation_deliveries(
 booking_id uuid not null references public.bookings(id) on delete cascade,
 guest_index integer not null,
 recipient_email text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0,
 provider_message_id text,
 error_message text,
 last_attempt_at timestamptz,
 sent_at timestamptz,
 primary key(booking_id,guest_index)
);
create index if not exists booking_confirmation_deliveries_pending
 on public.booking_confirmation_deliveries(status,last_attempt_at);
alter table public.booking_confirmation_deliveries enable row level security;
revoke all on public.booking_confirmation_deliveries from public,anon,authenticated;

-- Trigger only confirmed bookings. These rows carry each adult's address, so
-- a server-only worker can send an individual confirmation to each adult.
create or replace function yumorilnik_internal.queue_confirmed_booking_mail()
returns trigger language plpgsql security definer set search_path='' as $body$
begin
 if new.status='confirmed' and (tg_op='INSERT' or old.status is distinct from 'confirmed') then
  insert into public.booking_confirmation_deliveries(booking_id,guest_index,recipient_email)
  select new.id,g.guest_index,g.email
  from public.booking_guests g
  where g.booking_id=new.id and g.category='adult' and g.email is not null
  on conflict(booking_id,guest_index) do nothing;
 end if;
 return new;
end;
$body$;
drop trigger if exists yumorilnik_queue_confirmations on public.bookings;
create trigger yumorilnik_queue_confirmations
after insert or update of status on public.bookings
for each row execute function yumorilnik_internal.queue_confirmed_booking_mail();
-- The RPC inserts booking_guests before setting booking.status='confirmed', so
-- the update trigger queues the adult recipients once guests are present.
-- Backfill rows only for verified confirmations not yet sent.
insert into public.booking_confirmation_deliveries(booking_id,guest_index,recipient_email)
select b.id,g.guest_index,g.email from public.bookings b
join public.booking_guests g on g.booking_id=b.id
where b.status='confirmed' and g.category='adult' and g.email is not null
  and b.confirmation_email_status in ('pending','not_queued')
on conflict(booking_id,guest_index) do nothing;

comment on table public.booking_confirmation_deliveries is
 'Per-adult transactional receipt delivery. Secret server worker only; never public email access.';
