-- ============================================================
-- Migration 004 — Booking integrity
--
-- Fixes two checkout edge cases found in review:
--
--   1. Race condition: two concurrent requests for the same slot
--      could both pass the JS-level validateSlot() check and both
--      get inserted, double-booking the groomer. There was no
--      DB-level guard — validateSlot (read) and INSERT happened as
--      two separate round trips with no locking between them.
--
--   2. No idempotency: a network retry (not just a double-click,
--      which the UI already disables against) could create two
--      appointment rows + two Ziina payment intents for one
--      logical booking attempt.
--
-- Fix: a single plpgsql function that, within one transaction,
-- takes an advisory lock keyed on the date (serializing all
-- booking attempts for that day), re-checks for idempotency and
-- for overlapping active bookings, then inserts. Because it's one
-- function call it runs as one DB transaction even though the
-- Supabase JS client can't otherwise span BEGIN/COMMIT across
-- separate requests.
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS ziina_redirect_url TEXT,
  -- Claim markers so two concurrent requests sharing the same
  -- idempotency_key (a genuine in-flight duplicate, not just a later
  -- replay) can't both create a Ziina payment intent or both send the
  -- pay-on-arrival confirmation emails for the same booking.
  ADD COLUMN IF NOT EXISTS ziina_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION create_booking_atomic(
  p_booking_reference TEXT,
  p_idempotency_key    TEXT,
  p_date               DATE,
  p_start_time         TIME,
  p_end_time           TIME,
  p_pet_type           TEXT,
  p_service_id         UUID,
  p_size               TEXT,
  p_zone_id            UUID,
  p_customer_address   TEXT,
  p_customer_name      TEXT,
  p_customer_email     TEXT,
  p_customer_phone     TEXT,
  p_pet_name           TEXT,
  p_pet_breed          TEXT,
  p_special_notes      TEXT,
  p_subtotal           NUMERIC,
  p_vat                NUMERIC,
  p_total              NUMERIC,
  p_payment_method     TEXT,
  p_status             TEXT,
  p_hold_expires_at    TIMESTAMPTZ
) RETURNS appointments
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing appointments;
  v_new      appointments;
BEGIN
  -- Cheap idempotency check before waiting on the lock.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM appointments WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Serialize all booking attempts for this date so the overlap
  -- check below and the insert are atomic with respect to each other.
  PERFORM pg_advisory_xact_lock(hashtext(p_date::text));

  -- Re-check idempotency now that we hold the lock, in case a
  -- concurrent duplicate submission inserted between the check
  -- above and the lock being granted.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM appointments WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Hard backstop against double-booking: reject if any other active
  -- booking already occupies an overlapping time on this date. This
  -- deliberately ignores zone/travel-time (already checked by the
  -- caller pre-lock) — it only guards the literal "two appointments
  -- at once" case, which is a real race the app-level check can't
  -- prevent on its own.
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE date = p_date
      AND (
        status = 'confirmed'
        OR (status = 'pending_payment' AND hold_expires_at > now())
      )
      AND start_time < p_end_time
      AND end_time > p_start_time
  ) THEN
    RAISE EXCEPTION 'slot_taken';
  END IF;

  INSERT INTO appointments (
    booking_reference, idempotency_key, date, start_time, end_time,
    pet_type, service_id, size, zone_id, customer_address, customer_name,
    customer_email, customer_phone, pet_name, pet_breed, special_notes,
    subtotal, vat, total, status, hold_expires_at, payment_method, payment_status
  ) VALUES (
    p_booking_reference, p_idempotency_key, p_date, p_start_time, p_end_time,
    p_pet_type, p_service_id, p_size, p_zone_id, p_customer_address, p_customer_name,
    p_customer_email, p_customer_phone, p_pet_name, p_pet_breed, p_special_notes,
    p_subtotal, p_vat, p_total, p_status, p_hold_expires_at, p_payment_method, 'unpaid'
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

-- Runs with the privileges of the calling role (default SECURITY
-- INVOKER) so it stays subject to the existing RLS policies on
-- appointments (anon insert / public select are already permissive).
GRANT EXECUTE ON FUNCTION create_booking_atomic TO anon, authenticated;
