const express = require('express');
const { query } = require('../../config/database');
const config = require('../../config');

const router = express.Router();

// GET /promo-video — public, returns current promotional video URL (null if none set)
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT video_url, s3_key FROM promo_video WHERE id = 1');
    if (!rows.length) return res.json({ videoUrl: null });

    let { video_url, s3_key } = rows[0];

    // If CloudFront is configured and the stored URL is a direct S3 URL, rewrite it
    // to the CloudFront domain so the OAC-protected bucket serves it correctly.
    if (config.s3.cloudfrontDomain && video_url.includes('.amazonaws.com/') && s3_key) {
      video_url = `https://${config.s3.cloudfrontDomain}/${s3_key}`;
    }

    res.json({ videoUrl: video_url });
  } catch (err) { next(err); }
});

module.exports = router;
