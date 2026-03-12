const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { s3Client } = require('../config/aws');
const config = require('../config');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * Multer instance configured to upload directly to AWS S3.
 * Files are stored under   avatars/<uuid><ext>   in the bucket.
 */
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: config.s3.bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (_req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const key = `avatars/${uuidv4()}${ext}`;
      cb(null, key);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Only JPEG, PNG, WebP, and GIF images are allowed');
      err.statusCode = 400;
      err.error = 'InvalidFileType';
      cb(err, false);
    }
  },
});

module.exports = upload;
