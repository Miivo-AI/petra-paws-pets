-- ============================================================
-- Migration 006 — remove the WhatsApp booking flow
--
-- The conversational WhatsApp booking bot (webhook + step machine) has
-- been removed in favor of a simple outbound-only notification: every
-- booking now gets a plain WhatsApp confirmation message alongside its
-- email, sent from lib/booking/confirm.ts / lib/booking/createBooking.ts.
--
-- whatsapp_sessions (migration 005) was scratch state for that bot's
-- step machine only — nothing else reads or writes it, so it's dropped
-- outright rather than left as dead weight.
--
-- appointments.source is left in place: existing rows may still be
-- tagged 'whatsapp' from bookings made through the old bot, and the
-- admin UI still shows that provenance. No new rows will get that
-- value now that the bot is gone.
-- ============================================================

DROP TABLE IF EXISTS whatsapp_sessions;
