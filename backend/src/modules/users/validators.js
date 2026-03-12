const { body, param } = require('express-validator');

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

module.exports = {
  saveProfileValidation,
  getPublicProfileValidation,
};
