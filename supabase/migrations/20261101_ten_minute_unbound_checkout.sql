-- Make an unbound (never reached Stripe) checkout eligible for release after 10 minutes.
-- Active Stripe sessions are cancelled by the server before their seats are released.
DO $migration$
DECLARE source text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO STRICT source
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='abandon_unbound_live_checkout'
   AND p.pronargs=1;
 IF position('interval ''90 minutes''' IN source)=0 THEN
  RAISE EXCEPTION 'Unexpected unbound checkout function, no change made';
 END IF;
 EXECUTE replace(source,'interval ''90 minutes''','interval ''10 minutes''');
END $migration$;
SELECT pg_get_functiondef(p.oid) LIKE '%interval ''10 minutes''%'
 AS ten_minute_unbound_expiry_installed
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='abandon_unbound_live_checkout';
