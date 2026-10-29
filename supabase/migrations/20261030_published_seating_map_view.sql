-- Public seating-map viewport, distinct from background photo framing.
-- All values describe presentation ONLY; they never change table coordinates,
-- wall/entrance geometry, seat numbering or ticket pricing.
-- Run once in the Yumorilnik Supabase SQL editor before publishing the
-- admin whole-map view to the customer map.
alter table public.event_seating_maps
 add column if not exists public_view_scale numeric not null default 1,
 add column if not exists public_view_x numeric not null default 0,
 add column if not exists public_view_y numeric not null default 0;

-- Existing users retain default view; positive and negative translations work.
-- No new table, policy, function or security-definer access is introduced.
do $migration$
begin
 if not exists(
  select 1 from pg_constraint where conname='event_seating_maps_public_view_bounds'
 ) then
  alter table public.event_seating_maps
    add constraint event_seating_maps_public_view_bounds check(
      public_view_scale between 0.4 and 2.5 and
      public_view_x between -100 and 100 and
      public_view_y between -100 and 100
    );
 end if;
end $migration$;

-- Verification:
-- select public_view_scale,public_view_x,public_view_y
-- from public.event_seating_maps
-- where event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid;
