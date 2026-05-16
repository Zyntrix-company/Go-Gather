const authService = require('./service');
const logger = require('../../utils/logger');

/**
 * POST /auth/signup
 */
const signup = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;
    const result = await authService.signup({ email, phone, password });

    logger.info('User signed up', { userId: result.user.id });

    return res.status(201).json({
      message: 'Account created successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password, deviceToken, platform } = req.body;
    const result = await authService.login({ email, password, deviceToken, platform });

    logger.info('User logged in', { userId: result.user.id });

    return res.status(200).json({
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/google
 */
const googleAuth = async (req, res, next) => {
  try {
    const { idToken, deviceToken, platform } = req.body;
    const result = await authService.googleAuth({ idToken, deviceToken, platform });

    logger.info('Google auth completed', {
      userId: result.user.id,
      isNewUser: result.user.isNewUser,
    });

    return res.status(200).json({
      message: result.user.isNewUser ? 'Account created via Google' : 'Login successful',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/facebook
 */
const facebookAuth = async (req, res, next) => {
  try {
    const { accessToken, deviceToken, platform } = req.body;
    const result = await authService.facebookAuth({ accessToken, deviceToken, platform });

    logger.info('Facebook auth completed', {
      userId: result.user.id,
      isNewUser: result.user.isNewUser,
    });

    return res.status(200).json({
      message: result.user.isNewUser ? 'Account created via Facebook' : 'Login successful',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh({ refreshToken });

    return res.status(200).json({
      message: 'Tokens refreshed',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout({ refreshToken });

    logger.info('User logged out', { userId: req.user.id });

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    const result = await authService.forgotPassword({ email, phone });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);

    return res.status(200).json({
      message: 'User profile fetched',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/verify-email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp, deviceToken, platform } = req.body;
    const result = await authService.verifyEmail({ email, otp, deviceToken, platform });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;
    const result = await authService.resetPassword({ email, otp, password });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/resend-otp
 */
const resendOTP = async (req, res, next) => {
  try {
    const { email, purpose } = req.body;
    const result = await authService.resendOTP({ email, purpose });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/facebook/data-deletion
 */
const facebookDataDeletion = async (req, res, next) => {
  try {
    const signedRequest = req.body?.signed_request;
    const result = await authService.facebookDataDeletion(signedRequest);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  googleAuth,
  facebookAuth,
  refresh,
  logout,
  forgotPassword,
  verifyEmail,
  resetPassword,
  resendOTP,
  getMe,
  facebookDataDeletion,
};
