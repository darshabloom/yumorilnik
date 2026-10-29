-- Yumorilnik Phase B / Step 6: read-only payment, tickets and delivery status
-- RUN ONLY in project vzzabkviwyarrdkevqco.
-- No writes, no email sends, no payments, no personally identifying data.
SELECT pg_catalog.jsonb_pretty(pg_catalog.jsonb_build_object(
 'event',(
  SELECT pg_catalog.jsonb_build_object(
   'title',e.title,'english_title',e.title_en,
   'date',e.event_date,'database_start_time',e.event_time,
   'active',e.is_active,
   'russian_description_excerpt',left(coalesce(e.description,''),500),
   'english_description_excerpt',left(coalesce(e.description_en,''),500))
  FROM public.events e
  WHERE e.id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
 ),
 'configured_ticket_types',coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'ticket',t.name,'price_cents',t.price_cents,
   'currency',t.currency,'quantity_total',t.quantity_total,
   'quantity_sold',t.quantity_sold,'active',t.is_active)
   ORDER BY t.name)
  FROM public.ticket_types t
  WHERE t.event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
 ),'[]'::jsonb),
 'live_checkout_state_counts',coalesce((
  SELECT jsonb_object_agg(l.state,l.number)
  FROM (SELECT state,count(*) AS number FROM public.booking_live_checkouts GROUP BY state) l
 ),'{}'::jsonb),
 'confirmation_delivery_state_counts',coalesce((
  SELECT jsonb_object_agg(l.status,l.number)
  FROM (SELECT status,count(*) AS number FROM public.booking_confirmation_deliveries GROUP BY status) l
 ),'{}'::jsonb),
 'confirmation_outbox_state_counts',coalesce((
  SELECT jsonb_object_agg(l.status,l.number)
  FROM (SELECT status,count(*) AS number FROM public.booking_confirmation_outbox GROUP BY status) l
 ),'{}'::jsonb),
 'manually_confirmed_without_live_payment',(
  SELECT count(*) FROM public.bookings b WHERE b.status='confirmed'
   AND NOT EXISTS (SELECT 1 FROM public.booking_live_checkouts c
     WHERE c.booking_id=b.id AND c.state='paid')
 ),
 'paid_live_without_delivery_rows',(
  SELECT count(*) FROM public.booking_live_checkouts c
  JOIN public.bookings b ON b.id=c.booking_id AND b.status='confirmed'
  WHERE c.state='paid'
   AND NOT EXISTS (SELECT 1 FROM public.booking_confirmation_deliveries d
     WHERE d.booking_id=b.id)
 ),
 'pending_delivery_without_live_payment',(
  SELECT count(*) FROM public.booking_confirmation_deliveries d
  WHERE d.status IN ('pending','failed','sending')
   AND NOT EXISTS (SELECT 1 FROM public.booking_live_checkouts c
     WHERE c.booking_id=d.booking_id AND c.state='paid')
 )
)) AS phase_b_step6_readiness;
