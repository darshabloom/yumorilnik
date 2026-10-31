-- Enable controlled admin activation of personal and flash promotions,
-- only after the checkout budget-reservation logic has been installed.
DO $migration$
DECLARE fn text; old_guard text;
BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='prepare_live_checkout'
 AND pg_get_functiondef(p.oid) LIKE '%v_campaign_category%'
 ) THEN RAISE EXCEPTION 'Run promo budget checkout integration first'; END IF;
 SELECT replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)) INTO STRICT fn
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='admin_set_event_discount_enabled';
 old_guard:=E' IF p_enabled AND p_offer_type IN (''flash'',''personal'') THEN\n   RAISE EXCEPTION ''Campaign discounts need checkout budget enforcement before activation'' USING errcode=''22023'';\n END IF;';
 IF position(old_guard IN fn)=0 THEN
  RAISE EXCEPTION 'Unexpected admin activation function; no changes made';END IF;
 fn:=replace(fn,old_guard,'');
 EXECUTE fn;
END;$migration$;
SELECT pg_get_functiondef(p.oid) NOT LIKE '%Campaign discounts need checkout budget enforcement%'
 AS personal_and_flash_admin_activation_available
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='admin_set_event_discount_enabled';