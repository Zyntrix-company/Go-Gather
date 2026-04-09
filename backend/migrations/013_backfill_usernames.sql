-- Migration 013: Backfill usernames for existing users who have a profile but no handle.
-- Uses the same slug logic as the application: join name parts, keep [a-z0-9_],
-- truncate base to 15 chars, append an incrementing suffix on collision.

DO $$
DECLARE
  rec       RECORD;
  base_slug TEXT;
  candidate TEXT;
  suffix    INT;
BEGIN
  FOR rec IN
    SELECT u.id, p.full_name
    FROM   users u
    JOIN   profiles p ON p.user_id = u.id
    WHERE  u.username IS NULL
      AND  p.full_name IS NOT NULL
    ORDER  BY u.created_at
  LOOP
    -- Build slug: remove spaces, keep a-z0-9_, lowercase, limit to 15 chars
    base_slug := SUBSTRING(
      REGEXP_REPLACE(LOWER(REPLACE(rec.full_name, ' ', '')), '[^a-z0-9_]', '', 'g'),
      1, 15
    );

    -- Guarantee minimum length of 3
    IF LENGTH(base_slug) < 3 THEN
      base_slug := SUBSTRING(base_slug || 'user', 1, 20);
    END IF;

    -- Find a collision-free handle
    candidate := base_slug;
    suffix    := 1;
    WHILE EXISTS (SELECT 1 FROM users WHERE username = candidate) LOOP
      candidate := SUBSTRING(base_slug, 1, 15) || suffix::TEXT;
      suffix    := suffix + 1;
    END LOOP;

    UPDATE users SET username = candidate, updated_at = NOW() WHERE id = rec.id;
  END LOOP;
END $$;
