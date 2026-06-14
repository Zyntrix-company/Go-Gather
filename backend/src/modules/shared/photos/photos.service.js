const { query: db, getClient } = require('../../../config/database');
const { uploadToS3, deleteFromS3, sanitiseFilename, getPresignedDownloadUrl } = require('../../../utils/s3.util');
const config = require('../../../config');
const { v4: uuidv4 } = require('uuid');
const { assertPhotoVideoUploadAllowed } = require('./photoLimits.util');

const getNextDisplayOrder = async ({ parentType, parentId, activityId = null }) => {
  const result = await db(
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
     FROM photos
     WHERE parent_type = $1 AND parent_id = $2
       AND activity_id IS NOT DISTINCT FROM $3`,
    [parentType, parentId, activityId],
  );
  return result.rows[0]?.next_order ?? 0;
};

const uploadPhotos = async ({ parentType, parentId }, userId, files, { activityId = null } = {}) => {
  await assertPhotoVideoUploadAllowed({ parentType, parentId }, files, { activityId });

  const uploaded = [];
  let nextOrder = await getNextDisplayOrder({ parentType, parentId, activityId });

  for (const file of files) {
    const safeName = sanitiseFilename(file.originalname);
    const s3Key = activityId
      ? `${parentType}s/${parentId}/activities/${activityId}/${uuidv4()}-${safeName}`
      : `${parentType}s/${parentId}/photos/${uuidv4()}-${safeName}`;

    await uploadToS3(file.buffer, s3Key, file.mimetype);

    const fileUrl = config.s3.cloudfrontDomain
      ? `https://${config.s3.cloudfrontDomain}/${s3Key}`
      : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${s3Key}`;

    const result = await db(
      `INSERT INTO photos (parent_type, parent_id, uploaded_by, file_url, s3_key, mime_type, activity_id, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [parentType, parentId, userId, fileUrl, s3Key, file.mimetype, activityId, nextOrder],
    );
    nextOrder += 1;
    const presignedUrl = config.s3.cloudfrontDomain ? null : await getPresignedDownloadUrl(s3Key);
    uploaded.push(formatPhoto({ ...result.rows[0], activity_title: null }, presignedUrl));
  }

  return uploaded;
};

const getPhotos = async ({ parentType, parentId }, { page = 1, limit = 30 } = {}) => {
  const safLimit = Math.min(limit, 100);
  const offset = (page - 1) * safLimit;

  const result = await db(
    `SELECT ph.*, p.full_name AS uploader_name, ta.title AS activity_title,
            COUNT(*) OVER()::int AS total_count
     FROM photos ph
     LEFT JOIN profiles p ON p.user_id = ph.uploaded_by
     LEFT JOIN trip_activities ta ON ta.id = ph.activity_id
     WHERE ph.parent_type = $1 AND ph.parent_id = $2
     ORDER BY ph.display_order ASC, ph.created_at ASC
     LIMIT $3 OFFSET $4`,
    [parentType, parentId, safLimit, offset],
  );

  const total = result.rows[0]?.total_count || 0;
  const photos = await Promise.all(
    result.rows.map(async (row) => {
      const presignedUrl = config.s3.cloudfrontDomain ? null : await getPresignedDownloadUrl(row.s3_key);
      return formatPhoto(row, presignedUrl);
    }),
  );
  return { photos, total, page, limit: safLimit };
};

const deletePhoto = async ({ photoId, parentType, parentId, requesterId, requesterRole }) => {
  const photoResult = await db(
    'SELECT * FROM photos WHERE id = $1 AND parent_type = $2 AND parent_id = $3',
    [photoId, parentType, parentId],
  );
  if (photoResult.rowCount === 0) {
    const e = new Error('Photo not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const photo = photoResult.rows[0];

  await deleteFromS3(photo.s3_key);
  await db('DELETE FROM photos WHERE id = $1', [photoId]);
};

/**
 * Batch reorder photos within a scope.
 * @param {{ parentType: string, parentId: string, activityId?: string|null, items: { id: string, displayOrder: number }[] }} opts
 * activityId undefined = all photos for parent; null = trip/event-level only; uuid = activity scope
 */
const reorderPhotos = async ({ parentType, parentId, activityId, items }) => {
  if (!items?.length) {
    const e = new Error('At least one item is required');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  const ids = items.map((i) => i.id);
  let scopeWhere;
  let scopeParams;

  if (activityId === null) {
    scopeWhere = 'parent_type = $1 AND parent_id = $2 AND activity_id IS NULL';
    scopeParams = [parentType, parentId];
  } else if (activityId) {
    scopeWhere = 'parent_type = $1 AND parent_id = $2 AND activity_id = $3';
    scopeParams = [parentType, parentId, activityId];
  } else {
    scopeWhere = 'parent_type = $1 AND parent_id = $2';
    scopeParams = [parentType, parentId];
  }

  const idsParam = `$${scopeParams.length + 1}`;
  const existing = await db(
    `SELECT id FROM photos WHERE ${scopeWhere} AND id = ANY(${idsParam}::uuid[])`,
    [...scopeParams, ids],
  );

  if (existing.rowCount !== ids.length) {
    const e = new Error('One or more photos not found in this scope');
    e.statusCode = 400;
    e.error = 'VALIDATION_ERROR';
    throw e;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      if (activityId === null) {
        await client.query(
          `UPDATE photos SET display_order = $1
           WHERE id = $2 AND parent_type = $3 AND parent_id = $4 AND activity_id IS NULL`,
          [item.displayOrder, item.id, parentType, parentId],
        );
      } else if (activityId) {
        await client.query(
          `UPDATE photos SET display_order = $1
           WHERE id = $2 AND parent_type = $3 AND parent_id = $4 AND activity_id = $5`,
          [item.displayOrder, item.id, parentType, parentId, activityId],
        );
      } else {
        await client.query(
          `UPDATE photos SET display_order = $1
           WHERE id = $2 AND parent_type = $3 AND parent_id = $4`,
          [item.displayOrder, item.id, parentType, parentId],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { success: true };
};

const formatPhoto = (p, presignedUrl) => ({
  id: p.id,
  parentType: p.parent_type,
  parentId: p.parent_id,
  activityId: p.activity_id || null,
  activityTitle: p.activity_title || null,
  uploadedBy: p.uploaded_by,
  uploaderName: p.uploader_name || null,
  fileUrl: p.file_url,
  url: presignedUrl || p.file_url,
  caption: p.caption,
  mimeType: p.mime_type,
  displayOrder: p.display_order ?? 0,
  createdAt: p.created_at,
});

module.exports = { uploadPhotos, getPhotos, deletePhoto, reorderPhotos, formatPhoto };
