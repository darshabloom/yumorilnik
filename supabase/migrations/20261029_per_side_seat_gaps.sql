-- Apply in Yumorilnik Supabase project vzzabkviwyarrdkevqco before using per-side spacing.
-- Display-only values in venue coordinate units; no booking identities or seat numbers change.
alter table public.seating_tables
  add column if not exists seat_gap_top integer not null default 6,
  add column if not exists seat_gap_right integer not null default 6,
  add column if not exists seat_gap_bottom integer not null default 6,
  add column if not exists seat_gap_left integer not null default 6;
alter table public.seating_tables
  add constraint seating_tables_seat_gaps_range
  check (seat_gap_top between 0 and 40
     and seat_gap_right between 0 and 40
     and seat_gap_bottom between 0 and 40
     and seat_gap_left between 0 and 40);
