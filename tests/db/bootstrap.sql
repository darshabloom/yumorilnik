-- Isolated PostgreSQL fixture for verifying the Yumorilnik booking migration.
-- This is NOT a Supabase production database.
create role anon nologin;
create role authenticated nologin;
create extension if not exists pgcrypto;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable
 as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;

create table public.events(
 id uuid primary key,
 is_active boolean not null,
 event_type text not null,
 seating_mode text not null,
 table_booking_mode text not null
);
create table public.ticket_types(
 id uuid primary key,
 event_id uuid not null references public.events(id),
 name text not null,
 price_cents integer not null,
 is_active boolean not null,
 quantity_total integer,
 quantity_sold integer
);
create table public.seating_tables(
 id uuid primary key,
 event_id uuid not null references public.events(id),
 label text not null,
 is_active boolean not null,
 seats_top integer not null,
 seats_bottom integer not null,
 seats_left integer not null,
 seats_right integer not null,
 seat_price_cents integer,
 table_price_cents integer
);
create table public.admin_users(user_id uuid primary key references auth.users(id),role text not null);
alter table public.admin_users enable row level security;
create policy admin_self on public.admin_users for select to authenticated
 using(user_id=(select auth.uid()));
grant select on public.admin_users to authenticated;

insert into public.events(id,is_active,event_type,seating_mode,table_booking_mode)
values('11111111-1111-4111-8111-111111111111',true,'internal','assigned_seats','individual_seats');
insert into public.ticket_types(id,event_id,name,price_cents,is_active,quantity_total,quantity_sold)values
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Adult',4000,true,100,0),
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Child',3000,true,100,0);
insert into public.seating_tables(id,event_id,label,is_active,seats_top,seats_bottom,seats_left,seats_right,seat_price_cents,table_price_cents)values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Table A',true,4,0,0,0,10500,20000),
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Table B',true,2,0,0,0,null,12000);
insert into auth.users(id) values('66666666-6666-4666-8666-666666666666');
insert into public.admin_users(user_id,role)values('66666666-6666-4666-8666-666666666666','owner');
