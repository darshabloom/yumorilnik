-- Run in the Yumorilnik Supabase SQL editor before testing ticket editing.
alter table public.ticket_types enable row level security;
drop policy if exists "yumorilnik_ticket_admin_select" on public.ticket_types;
create policy "yumorilnik_ticket_admin_select" on public.ticket_types for select to authenticated
using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
drop policy if exists "yumorilnik_ticket_public_select" on public.ticket_types;
create policy "yumorilnik_ticket_public_select" on public.ticket_types for select to anon,authenticated
using (is_active=true and exists(select 1 from public.events e where e.id=event_id and e.is_active=true));
drop policy if exists "yumorilnik_ticket_admin_insert" on public.ticket_types;
create policy "yumorilnik_ticket_admin_insert" on public.ticket_types for insert to authenticated
with check (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
drop policy if exists "yumorilnik_ticket_admin_update" on public.ticket_types;
create policy "yumorilnik_ticket_admin_update" on public.ticket_types for update to authenticated
using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')))
with check (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
-- Review any legacy permissive policies in production because permissive RLS policies combine with OR.
