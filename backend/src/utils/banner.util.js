const { query: db } = require('../config/database');
const logger = require('./logger');
const config = require('../config');
const { getPresignedDownloadUrl } = require('./s3.util');

// Generic photo used when no category keyword matches.
const FALLBACK_BANNER = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80';

/**
 * Match free-text against category keywords and return the best photo URL.
 * Priority: keyword match > FALLBACK_BANNER
 */
async function resolveBannerUrl(text) {
  try {
    const result = await db(
      "SELECT keywords, photo_urls FROM categories WHERE array_length(photo_urls, 1) > 0",
    );
    const categories = result.rows;
    if (!categories.length) return FALLBACK_BANNER;

    const lower = (text || '').toLowerCase();
    let bestScore = 0;
    let bestUrl = null;

    for (const cat of categories) {
      const score = cat.keywords.reduce(
        (acc, kw) => acc + (lower.includes(kw.toLowerCase()) ? 1 : 0),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestUrl = cat.photo_urls[0];
      }
    }

    return bestUrl || FALLBACK_BANNER;
  } catch (err) {
    logger.warn('resolveBannerUrl failed, using fallback', { error: err.message });
    return FALLBACK_BANNER;
  }
}

/**
 * A banner stored in our own bucket needs a presigned URL to be viewable; any other
 * URL (Unsplash, etc.) passes through. Never throws.
 */
async function presignOwnBanner(rawUrl) {
  if (!rawUrl) return null;
  try {
    const { hostname, pathname } = new URL(rawUrl);
    const ours =
      (config.s3.cloudfrontDomain && hostname === config.s3.cloudfrontDomain) ||
      (config.s3.bucket && hostname.startsWith(config.s3.bucket));
    if (!ours) return rawUrl;
    const key = pathname.replace(/^\//, '');
    return key ? await getPresignedDownloadUrl(key) : rawUrl;
  } catch {
    return rawUrl;
  }
}

module.exports = { FALLBACK_BANNER, resolveBannerUrl, presignOwnBanner };
