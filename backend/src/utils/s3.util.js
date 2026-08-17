const {
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../config/aws');
const config = require('../config');
const logger = require('./logger');
const { compressImageIfPossible, recordCompressionStats } = require('./imageCompression.util');

/**
 * Sanitise a filename: strip special chars, replace spaces with hyphens.
 * @param {string} filename
 * @returns {string}
 */
const sanitiseFilename = (filename) => {
  return filename
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-_]/g, '')
    .replace(/-+/g, '-');
};

/**
 * Upload a buffer directly to S3. Images (JPEG/PNG/WebP) are transparently
 * resized/re-encoded first to cut storage size — see imageCompression.util.
 * @param {Buffer} buffer
 * @param {string} key   - Full S3 object key
 * @param {string} mimeType
 * @returns {Promise<{ url: string, finalBytes: number, compressed: boolean }>}
 */
const uploadToS3 = async (buffer, key, mimeType, extras = {}) => {
  const { buffer: uploadBuffer, compressed, originalBytes, finalBytes } = await compressImageIfPossible(buffer, mimeType);
  if (compressed) {
    logger.info('Image compressed before upload', {
      key, originalBytes, finalBytes,
      savedPercent: Math.round((1 - finalBytes / originalBytes) * 100),
    });
  }

  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: uploadBuffer,
    ContentType: mimeType,
    // SSE-S3 keeps CloudFront OAC working regardless of bucket-level KMS defaults.
    // Without this, a bucket default of SSE-KMS causes CloudFront to return 403 for
    // new objects (OAC lacks kms:Decrypt) while old SSE-S3 objects continue to load
    // from FastImage's immutable cache — exactly the "old photos fine, new ones broken" symptom.
    ServerSideEncryption: 'AES256',
    // CloudFront forwards Cache-Control from S3 origin to the client. cacheControl.web in
    // FastImage (iOS: NSURLSession, Android: OkHttp) respects this header and caches
    // immutably in the OS HTTP cache after the first successful load.
    CacheControl: 'public, max-age=31536000, immutable',
    ...extras,
  });

  await s3Client.send(command);
  logger.info('S3 upload successful', { key });

  // Only counted once the compressed bytes are actually persisted — a stats
  // bump for a compression that never made it to S3 would be a phantom saving.
  if (compressed) {
    recordCompressionStats(originalBytes, finalBytes);
  }

  // If CloudFront configured, return CDN URL; else S3 URL
  const url = config.s3.cloudfrontDomain
    ? `https://${config.s3.cloudfrontDomain}/${key}`
    : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;

  return { url, finalBytes, compressed };
};

/**
 * Delete a single S3 object.
 * @param {string} key
 */
const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    });
    await s3Client.send(command);
    logger.info('S3 object deleted', { key });
  } catch (error) {
    logger.error('Failed to delete S3 object', { key, error: error.message });
    throw error;
  }
};

/**
 * Batch-delete multiple S3 objects (up to 1000 at a time).
 * @param {string[]} keys
 */
const batchDeleteFromS3 = async (keys) => {
  if (!keys || keys.length === 0) return;

  // S3 deleteObjects supports max 1000 per request
  const chunks = [];
  for (let i = 0; i < keys.length; i += 1000) {
    chunks.push(keys.slice(i, i + 1000));
  }

  for (const chunk of chunks) {
    try {
      const command = new DeleteObjectsCommand({
        Bucket: config.s3.bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      });
      await s3Client.send(command);
      logger.info('S3 batch delete successful', { count: chunk.length });
    } catch (error) {
      logger.error('Failed to batch delete S3 objects', { error: error.message });
      throw error;
    }
  }
};

/**
 * Generate a pre-signed download URL (default 1-hour expiry).
 * @param {string} key
 * @param {number} [expiresInSeconds=3600]
 * @returns {Promise<string>}
 */
const getPresignedDownloadUrl = async (key, expiresInSeconds = 3600) => {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

module.exports = {
  sanitiseFilename,
  uploadToS3,
  deleteFromS3,
  batchDeleteFromS3,
  getPresignedDownloadUrl,
};
