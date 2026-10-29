-- Yumorilnik Phase B / Step 5 — read-only fulfilment and ticket data audit
-- Run ONLY in the Yumorilnik Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vzzabkviwyarrdkevqco/sql/new
-- ZERO writes, ZERO test bookings, ZERO emails, ZERO Stripe calls.
-- Output includes schema metadata and aggregate counts, not guest personal data.

WITH relevant_tables AS (
 SELECT t.table_schema,t.table_name
 FROM information_schema.tables t
 WHERE t.table_schema IN ('public','yumorilnik_internal')
   AND t.table_type='BASE TABLE'
   AND (
     t.table_name IN (
       'bookings','booking_items','booking_guests','booking_selections',
       'booking_live_checkouts','booking_test_checkouts',
       'events','event_tables','venue_tables','booking_promotions')
     OR t.table_name ~* '(ticket|email|mail|admission|scan|check.?in|deliver|notif|outbox)'
   )
), table_columns AS (
 SELECT c.table_schema,c.table_name,
   jsonb_agg(
     jsonb_build_object(
       'column',c.column_name,'type',c.udt_name,
       'nullable',c.is_nullable='YES',
       'default',c.column_default IS NOT NULL
     ) ORDER BY c.ordinal_position
   ) AS columns
 FROM information_schema.columns c
 JOIN relevant_tables t
   ON t.table_schema=c.table_schema AND t.table_name=c.table_name
 GROUP BY c.table_schema,c.table_name
), related_functions AS (
 SELECT n.nspname AS schema_name,p.proname,
   pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
   p.prosecdef AS security_definer
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n
   ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','yumorilnik_internal')
   AND p.proname ~* '(email|mail|ticket|admission|scan|check.?in|deliver|notif|outbox)'
), related_triggers AS (
 SELECT n.nspname AS schema_name,c.relname AS table_name,
   tr.tgname AS trigger_name,p.proname AS function_name
 FROM pg_catalog.pg_trigger tr
 JOIN pg_catalog.pg_class c ON c.oid=tr.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_proc p ON p.oid=tr.tgfoid
 WHERE NOT tr.tgisinternal
   AND n.nspname='public'
   AND (
     c.relname IN ('bookings','booking_guests','booking_live_checkouts','booking_selections')
     OR c.relname ~* '(email|mail|ticket|deliver|notif|outbox)'
   )
), aggregate_booking_status AS (
 SELECT status, count(*) AS total FROM public.bookings GROUP BY status
), occupied AS (
 SELECT b.event_id,s.table_id,s.seat_number,b.id AS booking_id
 FROM public.booking_selections s
 JOIN public.bookings b ON b.id=s.booking_id
 WHERE s.seat_number IS NOT NULL
   AND (
     b.status IN ('confirmed','test_confirmed')
     OR (b.status='requested' AND (
       EXISTS(SELECT 1 FROM public.booking_test_checkouts t
               WHERE t.booking_id=b.id AND t.state IN ('creating','open'))
       OR EXISTS(SELECT 1 FROM public.booking_live_checkouts l
               WHERE l.booking_id=b.id AND l.state IN ('creating','open'))
     ))
   )
), overlaps AS (
 SELECT event_id,table_id,seat_number,count(DISTINCT booking_id) AS conflicting_bookings
 FROM occupied
 GROUP BY event_id,table_id,seat_number
 HAVING count(DISTINCT booking_id)>1
)
SELECT pg_catalog.jsonb_pretty(
 pg_catalog.jsonb_build_object(
  'project_expected','vzzabkviwyarrdkevqco',
  'tables_with_columns',coalesce((
   SELECT jsonb_agg(jsonb_build_object(
     'table',table_schema||'.'||table_name,'columns',columns)
     ORDER BY table_schema,table_name)
   FROM table_columns
  ),'[]'::jsonb),
  'ticket_email_functions',coalesce((
   SELECT jsonb_agg(jsonb_build_object(
     'name',schema_name||'.'||proname,'args',args,'security_definer',security_definer)
    ORDER BY schema_name,proname) FROM related_functions
  ),'[]'::jsonb),
  'booking_and_delivery_triggers',coalesce((
   SELECT jsonb_agg(jsonb_build_object(
     'table',schema_name||'.'||table_name,'name',trigger_name,'function',function_name)
    ORDER BY schema_name,table_name,trigger_name) FROM related_triggers
  ),'[]'::jsonb),
  'booking_status_counts',coalesce((
   SELECT jsonb_object_agg(status,total) FROM aggregate_booking_status
  ),'{}'::jsonb),
  'live_checkout_rows',(SELECT count(*) FROM public.booking_live_checkouts),
  'overlapping_occupied_numbered_seats',(SELECT count(*) FROM overlaps)
 )
) AS phase_b_step5_audit;
