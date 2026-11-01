-- Set the normal seat price for performer-reserved Tables 22 and 23 to NZ$80.
-- Run in Yumorilnik Supabase project vzzabkviwyarrdkevqco.
-- Pricing is authoritative in the database for both quote and checkout.
DO $$
DECLARE actual_count integer;
BEGIN
 SELECT count(*) INTO actual_count FROM public.seating_tables
 WHERE event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
 AND btrim(lower(label)) IN ('table 22','table 23','22','23');
 IF actual_count<>2 THEN
  RAISE EXCEPTION 'Expected exactly Tables 22 and 23; found %. No prices changed.',actual_count;
 END IF;
 UPDATE public.seating_tables
 SET seat_price_cents=8000
 WHERE event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
 AND btrim(lower(label)) IN ('table 22','table 23','22','23');
END $$;
SELECT label,seat_price_cents/100.0 AS seat_price_nzd,is_active FROM public.seating_tables
 WHERE event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
 AND btrim(lower(label)) IN ('table 22','table 23','22','23')
 ORDER BY label;
