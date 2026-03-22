const { Router } = require('express');
const { param } = require('express-validator');
const controller = require('./invites.controller');
const validate = require('../../middleware/validate');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

const tokenValidation = [
  param('token').notEmpty().withMessage('token is required'),
];

// GET /invites/validate/:token — public, no JWT required
router.get(
  '/validate/:token',
  tokenValidation,
  validate,
  controller.validateInvite,
);

// POST /invites/claim/:token — JWT required
router.post(
  '/claim/:token',
  authenticateJWT,
  tokenValidation,
  validate,
  controller.claimInvite,
);

module.exports = router;
