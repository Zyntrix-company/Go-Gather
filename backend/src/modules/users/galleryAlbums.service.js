const db = require('../../config/database');
const config = require('../../config');
const sharedPhotos = require('../shared/photos/photos.service');
const { deleteFromS3, getPresignedDownloadUrl } = require('../../utils/s3.util');

const PARENT_TYPE = 'gallery_album';

const presignBanner = async (rawUrl) => {
  if (!rawUrl) return null;
  const cloudfrontDomain = config.s3?.cloudfrontDomain;
  try {
    const hostname = new URL(rawUrl).hostname;
    if (cloudfrontDomain && hostname === cloudfrontDomain) return rawUrl;
    if (hostname.endsWith('.amazonaws.com')) {
      const key = new URL(rawUrl).pathname.replace(/^\//, '');
      return key ? await getPresignedDownloadUrl(key) : rawUrl;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
};

const formatAlbumRow = async (row) => ({
  id: row.id,
  name: row.name,
  bannerImageUrl: await presignBanner(row.banner_image_url),
  gallerySubtitle: row.subtitle ?? null,
  photoCount: row.photoCount ?? 0,
  section: row.section,
  isCustom: true,
});

/**
 * List custom albums for a user's gallery grid or archived list.
 */
const listAlbumsForUser = async (userId, { archived = false } = {}) => {
  const archivedClause = archived
    ? 'AND a.archived_at IS NOT NULL'
    : 'AND a.archived_at IS NULL';

  const result = await db.query(
    `SELECT
       a.id,
       a.name,
       a.section,
       a.banner_image_url,
       a.subtitle,
       a.archived_at,
       (SELECT COUNT(*)::int FROM photos p
        WHERE p.parent_type = 'gallery_album' AND p.parent_id = a.id) AS "photoCount"
     FROM user_gallery_albums a
     WHERE a.user_id = $1
       ${archivedClause}
     ORDER BY ${archived ? 'a.archived_at DESC' : 'a.created_at DESC'}
     LIMIT 100`,
    [userId],
  );

  const formatted = await Promise.all(result.rows.map(formatAlbumRow));
  const trip = formatted.filter((a) => a.section === 'trip');
  const event = formatted.filter((a) => a.section === 'event');
  return { trip, event };
};

const getAlbumById = async (albumId) => {
  const result = await db.query(
    `SELECT a.*,
       (SELECT COUNT(*)::int FROM photos p
        WHERE p.parent_type = 'gallery_album' AND p.parent_id = a.id) AS "photoCount"
     FROM user_gallery_albums a
     WHERE a.id = $1`,
    [albumId],
  );
  if (result.rows.length === 0) {
    const err = new Error('Gallery album not found');
    err.statusCode = 404;
    err.error = 'NOT_FOUND';
    throw err;
  }
  return result.rows[0];
};

const assertAlbumOwner = async (albumId, userId) => {
  const album = await getAlbumById(albumId);
  if (album.user_id !== userId) {
    const err = new Error('You do not own this gallery album');
    err.statusCode = 403;
    err.error = 'FORBIDDEN';
    throw err;
  }
  return album;
};

const createAlbum = async (userId, { name, section, subtitle }) => {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    const err = new Error('Album name is required');
    err.statusCode = 400;
    throw err;
  }
  if (!['trip', 'event'].includes(section)) {
    const err = new Error('section must be trip or event');
    err.statusCode = 400;
    throw err;
  }

  const result = await db.query(
    `INSERT INTO user_gallery_albums (user_id, section, name, subtitle)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, section, cleanName, subtitle?.trim() || null],
  );

  const row = result.rows[0];
  return formatAlbumRow({ ...row, photoCount: 0 });
};

const updateAlbum = async (userId, albumId, { name, subtitle, bannerImageUrl }) => {
  await assertAlbumOwner(albumId, userId);

  const fields = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      const err = new Error('Album name cannot be empty');
      err.statusCode = 400;
      throw err;
    }
    fields.push(`name = $${i++}`);
    values.push(cleanName);
  }
  if (subtitle !== undefined) {
    fields.push(`subtitle = $${i++}`);
    values.push(subtitle?.trim() || null);
  }
  if (bannerImageUrl !== undefined) {
    fields.push(`banner_image_url = $${i++}`);
    values.push(bannerImageUrl || null);
  }

  if (fields.length === 0) {
    return formatAlbumRow(await getAlbumById(albumId));
  }

  fields.push('updated_at = NOW()');
  values.push(albumId, userId);
  const idParam = i++;
  const userParam = i;

  await db.query(
    `UPDATE user_gallery_albums
     SET ${fields.join(', ')}
     WHERE id = $${idParam} AND user_id = $${userParam}`,
    values,
  );

  return formatAlbumRow(await getAlbumById(albumId));
};

const archiveAlbum = async (userId, albumId) => {
  await assertAlbumOwner(albumId, userId);
  await db.query(
    `UPDATE user_gallery_albums SET archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [albumId],
  );
  return { archived: true };
};

const unarchiveAlbum = async (userId, albumId) => {
  await assertAlbumOwner(albumId, userId);
  await db.query(
    `UPDATE user_gallery_albums SET archived_at = NULL, updated_at = NOW() WHERE id = $1`,
    [albumId],
  );
  return { archived: false };
};

const deleteAlbum = async (userId, albumId) => {
  const album = await assertAlbumOwner(albumId, userId);

  const photosResult = await db.query(
    `SELECT id, s3_key FROM photos WHERE parent_type = $1 AND parent_id = $2`,
    [PARENT_TYPE, albumId],
  );

  for (const ph of photosResult.rows) {
    if (ph.s3_key) {
      try {
        await deleteFromS3(ph.s3_key);
      } catch {
        /* best effort */
      }
    }
  }

  await db.query(
    `DELETE FROM photos WHERE parent_type = $1 AND parent_id = $2`,
    [PARENT_TYPE, albumId],
  );
  await db.query(
    `DELETE FROM gallery_item_likes WHERE parent_type = $1 AND parent_id = $2`,
    [PARENT_TYPE, albumId],
  );
  await db.query(
    `DELETE FROM gallery_item_comments WHERE parent_type = $1 AND parent_id = $2`,
    [PARENT_TYPE, albumId],
  );
  await db.query('DELETE FROM user_gallery_albums WHERE id = $1', [albumId]);

  return { deleted: true, id: album.id };
};

const getAlbumPhotos = async (albumId) => {
  await getAlbumById(albumId);
  return sharedPhotos.getPhotos({ parentType: PARENT_TYPE, parentId: albumId }, { page: 1, limit: 500 });
};

const uploadAlbumPhotos = async (userId, albumId, files) => {
  await assertAlbumOwner(albumId, userId);
  const photos = await sharedPhotos.uploadPhotos(
    { parentType: PARENT_TYPE, parentId: albumId },
    userId,
    files,
  );
  return { photos };
};

const deleteAlbumPhoto = async (userId, albumId, photoId) => {
  await assertAlbumOwner(albumId, userId);
  await sharedPhotos.deletePhoto({
    photoId,
    parentType: PARENT_TYPE,
    parentId: albumId,
    requesterId: userId,
    requesterRole: 'admin',
  });
  return { success: true };
};

/**
 * Viewer may load photos if album belongs to targetUser (friend gallery read-only).
 */
const getAlbumPhotosForProfile = async (targetUserId, albumId) => {
  const album = await getAlbumById(albumId);
  if (album.user_id !== targetUserId) {
    const err = new Error('Album does not belong to this user');
    err.statusCode = 404;
    err.error = 'NOT_FOUND';
    throw err;
  }
  return getAlbumPhotos(albumId);
};

module.exports = {
  listAlbumsForUser,
  createAlbum,
  updateAlbum,
  archiveAlbum,
  unarchiveAlbum,
  deleteAlbum,
  getAlbumById,
  assertAlbumOwner,
  getAlbumPhotos,
  getAlbumPhotosForProfile,
  uploadAlbumPhotos,
  deleteAlbumPhoto,
  PARENT_TYPE,
};
