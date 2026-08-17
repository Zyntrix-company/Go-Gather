const sharp = require('sharp');
const logger = require('./logger');
const { query: db } = require('../config/database');

// HEIC/HEIF deliberately excluded: prebuilt sharp binaries don't reliably
// include a HEVC decoder (licensing), so we leave those untouched rather
// than risk a silent no-op or a decode failure on every request.
const COMPRESSIBLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 82;
const PNG_COMPRESSION_LEVEL = 8;
const WEBP_QUALITY = 82;

/**
 * Resize + re-encode an image buffer to cut storage size, keeping its format.
 * Never throws — falls back to the original buffer for unsupported types,
 * decode failures, or when the "compressed" output isn't actually smaller,
 * since a broken upload is worse than a missed compression opportunity.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<{ buffer: Buffer, compressed: boolean, originalBytes: number, finalBytes: number }>}
 */
const compressImageIfPossible = async (buffer, mimeType) => {
  const originalBytes = buffer.length;

  if (!COMPRESSIBLE_MIME_TYPES.has(mimeType)) {
    return { buffer, compressed: false, originalBytes, finalBytes: originalBytes };
  }

  try {
    let pipeline = sharp(buffer, { failOn: 'none' })
      .rotate() // bake in EXIF orientation, then strip metadata by default
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });

    if (mimeType === 'image/jpeg') {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    } else if (mimeType === 'image/png') {
      pipeline = pipeline.png({ compressionLevel: PNG_COMPRESSION_LEVEL });
    } else if (mimeType === 'image/webp') {
      pipeline = pipeline.webp({ quality: WEBP_QUALITY });
    }

    // Fresh copy, not sharp's own output buffer directly — the AWS SDK's
    // request-checksum signing has been observed to choke on some native
    // addons' buffer backing stores, so hand it a plain, newly-allocated one.
    const output = Buffer.from(await pipeline.toBuffer());

    if (output.length >= originalBytes) {
      return { buffer, compressed: false, originalBytes, finalBytes: originalBytes };
    }

    return { buffer: output, compressed: true, originalBytes, finalBytes: output.length };
  } catch (err) {
    logger.warn('Image compression failed, uploading original', { mimeType, error: err.message });
    return { buffer, compressed: false, originalBytes, finalBytes: originalBytes };
  }
};

/**
 * Fire-and-forget running total of real compression savings, so the admin
 * dashboard can show an actual measured number instead of a guessed one.
 * Callers should only invoke this once the compressed buffer has actually
 * been persisted (e.g. after a successful S3 upload) — never on compression
 * success alone, since a subsequent upload failure would leave nothing
 * actually stored. Never awaited — a stats-tracking hiccup must never slow
 * down or fail an upload.
 */
const recordCompressionStats = (originalBytes, finalBytes) => {
  db(
    `UPDATE image_compression_stats
     SET images_compressed = images_compressed + 1,
         original_bytes = original_bytes + $1,
         final_bytes = final_bytes + $2,
         updated_at = NOW()
     WHERE id = 1`,
    [originalBytes, finalBytes],
  ).catch((err) => logger.warn('Failed to record compression stats', { error: err.message }));
};

/**
 * Cumulative compression savings across every image compressed so far.
 * @returns {Promise<{ imagesCompressed: number, originalBytes: number, finalBytes: number, savedPercent: number|null }>}
 */
const getCompressionStats = async () => {
  const result = await db('SELECT images_compressed, original_bytes, final_bytes FROM image_compression_stats WHERE id = 1');
  const row = result.rows[0] || { images_compressed: 0, original_bytes: 0, final_bytes: 0 };
  const imagesCompressed = Number(row.images_compressed);
  const originalBytes = Number(row.original_bytes);
  const finalBytes = Number(row.final_bytes);
  return {
    imagesCompressed,
    originalBytes,
    finalBytes,
    savedPercent: originalBytes > 0 ? Math.round((1 - finalBytes / originalBytes) * 100) : null,
  };
};

module.exports = { compressImageIfPossible, recordCompressionStats, getCompressionStats, COMPRESSIBLE_MIME_TYPES };
