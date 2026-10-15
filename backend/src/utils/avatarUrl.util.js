const config = require('../config');

/**
 * Turns a stored profile avatar_url into one a client can actually load:
 * drops the malformed "https://undefined" values and rewrites legacy direct-S3 URLs
 * (including expired presigned ones) to the CloudFront domain.
 */
const normalizeAvatarUrl = (rawAvatarUrl) => {
  if (!rawAvatarUrl || rawAvatarUrl.includes('https://undefined')) return null;
  const cf = config.s3?.cloudfrontDomain;
  if (cf && rawAvatarUrl.includes('.amazonaws.com/')) {
    try {
      const key = new URL(rawAvatarUrl).pathname.replace(/^\//, '');
      if (key) return `https://${cf}/${key}`;
    } catch { /* fall through to the original */ }
  }
  return rawAvatarUrl;
};

module.exports = { normalizeAvatarUrl };
