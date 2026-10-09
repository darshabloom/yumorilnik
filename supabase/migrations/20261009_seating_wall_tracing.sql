create table if not exists public.seating_features (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 kind text not null check (kind in ('wall','entrance')),
 label text,
 points jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint seating_feature_points_array check (jsonb_typeof(points)='array')
);
create index if not exists seating_features_event_idx on public.seating_features(event_id);
alter table public.seating_features enable row level security;
drop policy if exists "yumorilnik_features_read" on public.seating_features;
create policy "yumorilnik_features_read" on public.seating_features for select to anon,authenticated
using (
 exists(select 1 from public.events e where e.id=event_id and e.is_active=true)
 or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))
);
drop policy if exists "yumorilnik_features_write" on public.seating_features;
create policy "yumorilnik_features_write" on public.seating_features for all to authenticated
using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')))
with check (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
-- Existing events and table positions are preserved.
