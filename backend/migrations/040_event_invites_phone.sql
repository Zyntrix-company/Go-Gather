-- Allow SMS-style invites on events (parity with trip_invites)
ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
