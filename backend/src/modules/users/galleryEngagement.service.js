const db = require('../../config/database');
const { notifyGalleryLiked, notifyGalleryComment } = require('./galleryEngagementNotifications');
const { verifyViewerAccess } = require('./galleryOverlay.service');
const galleryAlbumsService = require('./galleryAlbums.service');

const PARENT_TYPE_GALLERY_ALBUM = 'gallery_album';

const isMember = async (userId, parentType, parentId) => {
  if (parentType === 'trip') {
    const result = await db.query(
      'SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2',
      [parentId, userId],
    );
    return result.rowCount > 0;
  }
  if (parentType === 'event') {
    const result = await db.query(
      'SELECT 1 FROM event_members WHERE event_id = $1 AND user_id = $2',
      [parentId, userId],
    );
    return result.rowCount > 0;
  }
  return false;
};

const verifyEngagementAccess = async (userId, parentType, parentId, { galleryOwnerId } = {}) => {
  if (parentType === PARENT_TYPE_GALLERY_ALBUM) {
    const album = await galleryAlbumsService.getAlbumById(parentId);
    if (album.user_id === userId) return;
    await verifyViewerAccess(userId, album.user_id);
    return;
  }

  if (!['trip', 'event'].includes(parentType)) {
    const e = new Error('Invalid parent type');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  if (await isMember(userId, parentType, parentId)) return;

  if (galleryOwnerId) {
    if (!(await isMember(galleryOwnerId, parentType, parentId))) {
      const e = new Error('Gallery owner is not a member of this trip/event');
      e.statusCode = 403;
      e.error = 'FORBIDDEN';
      throw e;
    }
    await verifyViewerAccess(userId, galleryOwnerId);
    return;
  }

  const e = new Error('Not authorized to engage with this gallery item');
  e.statusCode = 403;
  e.error = 'FORBIDDEN';
  throw e;
};

const canModerateComment = async (userId, parentType, parentId) => {
  if (parentType === PARENT_TYPE_GALLERY_ALBUM) {
    const album = await galleryAlbumsService.getAlbumById(parentId);
    return album.user_id === userId;
  }
  if (parentType === 'trip' || parentType === 'event') {
    return isMember(userId, parentType, parentId);
  }
  return false;
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

const fetchUserDisplay = async (userId) => {
  const userResult = await db.query(
    `SELECT COALESCE(p.full_name, u.username, 'Traveler') AS user_name,
            p.avatar_url AS avatar_url
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  return userResult.rows[0];
};

const getEngagement = async (userId, parentType, parentId, { galleryOwnerId } = {}) => {
  await verifyEngagementAccess(userId, parentType, parentId, { galleryOwnerId });

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
              COALESCE(p.full_name, u.username, 'Traveler') AS user_name,
              p.avatar_url AS avatar_url
       FROM gallery_item_comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
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

const toggleLike = async (userId, parentType, parentId, { galleryOwnerId } = {}) => {
  await verifyEngagementAccess(userId, parentType, parentId, { galleryOwnerId });

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
  notifyGalleryLiked(userId, parentType, parentId);
  return { liked: true };
};

const addComment = async (userId, parentType, parentId, text, { galleryOwnerId } = {}) => {
  await verifyEngagementAccess(userId, parentType, parentId, { galleryOwnerId });

  const clean = (text ?? '').trim();
  if (!clean || clean.length > 30) {
    const e = new Error('Comment must be 1–30 characters');
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

  const profile = await fetchUserDisplay(userId);

  const comment = formatComment({
    ...result.rows[0],
    user_name: profile?.user_name,
    avatar_url: profile?.avatar_url,
  });

  notifyGalleryComment(userId, parentType, parentId, clean, comment.id);
  return comment;
};

const updateComment = async (userId, commentId, text) => {
  const clean = (text ?? '').trim();
  if (!clean || clean.length > 30) {
    const e = new Error('Comment must be 1–30 characters');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  const existing = await db.query(
    `SELECT id, user_id, parent_type, parent_id, text, created_at, updated_at
     FROM gallery_item_comments WHERE id = $1`,
    [commentId],
  );

  if (existing.rowCount === 0) {
    const e = new Error('Comment not found');
    e.statusCode = 404;
    e.error = 'NOT_FOUND';
    throw e;
  }

  const row = existing.rows[0];
  if (row.user_id !== userId) {
    const e = new Error('Comment not found');
    e.statusCode = 404;
    e.error = 'NOT_FOUND';
    throw e;
  }

  await verifyEngagementAccess(userId, row.parent_type, row.parent_id);

  const result = await db.query(
    `UPDATE gallery_item_comments
     SET text = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, user_id, text, created_at, updated_at, parent_type, parent_id`,
    [clean, commentId, userId],
  );

  const profile = await fetchUserDisplay(userId);

  return formatComment({
    ...result.rows[0],
    user_name: profile?.user_name,
    avatar_url: profile?.avatar_url,
  });
};

const deleteComment = async (userId, commentId) => {
  const existing = await db.query(
    `SELECT id, user_id, parent_type, parent_id FROM gallery_item_comments WHERE id = $1`,
    [commentId],
  );

  if (existing.rowCount === 0) {
    const e = new Error('Comment not found');
    e.statusCode = 404;
    e.error = 'NOT_FOUND';
    throw e;
  }

  const row = existing.rows[0];
  const isAuthor = row.user_id === userId;
  const isModerator = await canModerateComment(userId, row.parent_type, row.parent_id);

  if (!isAuthor && !isModerator) {
    const e = new Error('Comment not found');
    e.statusCode = 404;
    e.error = 'NOT_FOUND';
    throw e;
  }

  await db.query('DELETE FROM gallery_item_comments WHERE id = $1', [commentId]);
  return { success: true };
};

module.exports = {
  getEngagement,
  toggleLike,
  addComment,
  updateComment,
  deleteComment,
  PARENT_TYPE_GALLERY_ALBUM,
};
