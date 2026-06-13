const db = require('../../config/database');

const verifyMembership = async (userId, parentType, parentId) => {
  const memberCheck = parentType === 'trip'
    ? await db.query('SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2', [parentId, userId])
    : await db.query('SELECT 1 FROM event_members WHERE event_id = $1 AND user_id = $2', [parentId, userId]);

  if (memberCheck.rowCount === 0) {
    const e = new Error('Not a member of this trip/event');
    e.statusCode = 403;
    e.error = 'FORBIDDEN';
    throw e;
  }
};

const formatComment = (row) => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  avatarUrl: row.avatar_url,
  text: row.text,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getEngagement = async (userId, parentType, parentId) => {
  await verifyMembership(userId, parentType, parentId);

  const [likesResult, likedResult, commentsResult] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS count FROM gallery_item_likes
       WHERE parent_type = $1 AND parent_id = $2`,
      [parentType, parentId],
    ),
    db.query(
      `SELECT 1 FROM gallery_item_likes
       WHERE parent_type = $1 AND parent_id = $2 AND user_id = $3`,
      [parentType, parentId, userId],
    ),
    db.query(
      `SELECT c.id, c.user_id, c.text, c.created_at, c.updated_at,
              COALESCE(u.full_name, u.username, 'Traveler') AS user_name,
              u.photo_url AS avatar_url
       FROM gallery_item_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.parent_type = $1 AND c.parent_id = $2
       ORDER BY c.created_at ASC
       LIMIT 100`,
      [parentType, parentId],
    ),
  ]);

  return {
    likeCount: likesResult.rows[0]?.count ?? 0,
    likedByMe: likedResult.rowCount > 0,
    comments: commentsResult.rows.map(formatComment),
  };
};

const toggleLike = async (userId, parentType, parentId) => {
  await verifyMembership(userId, parentType, parentId);

  const existing = await db.query(
    `SELECT 1 FROM gallery_item_likes
     WHERE parent_type = $1 AND parent_id = $2 AND user_id = $3`,
    [parentType, parentId, userId],
  );

  if (existing.rowCount > 0) {
    await db.query(
      `DELETE FROM gallery_item_likes
       WHERE parent_type = $1 AND parent_id = $2 AND user_id = $3`,
      [parentType, parentId, userId],
    );
    return { liked: false };
  }

  await db.query(
    `INSERT INTO gallery_item_likes (parent_type, parent_id, user_id)
     VALUES ($1, $2, $3)`,
    [parentType, parentId, userId],
  );
  return { liked: true };
};

const addComment = async (userId, parentType, parentId, text) => {
  await verifyMembership(userId, parentType, parentId);

  const clean = (text ?? '').trim();
  if (!clean || clean.length > 20) {
    const e = new Error('Comment must be 1–20 characters');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  const result = await db.query(
    `INSERT INTO gallery_item_comments (parent_type, parent_id, user_id, text)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, text, created_at, updated_at`,
    [parentType, parentId, userId, clean],
  );

  const userResult = await db.query(
    `SELECT COALESCE(full_name, username, 'Traveler') AS user_name, photo_url AS avatar_url
     FROM users WHERE id = $1`,
    [userId],
  );

  return formatComment({
    ...result.rows[0],
    user_name: userResult.rows[0]?.user_name,
    avatar_url: userResult.rows[0]?.avatar_url,
  });
};

const updateComment = async (userId, commentId, text) => {
  const clean = (text ?? '').trim();
  if (!clean || clean.length > 20) {
    const e = new Error('Comment must be 1–20 characters');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  const result = await db.query(
    `UPDATE gallery_item_comments
     SET text = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, user_id, text, created_at, updated_at, parent_type, parent_id`,
    [clean, commentId, userId],
  );

  if (result.rowCount === 0) {
    const e = new Error('Comment not found');
    e.statusCode = 404;
    e.error = 'NOT_FOUND';
    throw e;
  }

  const row = result.rows[0];
  await verifyMembership(userId, row.parent_type, row.parent_id);

  const userResult = await db.query(
    `SELECT COALESCE(full_name, username, 'Traveler') AS user_name, photo_url AS avatar_url
     FROM users WHERE id = $1`,
    [userId],
  );

  return formatComment({
    ...row,
    user_name: userResult.rows[0]?.user_name,
    avatar_url: userResult.rows[0]?.avatar_url,
  });
};

const deleteComment = async (userId, commentId) => {
  const result = await db.query(
    `DELETE FROM gallery_item_comments
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [commentId, userId],
  );

  if (result.rowCount === 0) {
    const e = new Error('Comment not found');
    e.statusCode = 404;
    e.error = 'NOT_FOUND';
    throw e;
  }

  return { success: true };
};

module.exports = {
  getEngagement,
  toggleLike,
  addComment,
  updateComment,
  deleteComment,
};
