-- Rollback 078: drop the profile travel details.
-- Switch PROFILE_TRAVEL_PREFS off before rolling back — the flag-on code reads and writes these columns.

BEGIN;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_travel_mode_pref_check;
ALTER TABLE profiles DROP COLUMN IF EXISTS accessibility_needs;
ALTER TABLE profiles DROP COLUMN IF EXISTS dietary_needs;
ALTER TABLE profiles DROP COLUMN IF EXISTS interests;
ALTER TABLE profiles DROP COLUMN IF EXISTS travel_mode_pref;
ALTER TABLE profiles DROP COLUMN IF EXISTS home_city;

COMMIT;
