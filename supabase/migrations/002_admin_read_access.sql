-- ============================================================
-- Admin read access for the /admin page
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- (after supabase-schema.sql has already been run)
-- ============================================================
--
-- supabase-schema.sql only lets `service_role` (a server-side secret,
-- never shipped to the browser) SELECT from these tables. The admin page
-- runs in the browser with the public anon key, so it authenticates real
-- people via Supabase Auth instead, and this policy lets any signed-in
-- ("authenticated") user read booking data. The anon (not-signed-in)
-- role still only has INSERT — booking as a devotee never required an
-- account, and still doesn't.
--
-- To create an admin login: Supabase Dashboard → Authentication → Users
-- → Add user → set an email + password for each committee member who
-- should have access. There's no public sign-up page — this is the only
-- way an account gets created.

CREATE POLICY "Signed-in users can read bookings"
  ON bookings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in users can read devotees"
  ON devotees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in users can read devotee_offerings"
  ON devotee_offerings FOR SELECT TO authenticated USING (true);
