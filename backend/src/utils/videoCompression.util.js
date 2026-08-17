const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const logger = require('./logger');
const { query: db } = require('../config/database');
const { uploadToS3 } = require('./s3.util');

// webm intentionally excluded for now — only the mime types trip/event/gallery
// video uploads actually accept (see PHOTO_ALLOWED_TYPES in upload.middleware.js).
const COMPRESSIBLE_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime']);

const MAX_VIDEO_DIMENSION = 1920;
const VIDEO_CRF = 27;
const VIDEO_PRESET = 'veryfast';
const AUDIO_BITRATE = '128k';

const cleanupQuiet = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch {
    // best-effort cleanup only — a leftover temp file must never fail the caller
  }
};

/**
 * Re-encode a video buffer to cut storage size (H.264/AAC, capped at 1080p).
 * Never throws — falls back to the original buffer for unsupported types,
 * transcode failures, or when the "compressed" output isn't actually smaller,
 * since a broken upload is worse than a missed compression opportunity.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<{ buffer: Buffer, compressed: boolean, originalBytes: number, finalBytes: number }>}
 */
const compressVideoIfPossible = async (buffer, mimeType) => {
  const originalBytes = buffer.length;

  if (!COMPRESSIBLE_VIDEO_MIME_TYPES.has(mimeType)) {
    return { buffer, compressed: false, originalBytes, finalBytes: originalBytes };
  }

  const tmpDir = os.tmpdir();
  const jobId = randomUUID();
  const inputPath = path.join(tmpDir, `${jobId}-in.mp4`);
  const outputPath = path.join(tmpDir, `${jobId}-out.mp4`);

  try {
    await fs.writeFile(inputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .outputOptions([
          `-crf ${VIDEO_CRF}`,
          `-preset ${VIDEO_PRESET}`,
          // Bounding box, not a single-axis cap — caps whichever side is larger,
          // so portrait (phone-shot vertical) video gets capped correctly too.
          // force_divisible_by=2 keeps dimensions even, required for H.264 4:2:0.
          `-vf scale=w=${MAX_VIDEO_DIMENSION}:h=${MAX_VIDEO_DIMENSION}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
          '-movflags +faststart',
        ])
        .audioCodec('aac')
        .audioBitrate(AUDIO_BITRATE)
        .on('error', reject)
        .on('end', resolve)
        .save(outputPath);
    });

    const output = await fs.readFile(outputPath);

    if (output.length >= originalBytes) {
      return { buffer, compressed: false, originalBytes, finalBytes: originalBytes };
    }

    return { buffer: output, compressed: true, originalBytes, finalBytes: output.length };
  } catch (err) {
    logger.warn('Video compression failed, uploading original', { mimeType, error: err.message });
    return { buffer, compressed: false, originalBytes, finalBytes: originalBytes };
  } finally {
    await cleanupQuiet(inputPath);
    await cleanupQuiet(outputPath);
  }
};

/**
 * Fire-and-forget running total of real compression savings, so the admin
 * dashboard can show an actual measured number instead of a guessed one.
 * Only call once the compressed buffer has actually replaced the S3 object.
 */
const recordVideoCompressionStats = (originalBytes, finalBytes) => {
  db(
    `UPDATE video_compression_stats
     SET videos_compressed = videos_compressed + 1,
         original_bytes = original_bytes + $1,
         final_bytes = final_bytes + $2,
         updated_at = NOW()
     WHERE id = 1`,
    [originalBytes, finalBytes],
  ).catch((err) => logger.warn('Failed to record video compression stats', { error: err.message }));
};

/**
 * Cumulative video compression savings across every video compressed so far.
 * @returns {Promise<{ videosCompressed: number, originalBytes: number, finalBytes: number, savedPercent: number|null }>}
 */
const getVideoCompressionStats = async () => {
  const result = await db('SELECT videos_compressed, original_bytes, final_bytes FROM video_compression_stats WHERE id = 1');
  const row = result.rows[0] || { videos_compressed: 0, original_bytes: 0, final_bytes: 0 };
  const videosCompressed = Number(row.videos_compressed);
  const originalBytes = Number(row.original_bytes);
  const finalBytes = Number(row.final_bytes);
  return {
    videosCompressed,
    originalBytes,
    finalBytes,
    savedPercent: originalBytes > 0 ? Math.round((1 - finalBytes / originalBytes) * 100) : null,
  };
};

/**
 * Compress an already-uploaded video in the background and, if smaller,
 * overwrite the S3 object in place.
 *
 * Runs AFTER the original upload has already completed and the API has
 * responded — never awaited by the caller, so a slow transcode (or ffmpeg
 * being unavailable) can never slow down or fail an upload. The original,
 * already-persisted S3 object is the safe fallback at every step here.
 * @param {{ buffer: Buffer, s3Key: string, mimeType: string, onReplaced?: (finalBytes: number) => Promise<void>|void }} opts
 *   onReplaced — optional hook to update a caller-specific DB row's stored
 *   size once the smaller object is live in S3 (e.g. photos.file_size_bytes).
 *   Not every caller has a size column to update (promo_video doesn't), so
 *   this stays a plain callback rather than a hardcoded query.
 */
const compressAndReplaceVideoAsync = async ({ buffer, s3Key, mimeType, onReplaced }) => {
  try {
    const { buffer: compressedBuffer, compressed, originalBytes, finalBytes } =
      await compressVideoIfPossible(buffer, mimeType);

    if (!compressed) return;

    await uploadToS3(compressedBuffer, s3Key, mimeType);

    if (onReplaced) await onReplaced(finalBytes);

    logger.info('Video compressed and replaced in S3', {
      s3Key, originalBytes, finalBytes,
      savedPercent: Math.round((1 - finalBytes / originalBytes) * 100),
    });

    recordVideoCompressionStats(originalBytes, finalBytes);
  } catch (err) {
    logger.warn('Background video compression failed, original stays in place', {
      s3Key, error: err.message,
    });
  }
};

module.exports = {
  compressVideoIfPossible,
  recordVideoCompressionStats,
  getVideoCompressionStats,
  compressAndReplaceVideoAsync,
  COMPRESSIBLE_VIDEO_MIME_TYPES,
};
