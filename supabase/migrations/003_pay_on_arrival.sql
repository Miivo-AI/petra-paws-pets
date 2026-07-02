-- ============================================================
-- Migration 003 — Pay on Arrival
-- Adds a non-online payment path: customer pays cash/card in
-- person when the groomer arrives, instead of paying via Ziina
-- up front.
--
--   payment_method: how the customer intends to pay
--   payment_status: whether money has actually been collected
--
-- Online bookings: payment_method='online', payment_status flips
--   unpaid → paid when Ziina confirms the payment (§confirm route).
-- Pay-on-arrival bookings: payment_method='pay_on_arrival', booking
--   goes straight to status='confirmed' with payment_status='unpaid'
--   (no hold, no Ziina step); the owner marks it 'paid' from the
--   admin dashboard once the groomer collects payment on-site.
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'online'
    CHECK (payment_method IN ('online', 'pay_on_arrival')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid'));

-- Backfill: existing confirmed online bookings already paid via Ziina.
UPDATE appointments
SET payment_status = 'paid'
WHERE status = 'confirmed' AND ziina_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appt_payment_status ON appointments(payment_status)
  WHERE status = 'confirmed';
