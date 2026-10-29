-- Yumorilnik Phase B / Step 2: one seat/ticket availability check for BOTH Stripe channels
-- PROJECT: vzzabkviwyarrdkevqco ONLY.
-- Run ONLY after successful Step 1 (booking_live_checkouts table).
-- This does NOT activate live payments or create/modify any bookings.
-- Existing paid or test-paid bookings continue blocking their seats.
-- A live hold in 'creating'/'open' keeps its seat until payment confirmation
-- or EXPLICIT expiration/cancellation; time alone must NOT release an
-- in-flight Stripe payment and accidentally permit a second sale.
BEGIN;

CREATE OR REPLACE FUNCTION yumorilnik_internal.checkout_places_available(
  p_booking_id uuid, p_event_id uuid
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT EXISTS (
   SELECT 1 FROM public.bookings b
   WHERE b.id=p_booking_id AND b.event_id=p_event_id
 )
 AND NOT EXISTS (
   SELECT 1
   FROM public.booking_selections mine
   JOIN public.booking_selections taken
     ON taken.table_id=mine.table_id
    AND taken.booking_id<>mine.booking_id
    AND (taken.seat_number IS NULL OR mine.seat_number IS NULL
      OR taken.seat_number=mine.seat_number)
   JOIN public.bookings competing
     ON competing.id=taken.booking_id AND competing.event_id=p_event_id
   LEFT JOIN public.booking_test_checkouts test_hold
     ON test_hold.booking_id=competing.id
   LEFT JOIN public.booking_live_checkouts live_hold
     ON live_hold.booking_id=competing.id
   WHERE mine.booking_id=p_booking_id
     AND (
       competing.status IN ('confirmed','test_confirmed')
       OR (competing.status='requested'
           AND test_hold.state IN ('creating','open'))
       OR (competing.status='requested'
           AND live_hold.state IN ('creating','open'))
     )
 )
 AND NOT EXISTS (
   SELECT 1
   FROM public.booking_items mine
   JOIN public.ticket_types tt ON tt.id=mine.ticket_type_id
   WHERE mine.booking_id=p_booking_id AND tt.quantity_total IS NOT NULL
     AND (
       GREATEST(
         COALESCE(tt.quantity_sold,0),
         COALESCE((
           SELECT SUM(confirmed.quantity)
           FROM public.booking_items confirmed
           JOIN public.bookings b ON b.id=confirmed.booking_id
           WHERE confirmed.ticket_type_id=mine.ticket_type_id
             AND b.status IN ('confirmed','test_confirmed')
         ),0)
       )
       + COALESCE((
         SELECT SUM(held.quantity)
         FROM public.booking_items held
         JOIN public.booking_test_checkouts checkout
           ON checkout.booking_id=held.booking_id
         JOIN public.bookings b ON b.id=held.booking_id
         WHERE held.ticket_type_id=mine.ticket_type_id
           AND held.booking_id<>p_booking_id
           AND b.status='requested'
           AND checkout.state IN ('creating','open')
       ),0)
       + COALESCE((
         SELECT SUM(held.quantity)
         FROM public.booking_items held
         JOIN public.booking_live_checkouts checkout
           ON checkout.booking_id=held.booking_id
         JOIN public.bookings b ON b.id=held.booking_id
         WHERE held.ticket_type_id=mine.ticket_type_id
           AND held.booking_id<>p_booking_id
           AND b.status='requested'
           AND checkout.state IN ('creating','open')
       ),0)
       + mine.quantity > tt.quantity_total
     )
 );
$function$;

-- Avoid default PUBLIC EXECUTE on new SECURITY DEFINER functions.
REVOKE ALL ON FUNCTION
 yumorilnik_internal.checkout_places_available(uuid,uuid)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
 yumorilnik_internal.checkout_places_available(uuid,uuid)
 TO service_role;

-- Preserve existing sandbox function signature and service-only permissions,
-- while making it see future live reservations as well.
CREATE OR REPLACE FUNCTION yumorilnik_internal.test_checkout_places_available(
  p_booking_id uuid, p_event_id uuid
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT yumorilnik_internal.checkout_places_available(p_booking_id,p_event_id);
$function$;
REVOKE ALL ON FUNCTION
 yumorilnik_internal.test_checkout_places_available(uuid,uuid)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
 yumorilnik_internal.test_checkout_places_available(uuid,uuid)
 TO service_role;
COMMIT;

-- STEP 2 VERIFICATION (read-only):
SELECT
 to_regprocedure('yumorilnik_internal.checkout_places_available(uuid,uuid)')
   IS NOT NULL AS shared_check_exists,
 to_regprocedure('yumorilnik_internal.test_checkout_places_available(uuid,uuid)')
   IS NOT NULL AS sandbox_check_exists,
 has_function_privilege('anon',
   'yumorilnik_internal.checkout_places_available(uuid,uuid)','EXECUTE')
   AS anon_can_execute,
 has_function_privilege('authenticated',
   'yumorilnik_internal.checkout_places_available(uuid,uuid)','EXECUTE')
   AS authenticated_can_execute,
 has_function_privilege('service_role',
   'yumorilnik_internal.checkout_places_available(uuid,uuid)','EXECUTE')
   AS service_can_execute,
 (SELECT rowsecurity FROM pg_tables
  WHERE schemaname='public' AND tablename='booking_live_checkouts')
   AS live_table_rls_enabled,
 (SELECT COUNT(*) FROM public.booking_live_checkouts) AS live_rows;

-- Expected: true,true,false,false,true,true,0
-- NOTE: Run the verification while still in SQL Editor (postgres role).
-- Tests for real overlapping holds, cancelled seats and inventory come next;
-- do not enable either production booking flag after Step 2.
