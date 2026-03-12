const { Router } = require('express');
const controller = require('./controller');
const validators = require('./validators');
const validate = require('../../middleware/validate');
const authenticateJWT = require('../../middleware/authenticate');
const upload = require('../../middleware/upload');

const router = Router();

// POST /users/profile — Save profile after signup (requires auth)
router.post(
  '/profile',
  authenticateJWT,
  validators.saveProfileValidation,
  validate,
  controller.saveProfile,
);

// PUT /users/photo — Upload profile photo to S3 (requires auth)
router.put(
  '/photo',
  authenticateJWT,
  upload.single('photo'),
  controller.uploadPhoto,
);

// GET /users/:id — Get public user profile
router.get(
  '/:id',
  validators.getPublicProfileValidation,
  validate,
  controller.getPublicProfile,
);

module.exports = router;
