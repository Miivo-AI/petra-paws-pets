-- ============================================================
-- Petra Paws — Initial Schema
-- ============================================================

-- Enable the moddatetime extension for auto-updated_at
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  price            NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  features         JSONB NOT NULL DEFAULT '[]',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  image_url        TEXT,
  category         TEXT NOT NULL DEFAULT 'grooming'
                     CHECK (category IN ('grooming', 'spa', 'training', 'daycare')),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER handle_updated_at_services
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- ============================================================
-- PROFILES  (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name  TEXT,
  phone      TEXT,
  pet_name   TEXT,
  pet_breed  TEXT,
  pet_age    INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER handle_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Automatically create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  service_id       UUID REFERENCES services(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  customer_name    TEXT NOT NULL,
  customer_email   TEXT NOT NULL,
  customer_phone   TEXT,
  pet_name         TEXT NOT NULL,
  pet_breed        TEXT,
  notes            TEXT,
  total_price      NUMERIC(10, 2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_user ON appointments(user_id);

CREATE TRIGGER handle_updated_at_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- ============================================================
-- BLOCKED SLOTS  (no-service days & time blocks)
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_slots (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date        DATE NOT NULL,
  is_full_day BOOLEAN NOT NULL DEFAULT false,
  start_time  TIME,
  end_time    TIME,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT time_block_requires_times
    CHECK (is_full_day = true OR (start_time IS NOT NULL AND end_time IS NOT NULL)),
  CONSTRAINT end_after_start
    CHECK (is_full_day = true OR end_time > start_time)
);

CREATE INDEX idx_blocked_slots_date ON blocked_slots(date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Services: public read, admin write
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read active services"
  ON services FOR SELECT
  USING (is_active = true);

CREATE POLICY "authenticated can manage services"
  ON services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Profiles: users manage their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Appointments: users see their own; authenticated (admin) sees all
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "anyone can create appointment"
  ON appointments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "authenticated can manage all appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Blocked slots: public read, authenticated write
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read blocked slots"
  ON blocked_slots FOR SELECT
  USING (true);

CREATE POLICY "authenticated can manage blocked slots"
  ON blocked_slots FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- SEED — sample services
-- ============================================================
INSERT INTO services (name, description, price, duration_minutes, features, category, sort_order)
VALUES
  (
    'Full Groom & Bath',
    'Our signature full grooming package — perfect for a fresh, clean look.',
    150,
    90,
    '["Bath with premium shampoo & conditioner","Blow dry & brush out","Haircut & style","Nail trim","Ear cleaning","Spritz of cologne"]',
    'grooming',
    1
  ),
  (
    'Bath & Brush',
    'A thorough bath and brush out to keep your pet looking their best.',
    90,
    60,
    '["Bath with premium shampoo","Blow dry & brush out","Nail trim"]',
    'grooming',
    2
  ),
  (
    'Puppy First Groom',
    'A gentle introduction to grooming for puppies under 6 months.',
    80,
    45,
    '["Gentle bath","Light brush out","Nail file","Ear check","Treat & lots of patience"]',
    'grooming',
    3
  ),
  (
    'Spa Day',
    'A luxurious spa experience with deep conditioning and relaxing treatments.',
    200,
    120,
    '["Deep conditioning mask","Blueberry facial","Paw balm massage","Deshedding treatment","Full groom included"]',
    'spa',
    4
  )
ON CONFLICT DO NOTHING;
