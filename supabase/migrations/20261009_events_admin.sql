-- Yumorilnik bilingual event management
-- Run once in the Yumorilnik project after reviewing existing policies.
-- Existing rows stay intact; is_active = false represents a draft for now.

alter table public.events
  add column if not exists title_en text,
  add column if not exists description_en text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.events enable row level security;

-- Only authenticated members of admin_users may create or change events.
-- Review and remove any existing permissive INSERT/UPDATE/DELETE policies
-- for anon/authenticated before production: permissive policies combine via OR.
drop policy if exists "yumorilnik_admin_events_insert" on public.events;
create policy "yumorilnik_admin_events_insert" on public.events
  for insert to authenticated
  with check (exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.role in ('owner', 'admin')
  ));

drop policy if exists "yumorilnik_admin_events_update" on public.events;
create policy "yumorilnik_admin_events_update" on public.events
  for update to authenticated
  using (exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.role in ('owner', 'admin')
  ));

drop policy if exists "yumorilnik_admin_events_select" on public.events;
create policy "yumorilnik_admin_events_select" on public.events
  for select to authenticated
  using (exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.role in ('owner', 'admin')
  ));

drop policy if exists "yumorilnik_public_events_select" on public.events;
create policy "yumorilnik_public_events_select" on public.events
  for select to anon, authenticated
  using (is_active = true);
