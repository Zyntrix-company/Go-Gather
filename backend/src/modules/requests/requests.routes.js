const { Router } = require('express');
const { param, body } = require('express-validator');
const controller = require('./requests.controller');
const validate = require('../../middleware/validate');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

router.use(authenticateJWT);

// GET /requests — pending friend + trip + event requests for the current user
router.get('/', controller.getRequests);

// GET /requests/:type/:id/preview — details for the invite popup (trip | event only)
router.get(
  '/:type/:id/preview',
  [
    param('type').isIn(['trip', 'event']).withMessage('type must be trip or event'),
    param('id').isUUID().withMessage('id must be a UUID'),
  ],
  validate,
  controller.getRequestPreview,
);

// PUT /requests/:type/:id — approve or decline
router.put(
  '/:type/:id',
  [
    param('type').isIn(['friend', 'trip', 'event']).withMessage('type must be friend, trip or event'),
    param('id').isUUID().withMessage('id must be a UUID'),
    body('action').isIn(['approve', 'decline']).withMessage('action must be approve or decline'),
  ],
  validate,
  controller.respondToRequest,
);

module.exports = router;
