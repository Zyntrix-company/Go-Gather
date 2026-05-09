const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const db = require('../../config/database');
const config = require('../../config');
const {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  verifyRefreshToken,
  hashToken,
} = require('../../utils/token');
const {
  sendVerificationOTPEmail,
  sendPasswordResetOTPEmail,
} = require('../../utils/mailer');
const logger = require('../../utils/logger');
const { syncUserLegalAckFromCurrent } = require('../legal/legal.service');

const { getPresignedDownloadUrl } = require('../../utils/s3.util');

const SALT_ROUNDS = 12;
const googleClient = new OAuth2Client(config.google.clientId);

/* ───────────────────────────────────────────
 * Helpers
 * ─────────────────────────────────────────── */

/**
 * Store a hashed refresh token in the DB.
 */
const storeRefreshToken = async (userId, rawToken) => {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
};

/**
 * Generate access + refresh token pair and persist refresh token.
 */
const issueTokenPair = async (user) => {
  const accessToken = generateAccessToken({ id: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ id: user.id });
  await storeRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken };
};

/**
 * Save the raw FCM device token on login.
 * platform is stored for future iOS-specific handling (APNS channel, badge resets, etc.)
 */
const handleDeviceRegistration = async (userId, deviceToken, platform) => {
  if (!deviceToken) return;

  try {
    // Remove this token from any other user who currently holds it — prevents
    // cross-user notification delivery when the same device is re-used.
    await db.query(
      'UPDATE users SET fcm_token = NULL, platform = NULL WHERE fcm_token = $1 AND id != $2',
      [deviceToken, userId],
    );
    await db.query(
      'UPDATE users SET fcm_token = $1, platform = $2, updated_at = NOW() WHERE id = $3',
      [deviceToken, platform || null, userId],
    );
    logger.info('FCM token saved', { userId, platform });
  } catch (error) {
    logger.error('FCM token save failed', { userId, error: error.message });
  }
};

/**
 * Generate a 6-digit numeric OTP.
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Store an OTP in the DB.
 */
const storeOTP = async (userId, otp, purpose) => {
  const otpHash = hashToken(otp); // Reuse hashToken (SHA-256)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Delete previous OTPs for this user and purpose
  await db.query('DELETE FROM otps WHERE user_id = $1 AND purpose = $2', [userId, purpose]);

  await db.query(
    `INSERT INTO otps (user_id, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, otpHash, purpose, expiresAt],
  );
};

/* ───────────────────────────────────────────
 * Service methods
 * ─────────────────────────────────────────── */

/**
 * POST /auth/signup — Email / password registration.
 */
const signup = async ({ email, phone, password }) => {
  // Check for existing user
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const err = new Error('An account with this email already exists');
    err.statusCode = 409;
    err.error = 'EmailExists';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await db.query(
    `INSERT INTO users (email, phone, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, phone, is_profile_complete, created_at`,
    [email, phone || null, passwordHash],
  );

  const user = result.rows[0];

  await syncUserLegalAckFromCurrent(user.id);

  // Generate and send verification OTP
  const otp = generateOTP();
  await storeOTP(user.id, otp, 'email-verification');
  await sendVerificationOTPEmail(user.email, otp);

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      isProfileComplete: user.is_profile_complete,
      isVerified: user.is_verified,
    },
    message: 'Registration successful. Please verify your email with the OTP sent.',
  };
};

/**
 * POST /auth/login — Email / password login.
 */
const login = async ({ email, password, deviceToken, platform }) => {
  const result = await db.query(
    'SELECT id, email, password_hash, is_profile_complete FROM users WHERE email = $1',
    [email],
  );

  if (result.rows.length === 0) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.error = 'InvalidCredentials';
    throw err;
  }

  const user = result.rows[0];

  if (!user.password_hash) {
    const err = new Error('This account uses Google sign-in. Please login with Google.');
    err.statusCode = 401;
    err.error = 'GoogleOnlyAccount';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.error = 'InvalidCredentials';
    throw err;
  }

  await db.query(
    'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
    [user.id],
  );

  const tokens = await issueTokenPair(user);

  // Register SNS device endpoint on every login
  await handleDeviceRegistration(user.id, deviceToken, platform);

  return {
    user: {
      id: user.id,
      email: user.email,
      isProfileComplete: user.is_profile_complete,
      isVerified: user.is_verified,
    },
    ...tokens,
  };
};

/**
 * POST /auth/google — Google OAuth token exchange.
 */
const googleAuth = async ({ idToken, deviceToken, platform }) => {
  // Verify google id token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  });
  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture } = payload;

  // Check for existing user by email
  let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  let isNewUser = false;

  if (result.rows.length > 0) {
    // Link Google ID if not already linked
    const user = result.rows[0];
    if (!user.google_id) {
      await db.query(
        'UPDATE users SET google_id = $1, updated_at = NOW() WHERE id = $2',
        [googleId, user.id],
      );
    }
  } else {
    // Create new user (Auto-verifying email since Google verified it)
    result = await db.query(
      `INSERT INTO users (email, google_id, is_profile_complete, is_verified)
       VALUES ($1, $2, false, true)
       RETURNING *`,
      [email, googleId],
    );
    isNewUser = true;

    // Auto-create a basic profile from Google data
    const user = result.rows[0];
    await db.query(
      `INSERT INTO profiles (user_id, full_name, avatar_url)
       VALUES ($1, $2, $3)`,
      [user.id, name || null, picture || null],
    );

    await syncUserLegalAckFromCurrent(user.id);
  }

  const user = result.rows[0];
  const tokens = await issueTokenPair(user);

  // Register SNS device endpoint on every login
  await handleDeviceRegistration(user.id, deviceToken, platform);

  return {
    user: {
      id: user.id,
      email: user.email,
      isProfileComplete: user.is_profile_complete,
      isNewUser,
    },
    ...tokens,
  };
};

/**
 * POST /auth/facebook — Facebook OAuth token exchange.
 */
const facebookAuth = async ({ accessToken, deviceToken, platform }) => {
  const axios = require('axios'); // Optional, or use https. Going to assume I'll add axios or use a helper.
  // Using a manual https request or adding axios to package.json.
  // Let's assume axios is added.

  const response = await axios.get(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`);
  const { id: facebookId, email, name, picture } = response.data;

  if (!email) {
    const err = new Error('Facebook account must have an email associated.');
    err.statusCode = 400;
    err.error = 'NoEmail';
    throw err;
  }

  // Check for existing user by email
  let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  let isNewUser = false;

  if (result.rows.length > 0) {
    // Link Facebook ID if not already linked
    const user = result.rows[0];
    if (!user.facebook_id) {
      await db.query(
        'UPDATE users SET facebook_id = $1, updated_at = NOW() WHERE id = $2',
        [facebookId, user.id],
      );
    }
  } else {
    // Create new user (Auto-verifying email since Facebook verified it)
    result = await db.query(
      `INSERT INTO users (email, facebook_id, is_profile_complete, is_verified)
       VALUES ($1, $2, false, true)
       RETURNING *`,
      [email, facebookId],
    );
    isNewUser = true;

    // Auto-create a basic profile from Facebook data
    const user = result.rows[0];
    const avatarUrl = picture?.data?.url || null;
    await db.query(
      `INSERT INTO profiles (user_id, full_name, avatar_url)
       VALUES ($1, $2, $3)`,
      [user.id, name || null, avatarUrl],
    );

    await syncUserLegalAckFromCurrent(user.id);
  }

  const user = result.rows[0];
  const tokens = await issueTokenPair(user);

  // Register SNS device endpoint on every login
  await handleDeviceRegistration(user.id, deviceToken, platform);

  return {
    user: {
      id: user.id,
      email: user.email,
      isProfileComplete: user.is_profile_complete,
      isNewUser,
    },
    ...tokens,
  };
};

/**
 * POST /auth/refresh — Silent JWT refresh.
 */
const refresh = async ({ refreshToken: rawToken }) => {
  // Verify JWT signature
  let decoded;
  try {
    decoded = verifyRefreshToken(rawToken);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    err.error = 'InvalidRefreshToken';
    throw err;
  }

  // Check DB for the hashed token
  const tokenHash = hashToken(rawToken);
  const result = await db.query(
    `SELECT rt.id, rt.user_id, u.email, u.is_profile_complete
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
    [tokenHash],
  );

  if (result.rows.length === 0) {
    const err = new Error('Refresh token not found or expired');
    err.statusCode = 401;
    err.error = 'InvalidRefreshToken';
    throw err;
  }

  const row = result.rows[0];

  // Delete old refresh token (rotation)
  await db.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);

  // Issue new token pair
  const user = { id: row.user_id, email: row.email };
  const tokens = await issueTokenPair(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      isProfileComplete: row.is_profile_complete,
    },
    ...tokens,
  };
};

/**
 * POST /auth/logout — Invalidate session.
 */
const logout = async ({ refreshToken: rawToken }) => {
  if (!rawToken) return;

  const tokenHash = hashToken(rawToken);
  await db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
};

/**
 * POST /auth/forgot-password — Send reset email via SES.
 */
const forgotPassword = async ({ email, phone }) => {
  // Lookup by email or phone
  const identifier = email || phone;
  const column = email ? 'email' : 'phone';

  const result = await db.query(
    `SELECT id, email FROM users WHERE ${column} = $1`,
    [identifier],
  );

  if (result.rows.length === 0) {
    // Return silently to avoid enumeration
    return { message: 'If an account exists, a reset email has been sent.' };
  }

  const user = result.rows[0];

  const otp = generateOTP();
  await storeOTP(user.id, otp, 'password-reset');
  await sendPasswordResetOTPEmail(user.email, otp);

  return { message: 'If an account exists, a reset code has been sent.' };
};

/**
 * POST /auth/verify-email — Verify OTP for signup.
 */
const verifyEmail = async ({ email, otp }) => {
  const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const userId = result.rows[0].id;

  const otpHash = hashToken(otp);
  const otpResult = await db.query(
    'SELECT id FROM otps WHERE user_id = $1 AND otp_hash = $2 AND purpose = $3 AND expires_at > NOW()',
    [userId, otpHash, 'email-verification'],
  );

  if (otpResult.rows.length === 0) {
    const err = new Error('Invalid or expired OTP');
    err.statusCode = 401;
    throw err;
  }

  // Mark verified
  await db.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);
  // Delete OTP
  await db.query('DELETE FROM otps WHERE id = $1', [otpResult.rows[0].id]);

  // Issue tokens now that verified
  const user = { id: userId, email };
  const tokens = await issueTokenPair(user);

  return {
    message: 'Email verified successfully',
    user: { id: userId, email, isVerified: true },
    ...tokens,
  };
};

/**
 * POST /auth/reset-password — Reset password using OTP.
 */
const resetPassword = async ({ email, otp, password }) => {
  const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const userId = result.rows[0].id;

  const otpHash = hashToken(otp);
  const otpResult = await db.query(
    'SELECT id FROM otps WHERE user_id = $1 AND otp_hash = $2 AND purpose = $3 AND expires_at > NOW()',
    [userId, otpHash, 'password-reset'],
  );

  if (otpResult.rows.length === 0) {
    const err = new Error('Invalid or expired OTP');
    err.statusCode = 401;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

  // Delete OTP and all refresh tokens for this user (security)
  await db.query('DELETE FROM otps WHERE id = $1', [otpResult.rows[0].id]);
  await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

  return { message: 'Password reset successful. Please login with your new password.' };
};

/**
 * POST /auth/resend-otp
 */
const resendOTP = async ({ email, purpose }) => {
  const result = await db.query('SELECT id, email, is_verified FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) return { message: 'If an account exists, a code has been sent.' };

  const user = result.rows[0];
  if (purpose === 'email-verification' && user.is_verified) {
    return { message: 'Email is already verified.' };
  }

  const otp = generateOTP();
  await storeOTP(user.id, otp, purpose);

  if (purpose === 'email-verification') {
    await sendVerificationOTPEmail(user.email, otp);
  } else {
    await sendPasswordResetOTPEmail(user.email, otp);
  }

  return { message: 'A new code has been sent.' };
};

/**
 * GET /auth/me — Return the current user from access token.
 */
const getMe = async (userId) => {
  const result = await db.query(
    `SELECT u.id, u.email, u.phone, u.username, u.google_id, u.facebook_id, u.is_profile_complete, u.is_verified,
            u.sns_endpoint_arn, u.created_at, u.updated_at,
            p.full_name, p.dob, p.gender, p.country, p.bio, p.avatar_url
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.error = 'UserNotFound';
    throw err;
  }

  const row = result.rows[0];

  // Sanitise avatar_url: strip any malformed URLs (e.g. "https://undefined/...")
  // that were stored before the CloudFront domain guard was added.
  const rawAvatar = row.avatar_url;
  const storedAvatarUrl = (rawAvatar && !rawAvatar.includes('https://undefined')) ? rawAvatar : null;

  // Derive the S3 key from the stored URL so we can generate a presigned URL.
  // Presigned URLs are signed with IAM credentials and bypass CloudFront entirely,
  // which avoids any distribution-level access issues for the avatars/ prefix.
  // We try to generate one; if it fails (e.g. GetObject not granted) we fall back
  // to the stored CloudFront / S3 URL so the response is never broken.
  let avatarUrl = storedAvatarUrl;
  if (storedAvatarUrl) {
    try {
      let s3Key = null;
      const cfDomain = config.s3.cloudfrontDomain;
      if (cfDomain && storedAvatarUrl.startsWith(`https://${cfDomain}/`)) {
        // CloudFront URL → extract key after the domain
        s3Key = storedAvatarUrl.slice(`https://${cfDomain}/`.length).split('?')[0];
      } else {
        // Direct S3 URL → extract key from path
        const parsed = new URL(storedAvatarUrl);
        s3Key = parsed.pathname.replace(/^\//, '').split('?')[0];
      }
      if (s3Key && s3Key.startsWith('avatars/')) {
        avatarUrl = await getPresignedDownloadUrl(s3Key, 3600);
      }
    } catch {
      // Fall back to the stored URL — presigned generation is best-effort
      avatarUrl = storedAvatarUrl;
    }
  }

  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    username: row.username,
    googleId: row.google_id,
    isProfileComplete: row.is_profile_complete,
    isVerified: row.is_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profile: {
      fullName: row.full_name,
      dob: row.dob,
      gender: row.gender,
      country: row.country,
      bio: row.bio,
      avatarUrl,
    },
  };
};

/**
 * POST /auth/facebook/data-deletion
 * Facebook Data Deletion Callback — verifies the signed_request, deletes user
 * data associated with the Facebook UID, and returns a confirmation response.
 */
const facebookDataDeletion = async (signedRequest) => {
  const crypto = require('crypto');

  if (!signedRequest) {
    const err = new Error('signed_request is required');
    err.statusCode = 400; err.error = 'MISSING_SIGNED_REQUEST'; throw err;
  }

  const [encodedSig, encodedPayload] = signedRequest.split('.');
  if (!encodedSig || !encodedPayload) {
    const err = new Error('Invalid signed_request format');
    err.statusCode = 400; err.error = 'INVALID_SIGNED_REQUEST'; throw err;
  }

  // Verify HMAC-SHA256 signature
  const appSecret = config.facebook.appSecret;
  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  if (expectedSig !== encodedSig) {
    const err = new Error('Invalid signed_request signature');
    err.statusCode = 400; err.error = 'INVALID_SIGNATURE'; throw err;
  }

  // Decode payload
  const payload = JSON.parse(
    Buffer.from(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
  );

  const facebookUserId = payload.user_id;
  if (!facebookUserId) {
    const err = new Error('user_id missing from signed_request payload');
    err.statusCode = 400; err.error = 'INVALID_PAYLOAD'; throw err;
  }

  // Find user and delete their data
  const userResult = await db.query(
    'SELECT id FROM users WHERE facebook_id = $1',
    [facebookUserId],
  );

  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].id;
    // Delete the user entirely — cascades to all related data via FK constraints
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    logger.info('Facebook data deletion: user deleted', { userId, facebookUserId });
  } else {
    logger.info('Facebook data deletion: no user found for facebook_id', { facebookUserId });
  }

  const confirmationCode = `fb-del-${facebookUserId}-${Date.now()}`;
  const statusUrl = `${config.appDeepLinkBaseUrl}/data-deletion?code=${confirmationCode}`;

  return { url: statusUrl, confirmation_code: confirmationCode };
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
