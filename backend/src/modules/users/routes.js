const { Router } = require('express');
const controller = require('./controller');
const validators = require('./validators');
const validate = require('../../middleware/validate');
const authenticateJWT = require('../../middleware/authenticate');
const upload = require('../../middleware/upload');

const router = Router();

// ── Authenticated routes ───────────────────────────────────────────────────────

// POST /users/profile — Save profile after signup (requires auth)
router.post(
  '/profile',
  authenticateJWT,
  validators.saveProfileValidation,
  validate,
  controller.saveProfile,
);

// PUT /users/profile — Update profile fields including username (requires auth)
router.put(
  '/profile',
  authenticateJWT,
  validators.updateProfileValidation,
  validate,
  controller.updateProfile,
);

// PUT /users/photo — Upload profile photo to S3 (requires auth)
router.put(
  '/photo',
  authenticateJWT,
  upload.single('photo'),
  controller.uploadPhoto,
);

// GET /users/search — Search users with friendship status (requires auth)
// IMPORTANT: must be registered BEFORE /:id to avoid Express matching "search" as a UUID param
router.get(
  '/search',
  authenticateJWT,
  validators.searchUsersValidation,
  validate,
  controller.searchUsers,
);

// ── Per-user routes ────────────────────────────────────────────────────────────

// GET /users/:id/profile — Enhanced profile with friendship status + stats (requires auth)
router.get(
  '/:id/profile',
  authenticateJWT,
  validators.getPublicProfileValidation,
  validate,
  controller.getUserProfile,
);

// GET /users/:id/gallery — Past trips/events (requires auth)
router.get(
  '/:id/gallery',
  authenticateJWT,
  validators.getPublicProfileValidation,
  validate,
  controller.getUserGallery,
);

// GET /users/:id/photos — All photos uploaded by user, grouped by trip/event + activity (requires auth)
router.get(
  '/:id/photos',
  authenticateJWT,
  validators.getPublicProfileValidation,
  validate,
  controller.getUserPhotos,
);

// GET /users/:id — Get public user profile (no auth required — legacy endpoint)
router.get(
  '/:id',
  validators.getPublicProfileValidation,
  validate,
  controller.getPublicProfile,
);

module.exports = router;
