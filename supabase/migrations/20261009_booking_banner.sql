alter table public.events
 add column if not exists booking_image_url text,
 add column if not exists booking_image_fit text not null default 'cover',
 add column if not exists booking_image_position_x integer not null default 50,
 add column if not exists booking_image_position_y integer not null default 50;
-- A null booking_image_url reuses the main event banner.
