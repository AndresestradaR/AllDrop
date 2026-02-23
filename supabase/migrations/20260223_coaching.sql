-- ============================================================
-- Coaching Prepago — Tables, RLS, Seed
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Mentors
CREATE TABLE IF NOT EXISTS coaching_mentors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text NOT NULL,
  photo_url   text,
  bio         text,
  topics      text[] NOT NULL DEFAULT '{}',
  price_usd   numeric(10,2) NOT NULL DEFAULT 40.00,
  mentor_share_usd   numeric(10,2) NOT NULL DEFAULT 30.00,
  platform_share_usd numeric(10,2) NOT NULL DEFAULT 10.00,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Availability (slots)
CREATE TABLE IF NOT EXISTS coaching_availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   uuid NOT NULL REFERENCES coaching_mentors(id) ON DELETE CASCADE,
  slot_date   date NOT NULL,
  slot_hour   integer NOT NULL CHECK (slot_hour >= 0 AND slot_hour <= 23),
  is_booked   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mentor_id, slot_date, slot_hour)
);

-- 3. Bookings
CREATE TABLE IF NOT EXISTS coaching_bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  mentor_id        uuid NOT NULL REFERENCES coaching_mentors(id) ON DELETE CASCADE,
  availability_id  uuid NOT NULL REFERENCES coaching_availability(id) ON DELETE CASCADE,
  topic            text NOT NULL,
  slot_date        date NOT NULL,
  slot_hour        integer NOT NULL,
  price_usd        numeric(10,2) NOT NULL DEFAULT 40.00,
  status           text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_mentor_date ON coaching_availability(mentor_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON coaching_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_mentor ON coaching_bookings(mentor_id);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE coaching_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_bookings ENABLE ROW LEVEL SECURITY;

-- Mentors: anyone can read active mentors
CREATE POLICY "Public read active mentors"
  ON coaching_mentors FOR SELECT
  USING (is_active = true);

-- Availability: anyone can read
CREATE POLICY "Public read availability"
  ON coaching_availability FOR SELECT
  USING (true);

-- Bookings: users can only read their own
CREATE POLICY "Users read own bookings"
  ON coaching_bookings FOR SELECT
  USING (auth.uid() = user_id);

-- Service role handles all writes (no INSERT/UPDATE/DELETE policies for anon)

-- ============================================================
-- Seed: Juan Franco as first mentor
-- ============================================================
INSERT INTO coaching_mentors (email, name, bio, topics, price_usd, mentor_share_usd, platform_share_usd)
VALUES (
  'juampifranco2612@gmail.com',
  'Juan Franco',
  'Experto en e-commerce y dropshipping. Más de 3 años escalando tiendas online con estrategias probadas en Meta Ads y creación de landings de alta conversión.',
  ARRAY['Escalamiento', 'Creación de Landings', 'Campañas Meta'],
  40.00,
  30.00,
  10.00
)
ON CONFLICT (email) DO NOTHING;

-- Add Juan Franco to allowed_emails if not already there
INSERT INTO allowed_emails (email, name, is_active)
VALUES ('juampifranco2612@gmail.com', 'Juan Franco', true)
ON CONFLICT (email) DO NOTHING;
