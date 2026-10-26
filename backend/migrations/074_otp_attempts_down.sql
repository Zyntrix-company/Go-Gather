-- Rollback 074: drop the OTP attempt counter.

ALTER TABLE otps DROP COLUMN IF EXISTS attempts;
