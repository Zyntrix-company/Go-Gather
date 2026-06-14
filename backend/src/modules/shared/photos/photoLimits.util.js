const { query: db } = require('../../../config/database');
const {
  photoMaxBytes,
  videoMaxBytes,
  videoMaxCount,
  isVideoMime,
  formatMb,
} = require('../../../config/uploadLimits');

/**
 * Validate photo/video size and video count before S3 upload.
 * Activity uploads: images only, photo size cap.
 */
const assertPhotoVideoUploadAllowed = async (
  { parentType, parentId },
  files,
  { activityId = null } = {},
) => {
  if (!files?.length) return;

  if (activityId) {
    for (const file of files) {
      if (isVideoMime(file.mimetype)) {
        const e = new Error('Activity photos must be JPEG, PNG, or HEIC (videos not allowed)');
        e.statusCode = 400;
        e.error = 'INVALID_FILE_TYPE';
        throw e;
      }
      const size = file.size ?? file.buffer?.length ?? 0;
      if (size > photoMaxBytes) {
        const e = new Error(`Photos must be ${formatMb(photoMaxBytes)} or smaller`);
        e.statusCode = 400;
        e.error = 'FILE_TOO_LARGE';
        throw e;
      }
    }
    return;
  }

  const incomingVideos = files.filter((f) => isVideoMime(f.mimetype));
  if (incomingVideos.length > 0) {
    const countResult = await db(
      `SELECT COUNT(*)::int AS count FROM photos
       WHERE parent_type = $1 AND parent_id = $2
         AND mime_type LIKE 'video/%'`,
      [parentType, parentId],
    );
    const existingVideos = countResult.rows[0]?.count ?? 0;
    if (existingVideos + incomingVideos.length > videoMaxCount) {
      const e = new Error(
        `Maximum ${videoMaxCount} video${videoMaxCount === 1 ? '' : 's'} allowed per ${parentType}. `
        + `You have ${existingVideos}; tried to add ${incomingVideos.length}.`,
      );
      e.statusCode = 400;
      e.error = 'MAX_VIDEOS_EXCEEDED';
      e.limit = videoMaxCount;
      e.current = existingVideos;
      throw e;
    }
  }

  for (const file of files) {
    const size = file.size ?? file.buffer?.length ?? 0;
    const maxBytes = isVideoMime(file.mimetype) ? videoMaxBytes : photoMaxBytes;
    const label = isVideoMime(file.mimetype) ? 'Videos' : 'Photos';
    if (size > maxBytes) {
      const e = new Error(`${label} must be ${formatMb(maxBytes)} or smaller`);
      e.statusCode = 400;
      e.error = 'FILE_TOO_LARGE';
      throw e;
    }
  }
};

module.exports = { assertPhotoVideoUploadAllowed };
