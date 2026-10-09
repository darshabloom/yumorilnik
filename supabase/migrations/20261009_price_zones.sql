create table if not exists public.event_price_zones (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 name text not null,
 price_cents integer not null check (price_cents >= 0),
 color text not null default '#f5a047',
 x numeric not null default 100,
 y numeric not null default 100,
 width numeric not null default 300,
 height numeric not null default 200,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 constraint price_zone_bounds check (x>=0 and y>=0 and width>0 and height>0 and x+width<=1000 and y+height<=700)
);
create index if not exists event_price_zones_event_idx on public.event_price_zones(event_id);
alter table public.event_price_zones enable row level security;
drop policy if exists "price_zones_read" on public.event_price_zones;
create policy "price_zones_read" on public.event_price_zones for select to anon,authenticated using (
 exists(select 1 from public.events e where e.id=event_id and e.is_active=true)
 or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()))
);
drop policy if exists "price_zones_write" on public.event_price_zones;
create policy "price_zones_write" on public.event_price_zones for all to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')))
 with check (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
alter table public.events add column if not exists pricing_model text not null default 'admission_plus_seat';
alter table public.events add column if not exists child_unseated_price_cents integer not null default 3000;
