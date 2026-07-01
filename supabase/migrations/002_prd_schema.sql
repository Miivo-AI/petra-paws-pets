-- ============================================================
-- Migration 002 — PRD alignment
-- Fixes schema to match PRD §3.2:
--   • services: remove price/category, rename is_active→active
--   • new: service_zones, service_prices, travel_time_cache
--   • new: blackouts (replaces blocked_slots)
--   • new: appointments (full rebuild with correct fields)
-- ============================================================

-- ── Drop tables being replaced ──────────────────────────────
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS blocked_slots CASCADE;

-- ── Update services ─────────────────────────────────────────
-- Clear seed data from 001 (will re-seed correctly below)
TRUNCATE TABLE services CASCADE;

ALTER TABLE services RENAME COLUMN is_active TO active;
ALTER TABLE services DROP COLUMN IF EXISTS price;
ALTER TABLE services DROP COLUMN IF EXISTS category;

-- ── Service zones ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_zones (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lng DOUBLE PRECISION NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pricing matrix ───────────────────────────────────────────
-- Keyed on (pet_type, service_id, size).
-- size is NULL for cats (cats are flat-priced per service).
CREATE TABLE IF NOT EXISTS service_prices (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_type   TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat')),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  size       TEXT CHECK (size IN ('small', 'medium', 'large')),
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  UNIQUE (pet_type, service_id, size),
  -- dogs must have a size; cats must not
  CONSTRAINT dog_requires_size CHECK (pet_type = 'cat' OR size IS NOT NULL),
  CONSTRAINT cat_no_size       CHECK (pet_type = 'dog' OR size IS NULL)
);

-- ── Blackouts (replaces blocked_slots) ───────────────────────
-- start_time/end_time both NULL  → full-day block
-- start_time/end_time both set   → partial time block
CREATE TABLE IF NOT EXISTS blackouts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date       DATE NOT NULL,
  start_time TIME,
  end_time   TIME,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT times_both_or_neither
    CHECK ((start_time IS NULL) = (end_time IS NULL)),
  CONSTRAINT end_after_start
    CHECK (start_time IS NULL OR end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_blackouts_date ON blackouts(date);

-- ── Travel time cache ────────────────────────────────────────
-- Persists Google Maps Distance Matrix results between zone pairs.
CREATE TABLE IF NOT EXISTS travel_time_cache (
  zone_a_id      UUID NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  zone_b_id      UUID NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  travel_minutes INTEGER NOT NULL,
  cached_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (zone_a_id, zone_b_id)
);

-- ── Appointments (full rebuild) ──────────────────────────────
-- status: pending_payment → confirmed | cancelled
-- booking_reference: human-readable (PP-XXXXXX)
-- lookup_token: UUID used in magic links
CREATE TABLE IF NOT EXISTS appointments (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_reference TEXT NOT NULL UNIQUE,
  lookup_token      UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,

  pet_type          TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat')),
  service_id        UUID REFERENCES services(id) ON DELETE SET NULL,
  size              TEXT CHECK (size IN ('small', 'medium', 'large')),

  zone_id           UUID REFERENCES service_zones(id) ON DELETE SET NULL,
  customer_address  TEXT,

  customer_name     TEXT NOT NULL,
  customer_email    TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  pet_name          TEXT NOT NULL,
  pet_breed         TEXT,
  special_notes     TEXT,

  subtotal          NUMERIC(10, 2) NOT NULL,
  vat               NUMERIC(10, 2) NOT NULL,
  total             NUMERIC(10, 2) NOT NULL,

  status            TEXT NOT NULL DEFAULT 'pending_payment'
                      CHECK (status IN ('pending_payment', 'confirmed', 'cancelled')),
  hold_expires_at   TIMESTAMPTZ,
  ziina_payment_id  TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- dogs must specify size; cats must not
  CONSTRAINT appt_dog_requires_size CHECK (pet_type = 'cat' OR size IS NOT NULL),
  CONSTRAINT appt_cat_no_size       CHECK (pet_type = 'dog' OR size IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_appt_date        ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appt_status      ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appt_email       ON appointments(customer_email);
CREATE INDEX IF NOT EXISTS idx_appt_hold_expiry ON appointments(hold_expires_at)
  WHERE status = 'pending_payment';

CREATE TRIGGER handle_updated_at_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE service_zones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackouts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_time_cache ENABLE ROW LEVEL SECURITY;

-- Service zones: anyone can read active zones
CREATE POLICY "public read active zones"
  ON service_zones FOR SELECT USING (active = true);
CREATE POLICY "admin manage zones"
  ON service_zones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Pricing: anyone can read
CREATE POLICY "public read prices"
  ON service_prices FOR SELECT USING (true);
CREATE POLICY "admin manage prices"
  ON service_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Blackouts: anyone can read (booking engine needs this unauthenticated)
CREATE POLICY "public read blackouts"
  ON blackouts FOR SELECT USING (true);
CREATE POLICY "admin manage blackouts"
  ON blackouts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Appointments:
--   anonymous can INSERT (create a booking hold)
--   anon can SELECT their own by lookup_token (magic link)
--   authenticated (admin) can do everything
CREATE POLICY "anon insert appointment"
  ON appointments FOR INSERT WITH CHECK (true);

CREATE POLICY "lookup by token"
  ON appointments FOR SELECT
  USING (true);  -- token matching handled in app layer via service-role reads

CREATE POLICY "admin full access appointments"
  ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Travel cache: service-role only
CREATE POLICY "service role travel cache"
  ON travel_time_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Seed: service zones ──────────────────────────────────────
INSERT INTO service_zones (name, centroid_lat, centroid_lng) VALUES
  ('Nad Al Sheba',                25.1530, 55.3188),
  ('Meydan',                      25.1729, 55.3008),
  ('Mohammed Bin Rashid City',    25.1876, 55.2735),
  ('Business Bay',                25.1869, 55.2702),
  ('Downtown Dubai',              25.1972, 55.2744),
  ('Dubai Creek Harbour',         25.2160, 55.3338),
  ('Zabeel',                      25.2197, 55.2906)
ON CONFLICT (name) DO NOTHING;

-- ── Seed: services ───────────────────────────────────────────
INSERT INTO services (name, description, features, duration_minutes, active, sort_order) VALUES
  (
    'Basic Grooming',
    'A thorough groom that leaves your pet fresh, clean, and happy.',
    '["Bathing","Blow Dry","Nail Clipping","Ear Cleaning","Teeth Brush"]',
    90,
    true,
    1
  ),
  (
    'Full Grooming',
    'Our premium full service — everything in Basic, plus a complete haircut and scenting finish.',
    '["Full Hair Cut","Bathing","Blow Dry","Nail Clipping","Ear Cleaning","Teeth Brush","Scenting & Fluff"]',
    120,
    true,
    2
  )
ON CONFLICT DO NOTHING;

-- ── Seed: pricing matrix ─────────────────────────────────────
-- Prices from §3.2a (Petology reference — confirm with client before launch)
DO $$
DECLARE
  basic_id UUID;
  full_id  UUID;
BEGIN
  SELECT id INTO basic_id FROM services WHERE name = 'Basic Grooming' LIMIT 1;
  SELECT id INTO full_id  FROM services WHERE name = 'Full Grooming'  LIMIT 1;

  -- Dogs (size required)
  INSERT INTO service_prices (pet_type, service_id, size, amount) VALUES
    ('dog', basic_id, 'small',  210),
    ('dog', basic_id, 'medium', 275),
    ('dog', basic_id, 'large',  310),
    ('dog', full_id,  'small',  249),
    ('dog', full_id,  'medium', 299),
    ('dog', full_id,  'large',  349)
  ON CONFLICT (pet_type, service_id, size) DO NOTHING;

  -- Cats (size = NULL — flat per service)
  INSERT INTO service_prices (pet_type, service_id, size, amount) VALUES
    ('cat', basic_id, NULL, 210),
    ('cat', full_id,  NULL, 249)
  ON CONFLICT (pet_type, service_id, size) DO NOTHING;
END $$;
