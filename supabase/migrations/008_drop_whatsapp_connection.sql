-- ============================================================
-- Migration 008 — drop unused WhatsApp Embedded Signup table
--
-- Booking WhatsApp confirmations use Meta Cloud API env credentials
-- only (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID / template name).
-- The admin Connect UI and whatsapp_connection row from migration 007
-- are no longer used.
-- ============================================================

DROP TABLE IF EXISTS whatsapp_connection;
