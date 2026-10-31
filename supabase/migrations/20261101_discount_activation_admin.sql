-- P019: Admin-only offer activation and audit trail.
-- Existing discounts stay disabled until deliberately enabled by an owner/admin.
BEGIN;
CREATE TABLE IF NOT EXISTS public.event_discount_admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id uuid NOT NULL REFERENCES public.events(id),
 actor_id uuid NOT NULL,
 offer_type text NOT NULL CHECK (offer_type IN ('early_bird','group','flash','personal')),
 old_enabled boolean NOT NULL,
 new_enabled boolean NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_discount_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_discount_admin_audit FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_set_event_discount_enabled(
 p_event_id uuid,p_offer_type text,p_enabled boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE b public.event_discount_budgets%rowtype; previous boolean; limit_cents bigint; spent bigint; active_total bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.admin_users WHERE user_id=auth.uid() AND role IN ('owner','admin')
 ) THEN RAISE EXCEPTION 'Admin access required' USING errcode='42501'; END IF;
 IF p_event_id IS DISTINCT FROM '3f6fa4d1-aaca-4326-9c01-5774cffca2f5'::uuid
   OR p_offer_type NOT IN ('early_bird','group','flash','personal') OR p_enabled IS NULL
 THEN RAISE EXCEPTION 'Invalid discount configuration' USING errcode='22023';END IF;
 SELECT * INTO STRICT b FROM public.event_discount_budgets WHERE event_id=p_event_id FOR UPDATE;
 SELECT coalesce(sum(amount_cents),0) INTO active_total FROM public.booking_discount_reservations
  WHERE event_id=p_event_id AND state IN ('reserved','committed');
 IF active_total>b.total_budget_cents THEN RAISE EXCEPTION 'Overall discount budget exceeded' USING errcode='22023';END IF;
 SELECT coalesce(sum(amount_cents),0) INTO spent FROM public.booking_discount_reservations
  WHERE event_id=p_event_id AND discount_type=p_offer_type AND state IN ('reserved','committed');
 CASE p_offer_type
  WHEN 'early_bird' THEN previous:=b.early_bird_enabled;limit_cents:=b.early_bird_budget_cents;
  WHEN 'group' THEN previous:=b.group_enabled;limit_cents:=b.group_budget_cents;
  WHEN 'flash' THEN previous:=b.flash_enabled;limit_cents:=b.flash_budget_cents;
  WHEN 'personal' THEN previous:=b.personal_enabled;limit_cents:=b.personal_budget_cents;
 END CASE;
 IF spent>limit_cents THEN RAISE EXCEPTION 'Offer allocation exceeded' USING errcode='22023';END IF;
 IF p_enabled AND p_offer_type IN ('flash','personal') THEN
   RAISE EXCEPTION 'Campaign discounts need checkout budget enforcement before activation' USING errcode='22023';
 END IF;
 IF p_enabled AND p_offer_type='early_bird' AND now()>=b.early_bird_ends_at THEN
   RAISE EXCEPTION 'Early-bird period has ended' USING errcode='22023';
 END IF;
 IF previous IS DISTINCT FROM p_enabled THEN
   UPDATE public.event_discount_budgets SET
     early_bird_enabled=CASE WHEN p_offer_type='early_bird' THEN p_enabled ELSE early_bird_enabled END,
     group_enabled=CASE WHEN p_offer_type='group' THEN p_enabled ELSE group_enabled END,
     flash_enabled=CASE WHEN p_offer_type='flash' THEN p_enabled ELSE flash_enabled END,
     personal_enabled=CASE WHEN p_offer_type='personal' THEN p_enabled ELSE personal_enabled END,
     updated_at=now()
   WHERE event_id=p_event_id;
   INSERT INTO public.event_discount_admin_audit(event_id,actor_id,offer_type,old_enabled,new_enabled)
    VALUES(p_event_id,auth.uid(),p_offer_type,previous,p_enabled);
 END IF;
 RETURN pg_catalog.jsonb_build_object('offer_type',p_offer_type,'enabled',p_enabled,'changed',previous IS DISTINCT FROM p_enabled);
END;
$body$;
REVOKE ALL ON FUNCTION public.admin_set_event_discount_enabled(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_event_discount_enabled(uuid,text,boolean) TO authenticated;
COMMIT;
