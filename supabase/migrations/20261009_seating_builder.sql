-- Seating map tables used by the visual editor.
create table if not exists public.event_seating_maps (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null unique references public.events(id) on delete cascade,
 background_image_url text,
 canvas_width integer not null default 1000,
 canvas_height integer not null default 700,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.seating_tables (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 label text not null,
 shape text not null default 'rectangle',
 x numeric not null default 100,
 y numeric not null default 100,
 width numeric not null default 170,
 height numeric not null default 70,
 rotation_deg numeric not null default 0,
 seats_top integer not null default 2,
 seats_bottom integer not null default 2,
 seats_left integer not null default 1,
 seats_right integer not null default 1,
 table_price_cents integer,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint seating_table_price_valid check(table_price_cents is null or table_price_cents>=0)
);
alter table public.event_seating_maps enable row level security;
alter table public.seating_tables enable row level security;
drop policy if exists "yumorilnik_maps_read" on public.event_seating_maps;
create policy "yumorilnik_maps_read" on public.event_seating_maps for select to anon,authenticated
using(exists(select 1 from public.events e where e.id=event_id and e.is_active=true) or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
drop policy if exists "yumorilnik_tables_read" on public.seating_tables;
create policy "yumorilnik_tables_read" on public.seating_tables for select to anon,authenticated
using(exists(select 1 from public.events e where e.id=event_id and e.is_active=true) or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
drop policy if exists "yumorilnik_maps_write" on public.event_seating_maps;
create policy "yumorilnik_maps_write" on public.event_seating_maps for all to authenticated
using(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')))
with check(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
drop policy if exists "yumorilnik_tables_write" on public.seating_tables;
create policy "yumorilnik_tables_write" on public.seating_tables for all to authenticated
using(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')))
with check(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
-- Existing rows preserved. Confirm no older permissive write policies exist.
