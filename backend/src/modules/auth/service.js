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
const { registerDeviceToken } = require('../../utils/fcm.util');
const {
  sendVerificationOTPEmail,
  sendPasswordResetOTPEmail,
} = require('../../utils/mailer');
const logger = require('../../utils/logger');
const { phoneKey } = require('../../utils/phone.util');
const { syncUserLegalAckFromCurrent } = require('../legal/legal.service');
const { linkPendingInvitesToUser } = require('../invites/invites.service');
const { resolveAuthEmail, normalizeAuthEmail, sanitizeAuthEmail } = require('../../utils/email.util');

const { getPresignedDownloadUrl } = require('../../utils/s3.util');
const apple = require('./apple');

const SALT_ROUNDS = 12;
const googleClient = new OAuth2Client(config.google.clientId);

/**
 * Someone who was invited before they had an account signs up with the same
 * email/phone — attach those invites now so they land in their Requests tab.
 * Never allowed to fail the sign-up it is attached to.
 */
const attachPendingInvites = async (userId, { email, phone }) => {
  try {
    await linkPendingInvitesToUser(userId, { email: email || null, phone: phone || null });
  } catch (err) {
    logger.error('Pending invite matching failed', { userId, err: err.message });
  }
};

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
 * Generate a 6-digit numeric OTP.
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Store an OTP in the DB.
 */
const storeOTP = async (userId, otp, purpose, client = db) => {
  const otpHash = hashToken(otp); // Reuse hashToken (SHA-256)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Delete previous OTPs for this user and purpose
  await client.query('DELETE FROM otps WHERE user_id = $1 AND purpose = $2', [userId, purpose]);

  await client.query(
    `INSERT INTO otps (user_id, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, otpHash, purpose, expiresAt],
  );
};

/**
 * Roll back a signup when verification email delivery fails after DB commit.
 */
const rollbackFailedSignup = async (userId) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  } catch (cleanupErr) {
    logger.error('Failed to roll back signup after email delivery error', {
      userId,
      error: cleanupErr.message,
    });
  }
};

/**
 * Look up a user by any email alias the user may type at login/OTP flows.
 */
const findUserByAuthEmail = async (email, client = db) => {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return null;

  const result = await client.query(
    'SELECT * FROM users WHERE email_normalized = $1',
    [normalized],
  );
  return result.rows[0] || null;
};

/**
 * POST /auth/signup — Email / password registration.
 */
const signup = async ({ email, phone, password }) => {
  const resolved = resolveAuthEmail(email);
  if (!resolved) {
    const err = new Error('A valid email address is required');
    err.statusCode = 422;
    err.error = 'ValidationError';
    throw err;
  }

  const { display: displayEmail, normalized } = resolved;

  const existing = await db.query(
    'SELECT id FROM users WHERE email_normalized = $1',
    [normalized],
  );
  if (existing.rows.length > 0) {
    const err = new Error('An account with this email already exists');
    err.statusCode = 409;
    err.error = 'EmailExists';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const otp = generateOTP();

  const client = await db.getClient();
  let user;

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO users (email, email_normalized, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, phone, is_profile_complete, is_verified, created_at`,
      [displayEmail, normalized, phone || null, passwordHash],
    );

    user = result.rows[0];

    await syncUserLegalAckFromCurrent(user.id, client);
    await storeOTP(user.id, otp, 'email-verification', client);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  try {
    await sendVerificationOTPEmail(user.email, otp);
  } catch (error) {
    await rollbackFailedSignup(user.id);
    logger.error('Signup verification email failed', { email: user.email, error: error.message });
    const err = new Error('Could not send verification email. Please try again.');
    err.statusCode = 503;
    err.error = 'EmailDeliveryFailed';
    throw err;
  }

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
  const user = await findUserByAuthEmail(email);

  if (!user || user.deleted_at) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.error = 'InvalidCredentials';
    throw err;
  }

  if (!user.password_hash) {
    const err = new Error('This account has no password yet. Sign in with Google or Apple, or tap "Forgot password?" to set one.');
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

  if (!user.is_verified) {
    const err = new Error('Please verify your email with the OTP sent to your inbox.');
    err.statusCode = 403;
    err.error = 'EmailNotVerified';
    throw err;
  }

  await db.query(
    'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
    [user.id],
  );

  const tokens = await issueTokenPair(user);

  await registerDeviceToken(user.id, deviceToken, platform);

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
 * A social provider has just proven the user owns this email. If an existing
 * account with that email was never verified, someone else may have registered
 * it first to pre-hijack it — so verify it now and drop that unproven password.
 */
const linkProviderToExistingUser = async (user, column, providerId) => {
  if (!user.is_verified) {
    await db.query(
      'UPDATE users SET is_verified = true, password_hash = NULL, updated_at = NOW() WHERE id = $1',
      [user.id],
    );
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);
    user.is_verified = true;
    logger.warn('Social sign-in claimed an unverified account; password cleared', { userId: user.id, column });
  }
  if (!user[column]) {
    await db.query(`UPDATE users SET ${column} = $1, updated_at = NOW() WHERE id = $2`, [providerId, user.id]);
    user[column] = providerId;
  }
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
  const { sub: googleId, email: rawEmail, name, picture } = payload;
  const resolved = resolveAuthEmail(rawEmail);

  if (!resolved) {
    const err = new Error('Google account must have a valid email associated.');
    err.statusCode = 400;
    err.error = 'NoEmail';
    throw err;
  }

  const { display: displayEmail, normalized } = resolved;

  let result = await db.query('SELECT * FROM users WHERE email_normalized = $1', [normalized]);
  let isNewUser = false;

  if (result.rows.length > 0) {
    await linkProviderToExistingUser(result.rows[0], 'google_id', googleId);
  } else {
    // Create new user (Auto-verifying email since Google verified it)
    result = await db.query(
      `INSERT INTO users (email, email_normalized, google_id, is_profile_complete, is_verified)
       VALUES ($1, $2, $3, false, true)
       RETURNING *`,
      [displayEmail, normalized, googleId],
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
    await attachPendingInvites(user.id, { email: user.email, phone: user.phone });
  }

  const user = result.rows[0];
  const tokens = await issueTokenPair(user);

  await registerDeviceToken(user.id, deviceToken, platform);

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
 * POST /auth/apple — Sign in with Apple (iOS).
 * Apple sends the email only on the very first authorization and the name only
 * via the app (never in the token), so both are captured when the account is made.
 */
const appleAuth = async ({ identityToken, nonce, authorizationCode, fullName, deviceToken, platform }) => {
  const payload = await apple.verifyIdentityToken(identityToken, nonce);
  const appleId = payload.sub;
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

  let result = await db.query(
    'SELECT * FROM users WHERE apple_id = $1 AND deleted_at IS NULL',
    [appleId],
  );
  let isNewUser = false;

  if (result.rows.length === 0) {
    const resolved = payload.email && emailVerified ? resolveAuthEmail(payload.email) : null;
    if (!resolved) {
      const err = new Error(
        'Apple did not share an email. In Settings > Apple ID > Sign in with Apple, remove GatherGo and try again.',
      );
      err.statusCode = 400;
      err.error = 'NoEmail';
      throw err;
    }
    const { display: displayEmail, normalized } = resolved;

    result = await db.query('SELECT * FROM users WHERE email_normalized = $1', [normalized]);
    if (result.rows.length > 0) {
      // Same verified email as an existing account (e.g. made with Google) — link Apple to it
      await linkProviderToExistingUser(result.rows[0], 'apple_id', appleId);
    } else {
      try {
        result = await db.query(
          `INSERT INTO users (email, email_normalized, apple_id, is_profile_complete, is_verified)
           VALUES ($1, $2, $3, false, true)
           RETURNING *`,
          [displayEmail, normalized, appleId],
        );
      } catch (err) {
        // Double-tap: a parallel request created this account a moment ago
        if (err.code !== '23505') throw err;
        result = await db.query('SELECT * FROM users WHERE email_normalized = $1', [normalized]);
        if (result.rows.length === 0) throw err;
        await linkProviderToExistingUser(result.rows[0], 'apple_id', appleId);
        return finishAppleAuth(result.rows[0], { authorizationCode, deviceToken, platform, isNewUser: false });
      }
      isNewUser = true;

      const user = result.rows[0];
      const name = [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ').trim();
      await db.query(
        'INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)',
        [user.id, name || null],
      );

      await syncUserLegalAckFromCurrent(user.id);
      await attachPendingInvites(user.id, { email: user.email, phone: user.phone });
    }
  }

  return finishAppleAuth(result.rows[0], { authorizationCode, deviceToken, platform, isNewUser });
};

const finishAppleAuth = async (user, { authorizationCode, deviceToken, platform, isNewUser }) => {
  // Kept only so account deletion can revoke the Apple grant (App Store requirement)
  const appleRefreshToken = await apple.exchangeAuthorizationCode(authorizationCode);
  if (appleRefreshToken) {
    const { encrypt } = require('../../utils/encrypt.util');
    await db.query(
      'UPDATE users SET apple_refresh_token = $1 WHERE id = $2',
      [encrypt(appleRefreshToken), user.id],
    );
  }

  const tokens = await issueTokenPair(user);
  await registerDeviceToken(user.id, deviceToken, platform);

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
  let user = null;

  if (email) {
    user = await findUserByAuthEmail(email);
  } else if (phone) {
    const result = await db.query('SELECT id, email FROM users WHERE phone_key = $1', [
      phoneKey(phone),
    ]);
    user = result.rows[0] || null;
  }

  if (!user) {
    return { message: 'If an account exists, a reset email has been sent.' };
  }

  const otp = generateOTP();
  await storeOTP(user.id, otp, 'password-reset');
  await sendPasswordResetOTPEmail(user.email, otp);

  return { message: 'If an account exists, a reset code has been sent.' };
};

/**
 * POST /auth/verify-email — Verify OTP for signup.
 */
const verifyEmail = async ({ email, otp, deviceToken, platform }) => {
  const userRow = await findUserByAuthEmail(email);
  if (!userRow) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const userId = userRow.id;

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

  await db.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);
  await db.query('DELETE FROM otps WHERE id = $1', [otpResult.rows[0].id]);

  await registerDeviceToken(userId, deviceToken, platform);
  await attachPendingInvites(userId, { email: userRow.email, phone: userRow.phone });

  const user = { id: userId, email: userRow.email };
  const tokens = await issueTokenPair(user);

  return {
    message: 'Email verified successfully',
    user: { id: userId, email: userRow.email, isVerified: true },
    ...tokens,
  };
};

/**
 * POST /auth/reset-password — Reset password using OTP.
 */
const resetPassword = async ({ email, otp, password }) => {
  const userRow = await findUserByAuthEmail(email);
  if (!userRow) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const userId = userRow.id;

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
 * POST /auth/change-password — Change password for authenticated email/password users.
 */
const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const { password_hash: passwordHash } = result.rows[0];
  if (!passwordHash) {
    const err = new Error('This account uses social sign-in and has no password to change.');
    err.statusCode = 400;
    throw err;
  }

  const valid = await bcrypt.compare(currentPassword, passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 401;
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

  return { message: 'Password changed successfully' };
};

/**
 * POST /auth/resend-otp
 */
const resendOTP = async ({ email, purpose }) => {
  const user = await findUserByAuthEmail(email);
  if (!user) return { message: 'If an account exists, a code has been sent.' };

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

  // Normalise avatar_url: strip malformed URLs and rewrite legacy S3 URLs to CloudFront.
  const rawAvatar = row.avatar_url;
  let avatarUrl = (rawAvatar && !rawAvatar.includes('https://undefined')) ? rawAvatar : null;
  const cf = config.s3?.cloudfrontDomain;
  if (avatarUrl && cf && avatarUrl.includes('.amazonaws.com/')) {
    try {
      const key = new URL(avatarUrl).pathname.replace(/^\//, '');
      if (key) avatarUrl = `https://${cf}/${key}`;
    } catch { /* keep original */ }
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

module.exports = {
  signup,
  login,
  googleAuth,
  appleAuth,
  refresh,
  logout,
  forgotPassword,
  verifyEmail,
  resetPassword,
  changePassword,
  resendOTP,
  getMe,
};
