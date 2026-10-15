-- Migration 071: reusable trip/event share links.
-- One link per (trip|event, member who shares it). It never expires and is never reset;
-- opening it creates a pending request for the opener (see invites.service.openInvite).
-- parent_id has no FK, per the shared-table convention (migration 005): the row is
-- polymorphic, and the link is simply dead once the parent is gone.
CREATE TABLE IF NOT EXISTS share_links (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type VARCHAR(10)  NOT NULL CHECK (parent_type IN ('trip', 'event')),
  parent_id   UUID         NOT NULL,
  created_by  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (parent_type, parent_id, created_by)
);
