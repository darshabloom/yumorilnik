alter table public.events
  add column if not exists detail_image_url text,
  add column if not exists banner_fit text not null default 'cover',
  add column if not exists banner_position_x integer not null default 50,
  add column if not exists banner_position_y integer not null default 50,
  add column if not exists detail_fit text not null default 'cover',
  add column if not exists detail_position_x integer not null default 50,
  add column if not exists detail_position_y integer not null default 50;

alter table public.events add constraint events_banner_fit_valid check (banner_fit in ('cover','contain'));
alter table public.events add constraint events_detail_fit_valid check (detail_fit in ('cover','contain'));
alter table public.events add constraint events_positions_valid check (
  banner_position_x between 0 and 100 and banner_position_y between 0 and 100
  and detail_position_x between 0 and 100 and detail_position_y between 0 and 100
);
-- Existing image_url remains the banner. The secondary image starts empty, not copied.
