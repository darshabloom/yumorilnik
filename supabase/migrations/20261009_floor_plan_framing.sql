alter table public.event_seating_maps
 add column if not exists background_zoom numeric not null default 1,
 add column if not exists background_x numeric not null default 50,
 add column if not exists background_y numeric not null default 50;
-- zoom is scale relative to the image's contain fit; x/y are percentage positions.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='event_map_background_zoom_valid') then
 alter table public.event_seating_maps add constraint event_map_background_zoom_valid check(background_zoom between 0.5 and 5);
 end if;
 if not exists(select 1 from pg_constraint where conname='event_map_background_position_valid') then
 alter table public.event_seating_maps add constraint event_map_background_position_valid check(background_x between 0 and 100 and background_y between 0 and 100);
 end if;
end $$;
