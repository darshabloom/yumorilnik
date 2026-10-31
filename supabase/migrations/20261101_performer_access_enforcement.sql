-- Execute AFTER 20261101_performer_table_access_foundation.sql.
-- Authorised admins can set one shared access code and restricted table list.
CREATE OR REPLACE FUNCTION public.admin_set_performer_table_access(
 p_event_id uuid,p_code text,p_table_ids uuid[],p_enabled boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users a
 WHERE a.user_id=auth.uid() AND a.role IN ('owner','admin')) THEN
  RAISE EXCEPTION 'Admin access required' USING errcode='42501';
 END IF;
 IF length(btrim(coalesce(p_code,'')))<6 THEN
  RAISE EXCEPTION 'Access code must have six or more characters';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_table_ids) id WHERE NOT EXISTS
   (SELECT 1 FROM public.seating_tables t WHERE t.id=id AND t.event_id=p_event_id))
 THEN RAISE EXCEPTION 'Table belongs to another event';END IF;
 INSERT INTO public.performer_access_settings(event_id,code_hash,enabled)
 VALUES(p_event_id,encode(extensions.digest(upper(btrim(p_code)),'sha256'),'hex'),p_enabled)
 ON CONFLICT(event_id) DO UPDATE SET code_hash=excluded.code_hash,enabled=excluded.enabled,updated_at=now();
 DELETE FROM public.performer_table_access WHERE event_id=p_event_id;
 INSERT INTO public.performer_table_access(event_id,table_id)
 SELECT p_event_id,id FROM unnest(p_table_ids) id;
 RETURN true;
END;$body$;
REVOKE ALL ON FUNCTION public.admin_set_performer_table_access(uuid,text,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_performer_table_access(uuid,text,uuid[],boolean) TO authenticated;

-- Enforce restricted-table entitlement in the same transaction as booking.
-- Never trust map visibility alone. Preserve all original pricing and promo logic.
DO $migration$
DECLARE fn text; anchor text:=E' -- Canonical family builder enforces child, seat, quantity and price validation.';
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO STRICT fn
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='prepare_live_checkout' AND p.pronargs=6;
 IF position('Performer table access enforcement' IN fn)>0 THEN RETURN; END IF;
 IF position(anchor IN fn)=0 THEN RAISE EXCEPTION 'Unexpected checkout definition; no changes made'; END IF;
 fn:=replace(fn,anchor,$guard$
 -- Performer table access enforcement: token is carried in first selection.
 IF EXISTS(
   SELECT 1 FROM pg_catalog.jsonb_array_elements(p_selections) selected
   JOIN public.performer_table_access restricted
    ON restricted.event_id=p_event_id AND restricted.table_id=(selected->>'table_id')::uuid
 ) AND NOT public.is_performer_access_valid(
    p_event_id,p_selections->0->>'performer_access_code'
 ) THEN RAISE EXCEPTION 'Performer table access code required' USING errcode='42501'; END IF;
$guard$||anchor);
 EXECUTE fn;
END $migration$;
