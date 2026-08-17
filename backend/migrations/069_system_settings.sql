-- Migration 069: singleton table for platform-wide runtime settings, starting
-- with the emergency maintenance-mode kill switch (Admin panel > Health).
CREATE TABLE system_settings (
  id               SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  reason           TEXT,
  enabled_by       UUID REFERENCES users(id),
  enabled_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (id, maintenance_mode) VALUES (1, false);
