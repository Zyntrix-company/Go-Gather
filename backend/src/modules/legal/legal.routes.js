const { Router } = require('express');
const ctrl = require('./legal.controller');

const router = Router();

router.get('/privacy', ctrl.getPrivacy);
router.get('/terms', ctrl.getTerms);

module.exports = router;
