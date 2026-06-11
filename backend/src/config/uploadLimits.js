/**
 * Single source of truth for upload size / count limits.
 * Override via env (values in MB unless noted). Restart the server after changes.
 *
 * UPLOAD_PHOTO_MAX_MB              — trip/event/gallery photos & videos (default 100)
 * UPLOAD_DOC_MAX_MB                — trip/event documents (default 50)
 * UPLOAD_DOC_MAX_COUNT             — max docs per trip/event (default 50)
 * UPLOAD_PHOTO_MAX_BATCH           — photos per request: trip/event/gallery (default 20)
 * UPLOAD_ACTIVITY_PHOTO_MAX_COUNT  — max photos per activity (default 5)
 * UPLOAD_ACTIVITY_PHOTO_MAX_BATCH  — activity photos per request (default 5)
 * UPLOAD_TRIP_CREATE_PHOTO_BATCH   — multipart trip create photos (default 10)
 * UPLOAD_TRIP_CREATE_DOC_BATCH     — multipart trip create docs (default 10)
 * UPLOAD_AVATAR_MAX_MB             — profile photo (default 10)
 * UPLOAD_PROMO_VIDEO_MAX_MB        — admin promo video (default 500)
 * UPLOAD_BLOG_IMAGE_MAX_MB         — admin blog/deal images (default 10)
 */

const MB = 1024 * 1024;

const envInt = (name, fallback) => {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const envMb = (name, fallbackMb) => envInt(name, fallbackMb) * MB;

const photoMaxBytes = envMb('UPLOAD_PHOTO_MAX_MB', 100);
const docMaxBytes = envMb('UPLOAD_DOC_MAX_MB', 50);
const docMaxCount = envInt('UPLOAD_DOC_MAX_COUNT', 50);
const photoMaxBatch = envInt('UPLOAD_PHOTO_MAX_BATCH', 20);
const activityPhotoMaxCount = envInt('UPLOAD_ACTIVITY_PHOTO_MAX_COUNT', 5);
const activityPhotoMaxBatch = envInt('UPLOAD_ACTIVITY_PHOTO_MAX_BATCH', 5);
const tripCreatePhotoBatch = envInt('UPLOAD_TRIP_CREATE_PHOTO_BATCH', 10);
const tripCreateDocBatch = envInt('UPLOAD_TRIP_CREATE_DOC_BATCH', 10);
const avatarMaxBytes = envMb('UPLOAD_AVATAR_MAX_MB', 10);
const promoVideoMaxBytes = envMb('UPLOAD_PROMO_VIDEO_MAX_MB', 500);
const blogImageMaxBytes = envMb('UPLOAD_BLOG_IMAGE_MAX_MB', 10);

/** @typedef {{ maxFileBytes: number, maxBatchFiles: number, maxFilesTotal: number | null }} UploadLimitSlice */

/** @type {Record<string, UploadLimitSlice>} */
const limits = {
  tripPhoto: {
    maxFileBytes: photoMaxBytes,
    maxBatchFiles: photoMaxBatch,
    maxFilesTotal: null,
  },
  tripDoc: {
    maxFileBytes: docMaxBytes,
    maxBatchFiles: 1,
    maxFilesTotal: docMaxCount,
  },
  tripActivityPhoto: {
    maxFileBytes: photoMaxBytes,
    maxBatchFiles: activityPhotoMaxBatch,
    maxFilesTotal: activityPhotoMaxCount,
  },
  tripCreate: {
    maxFileBytes: Math.max(photoMaxBytes, docMaxBytes),
    maxBatchFiles: tripCreatePhotoBatch,
    maxFilesTotal: null,
    maxPhotoBatch: tripCreatePhotoBatch,
    maxDocBatch: tripCreateDocBatch,
  },
  eventPhoto: {
    maxFileBytes: photoMaxBytes,
    maxBatchFiles: photoMaxBatch,
    maxFilesTotal: null,
  },
  eventDoc: {
    maxFileBytes: docMaxBytes,
    maxBatchFiles: 1,
    maxFilesTotal: docMaxCount,
  },
  galleryPhoto: {
    maxFileBytes: photoMaxBytes,
    maxBatchFiles: photoMaxBatch,
    maxFilesTotal: null,
  },
  avatar: {
    maxFileBytes: avatarMaxBytes,
    maxBatchFiles: 1,
    maxFilesTotal: 1,
  },
  promoVideo: {
    maxFileBytes: promoVideoMaxBytes,
    maxBatchFiles: 1,
    maxFilesTotal: 1,
  },
  blogImage: {
    maxFileBytes: blogImageMaxBytes,
    maxBatchFiles: 1,
    maxFilesTotal: null,
  },
};

const formatMb = (bytes) => `${Math.round(bytes / MB)} MB`;

const toPublicSlice = (slice) => ({
  maxFileBytes: slice.maxFileBytes,
  maxFileMB: Math.round(slice.maxFileBytes / MB),
  maxBatchFiles: slice.maxBatchFiles,
  maxFilesTotal: slice.maxFilesTotal,
  maxModuleBytes: slice.maxFilesTotal != null
    ? slice.maxFilesTotal * slice.maxFileBytes
    : null,
});

/**
 * Public payload for GET /config/upload-limits (mobile + admin clients).
 */
const getPublicUploadLimits = () => ({
  tripPhoto: toPublicSlice(limits.tripPhoto),
  tripDoc: toPublicSlice(limits.tripDoc),
  tripActivityPhoto: toPublicSlice(limits.tripActivityPhoto),
  tripCreate: {
    maxPhotoBatch: limits.tripCreate.maxPhotoBatch,
    maxDocBatch: limits.tripCreate.maxDocBatch,
    maxPhotoFileBytes: photoMaxBytes,
    maxPhotoFileMB: Math.round(photoMaxBytes / MB),
    maxDocFileBytes: docMaxBytes,
    maxDocFileMB: Math.round(docMaxBytes / MB),
  },
  eventPhoto: toPublicSlice(limits.eventPhoto),
  eventDoc: toPublicSlice(limits.eventDoc),
  galleryPhoto: toPublicSlice(limits.galleryPhoto),
  avatar: toPublicSlice(limits.avatar),
  promoVideo: toPublicSlice(limits.promoVideo),
  blogImage: toPublicSlice(limits.blogImage),
  docMaxCount,
});

module.exports = {
  limits,
  docMaxBytes,
  docMaxCount,
  photoMaxBytes,
  avatarMaxBytes,
  promoVideoMaxBytes,
  blogImageMaxBytes,
  formatMb,
  getPublicUploadLimits,
};
