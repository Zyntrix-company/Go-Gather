const multer = require('multer');
const {
  limits,
  docMaxBytes,
  photoMaxBytes,
  avatarMaxBytes,
  promoVideoMaxBytes,
  blogImageMaxBytes,
  formatMb,
} = require('../config/uploadLimits');

// ── Memory storage (buffer → S3 directly, never disk) ─────────
const memoryStorage = multer.memoryStorage();

// ── Docs upload ───────────────────────────────────────────────
const DOC_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
];

const MIME_MAGIC = {
  'image/jpeg':      [0xFF, 0xD8, 0xFF],
  'image/png':       [0x89, 0x50, 0x4E, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':  [0x50, 0x4B, 0x03, 0x04],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':        [0x50, 0x4B, 0x03, 0x04],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':[0x50, 0x4B, 0x03, 0x04],
  'application/msword':           [0xD0, 0xCF, 0x11, 0xE0],
  'application/vnd.ms-excel':     [0xD0, 0xCF, 0x11, 0xE0],
  'application/vnd.ms-powerpoint':[0xD0, 0xCF, 0x11, 0xE0],
};

const validateMimeFromBuffer = (buffer, expectedMime) => {
  const magic = MIME_MAGIC[expectedMime];
  if (!magic) return true;
  if (!buffer || buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
};

const createDocUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: docMaxBytes },
  fileFilter: (_req, file, cb) => {
    if (DOC_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Invalid file type. Allowed: JPEG, PNG, PDF, Word, Excel, PowerPoint, TXT, CSV (max ${formatMb(docMaxBytes)})`);
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

const PHOTO_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
];

const createPhotoUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: photoMaxBytes },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Photos must be JPEG, PNG, HEIC, MP4, or MOV (max ${formatMb(photoMaxBytes)} each)`);
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const createAvatarUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: avatarMaxBytes },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Avatar must be JPEG, PNG, WebP, or GIF');
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

const handleMulterError = (err, _req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'FILE_TOO_LARGE',
      message: 'Uploaded file exceeds the maximum allowed size',
      statusCode: 400,
    });
  }
  if (err && (err.error === 'INVALID_FILE_TYPE' || err.statusCode === 400)) {
    return res.status(400).json({
      error: 'INVALID_FILE_TYPE',
      message: err.message,
      statusCode: 400,
    });
  }
  next(err);
};

const createActivityPhotoUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: limits.tripActivityPhoto.maxFileBytes },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Activity photos must be JPEG, PNG, or HEIC');
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

const createTripFilesUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: Math.max(photoMaxBytes, docMaxBytes) },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'photos') {
      if (PHOTO_ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const err = new Error(`Photos must be JPEG, PNG, HEIC, MP4, or MOV (max ${formatMb(photoMaxBytes)} each)`);
        err.statusCode = 400;
        err.error = 'INVALID_FILE_TYPE';
        cb(err, false);
      }
    } else if (file.fieldname === 'docs') {
      if (DOC_ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const err = new Error(`Documents must be PDF, Word, Excel, PowerPoint, TXT, or CSV (max ${formatMb(docMaxBytes)})`);
        err.statusCode = 400;
        err.error = 'INVALID_FILE_TYPE';
        cb(err, false);
      }
    } else {
      cb(null, false);
    }
  },
});

const BLOG_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const createBlogImageUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: blogImageMaxBytes },
  fileFilter: (_req, file, cb) => {
    if (BLOG_IMAGE_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Blog images must be JPEG, PNG, or WebP (max ${formatMb(blogImageMaxBytes)})`);
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

const PROMO_VIDEO_ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

const createPromoVideoUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: promoVideoMaxBytes },
  fileFilter: (_req, file, cb) => {
    if (PROMO_VIDEO_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Promo video must be MP4, MOV, or WebM (max ${formatMb(promoVideoMaxBytes)})`);
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

const createDealImageUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: blogImageMaxBytes },
  fileFilter: (_req, file, cb) => {
    if (BLOG_IMAGE_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Deal images must be JPEG, PNG, or WebP (max ${formatMb(blogImageMaxBytes)})`);
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

const docUpload = createDocUpload();
const photoUpload = createPhotoUpload();
const avatarUpload = createAvatarUpload();
const activityPhotoUpload = createActivityPhotoUpload();
const tripFilesUpload = createTripFilesUpload();
const blogImageUpload = createBlogImageUpload();
const dealImageUpload = createDealImageUpload();
const promoVideoUpload = createPromoVideoUpload();

module.exports = {
  docUpload,
  photoUpload,
  avatarUpload,
  activityPhotoUpload,
  tripFilesUpload,
  blogImageUpload,
  dealImageUpload,
  promoVideoUpload,
  handleMulterError,
  validateMimeFromBuffer,
};
