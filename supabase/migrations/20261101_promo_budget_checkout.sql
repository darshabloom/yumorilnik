-- Protect personal/flash promotion redemptions in New Year live checkout.
-- Requires 20261101_promo_category_assignment.sql.
-- Does NOT enable either category and preserves private NZ$0.50 controlled payment test.
DO $migration$
DECLARE fn text; original text;
old_due text:=' v_due:=v_booking.total_cents-v_discount;';
old_availability text:=' IF NOT yumorilnik_internal.checkout_places_available(v_booking.id,p_event_id)';
declarations text:=E' v_campaign_category text;\n v_campaign_budget public.event_discount_budgets%rowtype;\n v_campaign_used bigint;\n v_campaign_total_used bigint;\n v_campaign_cap bigint;\n v_campaign_adult_count integer;\n v_campaign_allocated bigint;\n';
guard text:=$guard$
 -- Every ordinary New Year code must have an explicit category and budget.
 -- Lock the budget row before checking aggregate reserved and committed spend.
 IF p_event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
    AND v_code IS NOT NULL AND v_code<>'YMRLIVE50C2026' THEN
  SELECT a.discount_category INTO v_campaign_category
   FROM public.event_discount_promotion_assignments a
   WHERE a.event_id=p_event_id AND a.promo_code=v_code;
  IF v_campaign_category IS NULL THEN
   RAISE EXCEPTION 'Promo code is not authorised for New Year live checkout'
    USING errcode='22023';
  END IF;
  SELECT * INTO STRICT v_campaign_budget FROM public.event_discount_budgets
   WHERE event_id=p_event_id FOR UPDATE;
  IF (v_campaign_category='personal' AND NOT v_campaign_budget.personal_enabled)
    OR (v_campaign_category='flash' AND NOT v_campaign_budget.flash_enabled)
  THEN RAISE EXCEPTION 'Promotional campaign is currently disabled'
   USING errcode='22023'; END IF;
  IF v_promo.applies_to IS DISTINCT FROM 'adult'
     OR v_promo.event_id IS DISTINCT FROM p_event_id THEN
    RAISE EXCEPTION 'Promotion must target adult seats in this event'
     USING errcode='22023'; END IF;
  SELECT count(*) INTO v_campaign_adult_count FROM public.booking_selections s
   WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL;
  IF v_campaign_adult_count<1 OR v_discount<1 THEN
   RAISE EXCEPTION 'No eligible adult seat discount' USING errcode='22023';
  END IF;
  SELECT coalesce(sum(r.amount_cents),0) INTO v_campaign_total_used
   FROM public.booking_discount_reservations r
   WHERE r.event_id=p_event_id AND r.state IN ('reserved','committed');
  SELECT coalesce(sum(r.amount_cents),0) INTO v_campaign_used
   FROM public.booking_discount_reservations r
   WHERE r.event_id=p_event_id AND r.discount_type=v_campaign_category
     AND r.state IN ('reserved','committed');
  v_campaign_cap:=CASE WHEN v_campaign_category='personal' THEN v_campaign_budget.personal_budget_cents
    ELSE v_campaign_budget.flash_budget_cents END;
  IF v_discount>v_campaign_cap-v_campaign_used
     OR v_discount>v_campaign_budget.total_budget_cents-v_campaign_total_used
  THEN RAISE EXCEPTION 'Promotional discount budget exhausted' USING errcode='22023'; END IF;
 END IF;
$guard$;
reserve text:=$reserve$
 IF v_campaign_category IS NOT NULL AND v_discount>0 THEN
  INSERT INTO public.booking_discount_reservations(
    booking_id,event_id,discount_type,promotion_code,amount_cents,adult_ticket_count,state
  ) VALUES(v_booking.id,p_event_id,v_campaign_category,v_code,v_discount,v_campaign_adult_count,'reserved');
  -- Allocate discount proportionately, with the rounding remainder on the
  -- final adult seat. Total must reconcile exactly to the reserved amount.
  WITH priced AS (
   SELECT s.guest_index,s.price_cents,
    row_number() OVER (ORDER BY s.guest_index) AS row_no,
    count(*) OVER () AS row_count,
    sum(s.price_cents) OVER () AS all_price
   FROM public.booking_selections s WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL
  ),shares AS (
   SELECT guest_index,row_no,row_count,
    floor(v_discount::numeric*price_cents/nullif(all_price,0))::bigint AS amount
   FROM priced
  ),parts AS (
   SELECT guest_index,CASE WHEN row_no=row_count
     THEN v_discount - coalesce(sum(amount) OVER (ORDER BY row_no ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0)
     ELSE amount END AS amount
   FROM shares
  )
  INSERT INTO public.booking_discount_units(booking_id,guest_index,discount_cents)
  SELECT v_booking.id,guest_index,amount FROM parts;
  SELECT coalesce(sum(discount_cents),0)::bigint INTO v_campaign_allocated
    FROM public.booking_discount_units WHERE booking_id=v_booking.id;
  IF v_campaign_allocated IS DISTINCT FROM v_discount
   THEN RAISE EXCEPTION 'Promotional discount allocations do not reconcile' USING errcode='22023'; END IF;
 END IF;
$reserve$;
BEGIN
 SELECT replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)) INTO STRICT fn
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='prepare_live_checkout' AND p.pronargs=6;
 original:=fn;
 IF position('v_campaign_category' IN fn)>0 THEN
  RAISE EXCEPTION 'Campaign reservation already installed';END IF;
 IF position(old_due IN fn)=0 OR position(old_availability IN fn)=0
   OR position(' v_due bigint;' IN fn)=0
   OR position('quote_nye_automatic_discount' IN fn)=0
 THEN RAISE EXCEPTION 'Unexpected live checkout function: no changes made';END IF;
 fn:=replace(fn,' v_due bigint;',' v_due bigint;'||chr(10)||declarations);
 fn:=replace(fn,old_due,guard||old_due);
 fn:=replace(fn,old_availability,reserve||old_availability);
 IF original=fn OR position('v_campaign_cap' IN fn)=0 THEN
  RAISE EXCEPTION 'Campaign migration integrity check failed'; END IF;
 EXECUTE fn;
END;$migration$;

SELECT pg_get_functiondef(p.oid) LIKE '%v_campaign_category%' AS campaign_budget_reservation_installed
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='prepare_live_checkout';