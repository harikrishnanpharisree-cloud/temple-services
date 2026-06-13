-- ============================================================
-- Panackal Bhadrakali Devi Temple — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. BOOKINGS
--    One row per checkout session (can have multiple devotees)
CREATE TABLE bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  grand_total       INTEGER NOT NULL,          -- total in paise (₹1 = 100)
  payment_status    TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','confirmed','failed')),
  razorpay_order_id TEXT,                      -- filled when payment order is created
  razorpay_payment_id TEXT,                    -- filled after payment success (via webhook)
  contact_email     TEXT,                      -- optional: for confirmation email
  contact_phone     TEXT                       -- optional: for SMS / WhatsApp
);

-- 2. DEVOTEES
--    One row per devotee in a booking
CREATE TABLE devotees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  birth_star      TEXT NOT NULL,
  preferred_date  DATE NOT NULL,
  subtotal        INTEGER NOT NULL             -- subtotal for this devotee in paise
);

-- 3. DEVOTEE_OFFERINGS
--    One row per offering selected by a devotee
CREATE TABLE devotee_offerings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devotee_id      UUID NOT NULL REFERENCES devotees(id) ON DELETE CASCADE,
  offering_id     INTEGER NOT NULL,            -- matches OFFERINGS[].id in the React app
  offering_name   TEXT NOT NULL,              -- snapshot at time of booking (en)
  price           INTEGER NOT NULL            -- price in paise at time of booking
);

-- ============================================================
-- INDEXES (for fast admin queries)
-- ============================================================
CREATE INDEX idx_bookings_status    ON bookings(payment_status);
CREATE INDEX idx_bookings_created   ON bookings(created_at DESC);
CREATE INDEX idx_devotees_booking   ON devotees(booking_id);
CREATE INDEX idx_devotees_date      ON devotees(preferred_date);
CREATE INDEX idx_dev_off_devotee    ON devotee_offerings(devotee_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Allow anyone to INSERT (create bookings), but only service
-- role (your webhook / admin) can SELECT or UPDATE.
-- ============================================================
ALTER TABLE bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devotees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devotee_offerings ENABLE ROW LEVEL SECURITY;

-- Public can insert new bookings (from the React app)
CREATE POLICY "Anyone can create bookings"
  ON bookings FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone can create devotees"
  ON devotees FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone can create devotee_offerings"
  ON devotee_offerings FOR INSERT TO anon WITH CHECK (true);

-- Only service role (webhook / admin) can read or update
-- (anon key used in the browser cannot read other people's data)
CREATE POLICY "Service role reads bookings"
  ON bookings FOR SELECT TO service_role USING (true);

CREATE POLICY "Service role updates bookings"
  ON bookings FOR UPDATE TO service_role USING (true);

CREATE POLICY "Service role reads devotees"
  ON devotees FOR SELECT TO service_role USING (true);

CREATE POLICY "Service role reads devotee_offerings"
  ON devotee_offerings FOR SELECT TO service_role USING (true);

-- ============================================================
-- ADMIN VIEW (convenient joined view for the temple dashboard)
-- ============================================================
CREATE VIEW booking_summary AS
  SELECT
    b.id              AS booking_id,
    b.created_at,
    b.payment_status,
    b.grand_total     / 100.0 AS grand_total_rupees,
    b.razorpay_payment_id,
    d.name            AS devotee_name,
    d.birth_star,
    d.preferred_date,
    d.subtotal        / 100.0 AS devotee_subtotal_rupees,
    dof.offering_name,
    dof.price         / 100.0 AS offering_price_rupees
  FROM bookings b
  JOIN devotees d          ON d.booking_id  = b.id
  JOIN devotee_offerings dof ON dof.devotee_id = d.id
  ORDER BY b.created_at DESC;

-- ============================================================
-- SAMPLE QUERY: All confirmed bookings for a given date
-- (Useful for the priest to know what to perform each day)
-- ============================================================
-- SELECT * FROM booking_summary
-- WHERE preferred_date = '2026-03-14'
--   AND payment_status = 'confirmed';
