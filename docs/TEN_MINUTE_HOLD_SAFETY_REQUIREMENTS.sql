-- Yumorilnik: ten-minute reservation window for unpaid checkout attempts.
-- IMPORTANT: standard Stripe Checkout sessions can remain payable longer than 10 minutes.
-- DO NOT apply until Stripe-session expiry/reconciliation is coordinated. Otherwise
-- a customer might pay after their seat has been released to another customer.
-- This migration is deliberately NOT automatically applied.
DO $migration$
DECLARE fn text; old text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO STRICT fn FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='prepare_live_checkout' AND p.pronargs=6;
 old:=fn;
 IF position('now()+interval ''45 minutes''' IN fn)=0 THEN
  RAISE EXCEPTION 'Unexpected checkout hold definition; no changes made';
 END IF;
 fn:=replace(fn,'now()+interval ''45 minutes''','now()+interval ''10 minutes''');
 IF fn=old THEN RAISE EXCEPTION 'Hold change failed'; END IF;
 EXECUTE fn;
END $migration$;
-- To fully enforce the ten-minute window, update bind_live_checkout_session,
-- checkout_places_available and the Stripe-session cancellation/reconciliation
-- flow together. This file must not be run alone.
