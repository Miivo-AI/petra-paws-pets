-- ============================================================
-- Migration 005 — WhatsApp booking flow
--
-- Adds:
--   1. appointments.source — tracks whether a booking came from the
--      website or the WhatsApp text-prompt bot, so admin can tell them
--      apart and lib/booking/confirm.ts knows when to also send a
--      WhatsApp confirmation alongside the email one.
--   2. whatsapp_sessions — one row per in-progress WhatsApp conversation,
--      keyed on the customer's wa_id. The bot is a menu-driven step
--      machine (lib/whatsapp/flow.ts); this table is where "which step
--      is this phone number on, and what have they answered so far"
--      lives between messages.
--
-- create_booking_atomic (migration 004) is replaced (not just
-- CREATE OR REPLACE'd) because adding a parameter changes its argument
-- signature — Postgres would otherwise keep both the 21-arg and 22-arg
-- versions around, and calling with 21 args would then be ambiguous.
-- Both callers (app/api/bookings/route.ts and lib/whatsapp/flow.ts) now
-- go through the single lib/booking/createBooking.ts function, which
-- always passes p_source explicitly.
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'whatsapp'));

DROP FUNCTION IF EXISTS create_booking_atomic(
  TEXT, TEXT, DATE, TIME, TIME, TEXT, UUID, TEXT, UUID, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ
);

CREATE FUNCTION create_booking_atomic(
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
  p_hold_expires_at    TIMESTAMPTZ,
  p_source             TEXT
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
    subtotal, vat, total, status, hold_expires_at, payment_method, payment_status,
    source
  ) VALUES (
    p_booking_reference, p_idempotency_key, p_date, p_start_time, p_end_time,
    p_pet_type, p_service_id, p_size, p_zone_id, p_customer_address, p_customer_name,
    p_customer_email, p_customer_phone, p_pet_name, p_pet_breed, p_special_notes,
    p_subtotal, p_vat, p_total, p_status, p_hold_expires_at, p_payment_method, 'unpaid',
    p_source
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

-- Runs with the privileges of the calling role (default SECURITY
-- INVOKER) so it stays subject to the existing RLS policies on
-- appointments (anon insert / public select are already permissive).
GRANT EXECUTE ON FUNCTION create_booking_atomic TO anon, authenticated;

-- ── WhatsApp conversation state ─────────────────────────────
-- One row per phone number with a booking in progress. Deleted once the
-- booking is created (or the customer restarts) — this is scratch state
-- for the chat flow, not a message history/inbox.
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  phone_number    TEXT PRIMARY KEY, -- WhatsApp wa_id, e.g. "971501234567"
  step            TEXT NOT NULL DEFAULT 'start',
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_id TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER handle_updated_at_whatsapp_sessions
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- RLS enabled with no policies at all: the webhook route is the only
-- caller, and it always uses the service-role admin client, which
-- bypasses RLS entirely. No anon/authenticated use case exists for this
-- table, so leaving it policy-less means everyone else is denied by
-- default rather than relying on a permissive policy we'd have to
-- remember to lock down later.
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
