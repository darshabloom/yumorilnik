-- YUMORILNIK PHASE B / STEP 4: SAFE LIVE RPC SMOKE TEST
-- RUN ONLY in Supabase project vzzabkviwyarrdkevqco (Yumorilnik).
--
-- SAFE: This test does not create a booking, reserve a seat, call Stripe,
-- or change any production record. It exercises ONLY invalid/nonexistent IDs
-- and expects the functions to reject them. Do not substitute real booking IDs.
--
-- Note: This is NOT a full end-to-end concurrency or payment test.
DO $test$
DECLARE
 v_event uuid := '3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid;
 v_missing_booking uuid := '00000000-0000-0000-0000-000000000000'::uuid;
 v_prep_rejected boolean := false;
 v_complete_rejected boolean := false;
BEGIN
 -- Invalid event: must reject BEFORE any insert and independent of input JSON.
 BEGIN
  PERFORM public.prepare_live_checkout(
   '00000000-0000-0000-0000-000000000000'::uuid,
   pg_catalog.gen_random_uuid(),'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,NULL);
 EXCEPTION WHEN SQLSTATE '22023' THEN
   v_prep_rejected := true;
 END;
 IF NOT v_prep_rejected THEN
  RAISE EXCEPTION 'FAIL: invalid event did not reject';
 END IF;

 -- Unknown booking: no existing seat hold must be created or bound.
 IF public.bind_live_checkout_session(
   v_missing_booking,'cs_live_invalid_nonexistent_test',
   now()+interval '30 minutes') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'FAIL: unknown booking was bound'; END IF;

 IF public.expire_live_checkout_session(
   v_missing_booking,'cs_live_invalid_nonexistent_test') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'FAIL: unknown booking expired'; END IF;

 IF public.abandon_unbound_live_checkout(v_missing_booking) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'FAIL: unknown booking was abandoned'; END IF;

 IF yumorilnik_internal.checkout_places_available(v_missing_booking,v_event)
    IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'FAIL: nonexistent booking considered valid'; END IF;

 -- Fake paid callback cannot confirm a nonexistent booking.
 BEGIN
  PERFORM public.complete_live_checkout_session(
    v_missing_booking,'cs_live_invalid_nonexistent_test',
    'pi_invalid_nonexistent_test',5000,'nzd');
 EXCEPTION WHEN SQLSTATE '22023' THEN
    v_complete_rejected := true;
 END;
 IF NOT v_complete_rejected THEN
  RAISE EXCEPTION 'FAIL: fake payment callback did not reject';
 END IF;
END;$test$;

-- Expected: all five functions exist; no public execution; RLS true;
-- and zero live rows (or existing production rows if tests later add them).
SELECT
 (SELECT count(*) FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'prepare_live_checkout','bind_live_checkout_session',
    'complete_live_checkout_session','expire_live_checkout_session',
    'abandon_unbound_live_checkout'
  )) AS live_rpc_count,
 (SELECT bool_and(
   has_function_privilege('service_role',p.oid,'EXECUTE')
   AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
   AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'prepare_live_checkout','bind_live_checkout_session',
    'complete_live_checkout_session','expire_live_checkout_session',
    'abandon_unbound_live_checkout'
  )) AS all_rpcs_server_only,
 (SELECT rowsecurity FROM pg_tables
   WHERE schemaname='public' AND tablename='booking_live_checkouts'
 ) AS live_ledger_rls_enabled,
 (SELECT count(*) FROM public.booking_live_checkouts) AS live_checkout_rows,
 true AS negative_rpc_smoke_tests_passed;
