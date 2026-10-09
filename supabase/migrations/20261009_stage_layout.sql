alter table public.event_seating_maps
 add column if not exists stage_x numeric not null default 440,
 add column if not exists stage_y numeric not null default 18,
 add column if not exists stage_width numeric not null default 130,
 add column if not exists stage_height numeric not null default 42,
 add column if not exists stage_rotation numeric not null default 0;
