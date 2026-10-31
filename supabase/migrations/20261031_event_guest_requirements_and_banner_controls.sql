-- Run in the Yumorilnik Supabase SQL Editor (project vzzabkviwyarrdkevqco).
-- Safe to rerun. Existing events continue requiring individual guest details.
alter table public.events
  add column if not exists banner_width_percent integer not null default 100,
  add column if not exists banner_height_vh integer not null default 62,
  add column if not exists require_individual_guest_details boolean not null default true;

-- Ensure invalid dimensions cannot be saved.
alter table public.events drop constraint if exists events_banner_width_percent_range;
alter table public.events add constraint events_banner_width_percent_range
  check (banner_width_percent between 30 and 100);
alter table public.events drop constraint if exists events_banner_height_vh_range;
alter table public.events add constraint events_banner_height_vh_range
  check (banner_height_vh between 15 and 90);

-- Igrisha uses general admission; lead-booker-only booking.
update public.events
set require_individual_guest_details=false
where lower(slug) like '%igrisha%' and seating_mode='general_admission';

-- Verify resulting settings.
select slug,seating_mode,require_individual_guest_details,
       banner_width_percent,banner_height_vh
from public.events
order by slug;
