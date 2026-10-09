alter table public.seating_tables
 add column if not exists seat_price_cents integer;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='seating_tables_seat_price_nonnegative') then
  alter table public.seating_tables add constraint seating_tables_seat_price_nonnegative check (seat_price_cents is null or seat_price_cents >= 0);
 end if;
end $$;
-- Existing whole-table prices remain unchanged. No per-seat charges are inferred from them.
