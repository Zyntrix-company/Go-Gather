const { query: db } = require('../../config/database');

const PAGE_LIMIT = 20;

/**
 * Fetch paginated notifications for the authenticated user, newest first.
 * Returns the list, total count, unread count, and whether more pages exist.
 */
const getNotifications = async (userId, page = 1) => {
  const offset = (page - 1) * PAGE_LIMIT;

  const [listResult, countResult] = await Promise.all([
    db(
      `SELECT id, type, title, body, data, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, PAGE_LIMIT, offset],
    ),
    db(
      `SELECT
         COUNT(*)::int                                      AS total,
         COUNT(*) FILTER (WHERE read = false)::int         AS unread_count
       FROM notifications
       WHERE user_id = $1`,
      [userId],
    ),
  ]);

  const { total, unread_count: unreadCount } = countResult.rows[0];

  return {
    notifications: listResult.rows,
    total,
    unreadCount,
    page,
    hasMore: offset + listResult.rows.length < total,
  };
};

/**
 * Return just the unread count — used for the tab badge.
 */
const getUnreadCount = async (userId) => {
  const result = await db(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE user_id = $1 AND read = false`,
    [userId],
  );
  return result.rows[0].unread_count;
};

/**
 * Mark a single notification as read. Verifies ownership.
 */
const markRead = async (userId, notificationId) => {
  const result = await db(
    `UPDATE notifications
     SET read = true
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId],
  );
  if (result.rows.length === 0) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  return { id: result.rows[0].id };
};

/**
 * Mark all of the user's notifications as read.
 */
const markAllRead = async (userId) => {
  const result = await db(
    `UPDATE notifications
     SET read = true
     WHERE user_id = $1 AND read = false`,
    [userId],
  );
  return { updated: result.rowCount };
};

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
