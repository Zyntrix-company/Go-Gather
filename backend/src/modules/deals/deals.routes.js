const express = require('express');
const { query } = require('../../config/database');

const router = express.Router();

// GET /deals — returns active deals ordered by sort_order then created_at
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, subtitle, image_url, hyperlink
         FROM deals
        WHERE active = true
        ORDER BY sort_order NULLS LAST, created_at DESC`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
