const { body } = require('express-validator');
const { sanitizeAuthEmail } = require('../../utils/email.util');

const authEmailField = (message = 'A valid email address is required') =>
  body('email')
    .isEmail()
    .withMessage(message)
    .customSanitizer(sanitizeAuthEmail);

const signupValidation = [
  authEmailField(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
];

const loginValidation = [
  authEmailField(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body('deviceToken')
    .optional()
    .isString(),
  body('platform')
    .optional()
    .isIn(['ios', 'android'])
    .withMessage('Platform must be ios or android'),
];

const googleAuthValidation = [
  body('idToken')
    .notEmpty()
    .withMessage('Google ID token is required')
    .isString(),
  body('deviceToken')
    .optional()
    .isString(),
  body('platform')
    .optional()
    .isIn(['ios', 'android'])
    .withMessage('Platform must be ios or android'),
];

const facebookAuthValidation = [
  body('accessToken')
    .notEmpty()
    .withMessage('Facebook access token is required')
    .isString(),
  body('deviceToken')
    .optional()
    .isString(),
  body('platform')
    .optional()
    .isIn(['ios', 'android'])
    .withMessage('Platform must be ios or android'),
];

const refreshValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isString(),
];

const logoutValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isString(),
];

const forgotPasswordValidation = [
  body()
    .custom((value) => {
      if (!value.email && !value.phone) {
        throw new Error('Either email or phone is required');
      }
      return true;
    }),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address')
    .customSanitizer(sanitizeAuthEmail),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
];

const verifyEmailValidation = [
  authEmailField('Invalid email address'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits'),
];

const resetPasswordValidation = [
  authEmailField('Invalid email address'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

const resendOTPValidation = [
  authEmailField('Invalid email address'),
  body('purpose')
    .isIn(['email-verification', 'password-reset'])
    .withMessage('Purpose must be email-verification or password-reset'),
];

module.exports = {
  signupValidation,
  loginValidation,
  googleAuthValidation,
  facebookAuthValidation,
  refreshValidation,
  logoutValidation,
  forgotPasswordValidation,
  verifyEmailValidation,
  resetPasswordValidation,
  changePasswordValidation,
  resendOTPValidation,
};
