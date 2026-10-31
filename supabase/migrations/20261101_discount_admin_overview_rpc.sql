-- Admin-only reporting RPC for P019 NYE ticket discount budgets.
-- Read-only. No offer activation or booking changes.
CREATE OR REPLACE FUNCTION public.admin_get_event_discount_overview(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.admin_users a
   WHERE a.user_id=auth.uid() AND a.role IN ('owner','admin')
 ) THEN
   RAISE EXCEPTION 'Admin access required' USING errcode='42501';
 END IF;
 SELECT pg_catalog.jsonb_build_object(
  'total_budget_cents',b.total_budget_cents,
  'early_bird_budget_cents',b.early_bird_budget_cents,
  'group_budget_cents',b.group_budget_cents,
  'flash_budget_cents',b.flash_budget_cents,
  'personal_budget_cents',b.personal_budget_cents,
  'early_bird_enabled',b.early_bird_enabled,
  'group_enabled',b.group_enabled,
  'flash_enabled',b.flash_enabled,
  'personal_enabled',b.personal_enabled,
  'early_bird_ticket_limit',b.early_bird_ticket_limit,
  'group_ticket_limit',b.group_ticket_limit,
  'early_bird_ends_at',b.early_bird_ends_at,
  'provisional_event_cost_cents',b.provisional_event_cost_cents,
  'minimum_surplus_cents',b.minimum_surplus_cents,
  'committed_cents',coalesce(sum(r.amount_cents) FILTER (WHERE r.state='committed'),0),
  'reserved_cents',coalesce(sum(r.amount_cents) FILTER (WHERE r.state='reserved'),0),
  'early_bird_spent_cents',coalesce(sum(r.amount_cents) FILTER (WHERE r.state IN ('reserved','committed') AND r.discount_type='early_bird'),0),
  'group_spent_cents',coalesce(sum(r.amount_cents) FILTER (WHERE r.state IN ('reserved','committed') AND r.discount_type='group'),0),
  'flash_spent_cents',coalesce(sum(r.amount_cents) FILTER (WHERE r.state IN ('reserved','committed') AND r.discount_type='flash'),0),
  'personal_spent_cents',coalesce(sum(r.amount_cents) FILTER (WHERE r.state IN ('reserved','committed') AND r.discount_type='personal'),0),
  'early_bird_tickets_used',coalesce(sum(r.adult_ticket_count) FILTER (WHERE r.state IN ('reserved','committed') AND r.discount_type='early_bird'),0),
  'group_tickets_used',coalesce(sum(r.adult_ticket_count) FILTER (WHERE r.state IN ('reserved','committed') AND r.discount_type='group'),0)
 ) INTO v_result
 FROM public.event_discount_budgets b
 LEFT JOIN public.booking_discount_reservations r ON r.event_id=b.event_id
 WHERE b.event_id=p_event_id
 GROUP BY b.event_id;
 RETURN v_result;
END;
$body$;
REVOKE ALL ON FUNCTION public.admin_get_event_discount_overview(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_get_event_discount_overview(uuid) TO authenticated,service_role;
