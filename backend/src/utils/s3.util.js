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
 * Upload a buffer directly to S3.
 * @param {Buffer} buffer
 * @param {string} key   - Full S3 object key
 * @param {string} mimeType
 * @returns {Promise<string>} - Public or CDN URL
 */
const uploadToS3 = async (buffer, key, mimeType) => {
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ACL: 'public-read',
  });

  await s3Client.send(command);
  logger.info('S3 upload successful', { key });

  // If CloudFront configured, return CDN URL; else S3 URL
  if (config.s3.cloudfrontDomain) {
    return `https://${config.s3.cloudfrontDomain}/${key}`;
  }
  return `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
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
