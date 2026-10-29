-- Yumorilnik Phase B / Step 3: live Stripe checkout RPCs
-- RUN ONLY in Supabase project vzzabkviwyarrdkevqco after Step 2 verification.
-- Based on exact sandbox SQL exported by the organiser (29 Oct 2026).
-- IMPORTANT: No Stripe requests occur in SQL. Server-only RPCs; payment evidence
-- is verified by the signed webhook AND retrieved live Checkout session before
-- calling complete_live_checkout_session. Do not expose service credentials.
-- Rollout stays DISABLED even after executing this migration.
--
-- This migration does not rewrite or destroy existing tickets or bookings.
-- Free (100% discounted) live orders intentionally fail CLOSED until the
-- organiser explicitly defines a zero-value fulfilment policy.

BEGIN;

CREATE OR REPLACE FUNCTION public.prepare_live_checkout(
 p_event_id uuid, p_client_request_id uuid, p_tickets jsonb,
 p_guests jsonb, p_selections jsonb, p_promo_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_booking public.bookings%rowtype;
 v_hold public.booking_live_checkouts%rowtype;
 v_promo public.booking_promotions%rowtype;
 v_code text:=NULLIF(upper(btrim(coalesce(p_promo_code,''))),'');
 v_adult_ticket uuid;
 v_child_ticket uuid;
 v_eligible_sum bigint:=0;
 v_expected_total bigint;
 v_eligible_count integer:=0;
 v_discount bigint:=0;
 v_unit record;
 v_unit_eligible boolean;
 v_unit_discount bigint;
 v_due bigint;
BEGIN
 IF p_event_id IS DISTINCT FROM '3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
    OR p_client_request_id IS NULL
 THEN RAISE EXCEPTION 'Live checkout is not configured for this event'
   USING errcode='22023'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.events e WHERE e.id=p_event_id
     AND e.seating_mode='tables'
     AND e.table_booking_mode='individual_seats'
 ) THEN RAISE EXCEPTION 'Event is not configured for individual table seats'
   USING errcode='22023'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text,0));
 SELECT * INTO v_booking FROM public.bookings
  WHERE client_request_id=p_client_request_id;
 IF FOUND THEN
   SELECT * INTO v_hold FROM public.booking_live_checkouts
    WHERE booking_id=v_booking.id;
   IF FOUND AND v_booking.event_id=p_event_id
     AND (v_hold.state IN ('creating','open') AND v_booking.status='requested') THEN
      RETURN pg_catalog.jsonb_build_object(
       'booking_id',v_booking.id,'reference',v_booking.booking_reference,
       'amount_cents',v_hold.amount_cents,'currency','nzd',
       'state',v_hold.state,'stripe_session_id',v_hold.stripe_session_id);
   END IF;
   RAISE EXCEPTION 'Request ID was previously used' USING errcode='22023';
 END IF;

 -- Canonical family builder enforces child, seat, quantity and price validation.
 PERFORM yumorilnik_internal.submit_family_booking_impl(
   p_event_id,p_client_request_id,p_tickets,p_guests,p_selections);
 SELECT * INTO STRICT v_booking FROM public.bookings
   WHERE client_request_id=p_client_request_id;
 IF v_booking.total_cents IS NULL OR v_booking.total_cents<1
    OR v_booking.total_cents>10000000
 THEN RAISE EXCEPTION 'Invalid total for live tickets and seats'
   USING errcode='22023'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.booking_items i
   JOIN public.ticket_types t ON t.id=i.ticket_type_id
   WHERE i.booking_id=v_booking.id AND lower(t.currency)<>'nzd'
 ) THEN RAISE EXCEPTION 'Only NZD can be charged'
   USING errcode='22023'; END IF;
 SELECT
    coalesce((SELECT SUM(s.price_cents) FROM public.booking_selections s
      WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL),0)
   +coalesce((SELECT SUM(g.childcare_price_cents) FROM public.booking_guests g
      WHERE g.booking_id=v_booking.id AND g.category='child'),0)
 INTO v_expected_total;
 IF v_expected_total IS DISTINCT FROM v_booking.total_cents
 THEN RAISE EXCEPTION 'Price components do not match booking total'
   USING errcode='22023'; END IF;

 IF (SELECT count(*) FROM public.booking_items i WHERE i.booking_id=v_booking.id
      AND i.category='adult')>1
 OR (SELECT count(*) FROM public.booking_items i WHERE i.booking_id=v_booking.id
      AND i.category='child')>1
 THEN RAISE EXCEPTION 'Multiple ticket types per category not supported'
   USING errcode='22023'; END IF;
 SELECT ticket_type_id INTO v_adult_ticket FROM public.booking_items
    WHERE booking_id=v_booking.id AND category='adult' LIMIT 1;
 SELECT ticket_type_id INTO v_child_ticket FROM public.booking_items
    WHERE booking_id=v_booking.id AND category='child' LIMIT 1;

 IF v_code IS NOT NULL THEN
  -- Existing legacy TEST12 code is never valid for live payments.
  IF v_code='TEST12' THEN
   RAISE EXCEPTION 'This test code is not valid for live payment'
    USING errcode='22023';
  END IF;
  SELECT * INTO v_promo FROM public.booking_promotions p
  WHERE p.code=v_code AND p.enabled=true
    AND (p.event_id IS NULL OR p.event_id=p_event_id)
    AND (p.starts_at IS NULL OR p.starts_at<=now())
    AND (p.ends_at IS NULL OR p.ends_at>now())
    AND (p.min_tickets IS NULL
      OR p.min_tickets<=pg_catalog.jsonb_array_length(p_guests))
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Promotion unavailable'
    USING errcode='22023'; END IF;
  -- Count in-flight LIVE redemptions only; paid redemptions are already
  -- reflected in times_used. Sandbox redemptions never consume live capacity.
  IF v_promo.max_uses IS NOT NULL
    AND v_promo.times_used+
       (SELECT count(*) FROM public.booking_live_checkouts c
         JOIN public.bookings b ON b.id=c.booking_id
         WHERE c.promotion_code=v_code AND c.state IN ('creating','open')
          AND b.status='requested') >= v_promo.max_uses
  THEN RAISE EXCEPTION 'Promotion usage limit reached'
    USING errcode='22023'; END IF;

  FOR v_unit IN
   SELECT 'adult'::text category,v_adult_ticket ticket_type_id,
      s.price_cents::bigint unit_cents
    FROM public.booking_selections s
    WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL
   UNION ALL
   SELECT 'child'::text,v_child_ticket,g.childcare_price_cents::bigint
    FROM public.booking_guests g
    WHERE g.booking_id=v_booking.id AND g.category='child'
  LOOP
   IF v_unit.unit_cents IS NULL OR v_unit.unit_cents<0
    THEN RAISE EXCEPTION 'Incomplete ticket pricing'
      USING errcode='22023'; END IF;
   v_unit_eligible:=(v_promo.applies_to='all'
      OR v_promo.applies_to=v_unit.category
      OR (v_promo.applies_to='selected' AND
          v_unit.ticket_type_id=ANY(v_promo.ticket_type_ids)));
   IF v_unit_eligible THEN
    v_eligible_sum:=v_eligible_sum+v_unit.unit_cents;
    v_eligible_count:=v_eligible_count+1;
    IF v_promo.discount_type='percentage' THEN
      v_unit_discount:=pg_catalog.floor(
          v_unit.unit_cents::numeric*v_promo.percent_off/100)::bigint;
    ELSIF v_promo.discount_type='amount_off' THEN
      v_unit_discount:=least(v_unit.unit_cents,v_promo.amount_cents);
    ELSIF v_promo.discount_type='fixed_price' THEN
      v_unit_discount:=greatest(0,v_unit.unit_cents-v_promo.amount_cents);
    ELSE RAISE EXCEPTION 'Unsupported promotion type'
      USING errcode='22023'; END IF;
    v_discount:=v_discount+v_unit_discount;
   END IF;
  END LOOP;
  IF v_eligible_count=0 THEN RAISE EXCEPTION 'Promotion is not eligible'
     USING errcode='22023'; END IF;
  IF v_promo.max_discount_cents IS NOT NULL
   THEN v_discount:=least(v_discount,v_promo.max_discount_cents); END IF;
  v_discount:=least(v_discount,v_eligible_sum,v_booking.total_cents);
 END IF;

 v_due:=v_booking.total_cents-v_discount;
 -- Live checkout requires Stripe to collect money; zero-value promotions
 -- need a separate verified admission workflow.
 IF v_due<50 THEN
   RAISE EXCEPTION 'Discounted live checkout must be at least NZD 0.50'
      USING errcode='22023';
 END IF;
 UPDATE public.bookings SET original_total_cents=v_booking.total_cents,
    total_cents=v_due,promo_code=v_code WHERE id=v_booking.id;

 INSERT INTO public.booking_live_checkouts(
  booking_id,event_id,state,amount_cents,currency,promotion_code,expires_at
 ) VALUES (v_booking.id,p_event_id,'creating',v_due,'nzd',v_code,
            now()+interval '45 minutes');

 IF NOT yumorilnik_internal.checkout_places_available(v_booking.id,p_event_id)
 THEN RAISE EXCEPTION 'Seats or tickets are already reserved'
    USING errcode='23505'; END IF;
 RETURN pg_catalog.jsonb_build_object(
   'booking_id',v_booking.id,'reference',v_booking.booking_reference,
   'amount_cents',v_due,'currency','nzd','state','creating');
END;$function$;

CREATE OR REPLACE FUNCTION public.bind_live_checkout_session(
 p_booking_id uuid, p_session_id text, p_expires_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_hold public.booking_live_checkouts%rowtype;v_changed integer;
BEGIN
 IF p_session_id IS NULL OR p_session_id NOT LIKE 'cs_live_%'
   OR p_expires_at IS NULL OR p_expires_at<now()
   OR p_expires_at>now()+interval '24 hours'
 THEN RAISE EXCEPTION 'Invalid live Checkout Session' USING errcode='22023';
 END IF;
 SELECT * INTO v_hold FROM public.booking_live_checkouts WHERE booking_id=p_booking_id;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_hold.event_id::text,0));
 UPDATE public.booking_live_checkouts SET stripe_session_id=p_session_id,
  state='open',expires_at=p_expires_at,updated_at=now()
 WHERE booking_id=p_booking_id
   AND (state='creating' OR (state='open' AND stripe_session_id=p_session_id))
   AND (stripe_session_id IS NULL OR stripe_session_id=p_session_id)
   AND EXISTS(SELECT 1 FROM public.bookings b
     WHERE b.id=p_booking_id AND b.status='requested');
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 RETURN v_changed=1;
END;$function$;

CREATE OR REPLACE FUNCTION public.complete_live_checkout_session(
 p_booking_id uuid, p_session_id text, p_intent_id text,
 p_amount_cents bigint, p_currency text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_hold public.booking_live_checkouts%rowtype;
 v_booking public.bookings%rowtype;
 v_promo public.booking_promotions%rowtype;
BEGIN
 IF p_session_id IS NULL OR p_session_id NOT LIKE 'cs_live_%'
   OR p_intent_id IS NULL OR p_intent_id NOT LIKE 'pi_%'
   OR lower(coalesce(p_currency,''))<>'nzd' THEN
    RAISE EXCEPTION 'Invalid Stripe live confirmation'
      USING errcode='22023';
 END IF;
 SELECT * INTO v_hold FROM public.booking_live_checkouts
   WHERE booking_id=p_booking_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown live checkout'
    USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_hold.event_id::text,0));
 SELECT * INTO STRICT v_hold FROM public.booking_live_checkouts
   WHERE booking_id=p_booking_id FOR UPDATE;
 SELECT * INTO STRICT v_booking FROM public.bookings
   WHERE id=p_booking_id FOR UPDATE;

 -- Always validate the original Stripe Session, amount and intent,
 -- including when replaying an already processed webhook.
 IF v_hold.stripe_session_id IS DISTINCT FROM p_session_id
   OR v_hold.amount_cents IS DISTINCT FROM p_amount_cents
   OR v_hold.currency<>'nzd' OR v_booking.event_id<>v_hold.event_id
 THEN RAISE EXCEPTION 'Payment does not match the reserved checkout'
    USING errcode='22023'; END IF;
 IF v_hold.state='paid' AND v_booking.status='confirmed' THEN
   IF v_hold.stripe_payment_intent_id IS DISTINCT FROM p_intent_id THEN
    RAISE EXCEPTION 'Payment Intent does not match confirmed booking'
     USING errcode='22023'; END IF;
   RETURN pg_catalog.jsonb_build_object('state','paid',
      'reference',v_booking.booking_reference);
 END IF;
 IF v_hold.state='needs_review' THEN
   IF v_hold.stripe_payment_intent_id IS DISTINCT FROM p_intent_id THEN
     RAISE EXCEPTION 'Payment intent mismatch in review case'
      USING errcode='22023'; END IF;
   RETURN pg_catalog.jsonb_build_object('state','needs_review',
      'reference',v_booking.booking_reference);
 END IF;
 IF v_hold.state='expired' OR v_booking.status<>'requested' THEN
   UPDATE public.booking_live_checkouts
    SET state='needs_review',
        stripe_payment_intent_id=p_intent_id,
        review_reason='Stripe collected payment after hold was expired or booking cancelled',
        updated_at=now()
    WHERE booking_id=p_booking_id;
   RETURN pg_catalog.jsonb_build_object('state','needs_review',
      'reference',v_booking.booking_reference);
 END IF;
 IF v_hold.state<>'open' THEN
    RAISE EXCEPTION 'Stripe payment has no bound open seat hold'
      USING errcode='22023';
 END IF;

 IF NOT yumorilnik_internal.checkout_places_available(p_booking_id,v_hold.event_id)
 THEN
  UPDATE public.booking_live_checkouts SET state='needs_review',
   stripe_payment_intent_id=p_intent_id,updated_at=now(),
   review_reason='Payment succeeded but conflicting seat/ticket reservation exists'
  WHERE booking_id=p_booking_id;
  RETURN pg_catalog.jsonb_build_object('state','needs_review',
    'reference',v_booking.booking_reference);
 END IF;

 IF v_hold.promotion_code IS NOT NULL THEN
   SELECT * INTO v_promo FROM public.booking_promotions
    WHERE code=v_hold.promotion_code FOR UPDATE;
   IF NOT FOUND OR NOT v_promo.enabled OR
     (v_promo.max_uses IS NOT NULL AND
       v_promo.times_used>=v_promo.max_uses) THEN
     UPDATE public.booking_live_checkouts SET state='needs_review',
       stripe_payment_intent_id=p_intent_id,updated_at=now(),
       review_reason='Promotion no longer available after confirmed payment'
      WHERE booking_id=p_booking_id;
     RETURN pg_catalog.jsonb_build_object('state','needs_review',
       'reference',v_booking.booking_reference);
   END IF;
 END IF;

 UPDATE public.booking_live_checkouts SET state='paid',
   stripe_payment_intent_id=p_intent_id,updated_at=now()
  WHERE booking_id=p_booking_id;
 UPDATE public.bookings SET status='confirmed',confirmed_at=now()
  WHERE id=p_booking_id;
 IF v_hold.promotion_code IS NOT NULL THEN
   UPDATE public.booking_promotions SET times_used=times_used+1
    WHERE code=v_hold.promotion_code;
 END IF;
 -- Email/QR fulfilment must be handled by separate idempotent worker.
 RETURN pg_catalog.jsonb_build_object('state','paid',
    'reference',v_booking.booking_reference);
END;$function$;

CREATE OR REPLACE FUNCTION public.expire_live_checkout_session(
 p_booking_id uuid,p_session_id text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_hold public.booking_live_checkouts%rowtype;v_changed integer;
BEGIN
 SELECT * INTO v_hold FROM public.booking_live_checkouts WHERE booking_id=p_booking_id;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_hold.event_id::text,0));
 UPDATE public.booking_live_checkouts SET state='expired',updated_at=now()
  WHERE booking_id=p_booking_id AND stripe_session_id=p_session_id AND state='open';
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed=1 THEN
  UPDATE public.bookings SET status='cancelled',cancelled_at=now(),
    cancellation_reason='Verified live Stripe Checkout Session expired'
   WHERE id=p_booking_id AND status='requested';
 END IF;
 RETURN v_changed=1;
END;$function$;

CREATE OR REPLACE FUNCTION public.abandon_unbound_live_checkout(
 p_booking_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_event uuid;v_changed integer;
BEGIN
 SELECT event_id INTO v_event FROM public.booking_live_checkouts
  WHERE booking_id=p_booking_id;
 IF v_event IS NULL THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_event::text,0));
 UPDATE public.booking_live_checkouts SET state='expired',
   updated_at=now(),review_reason='Unbound live Checkout setup timed out'
 WHERE booking_id=p_booking_id AND state='creating'
    AND stripe_session_id IS NULL
    AND created_at<now()-interval '90 minutes';
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed=1 THEN
  UPDATE public.bookings SET status='cancelled',cancelled_at=now(),
   cancellation_reason='Unbound live Checkout setup timed out'
  WHERE id=p_booking_id AND status='requested';
 END IF;
 RETURN v_changed=1;
END;$function$;

-- All privileged Stripe RPCs are server-only.
REVOKE ALL ON FUNCTION public.prepare_live_checkout(uuid,uuid,jsonb,jsonb,jsonb,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bind_live_checkout_session(uuid,text,timestamptz)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_live_checkout_session(uuid,text,text,bigint,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_live_checkout_session(uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.abandon_unbound_live_checkout(uuid)
 FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.prepare_live_checkout(uuid,uuid,jsonb,jsonb,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_live_checkout_session(uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_live_checkout_session(uuid,text,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_live_checkout_session(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.abandon_unbound_live_checkout(uuid) TO service_role;
COMMIT;

-- Read-only verification (expected 5 rows, all service_role=true, anon=false).
SELECT p.proname AS function,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
 p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'prepare_live_checkout','bind_live_checkout_session',
 'complete_live_checkout_session','expire_live_checkout_session',
 'abandon_unbound_live_checkout'
)
ORDER BY p.proname;
-- Do NOT test completion with fabricated identifiers or live booking rows.
-- NEXT: verify with isolated test data in a transaction and a live Stripe
-- session only after a deliberately approved controlled paid test.
