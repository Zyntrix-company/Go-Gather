-- ===========================================================
-- GatherGo — Migration 018: Create Feedback Table
-- Stores user-submitted feedback and Swee AI issue reports.
-- type: 'feedback' | 'swee_report'
-- status: 'open' | 'resolved'
-- ===========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL DEFAULT 'feedback'
               CHECK (type IN ('feedback', 'swee_report')),
  message    TEXT NOT NULL,
  status     VARCHAR(10) NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_type  ON feedback(type);
CREATE INDEX idx_feedback_status ON feedback(status);

COMMIT;
