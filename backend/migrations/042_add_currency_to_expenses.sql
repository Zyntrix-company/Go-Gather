-- Add per-expense currency support.
-- Existing rows default to INR (preserves all historical data).
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'INR';

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'INR';
