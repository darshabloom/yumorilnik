-- Apply to Yumorilnik Supabase project vzzabkviwyarrdkevqco before deploying banner controls.
alter table public.events
 add column if not exists banner_width_percent integer not null default 100
 check (banner_width_percent between 30 and 100),
 add column if not exists banner_height_vh integer not null default 62
 check (banner_height_vh between 15 and 90);
