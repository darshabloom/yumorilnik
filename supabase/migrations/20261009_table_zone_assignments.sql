alter table public.seating_tables add column if not exists price_zone_id uuid references public.event_price_zones(id) on delete set null;
create index if not exists seating_tables_price_zone_idx on public.seating_tables(price_zone_id);
-- Null means inherit from the polygon. A chosen zone overrides geometry without changing table placement.
