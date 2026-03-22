const { Router } = require('express');
const controller = require('./home.controller');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

// GET /home — personalised dashboard
router.get('/', authenticateJWT, controller.getDashboard);

module.exports = router;
