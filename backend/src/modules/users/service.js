const db = require('../../config/database');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * POST /users/profile — Save/create the user profile after signup.
 */
const saveProfile = async (userId, profileData) => {
  const { fullName, dob, gender, country, bio } = profileData;

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Upsert profile
    await client.query(
      `INSERT INTO profiles (user_id, full_name, dob, gender, country, bio)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET
         full_name  = EXCLUDED.full_name,
         dob        = EXCLUDED.dob,
         gender     = EXCLUDED.gender,
         country    = EXCLUDED.country,
         bio        = EXCLUDED.bio,
         updated_at = NOW()`,
      [userId, fullName, dob || null, gender || null, country || null, bio || null],
    );

    // Mark profile as complete
    await client.query(
      'UPDATE users SET is_profile_complete = true, updated_at = NOW() WHERE id = $1',
      [userId],
    );

    await client.query('COMMIT');

    // Return the updated profile
    const result = await db.query(
      `SELECT u.id, u.email, u.phone, u.is_profile_complete,
              p.full_name, p.dob, p.gender, p.country, p.bio, p.avatar_url,
              p.created_at, p.updated_at
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    const row = result.rows[0];

    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      isProfileComplete: row.is_profile_complete,
      profile: {
        fullName: row.full_name,
        dob: row.dob,
        gender: row.gender,
        country: row.country,
        bio: row.bio,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * PUT /users/photo — Upload profile photo (file already on S3 via multer-s3).
 * Constructs CloudFront URL and updates the profile record.
 */
const uploadPhoto = async (userId, file) => {
  if (!file) {
    const err = new Error('No file provided');
    err.statusCode = 400;
    err.error = 'NoFile';
    throw err;
  }

  // Build CloudFront CDN URL from the S3 key
  const cdnUrl = `https://${config.s3.cloudfrontDomain}/${file.key}`;

  await db.query(
    `UPDATE profiles SET avatar_url = $1, updated_at = NOW()
     WHERE user_id = $2`,
    [cdnUrl, userId],
  );

  logger.info('Profile photo uploaded', { userId, cdnUrl });

  return { avatarUrl: cdnUrl };
};

/**
 * GET /users/:id — Get a public user profile.
 */
const getPublicProfile = async (userId) => {
  const result = await db.query(
    `SELECT u.id, u.email, u.created_at,
            p.full_name, p.gender, p.country, p.bio, p.avatar_url
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

  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    profile: {
      fullName: row.full_name,
      gender: row.gender,
      country: row.country,
      bio: row.bio,
      avatarUrl: row.avatar_url,
    },
  };
};

module.exports = {
  saveProfile,
  uploadPhoto,
  getPublicProfile,
};
