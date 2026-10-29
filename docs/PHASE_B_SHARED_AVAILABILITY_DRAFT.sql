-- PHASE B: proposed shared place-availability predicate.
-- REVIEW ONLY. Do NOT execute until booking_live_checkouts is installed,
-- inventory semantics are audited, and tests for concurrent checkouts pass.
-- Explicitly server-only; no direct anon/authenticated invocation.
CREATE OR REPLACE FUNCTION yumorilnik_internal.checkout_places_available(
  p_booking_id uuid, p_event_id uuid
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.booking_selections mine
    JOIN public.booking_selections taken
      ON taken.table_id=mine.table_id
     AND taken.booking_id<>mine.booking_id
     AND (taken.seat_number IS NULL
       OR mine.seat_number IS NULL
       OR taken.seat_number=mine.seat_number)
    JOIN public.bookings other_booking
      ON other_booking.id=taken.booking_id
     AND other_booking.event_id=p_event_id
    LEFT JOIN public.booking_test_checkouts test_hold
      ON test_hold.booking_id=other_booking.id
    LEFT JOIN public.booking_live_checkouts live_hold
      ON live_hold.booking_id=other_booking.id
    WHERE mine.booking_id=p_booking_id
      AND (
        other_booking.status IN ('confirmed','test_confirmed')
        OR (
          other_booking.status='requested'
          AND test_hold.state IN ('creating','open')
        )
        OR (
          other_booking.status='requested'
          AND live_hold.state IN ('creating','open')
          AND live_hold.expires_at>now()
        )
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.booking_items mine
    JOIN public.ticket_types tt ON tt.id=mine.ticket_type_id
    WHERE mine.booking_id=p_booking_id
      AND tt.quantity_total IS NOT NULL
      AND (
        greatest(
          coalesce(tt.quantity_sold,0),
          coalesce((
            SELECT sum(item.quantity)
            FROM public.booking_items item
            JOIN public.bookings booking ON booking.id=item.booking_id
            WHERE item.ticket_type_id=mine.ticket_type_id
              AND booking.status IN ('confirmed','test_confirmed')
          ),0)
        )
        + coalesce((
          SELECT sum(item.quantity)
          FROM public.booking_items item
          JOIN public.bookings booking ON booking.id=item.booking_id
          JOIN public.booking_test_checkouts hold ON hold.booking_id=booking.id
          WHERE item.ticket_type_id=mine.ticket_type_id
            AND item.booking_id<>p_booking_id
            AND booking.status='requested'
            AND hold.state IN ('creating','open')
        ),0)
        + coalesce((
          SELECT sum(item.quantity)
          FROM public.booking_items item
          JOIN public.bookings booking ON booking.id=item.booking_id
          JOIN public.booking_live_checkouts hold ON hold.booking_id=booking.id
          WHERE item.ticket_type_id=mine.ticket_type_id
            AND item.booking_id<>p_booking_id
            AND booking.status='requested'
            AND hold.state IN ('creating','open')
            AND hold.expires_at>now()
        ),0)
        + mine.quantity > tt.quantity_total
      )
  );
$$;
REVOKE ALL ON FUNCTION yumorilnik_internal.checkout_places_available(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION yumorilnik_internal.checkout_places_available(uuid,uuid)
  TO service_role;

-- REQUIRED before rollout:
-- (1) Both sandbox and live preparers/completers must invoke this shared predicate.
-- (2) Both channels must hold event-level advisory xact lock during conflict check.
-- (3) Confirm test holds' expiry/recovery semantics and live checkout expiry race.
-- (4) Confirm quantity_sold is not double-counted and confirmed-seat inventory is correct.
-- (5) Test concurrent attempts for same seat and same ticket pool.
-- (6) Review security-definer owner, grants and schema visibility.
