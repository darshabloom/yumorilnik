-- New Year 2027: compact, unique booking references such as NY27-KF27.
-- Only new New Year bookings are affected. Existing booking references remain valid.
-- Alphabet omits I and O; digits omit 0 and 1 to avoid confusion.
-- Allocation is sequence-driven and permuted, so references never collide with
-- each other during the first 36,864 new New Year bookings.
BEGIN;
CREATE SEQUENCE IF NOT EXISTS public.ny27_booking_reference_seq
 START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE OR REPLACE FUNCTION public.make_ny27_booking_reference()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
 n bigint;
 ix bigint;
 letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
 digits constant text := '23456789';
BEGIN
 n := nextval('public.ny27_booking_reference_seq'::regclass)-1;
 IF n >= 36864 THEN
  RAISE EXCEPTION 'New Year booking reference capacity exhausted' USING errcode='22003';
 END IF;
 ix := (n*5+137) % 36864;
 RETURN 'NY27-' ||
  substr(letters,((ix/1536)::int)+1,1) ||
  substr(letters,(((ix/64)%24)::int)+1,1) ||
  substr(digits,(((ix/8)%8)::int)+1,1) ||
  substr(digits,((ix%8)::int)+1,1);
END;$body$;

CREATE OR REPLACE FUNCTION public.set_ny27_booking_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
BEGIN
 IF NEW.event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid THEN
  NEW.booking_reference:=public.make_ny27_booking_reference();
 END IF;
 RETURN NEW;
END;$body$;

DROP TRIGGER IF EXISTS bookings_ny27_reference_before_insert ON public.bookings;
CREATE TRIGGER bookings_ny27_reference_before_insert
 BEFORE INSERT ON public.bookings FOR EACH ROW
 EXECUTE FUNCTION public.set_ny27_booking_reference();

REVOKE ALL ON FUNCTION public.make_ny27_booking_reference() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_ny27_booking_reference() FROM PUBLIC,anon,authenticated;
COMMIT;

-- Verify without creating a booking or consuming a reference:
SELECT trigger_name FROM information_schema.triggers
 WHERE event_object_schema='public' AND event_object_table='bookings'
 AND trigger_name='bookings_ny27_reference_before_insert';
