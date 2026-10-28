-- After family metadata migration: do not email adult-priced children separately.
-- Send one confirmation to the actual adult guardian, including the child in their booking.
create or replace function yumorilnik_internal.queue_confirmed_booking_mail()
returns trigger language plpgsql security definer set search_path='' as $body$
begin
 if new.status='confirmed' and (tg_op='INSERT' or old.status is distinct from 'confirmed') then
  insert into public.booking_confirmation_deliveries(booking_id,guest_index,recipient_email)
  select new.id,g.guest_index,g.email
  from public.booking_guests g
  where g.booking_id=new.id and g.category='adult' and not g.is_child_with_adult_seat and g.email is not null
  on conflict(booking_id,guest_index) do nothing;
 end if;
 return new;
end;
$body$;
