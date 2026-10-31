-- P019 New Year discount ledger lifecycle.
-- Run after 20261101_event_discount_budget_foundation.sql.
-- This prepares paid/expired/refunded accounting; discounts stay disabled.
BEGIN;
CREATE OR REPLACE FUNCTION public.sync_live_checkout_discount_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
BEGIN
  IF TG_OP='UPDATE' AND NEW.state IS NOT DISTINCT FROM OLD.state THEN
    RETURN NEW;
  END IF;
  IF NEW.state='paid' THEN
    UPDATE public.booking_discount_reservations
       SET state='committed',committed_at=coalesce(committed_at,now())
     WHERE booking_id=NEW.booking_id AND state='reserved';
  ELSIF NEW.state='refunded' THEN
    UPDATE public.booking_discount_reservations
       SET state='refunded',refunded_at=coalesce(refunded_at,now())
     WHERE booking_id=NEW.booking_id AND state IN ('reserved','committed');
  ELSIF NEW.state IN ('expired','cancelled') THEN
    UPDATE public.booking_discount_reservations
       SET state='released',released_at=coalesce(released_at,now())
     WHERE booking_id=NEW.booking_id AND state='reserved';
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS trg_sync_live_checkout_discount_state
ON public.booking_live_checkouts;

CREATE TRIGGER trg_sync_live_checkout_discount_state
AFTER INSERT OR UPDATE OF state
ON public.booking_live_checkouts
FOR EACH ROW EXECUTE FUNCTION public.sync_live_checkout_discount_state();

-- Visible audit/reporting totals are calculated from actual ledger records.
CREATE OR REPLACE VIEW public.event_discount_budget_usage AS
SELECT b.event_id,b.total_budget_cents,
  b.early_bird_budget_cents,b.group_budget_cents,
  b.flash_budget_cents,b.personal_budget_cents,
  coalesce(sum(r.amount_cents) FILTER (WHERE r.state='committed'),0)::bigint AS committed_cents,
  coalesce(sum(r.amount_cents) FILTER (WHERE r.state='reserved'),0)::bigint AS reserved_cents,
  greatest(0,b.total_budget_cents-
    coalesce(sum(r.amount_cents) FILTER (WHERE r.state IN ('committed','reserved')),0))::bigint AS remaining_cents
FROM public.event_discount_budgets b
LEFT JOIN public.booking_discount_reservations r ON r.event_id=b.event_id
GROUP BY b.event_id,b.total_budget_cents,b.early_bird_budget_cents,
 b.group_budget_cents,b.flash_budget_cents,b.personal_budget_cents;

REVOKE ALL ON public.event_discount_budget_usage FROM anon,authenticated;
COMMIT;

SELECT event_id,total_budget_cents,committed_cents,reserved_cents,remaining_cents
FROM public.event_discount_budget_usage
WHERE event_id='3f6fa4d1-aaca-4326-9c01-5774cffca2f5';
