alter table public.ticket_types add column if not exists show_remaining boolean not null default false;
alter table public.events add column if not exists seating_mode text not null default 'general_admission';
do $$ begin
 if not exists (select 1 from pg_constraint where conname='events_seating_mode_check') then
 alter table public.events add constraint events_seating_mode_check check (seating_mode in ('general_admission','assigned_seats','tables'));
 end if;
end $$;
-- A selected mode controls presentation only; it does not create seats, bookings or holds.
