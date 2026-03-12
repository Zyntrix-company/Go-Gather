const { Router } = require('express');
const controller = require('./controller');
const validators = require('./validators');
const validate = require('../../middleware/validate');
const authenticateJWT = require('../../middleware/authenticate');

const router = Router();

// POST /auth/signup — Email/password registration
router.post(
  '/signup',
  validators.signupValidation,
  validate,
  controller.signup,
);

// POST /auth/login — Email/password login
router.post(
  '/login',
  validators.loginValidation,
  validate,
  controller.login,
);

// POST /auth/google — Google OAuth token exchange
router.post(
  '/google',
  validators.googleAuthValidation,
  validate,
  controller.googleAuth,
);

// POST /auth/facebook — Facebook OAuth token exchange
router.post(
  '/facebook',
  validators.facebookAuthValidation,
  validate,
  controller.facebookAuth,
);

// POST /auth/refresh — Silent JWT refresh
router.post(
  '/refresh',
  validators.refreshValidation,
  validate,
  controller.refresh,
);

// POST /auth/logout — Invalidate session (requires auth)
router.post(
  '/logout',
  authenticateJWT,
  validators.logoutValidation,
  validate,
  controller.logout,
);

// POST /auth/forgot-password — Send reset session via SES
router.post(
  '/forgot-password',
  validators.forgotPasswordValidation,
  validate,
  controller.forgotPassword,
);

// POST /auth/verify-email — Verify registration OTP
router.post(
  '/verify-email',
  validators.verifyEmailValidation,
  validate,
  controller.verifyEmail,
);

// POST /auth/reset-password — Reset password using OTP code
router.post(
  '/reset-password',
  validators.resetPasswordValidation,
  validate,
  controller.resetPassword,
);

// POST /auth/resend-otp — Resend code
router.post(
  '/resend-otp',
  validators.resendOTPValidation,
  validate,
  controller.resendOTP,
);

// GET /auth/me — Current user profile (requires auth)
router.get(
  '/me',
  authenticateJWT,
  controller.getMe,
);

module.exports = router;
