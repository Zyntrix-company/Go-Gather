const express = require('express');
const { query } = require('../../config/database');

const router = express.Router();

// GET /promo-video — public, returns current promotional video URL (null if none set)
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT video_url FROM promo_video WHERE id = 1');
    res.json({ videoUrl: rows.length ? rows[0].video_url : null });
  } catch (err) { next(err); }
});

module.exports = router;
