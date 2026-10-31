-- New Year's 2027 discount budget and reservation ledger.
-- Safe phase 1: creates infrastructure; does NOT activate discounts or alter checkout.
-- Apply in Supabase SQL Editor before enabling the application integration.
BEGIN;

CREATE TABLE IF NOT EXISTS public.event_discount_budgets (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  total_budget_cents bigint NOT NULL DEFAULT 80000 CHECK (total_budget_cents >= 0),
  early_bird_budget_cents bigint NOT NULL DEFAULT 40000 CHECK (early_bird_budget_cents >= 0),
  group_budget_cents bigint NOT NULL DEFAULT 15000 CHECK (group_budget_cents >= 0),
  flash_budget_cents bigint NOT NULL DEFAULT 15000 CHECK (flash_budget_cents >= 0),
  personal_budget_cents bigint NOT NULL DEFAULT 10000 CHECK (personal_budget_cents >= 0),
  early_bird_ticket_limit integer NOT NULL DEFAULT 40 CHECK (early_bird_ticket_limit >= 0),
  group_ticket_limit integer NOT NULL DEFAULT 20 CHECK (group_ticket_limit >= 0),
  early_bird_ends_at timestamptz NOT NULL DEFAULT ('2026-11-16 00:00:00 Pacific/Auckland'::timestamptz),
  early_bird_enabled boolean NOT NULL DEFAULT false,
  group_enabled boolean NOT NULL DEFAULT false,
  flash_enabled boolean NOT NULL DEFAULT false,
  personal_enabled boolean NOT NULL DEFAULT false,
  provisional_event_cost_cents bigint NOT NULL DEFAULT 1159250 CHECK (provisional_event_cost_cents >= 0),
  minimum_surplus_cents bigint NOT NULL DEFAULT 200000 CHECK (minimum_surplus_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_discount_allocations_within_total CHECK (
    early_bird_budget_cents + group_budget_cents +
    flash_budget_cents + personal_budget_cents <= total_budget_cents
  )
);

CREATE TABLE IF NOT EXISTS public.booking_discount_reservations (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id),
  discount_type text NOT NULL CHECK (discount_type IN ('early_bird','group','flash','personal')),
  promotion_code text NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  adult_ticket_count integer NOT NULL CHECK (adult_ticket_count >= 0),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','committed','released','refunded')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz NULL,
  released_at timestamptz NULL,
  refunded_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS booking_discount_reservations_event_state
 ON public.booking_discount_reservations(event_id,discount_type,state);

-- Per-seat allocations preserve an auditable basis for partial refunds.
CREATE TABLE IF NOT EXISTS public.booking_discount_units (
  booking_id uuid NOT NULL REFERENCES public.booking_discount_reservations(booking_id) ON DELETE CASCADE,
  guest_index integer NOT NULL,
  discount_cents bigint NOT NULL CHECK (discount_cents >= 0),
  PRIMARY KEY (booking_id, guest_index)
);

ALTER TABLE public.event_discount_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_discount_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_discount_units ENABLE ROW LEVEL SECURITY;

-- Financial controls are server-side only, never public client writes.
REVOKE ALL ON public.event_discount_budgets FROM anon, authenticated;
REVOKE ALL ON public.booking_discount_reservations FROM anon, authenticated;
REVOKE ALL ON public.booking_discount_units FROM anon, authenticated;

INSERT INTO public.event_discount_budgets(event_id)
VALUES ('3f6fa4d1-aaca-4326-9c01-5774cffca2f5')
ON CONFLICT (event_id) DO NOTHING;

COMMIT;

SELECT event_id,total_budget_cents,early_bird_budget_cents,
       group_budget_cents,flash_budget_cents,personal_budget_cents,
       early_bird_enabled,group_enabled
FROM public.event_discount_budgets
WHERE event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5';
