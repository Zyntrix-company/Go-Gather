const { query: db } = require('../../../config/database');
const { uploadToS3, deleteFromS3, sanitiseFilename, getPresignedDownloadUrl } = require('../../../utils/s3.util');
const config = require('../../../config');
const { v4: uuidv4 } = require('uuid');

const uploadPhotos = async ({ parentType, parentId }, userId, files, { activityId = null } = {}) => {
  const uploaded = [];

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
      `INSERT INTO photos (parent_type, parent_id, uploaded_by, file_url, s3_key, mime_type, activity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [parentType, parentId, userId, fileUrl, s3Key, file.mimetype, activityId],
    );
    // Generate presigned URL (1hr) so the client can display the photo immediately
    const presignedUrl = await getPresignedDownloadUrl(s3Key);
    // activity_title not available on INSERT RETURNING — set null; GET endpoint joins it
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
     ORDER BY ph.created_at DESC
     LIMIT $3 OFFSET $4`,
    [parentType, parentId, safLimit, offset],
  );

  const total = result.rows[0]?.total_count || 0;
  const photos = await Promise.all(
    result.rows.map(async (row) => {
      const presignedUrl = await getPresignedDownloadUrl(row.s3_key);
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

  if (photo.uploaded_by !== requesterId && requesterRole !== 'admin') {
    const e = new Error('Only the uploader or an admin can delete this photo');
    e.statusCode = 403; e.error = 'FORBIDDEN'; throw e;
  }

  await deleteFromS3(photo.s3_key);
  await db('DELETE FROM photos WHERE id = $1', [photoId]);
};

const formatPhoto = (p, presignedUrl) => ({
  id: p.id,
  parentType: p.parent_type,
  parentId: p.parent_id,
  activityId: p.activity_id || null,
  activityTitle: p.activity_title || null,
  uploadedBy: p.uploaded_by,
  uploaderName: p.uploader_name || null,
  fileUrl: p.file_url,              // permanent CDN/S3 URL (use for storing in DB)
  url: presignedUrl || p.file_url,  // presigned URL (1hr) preferred for display
  caption: p.caption,
  mimeType: p.mime_type,
  createdAt: p.created_at,
});

module.exports = { uploadPhotos, getPhotos, deletePhoto };
