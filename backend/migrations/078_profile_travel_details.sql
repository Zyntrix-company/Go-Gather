-- Migration 078: profile travel details (behind PROFILE_TRAVEL_PREFS).
-- home_city is editable in Edit Profile; the other four are written only through Swee
-- ("remember this"). All nullable — NULL means unknown / not shared. No completeness score.

BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_city           VARCHAR(120) NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_mode_pref    VARCHAR(16)  NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests           JSONB        NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dietary_needs       VARCHAR(200) NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accessibility_needs VARCHAR(200) NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_travel_mode_pref_check') THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_travel_mode_pref_check
      CHECK (travel_mode_pref IS NULL OR travel_mode_pref IN ('flight', 'train', 'road'));
  END IF;
END
$$;

COMMIT;
