-- Phase B Step 7: full live Stripe refund acknowledgement.
-- Apply ONLY in Yumorilnik project vzzabkviwyarrdkevqco.
-- No charge is made, no existing booking is modified by this migration.
-- Never call the RPC from a browser or before independently verifying
-- the refunded Stripe charge via authenticated Stripe API.
BEGIN;
ALTER TABLE public.booking_live_checkouts
 ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE public.booking_live_checkouts
 ADD COLUMN IF NOT EXISTS stripe_charge_id text;
ALTER TABLE public.booking_live_checkouts
 DROP CONSTRAINT IF EXISTS booking_live_checkouts_state_check;
ALTER TABLE public.booking_live_checkouts
 ADD CONSTRAINT booking_live_checkouts_state_check
 CHECK(state IN ('creating','open','paid','expired','needs_review','refunded'));

CREATE OR REPLACE FUNCTION public.record_verified_full_live_refund(
 p_booking_id uuid,p_payment_intent_id text,p_charge_id text,
 p_charge_amount_cents bigint,p_refunded_amount_cents bigint,p_currency text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_hold public.booking_live_checkouts%rowtype;
 v_status text;
BEGIN
 IF p_booking_id IS NULL OR p_payment_intent_id NOT LIKE 'pi_%'
    OR p_charge_id NOT LIKE 'ch_%' OR lower(coalesce(p_currency,''))<>'nzd'
    OR p_charge_amount_cents<50
    OR p_charge_amount_cents IS DISTINCT FROM p_refunded_amount_cents
 THEN RAISE EXCEPTION 'Unverified or incomplete full refund details'
   USING errcode='22023'; END IF;
 SELECT * INTO v_hold FROM public.booking_live_checkouts
  WHERE booking_id=p_booking_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown live checkout' USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_hold.event_id::text,0));
 SELECT * INTO STRICT v_hold FROM public.booking_live_checkouts
  WHERE booking_id=p_booking_id FOR UPDATE;
 IF v_hold.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id
    OR v_hold.amount_cents IS DISTINCT FROM p_charge_amount_cents
    OR v_hold.currency<>'nzd'
 THEN RAISE EXCEPTION 'Refund does not match original paid transaction'
   USING errcode='22023'; END IF;
 SELECT b.status INTO STRICT v_status FROM public.bookings b
  WHERE b.id=p_booking_id AND b.event_id=v_hold.event_id FOR UPDATE;
 IF v_hold.state='refunded' THEN
   IF v_status<>'cancelled' THEN
     RAISE EXCEPTION 'Refund ledger and booking statuses disagree' USING errcode='22023';
   END IF;
   RETURN pg_catalog.jsonb_build_object('state','refunded','replayed',true);
 END IF;
 IF v_hold.state<>'paid' OR v_status NOT IN ('confirmed','cancelled') THEN
  RAISE EXCEPTION 'Paid booking requires manual reconciliation before refund release'
    USING errcode='22023';
 END IF;
 UPDATE public.booking_live_checkouts SET state='refunded',refunded_at=now(),
  stripe_charge_id=p_charge_id,
  review_reason='Full Stripe refund verified; admission revoked',
  updated_at=now()
  WHERE booking_id=p_booking_id;
 UPDATE public.bookings SET status='cancelled',
  cancelled_at=coalesce(cancelled_at,now()),
  cancellation_reason='Fully refunded through verified live Stripe charge'
  WHERE id=p_booking_id AND status='confirmed';
 -- Never delete the booking audit trail. Shared availability now releases
 -- seats because only confirmed and active holds block inventory.
 RETURN pg_catalog.jsonb_build_object('state','refunded','replayed',false);
END;$function$;
REVOKE ALL ON FUNCTION
 public.record_verified_full_live_refund(uuid,text,text,bigint,bigint,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.record_verified_full_live_refund(uuid,text,text,bigint,bigint,text)
 TO service_role;
COMMIT;

-- Read-only verification:
SELECT to_regprocedure('public.record_verified_full_live_refund(uuid,text,text,bigint,bigint,text)')
 IS NOT NULL AS refund_function_exists,
 has_function_privilege('service_role',
  'public.record_verified_full_live_refund(uuid,text,text,bigint,bigint,text)','EXECUTE')
 AS service_can_execute,
 has_function_privilege('anon',
  'public.record_verified_full_live_refund(uuid,text,text,bigint,bigint,text)','EXECUTE')
 AS anon_can_execute,
 has_function_privilege('authenticated',
  'public.record_verified_full_live_refund(uuid,text,text,bigint,bigint,text)','EXECUTE')
 AS authenticated_can_execute,
 EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conname='booking_live_checkouts_state_check'
    AND conrelid='public.booking_live_checkouts'::regclass
    AND pg_get_constraintdef(oid) LIKE '%refunded%'
 ) AS refunded_state_supported,
 (SELECT count(*) FROM public.booking_live_checkouts) AS live_checkout_rows;
-- Expected: true, true, false, false, true, 0 (until live money tests).
