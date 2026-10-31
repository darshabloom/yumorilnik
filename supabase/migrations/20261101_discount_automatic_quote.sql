-- P019 Step 3A: server-side, read-only automatic discount quotation.
-- Does not enable discounts and cannot reserve or charge a payment.
-- The live checkout transaction MUST separately lock the event budget row,
-- reserve the full discount and check actual seat prices before Stripe.
CREATE OR REPLACE FUNCTION public.quote_nye_automatic_discount(
  p_event_id uuid,
  p_adult_seat_prices_cents bigint[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $quote$
DECLARE
  b public.event_discount_budgets%rowtype;
  n integer;
  early_used_count integer;
  group_used_count integer;
  early_used_cents bigint;
  group_used_cents bigint;
  all_used_cents bigint;
  early_amount bigint:=0;
  group_amount bigint:=0;
  group_raw bigint;
  full_price bigint;
  chosen text:=NULL;
  chosen_amount bigint:=0;
BEGIN
  IF p_event_id IS DISTINCT FROM '3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
    THEN RETURN pg_catalog.jsonb_build_object('discount_type',NULL,'discount_cents',0);
  END IF;
  SELECT * INTO b FROM public.event_discount_budgets
   WHERE event_id=p_event_id;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('discount_type',NULL,'discount_cents',0); END IF;
  n:=coalesce(pg_catalog.array_length(p_adult_seat_prices_cents,1),0);
  IF n=0 OR n>200 OR EXISTS(SELECT 1 FROM pg_catalog.unnest(p_adult_seat_prices_cents) AS seat(price) WHERE seat.price IS NULL OR seat.price<0)
    THEN RAISE EXCEPTION 'Invalid seat price array' USING errcode='22023'; END IF;
  SELECT coalesce(sum(seat.price),0)::bigint INTO full_price
    FROM pg_catalog.unnest(p_adult_seat_prices_cents) AS seat(price);
  SELECT coalesce(sum(amount_cents) FILTER (WHERE state IN ('reserved','committed')),0),
    coalesce(sum(amount_cents) FILTER (WHERE state IN ('reserved','committed') AND discount_type='early_bird'),0),
    coalesce(sum(amount_cents) FILTER (WHERE state IN ('reserved','committed') AND discount_type='group'),0),
    coalesce(sum(adult_ticket_count) FILTER (WHERE state IN ('reserved','committed') AND discount_type='early_bird'),0),
    coalesce(sum(adult_ticket_count) FILTER (WHERE state IN ('reserved','committed') AND discount_type='group'),0)
  INTO all_used_cents,early_used_cents,group_used_cents,early_used_count,group_used_count
  FROM public.booking_discount_reservations WHERE event_id=p_event_id;
  IF b.early_bird_enabled AND now()<b.early_bird_ends_at AND
     early_used_count+n<=b.early_bird_ticket_limit AND
     early_used_cents+n*1000<=b.early_bird_budget_cents AND
     all_used_cents+n*1000<=b.total_budget_cents THEN
    early_amount:=n*1000;
  END IF;
  IF b.group_enabled AND n>=6 AND group_used_count+n<=b.group_ticket_limit THEN
    SELECT coalesce(sum(pg_catalog.floor(seat.price::numeric*0.05)::bigint),0)
      INTO group_raw FROM pg_catalog.unnest(p_adult_seat_prices_cents) AS seat(price);
    IF group_used_cents+group_raw<=b.group_budget_cents
       AND all_used_cents+group_raw<=b.total_budget_cents THEN
      group_amount:=group_raw;
    END IF;
  END IF;
  IF early_amount>0 AND early_amount>=group_amount THEN
    chosen:='early_bird';chosen_amount:=early_amount;
  ELSIF group_amount>0 THEN
    chosen:='group';chosen_amount:=group_amount;
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'discount_type',chosen,'discount_cents',chosen_amount,
    'original_cents',full_price,'payable_cents',full_price-chosen_amount,
    'early_bird_available',early_amount>0,'group_available',group_amount>0,
    'quote_only',true
  );
END;
$quote$;
REVOKE ALL ON FUNCTION public.quote_nye_automatic_discount(uuid,bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_nye_automatic_discount(uuid,bigint[]) TO service_role;
