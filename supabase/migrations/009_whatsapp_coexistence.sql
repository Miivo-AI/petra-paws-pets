-- ============================================================
-- Migration 009 — WhatsApp coexistence, consent, and delivery log
--
-- Coexistence (Meta's "Onboard WhatsApp Business app users" flow) lets
-- the owner keep answering customers from the WhatsApp Business app on
-- their phone while this app sends booking confirmations through the
-- Cloud API on the *same* number. Meta only ever initiates that link
-- through Embedded Signup at runtime, so the resulting credentials
-- cannot come from a deploy-time env var — hence whatsapp_connection
-- comes back (it was created in 007 and dropped in 008).
--
-- Three concerns, three tables:
--   whatsapp_connection — the live Cloud API credentials + coexistence
--     onboarding/sync state for the one connected number.
--   whatsapp_contacts   — the consent ledger. Meta's Business Messaging
--     Policy requires demonstrable opt-in, and /privacy, /terms and
--     /data-deletion all promise customers that replying STOP works.
--     Both facts need to be recorded per phone number, not per booking.
--   whatsapp_messages   — one row per outbound send, so a failed
--     confirmation is visible to staff instead of living only in a
--     server log line, and so `statuses` webhooks have somewhere to
--     land.
--
-- All three hold either live access tokens or customer PII and are
-- written only by service-role callers (lib/supabase/server.ts
-- createAdminClient) from admin-authenticated routes or the Meta
-- webhook. RLS is therefore enabled with *no* policies, same rationale
-- as whatsapp_sessions (005) and whatsapp_connection (007): there is no
-- anon/authenticated use case for any of them.
-- ============================================================

-- ── Connected number (Embedded Signup / coexistence) ─────────
CREATE TABLE whatsapp_connection (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  display_phone_number text,
  verified_name text,
  access_token text NOT NULL,

  -- Coexistence markers, read back from the Graph API after onboarding
  -- (GET /{phone_number_id}?fields=is_on_biz_app,platform_type). Both
  -- are what distinguish a coexistence number from a plain API-only
  -- one, and the admin page surfaces them so a half-finished
  -- onboarding is obvious rather than silent.
  is_on_biz_app boolean,
  platform_type text,

  -- Meta gives exactly 24h from onboarding to pull contacts and message
  -- history via the SMB App Data API, and each sync can only be
  -- requested once. Miss the window and the client has to offboard and
  -- redo the whole Embedded Signup flow, so the deadline and the
  -- per-sync outcome are tracked explicitly.
  onboarded_at timestamptz NOT NULL DEFAULT now(),
  contacts_sync_requested_at timestamptz,
  contacts_sync_error text,
  history_sync_requested_at timestamptz,
  history_sync_error text,
  history_received_at timestamptz,

  -- Set from the account_update webhook (PARTNER_REMOVED). A
  -- coexistence number cannot be deregistered through the API — the
  -- owner disconnects from the phone — so without this the app would
  -- keep trying to send on dead credentials forever.
  disconnected_at timestamptz,
  disconnect_reason text,

  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_connection ENABLE ROW LEVEL SECURITY;

-- ── Consent ledger (opt-in + STOP opt-out), keyed by number ──
-- Keyed by phone rather than by appointment because that is how
-- customers experience it: one STOP suppresses every future booking
-- from the same number, including bookings made later under a
-- different email.
CREATE TABLE whatsapp_contacts (
  phone_e164 text PRIMARY KEY,

  opted_in_at timestamptz,
  -- Verbatim copy of the wording the customer actually agreed to, plus
  -- its version, so consent can be evidenced at App Review time even
  -- after the booking form copy changes.
  opt_in_text text,
  opt_in_version text,
  opt_in_source text CHECK (opt_in_source IN ('booking_form', 'inbound_message', 'admin')),
  opt_in_appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,

  opted_out_at timestamptz,
  opt_out_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX whatsapp_contacts_opted_out_idx
  ON whatsapp_contacts (opted_out_at)
  WHERE opted_out_at IS NOT NULL;

-- ── Outbound delivery log ────────────────────────────────────
CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  to_e164 text NOT NULL,

  -- Meta's message ID. Null until the send is accepted; the `statuses`
  -- webhook is keyed on it, which is the only way to tell "accepted by
  -- the API" apart from "actually delivered to the customer".
  wamid text UNIQUE,

  template_name text,
  template_language text,

  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  -- Why a send never left the building (no consent, opted out,
  -- unparseable number, not configured) or why Meta rejected it.
  skip_reason text,
  error_code int,
  error_message text,
  attempts int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX whatsapp_messages_appointment_idx ON whatsapp_messages (appointment_id);
CREATE INDEX whatsapp_messages_failed_idx
  ON whatsapp_messages (created_at DESC)
  WHERE status = 'failed';

-- ── Decouple the WhatsApp send from the email send ───────────
-- confirmation_sent_at (004) is claimed once and covers the customer
-- email + owner alert + WhatsApp together, so a WhatsApp failure could
-- never be retried without also re-sending both emails. WhatsApp now
-- claims its own column.
ALTER TABLE appointments ADD COLUMN whatsapp_sent_at timestamptz;

-- Backfill so the retry sweep in the reconcile cron doesn't treat every
-- historical booking as an unsent confirmation on first deploy.
UPDATE appointments
   SET whatsapp_sent_at = confirmation_sent_at
 WHERE confirmation_sent_at IS NOT NULL;

-- Retry sweep lookup: confirmed bookings whose WhatsApp never went out.
CREATE INDEX appointments_whatsapp_unsent_idx
  ON appointments (created_at DESC)
  WHERE status = 'confirmed' AND whatsapp_sent_at IS NULL;

-- NOTE: appointments.customer_phone now stores E.164 (+9715…) for all
-- new bookings — lib/whatsapp/phone.ts normalizes at the API boundary.
-- Rows created before this migration keep whatever the customer typed;
-- they are deliberately left alone rather than machine-guessed, since a
-- wrong guess would message a stranger. Sends for those rows are
-- normalized best-effort at send time and logged as 'skipped' with
-- skip_reason = 'unparseable_phone' when that fails.
