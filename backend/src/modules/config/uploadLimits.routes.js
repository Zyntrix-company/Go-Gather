const express = require('express');
const { getPublicUploadLimits } = require('../../config/uploadLimits');

const router = express.Router();

// GET /config/upload-limits — public; no auth (app reads limits before login)
router.get('/upload-limits', (_req, res) => {
  res.json(getPublicUploadLimits());
});

module.exports = router;
