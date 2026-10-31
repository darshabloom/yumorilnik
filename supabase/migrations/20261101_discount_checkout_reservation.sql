-- P019 Step 3B: reserve automatic discounts in the same transaction as live checkout.
-- Run AFTER 20261101_discount_automatic_quote.sql. Does not enable offers.
-- Existing promo-code path is preserved; it is NOT part of the new budget programme yet.
DO $migration$
DECLARE
  fn text;
  original text;
  old_due text := ' v_due:=v_booking.total_cents-v_discount;';
  old_hold text := ' IF NOT yumorilnik_internal.checkout_places_available(v_booking.id,p_event_id)';
  new_declarations text := E' v_auto_quote jsonb;\n v_auto_discount bigint:=0;\n v_auto_type text;\n v_auto_prices bigint[];\n v_auto_units integer;\n v_auto_allocated bigint;\n v_auto_budget public.event_discount_budgets%rowtype;\n';
  new_pricing text := $pricing$
 -- New Year's discount budget is locked for the full live-checkout transaction.
 -- No automatic discount is combined with an explicit promotion code.
 IF p_event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
    AND v_code IS NULL THEN
   SELECT * INTO v_auto_budget FROM public.event_discount_budgets
     WHERE event_id=p_event_id FOR UPDATE;
   IF FOUND AND (v_auto_budget.early_bird_enabled OR v_auto_budget.group_enabled) THEN
     SELECT coalesce(array_agg(s.price_cents::bigint ORDER BY s.guest_index),ARRAY[]::bigint[])
       INTO v_auto_prices
     FROM public.booking_selections s
     WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL;
     IF coalesce(array_length(v_auto_prices,1),0)>0 THEN
       SELECT public.quote_nye_automatic_discount(p_event_id,v_auto_prices)
         INTO v_auto_quote;
       v_auto_type:=v_auto_quote->>'discount_type';
       v_auto_discount:=coalesce((v_auto_quote->>'discount_cents')::bigint,0);
       v_auto_units:=coalesce(array_length(v_auto_prices,1),0);
       IF v_auto_discount>0 THEN
         IF v_auto_type NOT IN ('early_bird','group') THEN
           RAISE EXCEPTION 'Invalid automatic discount type' USING errcode='22023';
         END IF;
         v_discount:=v_auto_discount;
       END IF;
     END IF;
   END IF;
 END IF;

$pricing$;
  new_reservation text := $reserve$
 IF v_auto_discount>0 THEN
   INSERT INTO public.booking_discount_reservations(
     booking_id,event_id,discount_type,amount_cents,adult_ticket_count,state
   ) VALUES (
     v_booking.id,p_event_id,v_auto_type,v_auto_discount,v_auto_units,'reserved'
   );
   INSERT INTO public.booking_discount_units(booking_id,guest_index,discount_cents)
   SELECT v_booking.id,s.guest_index,
     CASE WHEN v_auto_type='early_bird' THEN 1000
       ELSE floor(s.price_cents::numeric*0.05)::bigint END
   FROM public.booking_selections s
   WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL;
   SELECT coalesce(sum(discount_cents),0)::bigint INTO v_auto_allocated
   FROM public.booking_discount_units WHERE booking_id=v_booking.id;
   IF v_auto_allocated IS DISTINCT FROM v_auto_discount
   THEN RAISE EXCEPTION 'Discount unit total mismatch' USING errcode='22023'; END IF;
 END IF;

$reserve$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10))
    INTO STRICT fn
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='prepare_live_checkout' AND p.pronargs=6;
  original:=fn;
  IF position('quote_nye_automatic_discount(' in fn)>0 THEN
     RAISE EXCEPTION 'Automatic checkout discount integration already installed';
  END IF;
  IF position(old_due in fn)=0 OR position(old_hold in fn)=0
    OR position(' v_due bigint;' in fn)=0
    OR position('unit_admission_cents' in fn)=0 THEN
     RAISE EXCEPTION 'Unexpected live checkout function; no changes made';
  END IF;
  fn:=replace(fn,' v_due bigint;', ' v_due bigint;'||chr(10)||new_declarations);
  fn:=replace(fn,old_due,new_pricing||old_due);
  fn:=replace(fn,old_hold,new_reservation||old_hold);
  IF fn=original OR position('v_auto_discount:=v_auto_discount' in fn)>0 THEN
    RAISE EXCEPTION 'Checkout migration validation failed'; END IF;
  EXECUTE fn;
END;
$migration$;

SELECT pg_get_functiondef(p.oid) LIKE '%quote_nye_automatic_discount(%' AS auto_reservation_integrated
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='prepare_live_checkout';
