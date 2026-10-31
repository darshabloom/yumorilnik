-- Atomic price confirmation for Yumorilnik live ticket checkout.
-- All changes made by prepare_live_checkout are automatically rolled back
-- if the authoritative amount differs from the amount accepted by the guest.
CREATE OR REPLACE FUNCTION public.prepare_live_checkout_confirmed(
  p_event_id uuid,
  p_client_request_id uuid,
  p_tickets jsonb,
  p_guests jsonb,
  p_selections jsonb,
  p_promo_code text,
  p_expected_amount_cents bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  result jsonb;
  actual bigint;
BEGIN
  IF p_expected_amount_cents IS NULL OR p_expected_amount_cents < 50
     OR p_expected_amount_cents > 10000000 THEN
    RAISE EXCEPTION 'Invalid approved payment amount' USING errcode='22023';
  END IF;
  SELECT public.prepare_live_checkout(
    p_event_id,p_client_request_id,p_tickets,p_guests,p_selections,p_promo_code
  ) INTO result;
  actual := (result->>'amount_cents')::bigint;
  IF actual IS DISTINCT FROM p_expected_amount_cents THEN
    -- Exception aborts this database transaction: no new booking, seat hold,
    -- Stripe checkout hold or discount allocation can be committed.
    RAISE EXCEPTION 'PAYABLE_AMOUNT_CHANGED' USING errcode='P0001';
  END IF;
  RETURN result;
END;
$body$;
REVOKE ALL ON FUNCTION public.prepare_live_checkout_confirmed(uuid,uuid,jsonb,jsonb,jsonb,text,bigint)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_live_checkout_confirmed(uuid,uuid,jsonb,jsonb,jsonb,text,bigint)
TO service_role;
