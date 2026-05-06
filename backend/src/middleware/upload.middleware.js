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
  // MS Office modern (OOXML / ZIP-based)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  // MS Office legacy (OLE2)
  'application/msword',                 // .doc
  'application/vnd.ms-excel',           // .xls
  'application/vnd.ms-powerpoint',      // .ppt
  // Plain text
  'text/plain',  // .txt
  'text/csv',    // .csv
];

// Magic-bytes MIME validation — trusts buffer, not Content-Type header.
// Types with no defined magic (text/plain, text/csv) skip byte-level check.
const MIME_MAGIC = {
  'image/jpeg':      [0xFF, 0xD8, 0xFF],
  'image/png':       [0x89, 0x50, 0x4E, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  // OOXML formats are ZIP archives
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':  [0x50, 0x4B, 0x03, 0x04], // PK
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':        [0x50, 0x4B, 0x03, 0x04],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':[0x50, 0x4B, 0x03, 0x04],
  // OLE2 legacy Office formats
  'application/msword':           [0xD0, 0xCF, 0x11, 0xE0],
  'application/vnd.ms-excel':     [0xD0, 0xCF, 0x11, 0xE0],
  'application/vnd.ms-powerpoint':[0xD0, 0xCF, 0x11, 0xE0],
};

const validateMimeFromBuffer = (buffer, expectedMime) => {
  const magic = MIME_MAGIC[expectedMime];
  if (!magic) return true; // no magic defined (e.g. text/plain, text/csv) — skip byte check
  if (!buffer || buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
};

const createDocUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: DOC_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (DOC_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Invalid file type. Allowed: JPEG, PNG, PDF, Word, Excel, PowerPoint, TXT, CSV (max 15 MB)');
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

// ── Trip creation upload (photos + docs in one request) ───────
// Accepts both media files (field: "photos") and documents (field: "docs").
// Per-fieldname MIME validation — rejects unknown field names silently.
const createTripFilesUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: PHOTO_MAX_SIZE }, // 50 MB ceiling covers both photos and docs
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'photos') {
      if (PHOTO_ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const err = new Error('Photos must be JPEG, PNG, HEIC, MP4, or MOV (max 50 MB each)');
        err.statusCode = 400;
        err.error = 'INVALID_FILE_TYPE';
        cb(err, false);
      }
    } else if (file.fieldname === 'docs') {
      if (DOC_ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const err = new Error('Documents must be PDF, Word, Excel, PowerPoint, TXT, or CSV (max 15 MB)');
        err.statusCode = 400;
        err.error = 'INVALID_FILE_TYPE';
        cb(err, false);
      }
    } else {
      cb(null, false); // ignore unknown field names
    }
  },
});

// ── Blog image upload (JPEG, PNG, WebP — 10 MB max) ──────────
const BLOG_IMAGE_MAX_SIZE = 10 * MB;
const BLOG_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const createBlogImageUpload = () => multer({
  storage: memoryStorage,
  limits: { fileSize: BLOG_IMAGE_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (BLOG_IMAGE_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Blog images must be JPEG, PNG, or WebP (max 10 MB)');
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

module.exports = {
  docUpload,
  photoUpload,
  avatarUpload,
  activityPhotoUpload,
  tripFilesUpload,
  blogImageUpload,
  handleMulterError,
  validateMimeFromBuffer,
};
