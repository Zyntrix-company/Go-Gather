const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const config = require('../../config');
const { uploadToS3, deleteFromS3, sanitiseFilename, getPresignedDownloadUrl } = require('../../utils/s3.util');

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

const formatPhoto = async (row) => ({
  id: row.id,
  fileUrl: row.file_url,
  url: await formatPhotoUrl(row.file_url, row.s3_key),
  mimeType: row.mime_type,
  activityId: row.activity_id || null,
  activityTitle: row.activity_title || null,
  source: row.source,
  createdAt: row.created_at,
});

/**
 * Curated album photos for a user's gallery presentation.
 */
const getCuratedAlbumPhotos = async (targetUserId, parentType, parentId, viewerId) => {
  if (!['trip', 'event'].includes(parentType)) {
    const e = new Error('parentType must be trip or event');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  await verifyMembership(targetUserId, parentType, parentId);
  await verifyViewerAccess(viewerId, targetUserId);

  const [sharedResult, extraResult] = await Promise.all([
    db.query(
      `SELECT ph.id, ph.file_url, ph.s3_key, ph.mime_type, ph.activity_id,
              ph.created_at, ta.title AS activity_title, 'shared' AS source
       FROM photos ph
       LEFT JOIN trip_activities ta ON ta.id = ph.activity_id
       WHERE ph.parent_type = $1 AND ph.parent_id = $2
         AND ph.id NOT IN (
           SELECT photo_id FROM user_gallery_hidden_photos WHERE user_id = $3
         )
       ORDER BY ph.created_at DESC`,
      [parentType, parentId, targetUserId],
    ),
    db.query(
      `SELECT id, file_url, s3_key, mime_type, NULL AS activity_id,
              NULL AS activity_title, created_at, 'extra' AS source
       FROM user_gallery_extra_photos
       WHERE user_id = $1 AND parent_type = $2 AND parent_id = $3
       ORDER BY created_at DESC`,
      [targetUserId, parentType, parentId],
    ),
  ]);

  const merged = [...sharedResult.rows, ...extraResult.rows]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const photos = await Promise.all(merged.map(formatPhoto));
  return { photos, total: photos.length };
};

const getCuratedPhotoCount = async (userId, parentType, parentId) => {
  const result = await db.query(
    `SELECT (
       (SELECT COUNT(*)::int FROM photos ph
        WHERE ph.parent_type = $2 AND ph.parent_id = $3
          AND ph.id NOT IN (
            SELECT photo_id FROM user_gallery_hidden_photos WHERE user_id = $1
          ))
       +
       (SELECT COUNT(*)::int FROM user_gallery_extra_photos
        WHERE user_id = $1 AND parent_type = $2 AND parent_id = $3)
     ) AS count`,
    [userId, parentType, parentId],
  );
  return result.rows[0]?.count ?? 0;
};

const hideSharedPhoto = async (userId, parentType, parentId, photoId) => {
  await verifyMembership(userId, parentType, parentId);

  const photoCheck = await db.query(
    `SELECT id FROM photos
     WHERE id = $1 AND parent_type = $2 AND parent_id = $3`,
    [photoId, parentType, parentId],
  );
  if (photoCheck.rowCount === 0) {
    const e = new Error('Photo not found');
    e.statusCode = 404;
    e.error = 'NOT_FOUND';
    throw e;
  }

  await db.query(
    `INSERT INTO user_gallery_hidden_photos (user_id, photo_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, photo_id) DO NOTHING`,
    [userId, photoId],
  );

  return { success: true };
};

const uploadExtraPhotos = async (userId, parentType, parentId, files) => {
  await verifyMembership(userId, parentType, parentId);

  const uploaded = [];
  for (const file of files) {
    const safeName = sanitiseFilename(file.originalname || 'photo.jpg');
    const s3Key = `users/${userId}/gallery/${parentType}/${parentId}/${uuidv4()}-${safeName}`;
    await uploadToS3(file.buffer, s3Key, file.mimetype);

    const fileUrl = config.s3.cloudfrontDomain
      ? `https://${config.s3.cloudfrontDomain}/${s3Key}`
      : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${s3Key}`;

    const result = await db.query(
      `INSERT INTO user_gallery_extra_photos
         (user_id, parent_type, parent_id, file_url, s3_key, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, file_url, s3_key, mime_type, created_at`,
      [userId, parentType, parentId, fileUrl, s3Key, file.mimetype],
    );

    const row = result.rows[0];
    uploaded.push(await formatPhoto({
      ...row,
      activity_id: null,
      activity_title: null,
      source: 'extra',
    }));
  }

  return { photos: uploaded };
};

const importExtraPhotoFromBuffer = async (userId, parentType, parentId, buffer, mimeType, fileName) => {
  await verifyMembership(userId, parentType, parentId);

  const safeName = sanitiseFilename(fileName || 'photo.jpg');
  const s3Key = `users/${userId}/gallery/${parentType}/${parentId}/${uuidv4()}-${safeName}`;
  await uploadToS3(buffer, s3Key, mimeType);

  const fileUrl = config.s3.cloudfrontDomain
    ? `https://${config.s3.cloudfrontDomain}/${s3Key}`
    : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${s3Key}`;

  const result = await db.query(
    `INSERT INTO user_gallery_extra_photos
       (user_id, parent_type, parent_id, file_url, s3_key, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, file_url, s3_key, mime_type, created_at`,
    [userId, parentType, parentId, fileUrl, s3Key, mimeType],
  );

  const row = result.rows[0];
  return formatPhoto({
    ...row,
    activity_id: null,
    activity_title: null,
    source: 'extra',
  });
};

const deleteExtraPhoto = async (userId, photoId) => {
  const result = await db.query(
    `SELECT * FROM user_gallery_extra_photos WHERE id = $1 AND user_id = $2`,
    [photoId, userId],
  );
  if (result.rowCount === 0) {
    const e = new Error('Photo not found');
    e.statusCode = 404;
    e.error = 'NOT_FOUND';
    throw e;
  }

  const row = result.rows[0];
  await deleteFromS3(row.s3_key);
  await db.query('DELETE FROM user_gallery_extra_photos WHERE id = $1', [photoId]);
  return { success: true };
};

module.exports = {
  getCuratedAlbumPhotos,
  getCuratedPhotoCount,
  hideSharedPhoto,
  uploadExtraPhotos,
  importExtraPhotoFromBuffer,
  deleteExtraPhoto,
};
