-- Yumorilnik administration foundation
-- Review and run in the Yumorilnik Supabase SQL Editor.
-- This migration does not assign an owner automatically.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Admins can inspect their own role; clients cannot grant themselves access.
drop policy if exists "Admins can read their own membership" on public.admin_users;
create policy "Admins can read their own membership"
  on public.admin_users
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No client-side insert, update, or delete policies:
-- owner assignment and future invitation acceptance must use trusted server code.
create unique index if not exists admin_users_one_owner
  on public.admin_users (role)
  where role = 'owner';

comment on table public.admin_users is
  'Explicit administrator permissions. Owner assignment must be performed via trusted server-side action.';
