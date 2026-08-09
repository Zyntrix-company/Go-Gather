-- Migration 066: track who actually recorded a settlement, since members can
-- now settle a debt between two OTHER members on their behalf (paid_by/paid_to
-- stay the two parties to the debt; recorded_by is the acting user).

ALTER TABLE settlements ADD COLUMN recorded_by UUID REFERENCES users(id);

-- Backfill existing rows: the recorder was always the payer historically.
UPDATE settlements SET recorded_by = paid_by WHERE recorded_by IS NULL;
