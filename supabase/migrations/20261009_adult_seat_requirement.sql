alter table public.events add column if not exists adult_seat_required boolean not null default false;
-- This is a per-event rule; keep off until the organiser confirms.
