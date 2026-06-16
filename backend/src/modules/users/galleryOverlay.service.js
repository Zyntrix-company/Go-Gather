const db = require('../../config/database');
const config = require('../../config');
const { getPresignedDownloadUrl } = require('../../utils/s3.util');
const sharedPhotos = require('../shared/photos/photos.service');

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

const verifyViewerAccess = async (viewerId, targetUserId) => {
  if (viewerId === targetUserId) return;

  const blockCheck = await db.query(
    `SELECT 1 FROM friend_connections
     WHERE requester_id = $1 AND addressee_id = $2 AND status = 'blocked'`,
    [targetUserId, viewerId],
  );
  if (blockCheck.rowCount > 0) {
    const e = new Error('Profile not available');
    e.statusCode = 403;
    e.error = 'BLOCKED';
    throw e;
  }

  const friendCheck = await db.query(
    `SELECT 1 FROM friend_connections
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
    [viewerId, targetUserId],
  );
  if (friendCheck.rowCount === 0) {
    const e = new Error('You must be friends to view this gallery');
    e.statusCode = 403;
    e.error = 'FORBIDDEN';
    throw e;
  }
};

const formatPhotoUrl = async (fileUrl, s3Key) => {
  const cloudfrontDomain = config.s3?.cloudfrontDomain;
  const presignedUrl = cloudfrontDomain ? null : await getPresignedDownloadUrl(s3Key);
  return presignedUrl || fileUrl;
};

const formatGalleryPhoto = async (row) => ({
  id: row.id,
  fileUrl: row.file_url,
  url: await formatPhotoUrl(row.file_url, row.s3_key),
  mimeType: row.mime_type,
  activityId: row.activity_id || null,
  activityTitle: row.activity_title || null,
  displayOrder: row.display_order ?? 0,
  createdAt: row.created_at,
});

const TRIP_PHOTOS_QUERY = `SELECT ph.id, ph.file_url, ph.s3_key, ph.mime_type, ph.activity_id,
                  ph.display_order, ph.created_at, ta.title AS activity_title
           FROM photos ph
           LEFT JOIN trip_activities ta ON ta.id = ph.activity_id
           WHERE ph.parent_type = $1 AND ph.parent_id = $2
           ORDER BY
             CASE WHEN ph.activity_id IS NULL THEN 0 ELSE 1 END ASC,
             ta.activity_date ASC NULLS LAST,
             ta.activity_time ASC NULLS LAST,
             ph.display_order ASC,
             ph.created_at ASC`;

const EVENT_PHOTOS_QUERY = `SELECT ph.id, ph.file_url, ph.s3_key, ph.mime_type, ph.activity_id,
                  ph.display_order, ph.created_at, ta.title AS activity_title
           FROM photos ph
           LEFT JOIN trip_activities ta ON ta.id = ph.activity_id
           WHERE ph.parent_type = $1 AND ph.parent_id = $2
           ORDER BY ph.display_order ASC, ph.created_at ASC`;

/**
 * Shared album photos for a trip/event gallery (identical for all members).
 */
const getSharedAlbumPhotos = async (targetUserId, parentType, parentId, viewerId) => {
  if (!['trip', 'event'].includes(parentType)) {
    const e = new Error('parentType must be trip or event');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  await verifyMembership(targetUserId, parentType, parentId);
  await verifyViewerAccess(viewerId, targetUserId);

  const query = parentType === 'trip' ? TRIP_PHOTOS_QUERY : EVENT_PHOTOS_QUERY;
  const result = await db.query(query, [parentType, parentId]);

  const photos = await Promise.all(result.rows.map(formatGalleryPhoto));
  return { photos, total: photos.length };
};

const getSharedPhotoCount = async (parentType, parentId) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM photos
     WHERE parent_type = $1 AND parent_id = $2`,
    [parentType, parentId],
  );
  return result.rows[0]?.count ?? 0;
};

module.exports = {
  verifyViewerAccess,
  verifyMembership,
  getSharedAlbumPhotos,
  getSharedPhotoCount,
  // Legacy aliases used during transition
  getCuratedAlbumPhotos: getSharedAlbumPhotos,
  getCuratedPhotoCount: (_userId, parentType, parentId) => getSharedPhotoCount(parentType, parentId),
};
