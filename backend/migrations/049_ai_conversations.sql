-- Migration 049: Swee AI conversation persistence

CREATE TABLE IF NOT EXISTS ai_conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(120) NOT NULL DEFAULT 'New chat',
  preview      VARCHAR(80) NOT NULL DEFAULT '',
  category     VARCHAR(20) NOT NULL DEFAULT 'general'
    CHECK (category IN ('trip', 'event', 'general', 'content')),
  trip_context JSONB,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON ai_conversations (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role             VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON ai_messages (conversation_id, created_at);
