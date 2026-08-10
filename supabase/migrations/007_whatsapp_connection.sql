-- ============================================================
-- Migration 007 — WhatsApp connection (Embedded Signup)
--
-- Backs the admin "Connect WhatsApp" page (/admin/whatsapp). Sending
-- the number's Cloud API credentials through Embedded Signup happens
-- at runtime via a button click, not a deploy-time env var, so the
-- resulting WABA ID / Phone Number ID / access token need somewhere
-- to live that the app can read and rewrite without a redeploy.
--
-- Singleton table (id is always `true`) — there is exactly one
-- WhatsApp number connected to this business at a time. Connecting a
-- new number overwrites the row; disconnecting deletes it.
--
-- RLS enabled with no policies at all, same rationale as
-- whatsapp_sessions (005): this holds a live Graph API access token,
-- so only the service-role client (lib/supabase/server.ts
-- createAdminClient, used from admin-authenticated API routes) may
-- touch it. No anon/authenticated use case exists for this table.
-- ============================================================

CREATE TABLE whatsapp_connection (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  display_phone_number text,
  verified_name text,
  access_token text NOT NULL,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_connection ENABLE ROW LEVEL SECURITY;
