const multer = require('multer');

const MB = 1024 * 1024;

// ── Memory storage (buffer → S3 directly, never disk) ─────────
const memoryStorage = multer.memoryStorage();

// ── Docs upload ───────────────────────────────────────────────
const DOC_MAX_SIZE = 15 * MB; // 15 MB
const DOC_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
];

// Magic-bytes MIME validation — trusts buffer, not Content-Type header
const MIME_MAGIC = {
  'image/jpeg':      [0xFF, 0xD8, 0xFF],
  'image/png':       [0x89, 0x50, 0x4E, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
};

const validateMimeFromBuffer = (buffer, expectedMime) => {
  const magic = MIME_MAGIC[expectedMime];
  if (!magic || !buffer || buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
};

const createDocUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: DOC_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (DOC_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Docs must be JPEG, PNG, or PDF (max 15 MB)');
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

// ── Photos upload ─────────────────────────────────────────────
const PHOTO_MAX_SIZE = 50 * MB; // 50 MB
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
  limits: { fileSize: PHOTO_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Photos must be JPEG, PNG, HEIC, MP4, or MOV (max 50 MB each)');
      err.statusCode = 400;
      err.error = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

// ── Avatar upload (re-export existing config's behaviour) ─────
const AVATAR_MAX_SIZE = 10 * MB;
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const createAvatarUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: AVATAR_MAX_SIZE },
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

// Multer error handler — converts MulterError to ApiError shape
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

// Activity photos reuse the same config as trip photos
const createActivityPhotoUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: PHOTO_MAX_SIZE },
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

const docUpload = createDocUpload();
const photoUpload = createPhotoUpload();
const avatarUpload = createAvatarUpload();
const activityPhotoUpload = createActivityPhotoUpload();

module.exports = {
  docUpload,
  photoUpload,
  avatarUpload,
  activityPhotoUpload,
  handleMulterError,
  validateMimeFromBuffer,
};
