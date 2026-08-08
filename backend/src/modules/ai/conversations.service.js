/**
 * Swee AI — conversation persistence (list, create, messages, metadata).
 */

const { query: db, getClient } = require('../../config/database');

const CATEGORIES = ['trip', 'event', 'general', 'content'];
const DEFAULT_TITLE = 'New chat';
const LIST_DEFAULT_LIMIT = 20;
const MESSAGES_DEFAULT_LIMIT = 30;

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    preview: row.preview || '',
    category: row.category || 'general',
    tripContext: row.trip_context || null,
    metadata: row.metadata || {},
    starred: row.starred || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

// ─── Metadata helpers ─────────────────────────────────────────────────────────

function stripMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\|[^|\n]+\|/g, '')
    .replace(/[#*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(str, max) {
  const s = (str || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function titleFromFirstMessage(message) {
  const clean = stripMarkdown(message).replace(/\n/g, ' ');
  return truncate(clean || DEFAULT_TITLE, 50) || DEFAULT_TITLE;
}

function refineTitle(userMessage, pendingAction, currentTitle) {
  if (!pendingAction?.draft) return currentTitle;
  const { intent, draft } = pendingAction;
  if (intent === 'create_trip' && draft.destination) {
    return truncate(`Trip to ${draft.destination}`, 120);
  }
  if (intent === 'create_event' && draft.name) {
    return truncate(String(draft.name), 120);
  }
  if (intent === 'update_trip' && draft.destination) {
    return truncate(`Update: ${draft.destination}`, 120);
  }
  if (intent === 'update_event' && draft.name) {
    return truncate(`Update: ${draft.name}`, 120);
  }
  if (currentTitle === DEFAULT_TITLE && userMessage) {
    return titleFromFirstMessage(userMessage);
  }
  return currentTitle;
}

function inferCategory(tripContext, pendingAction) {
  if (tripContext?.contextType === 'trip') return 'trip';
  if (tripContext?.contextType === 'event') return 'event';
  const intent = pendingAction?.intent || '';
  if (intent.includes('trip')) return 'trip';
  if (intent.includes('event')) return 'event';
  if (intent === 'add_note') return 'content';
  return 'general';
}

function buildPreview(replyText) {
  return truncate(stripMarkdown(replyText), 80);
}

function categoryFromTripContext(tripContext) {
  if (!tripContext) return 'general';
  if (tripContext.contextType === 'event') return 'event';
  if (tripContext.contextType === 'trip') return 'trip';
  return 'general';
}

// ─── Ownership ────────────────────────────────────────────────────────────────

async function getConversationForUser(userId, conversationId) {
  const result = await db(
    `SELECT * FROM ai_conversations
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [conversationId, userId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  }
  return result.rows[0];
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function listConversations(userId, { page = 1, limit = LIST_DEFAULT_LIMIT } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || LIST_DEFAULT_LIMIT, 1), 50);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const [listRes, countRes] = await Promise.all([
    db(
      `SELECT * FROM ai_conversations
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, offset],
    ),
    db(
      `SELECT COUNT(*)::int AS total FROM ai_conversations
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    ),
  ]);

  const total = countRes.rows[0]?.total ?? 0;
  return {
    conversations: listRes.rows.map(formatConversation),
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: offset + listRes.rows.length < total,
  };
}

async function createConversation(userId, tripContext = null) {
  const category = categoryFromTripContext(tripContext);
  const title = tripContext?.name
    ? truncate(`Chat: ${tripContext.name}`, 120)
    : DEFAULT_TITLE;

  const result = await db(
    `INSERT INTO ai_conversations (user_id, title, preview, category, trip_context)
     VALUES ($1, $2, '', $3, $4)
     RETURNING *`,
    [userId, title, category, tripContext ? JSON.stringify(tripContext) : null],
  );
  return formatConversation(result.rows[0]);
}

async function getConversation(userId, conversationId) {
  const row = await getConversationForUser(userId, conversationId);
  return formatConversation(row);
}

async function deleteConversation(userId, conversationId) {
  await getConversationForUser(userId, conversationId);
  await db(
    `UPDATE ai_conversations SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId],
  );
  return { success: true };
}

// Deliberately leaves updated_at untouched — starring is a UI marker only and
// must not reshuffle the conversation list (still ordered by updated_at DESC).
async function setConversationStarred(userId, conversationId, starred) {
  await getConversationForUser(userId, conversationId);
  const result = await db(
    `UPDATE ai_conversations SET starred = $1
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [!!starred, conversationId, userId],
  );
  return formatConversation(result.rows[0]);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

// User + assistant rows inserted in one transaction share the same NOW() timestamp.
// Tie-break so reversed DESC results always read user → assistant chronologically.
const MESSAGE_ORDER_DESC = `created_at DESC, CASE role WHEN 'assistant' THEN 0 ELSE 1 END`;

function buildMemoryBlock(olderRows) {
  if (!olderRows?.length) return '';
  const lines = [];
  for (const row of olderRows) {
    const text = stripMarkdown(row.content).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const label = row.role === 'user' ? 'User' : 'Swee';
    lines.push(`- ${label}: ${truncate(text, 120)}`);
    const draft = row.metadata?.pendingAction?.draft;
    if (draft?.destination) lines.push(`  (trip: ${draft.destination})`);
    if (draft?.name && row.metadata?.pendingAction?.intent?.includes('event')) {
      lines.push(`  (event: ${draft.name})`);
    }
  }
  if (!lines.length) return '';
  return truncate(lines.join('\n'), 1500);
}

async function countMessages(conversationId) {
  const result = await db(
    `SELECT COUNT(*)::int AS total FROM ai_messages WHERE conversation_id = $1`,
    [conversationId],
  );
  return result.rows[0]?.total ?? 0;
}

async function loadOlderMessagesForMemory(conversationId, skipLastN) {
  if (!skipLastN) return [];
  const result = await db(
    `SELECT role, content, metadata FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY ${MESSAGE_ORDER_DESC}
     OFFSET $2`,
    [conversationId, skipLastN],
  );
  return result.rows.reverse();
}

/** Recent turns for Gemini plus a compact summary of older messages in the thread. */
async function loadHistoryForGemini(conversationId, maxRecent = 10) {
  const total = await countMessages(conversationId);
  const history = await loadMessageHistory(conversationId, maxRecent);
  let memoryBlock = '';
  if (total > maxRecent) {
    const older = await loadOlderMessagesForMemory(conversationId, maxRecent);
    memoryBlock = buildMemoryBlock(older);
  }
  return { history, memoryBlock, total };
}

async function loadMessageHistory(conversationId, limit = 10) {
  const result = await db(
    `SELECT role, content FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY ${MESSAGE_ORDER_DESC}
     LIMIT $2`,
    [conversationId, limit],
  );
  return result.rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

async function listMessages(userId, conversationId, { before, limit = MESSAGES_DEFAULT_LIMIT } = {}) {
  await getConversationForUser(userId, conversationId);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || MESSAGES_DEFAULT_LIMIT, 1), 100);

  let sql;
  let params;

  if (before) {
    sql = `SELECT * FROM ai_messages
           WHERE conversation_id = $1 AND created_at < $2
           ORDER BY ${MESSAGE_ORDER_DESC}
           LIMIT $3`;
    params = [conversationId, before, safeLimit];
  } else {
    sql = `SELECT * FROM ai_messages
           WHERE conversation_id = $1
           ORDER BY ${MESSAGE_ORDER_DESC}
           LIMIT $2`;
    params = [conversationId, safeLimit];
  }

  const result = await db(sql, params);
  const messages = result.rows.reverse().map(formatMessage);
  const hasMore = result.rows.length === safeLimit;
  const nextBefore = messages.length > 0 ? messages[0].createdAt : null;

  return { messages, hasMore, nextBefore };
}

async function appendMessages(userId, conversationId, {
  userContent,
  assistantContent,
  pendingAction,
  tripContext,
}) {
  const conv = await getConversationForUser(userId, conversationId);
  const client = await getClient();

  const assistantMeta = {};
  if (pendingAction) assistantMeta.pendingAction = pendingAction;

  const newTitle = refineTitle(userContent, pendingAction, conv.title);
  const preview = buildPreview(assistantContent);
  const category = inferCategory(
    tripContext || conv.trip_context,
    pendingAction,
  );

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'user', $2, '{}', clock_timestamp())`,
      [conversationId, userContent],
    );

    const msgResult = await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'assistant', $2, $3, clock_timestamp())
       RETURNING *`,
      [conversationId, assistantContent, JSON.stringify(assistantMeta)],
    );

    await client.query(
      `UPDATE ai_conversations
       SET title = $1, preview = $2, category = $3, updated_at = NOW(),
           trip_context = COALESCE($4, trip_context)
       WHERE id = $5`,
      [
        newTitle,
        preview,
        category,
        tripContext ? JSON.stringify(tripContext) : null,
        conversationId,
      ],
    );

    await client.query('COMMIT');
    return formatMessage(msgResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function appendConfirmExchange(userId, conversationId, {
  userContent = 'Yes',
  assistantContent,
  createdResult = null,
}) {
  const assistantMeta = {};
  if (createdResult) assistantMeta.createdResult = createdResult;

  await getConversationForUser(userId, conversationId);
  const preview = buildPreview(assistantContent);
  const client = await getClient();

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'user', $2, '{}', clock_timestamp())`,
      [conversationId, userContent],
    );
    const msgResult = await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'assistant', $2, $3, clock_timestamp()) RETURNING *`,
      [conversationId, assistantContent, JSON.stringify(assistantMeta)],
    );
    await client.query(
      `UPDATE ai_conversations SET preview = $1, updated_at = NOW() WHERE id = $2`,
      [preview, conversationId],
    );
    await client.query('COMMIT');
    return formatMessage(msgResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function appendAssistantMessage(userId, conversationId, content, metadata = {}) {
  await getConversationForUser(userId, conversationId);
  const preview = buildPreview(content);

  const result = await db(
    `INSERT INTO ai_messages (conversation_id, role, content, metadata)
     VALUES ($1, 'assistant', $2, $3)
     RETURNING *`,
    [conversationId, content, JSON.stringify(metadata)],
  );

  await db(
    `UPDATE ai_conversations SET preview = $1, updated_at = NOW() WHERE id = $2`,
    [preview, conversationId],
  );

  return formatMessage(result.rows[0]);
}

module.exports = {
  CATEGORIES,
  DEFAULT_TITLE,
  formatConversation,
  formatMessage,
  titleFromFirstMessage,
  refineTitle,
  inferCategory,
  buildPreview,
  categoryFromTripContext,
  buildMemoryBlock,
  countMessages,
  loadHistoryForGemini,
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  setConversationStarred,
  loadMessageHistory,
  listMessages,
  appendMessages,
  appendConfirmExchange,
  appendAssistantMessage,
  getConversationForUser,
};
