-- Migration 074: count wrong guesses per OTP so a code dies after a few attempts
-- (SEC-02). Additive with a default — older code simply ignores the column.

ALTER TABLE otps ADD COLUMN IF NOT EXISTS attempts SMALLINT NOT NULL DEFAULT 0;
