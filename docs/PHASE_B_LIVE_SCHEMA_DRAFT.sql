-- PHASE B DESIGN DRAFT — NOT YET APPROVED FOR EXECUTION.
-- Do not run against production until prepare/bind/complete/expire routines,
-- seat-availability integration, permissions and payment-recovery tests are complete.
-- Existing sandbox is deliberately untouched.
begin;

create table if not exists public.booking_live_checkouts (
 booking_id uuid primary key references public.bookings(id) on delete restrict,
 event_id uuid not null references public.events(id) on delete restrict,
 state text not null default 'creating'
   check(state in ('creating','open','paid','expired','needs_review')),
 amount_cents bigint not null check(amount_cents >= 50 and amount_cents <= 10000000),
 currency text not null default 'nzd' check(currency='nzd'),
 promotion_code text,
 stripe_session_id text unique,
 stripe_payment_intent_id text unique,
 expires_at timestamptz not null,
 review_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists booking_live_checkouts_event_state
 on public.booking_live_checkouts(event_id,state,expires_at);
alter table public.booking_live_checkouts enable row level security;
revoke all on public.booking_live_checkouts from public, anon, authenticated;
-- Backend access is via server-only credentials and restricted RPCs.

commit;

-- IMPORTANT: The next migration must update seat availability to include
-- active live holds in addition to:
--   1. bookings.status = 'confirmed' / 'test_confirmed'
--   2. booking_test_checkouts.state = 'creating'/'open'
-- and ensure expiry and ticket inventory are checked under the same
-- pg_advisory_xact_lock(hashtextextended(event_id::text,0)).
-- Do not enable STRIPE_LIVE_CHECKOUT_ENABLED until that logic,
-- payment confirmation, idempotent fulfilment and reconciliation exist.
