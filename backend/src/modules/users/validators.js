const { body, param, query } = require('express-validator');

const saveProfileValidation = [
  body('fullName')
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .trim(),
  body('dob')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid ISO 8601 date (YYYY-MM-DD)'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Gender must be male, female, other, or prefer_not_to_say'),
  body('country')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters')
    .trim(),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be at most 500 characters')
    .trim(),
];

const getPublicProfileValidation = [
  param('id')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
];

// PUT /users/profile — update profile including optional username
const updateProfileValidation = [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .trim(),
  body('username')
    .optional()
    .matches(/^[a-z0-9_]{3,20}$/)
    .withMessage('Username must be 3–20 chars, lowercase letters, numbers, and underscores only'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be at most 500 characters')
    .trim(),
  body('country')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters')
    .trim(),
];

// GET /users/search
const searchUsersValidation = [
  query('q')
    .notEmpty()
    .withMessage('q (search query) is required')
    .isLength({ max: 100 })
    .withMessage('Search query too long')
    .trim(),
];

const albumIdParam = [
  param('albumId').isUUID().withMessage('albumId must be a valid UUID'),
];

const createGalleryAlbumValidation = [
  body('name')
    .notEmpty()
    .withMessage('Album name is required')
    .isLength({ min: 1, max: 120 })
    .trim(),
  body('section')
    .isIn(['trip', 'event'])
    .withMessage('section must be trip or event'),
  body('subtitle')
    .optional()
    .isLength({ max: 80 })
    .trim(),
];

const updateGalleryAlbumValidation = [
  ...albumIdParam,
  body('name').optional().isLength({ min: 1, max: 120 }).trim(),
  body('subtitle').optional().isLength({ max: 80 }).trim(),
  body('bannerImageUrl').optional().isString(),
];

module.exports = {
  saveProfileValidation,
  getPublicProfileValidation,
  updateProfileValidation,
  searchUsersValidation,
  albumIdParam,
  createGalleryAlbumValidation,
  updateGalleryAlbumValidation,
};
