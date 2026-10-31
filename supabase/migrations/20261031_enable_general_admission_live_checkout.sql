-- Execute in Yumorilnik Supabase SQL Editor (project vzzabkviwyarrdkevqco).
-- Extends existing live checkout to published general admission events;
-- retains individual-seat rules for New Year's Eve.
DO $migration$
DECLARE fn text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO fn
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='prepare_live_checkout'
 ORDER BY p.oid LIMIT 1;
 IF fn IS NULL THEN RAISE EXCEPTION 'prepare_live_checkout function missing';END IF;
 IF position('Live checkout is not configured for this event' in fn)=0 THEN RAISE EXCEPTION 'Unexpected checkout version; stop';END IF;
 fn:=replace(fn,
  'p_event_id IS DISTINCT FROM ''3f6fa4d1-aaca-4326-9c01-5774cffca2f5''::uuid',
  'NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id=p_event_id AND e.is_active=true AND e.event_type=''internal'' AND e.seating_mode IN (''general_admission'',''tables''))');
 fn:=replace(fn,
  E'e.seating_mode=''tables''\n     AND e.table_booking_mode=''individual_seats''',
  '(e.seating_mode=''general_admission'' OR (e.seating_mode=''tables'' AND e.table_booking_mode=''individual_seats''))');
 IF position('e.seating_mode=''tables''\n     AND e.table_booking_mode=''individual_seats''' in fn)>0 THEN RAISE EXCEPTION 'Seating guard not replaced'; END IF;
 fn:=replace(fn,
  E'coalesce((SELECT SUM(s.price_cents) FROM public.booking_selections s\n      WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL),0)',
  E'coalesce((SELECT SUM(s.price_cents) FROM public.booking_selections s\n      WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL),0) +coalesce((SELECT SUM(i.unit_admission_cents * i.quantity) FROM public.booking_items i JOIN public.events e ON e.id=p_event_id WHERE i.booking_id=v_booking.id AND e.seating_mode=''general_admission''),0)');
 -- General admission promotions must include the ticket admission amount.
 fn:=replace(fn,
  E'WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL\n   UNION ALL',
  E'WHERE s.booking_id=v_booking.id AND s.guest_index IS NOT NULL\n   UNION ALL\n   SELECT i.category,i.ticket_type_id,(i.unit_admission_cents)::bigint FROM public.booking_items i WHERE i.booking_id=v_booking.id AND i.category=''adult'' AND i.unit_admission_cents>0 AND EXISTS(SELECT 1 FROM public.events e WHERE e.id=p_event_id AND e.seating_mode=''general_admission'')\n   UNION ALL');
 -- Abort instead of silently applying an incomplete patch.
 IF position('p_event_id IS DISTINCT FROM ''3f6fa4d1-aaca-4326-9c01-5774cffca2f5''::uuid' in fn)>0 THEN RAISE EXCEPTION 'Event restriction not updated'; END IF;
 IF position('e.seating_mode=''general_admission'' OR' in fn)=0 THEN RAISE EXCEPTION 'Seating guard not updated'; END IF;
 IF position('unit_admission_cents * i.quantity' in fn)=0 THEN RAISE EXCEPTION 'Admission pricing not updated'; END IF;
 EXECUTE fn;
END $migration$;

-- Confirm the event is published and ready for a general admission checkout.
SELECT slug,is_active,seating_mode,event_type,require_individual_guest_details
FROM public.events WHERE slug='igrisha-nov-28-2026';
