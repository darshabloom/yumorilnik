alter table public.events add column if not exists table_booking_mode text not null default 'whole_table';
do $$ begin
 if not exists(select 1 from pg_constraint where conname='events_table_booking_mode_check') then
  alter table public.events add constraint events_table_booking_mode_check
  check (table_booking_mode in ('whole_table','individual_seats'));
 end if;
end $$;
-- Settings only; no seats, table inventory, holds or payments are created.
