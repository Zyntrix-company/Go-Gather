/**
 * Single source of truth for upload size / count limits.
 * Override via env (values in MB unless noted). Restart the server after changes.
 *
 * UPLOAD_PHOTO_MAX_MB              — images only: trip/event/gallery (default 15)
 * UPLOAD_VIDEO_MAX_MB              — videos: trip/event gallery (default 200)
 * UPLOAD_VIDEO_MAX_COUNT           — max videos per trip/event (default 2)
 * UPLOAD_DOC_MAX_MB                — documents (default 15)
 * UPLOAD_DOC_MAX_COUNT             — max docs per trip/event (default 50)
 * UPLOAD_DOC_MAX_BATCH             — docs per upload request (default 10)
 * UPLOAD_PHOTO_MAX_BATCH           — photos+videos per request (default 20)
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

const photoMaxBytes = envMb('UPLOAD_PHOTO_MAX_MB', 15);
const videoMaxBytes = envMb('UPLOAD_VIDEO_MAX_MB', 200);
const videoMaxCount = envInt('UPLOAD_VIDEO_MAX_COUNT', 2);
const docMaxBytes = envMb('UPLOAD_DOC_MAX_MB', 15);
const docMaxCount = envInt('UPLOAD_DOC_MAX_COUNT', 50);
const docMaxBatch = envInt('UPLOAD_DOC_MAX_BATCH', 10);
const photoMaxBatch = envInt('UPLOAD_PHOTO_MAX_BATCH', 20);
const activityPhotoMaxCount = envInt('UPLOAD_ACTIVITY_PHOTO_MAX_COUNT', 5);
const activityPhotoMaxBatch = envInt('UPLOAD_ACTIVITY_PHOTO_MAX_BATCH', 5);
const tripCreatePhotoBatch = envInt('UPLOAD_TRIP_CREATE_PHOTO_BATCH', 10);
const tripCreateDocBatch = envInt('UPLOAD_TRIP_CREATE_DOC_BATCH', 10);
const avatarMaxBytes = envMb('UPLOAD_AVATAR_MAX_MB', 10);
const promoVideoMaxBytes = envMb('UPLOAD_PROMO_VIDEO_MAX_MB', 500);
const blogImageMaxBytes = envMb('UPLOAD_BLOG_IMAGE_MAX_MB', 10);

/** Multer ceiling — must accept the largest allowed single file (video or doc). */
const mediaUploadMaxBytes = Math.max(photoMaxBytes, videoMaxBytes, docMaxBytes);

const isVideoMime = (mime) => typeof mime === 'string' && mime.startsWith('video/');

/** @type {Record<string, object>} */
const limits = {
  tripPhoto: {
    maxFileBytes: photoMaxBytes,
    maxBatchFiles: photoMaxBatch,
    maxFilesTotal: null,
  },
  tripVideo: {
    maxFileBytes: videoMaxBytes,
    maxBatchFiles: photoMaxBatch,
    maxFilesTotal: videoMaxCount,
  },
  tripDoc: {
    maxFileBytes: docMaxBytes,
    maxBatchFiles: docMaxBatch,
    maxFilesTotal: docMaxCount,
  },
  tripActivityPhoto: {
    maxFileBytes: photoMaxBytes,
    maxBatchFiles: activityPhotoMaxBatch,
    maxFilesTotal: activityPhotoMaxCount,
  },
  tripCreate: {
    maxFileBytes: mediaUploadMaxBytes,
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
  eventVideo: {
    maxFileBytes: videoMaxBytes,
    maxBatchFiles: photoMaxBatch,
    maxFilesTotal: videoMaxCount,
  },
  eventDoc: {
    maxFileBytes: docMaxBytes,
    maxBatchFiles: docMaxBatch,
    maxFilesTotal: docMaxCount,
  },
  galleryPhoto: {
    maxFileBytes: photoMaxBytes,
    maxBatchFiles: photoMaxBatch,
    maxFilesTotal: null,
  },
  galleryVideo: {
    maxFileBytes: videoMaxBytes,
    maxBatchFiles: photoMaxBatch,
    maxFilesTotal: videoMaxCount,
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

const getPublicUploadLimits = () => ({
  tripPhoto: toPublicSlice(limits.tripPhoto),
  tripVideo: toPublicSlice(limits.tripVideo),
  tripDoc: toPublicSlice(limits.tripDoc),
  tripActivityPhoto: toPublicSlice(limits.tripActivityPhoto),
  tripCreate: {
    maxPhotoBatch: limits.tripCreate.maxPhotoBatch,
    maxDocBatch: limits.tripCreate.maxDocBatch,
    maxPhotoFileBytes: photoMaxBytes,
    maxPhotoFileMB: Math.round(photoMaxBytes / MB),
    maxVideoFileBytes: videoMaxBytes,
    maxVideoFileMB: Math.round(videoMaxBytes / MB),
    maxDocFileBytes: docMaxBytes,
    maxDocFileMB: Math.round(docMaxBytes / MB),
  },
  eventPhoto: toPublicSlice(limits.eventPhoto),
  eventVideo: toPublicSlice(limits.eventVideo),
  eventDoc: toPublicSlice(limits.eventDoc),
  galleryPhoto: toPublicSlice(limits.galleryPhoto),
  galleryVideo: toPublicSlice(limits.galleryVideo),
  avatar: toPublicSlice(limits.avatar),
  promoVideo: toPublicSlice(limits.promoVideo),
  blogImage: toPublicSlice(limits.blogImage),
  docMaxCount,
  videoMaxCount,
});

module.exports = {
  limits,
  docMaxBytes,
  docMaxCount,
  docMaxBatch,
  photoMaxBytes,
  videoMaxBytes,
  videoMaxCount,
  mediaUploadMaxBytes,
  avatarMaxBytes,
  promoVideoMaxBytes,
  blogImageMaxBytes,
  isVideoMime,
  formatMb,
  getPublicUploadLimits,
};
