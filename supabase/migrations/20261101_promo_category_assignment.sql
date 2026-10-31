-- New Year's promotional discount categories and protected allocation.
-- Does not activate codes or campaigns. Run in Yumorilnik SQL Editor.
BEGIN;
CREATE TABLE IF NOT EXISTS public.event_discount_promotion_assignments (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 promo_code text NOT NULL REFERENCES public.booking_promotions(code) ON UPDATE CASCADE,
 discount_category text NOT NULL CHECK(discount_category IN ('personal','flash')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,promo_code)
);
ALTER TABLE public.event_discount_promotion_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_discount_promotion_assignments FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_event_discount_promotion(
 p_event_id uuid,p_promo_code text,p_category text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_code text:=upper(btrim(coalesce(p_promo_code,'')));
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.admin_users a WHERE a.user_id=auth.uid() AND a.role IN ('owner','admin')
 ) THEN RAISE EXCEPTION 'Admin access required' USING errcode='42501'; END IF;
 IF p_event_id IS DISTINCT FROM '3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid OR
  p_category NOT IN ('personal','flash') THEN
  RAISE EXCEPTION 'Invalid promotion category' USING errcode='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.booking_promotions p WHERE p.code=v_code AND p.event_id=p_event_id
  AND p.applies_to='adult') THEN
  RAISE EXCEPTION 'New Year code must target this event and adult seats only' USING errcode='22023';
 END IF;
 INSERT INTO public.event_discount_promotion_assignments(event_id,promo_code,discount_category)
 VALUES(p_event_id,v_code,p_category)
 ON CONFLICT(event_id,promo_code) DO UPDATE SET discount_category=excluded.discount_category;
 RETURN pg_catalog.jsonb_build_object('promo_code',v_code,'category',p_category);
END;$body$;
REVOKE ALL ON FUNCTION public.admin_assign_event_discount_promotion(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_event_discount_promotion(uuid,text,text) TO authenticated;
COMMIT;