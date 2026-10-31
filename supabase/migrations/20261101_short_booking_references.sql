-- Short references for NEW bookings only. Existing references stay unchanged.
-- Apply in Yumorilnik Supabase project vzzabkviwyarrdkevqco.
BEGIN;
CREATE SEQUENCE IF NOT EXISTS public.yumorilnik_booking_reference_seq START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE OR REPLACE FUNCTION public.make_short_booking_reference()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT 'Y-' || lpad(nextval('public.yumorilnik_booking_reference_seq'::regclass)::text,5,'0');
$fn$;
REVOKE ALL ON FUNCTION public.make_short_booking_reference() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.bookings ALTER COLUMN booking_reference SET DEFAULT public.make_short_booking_reference();
COMMIT;
-- Read-only verification:
SELECT column_default FROM information_schema.columns
 WHERE table_schema='public' AND table_name='bookings' AND column_name='booking_reference';
