const express = require('express');
const { getPublicUploadLimits } = require('../../config/uploadLimits');
const { getPublicAppLimits } = require('../../config/appLimits');

const router = express.Router();

// GET /config/upload-limits — public; no auth (app reads limits before login)
router.get('/upload-limits', (_req, res) => {
  res.json(getPublicUploadLimits());
});

// GET /config/app-limits — public; no auth (text / count limits)
router.get('/app-limits', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(getPublicAppLimits());
});

module.exports = router;
