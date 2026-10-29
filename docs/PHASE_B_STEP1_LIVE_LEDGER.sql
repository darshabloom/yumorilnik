-- Yumorilnik Phase B / Step 1: live checkout ledger foundation
-- Run ONLY in Supabase project vzzabkviwyarrdkevqco.
-- This is additive; does not turn on checkout, touch existing bookings,
-- or alter the functioning test checkout.
BEGIN;
CREATE TABLE IF NOT EXISTS public.booking_live_checkouts (
 booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE RESTRICT,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'creating'
  CHECK (state IN ('creating','open','paid','expired','needs_review')),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 50 AND 10000000),
 currency text NOT NULL DEFAULT 'nzd' CHECK(currency='nzd'),
 promotion_code text,
 stripe_session_id text UNIQUE,
 stripe_payment_intent_id text UNIQUE,
 expires_at timestamptz NOT NULL,
 review_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_live_checkouts_event_state
 ON public.booking_live_checkouts (event_id,state,expires_at);
ALTER TABLE public.booking_live_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_live_checkouts FROM PUBLIC,anon,authenticated;
COMMIT;
-- Read-only verification (run afterwards)
SELECT table_name, row_security
FROM (SELECT tablename AS table_name, rowsecurity AS row_security
      FROM pg_tables WHERE schemaname='public') t
WHERE table_name='booking_live_checkouts';
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='booking_live_checkouts'
ORDER BY indexname;
SELECT COUNT(*) AS live_checkout_rows FROM public.booking_live_checkouts;
