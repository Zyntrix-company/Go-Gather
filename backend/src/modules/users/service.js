const db = require('../../config/database');
const config = require('../../config');
const logger = require('../../utils/logger');
const { sendWelcomeEmail } = require('../../utils/mailer');

/**
 * Derive a URL-safe slug from a full name and find a DB-unique variant.
 * Pattern must satisfy /^[a-z0-9_]{3,20}$/.
 * @param {string} fullName
 * @param {object} dbClient  — pg client or pool (must support .query())
 */
const generateUniqueUsername = async (fullName, dbClient) => {
  const parts = fullName.trim().split(/\s+/);
  // join all name parts, keep only [a-z0-9_], truncate to 15 to leave room for numeric suffix
  const raw = parts.join('').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15);
  // guarantee minimum length of 3
  const base = raw.length >= 3 ? raw : (raw + 'user').slice(0, 20);

  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await dbClient.query(
      'SELECT id FROM users WHERE username = $1',
      [candidate],
    );
    if (rows.length === 0) break;
    candidate = `${base.slice(0, 15)}${suffix}`;
    suffix += 1;
  }
  return candidate;
};

/**
 * POST /users/profile — Save/create the user profile after signup.
 */
const saveProfile = async (userId, profileData) => {
  // username is intentionally excluded — handle is auto-generated, not user-supplied
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

    // Auto-generate username from full name if the user doesn't have one yet
    const userRow = await client.query(
      'SELECT username FROM users WHERE id = $1',
      [userId],
    );
    if (!userRow.rows[0]?.username) {
      const generatedUsername = await generateUniqueUsername(fullName, client);
      await client.query(
        'UPDATE users SET username = $1, is_profile_complete = true, updated_at = NOW() WHERE id = $2',
        [generatedUsername, userId],
      );
    } else {
      // Mark profile as complete
      await client.query(
        'UPDATE users SET is_profile_complete = true, updated_at = NOW() WHERE id = $1',
        [userId],
      );
    }

    await client.query('COMMIT');

    // Return the updated profile
    const result = await db.query(
      `SELECT u.id, u.email, u.phone, u.username, u.is_profile_complete,
              p.full_name, p.dob, p.gender, p.country, p.bio, p.avatar_url,
              p.created_at, p.updated_at
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    const row = result.rows[0];

    // Fire welcome email — non-blocking, failure does not affect the response
    sendWelcomeEmail(row.email, row.full_name).catch((err) => {
      logger.error('Failed to send welcome email', { userId, error: err.message });
    });

    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      username: row.username,
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

/**
 * PUT /users/profile — Update profile fields including optional username.
 */
const updateProfile = async (userId, updates) => {
  const { fullName, username, bio, country } = updates;

  // Username uniqueness check
  if (username) {
    const taken = await db.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username, userId],
    );
    if (taken.rows.length > 0) {
      const err = new Error('Username is already taken');
      err.statusCode = 409;
      err.error = 'USERNAME_TAKEN';
      throw err;
    }
    await db.query(
      'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2',
      [username, userId],
    );
  }

  // Build dynamic profile update
  const setClauses = [];
  const params = [];
  let paramIdx = 1;

  if (fullName !== undefined) {
    setClauses.push(`full_name = $${paramIdx++}`);
    params.push(fullName);
  }
  if (bio !== undefined) {
    setClauses.push(`bio = $${paramIdx++}`);
    params.push(bio);
  }
  if (country !== undefined) {
    setClauses.push(`country = $${paramIdx++}`);
    params.push(country);
  }

  if (setClauses.length > 0) {
    setClauses.push('updated_at = NOW()');
    params.push(userId);
    await db.query(
      `UPDATE profiles SET ${setClauses.join(', ')} WHERE user_id = $${paramIdx}`,
      params,
    );
  }

  // Return updated profile
  const result = await db.query(
    `SELECT u.id, u.username,
            p.full_name, p.bio, p.country, p.avatar_url, p.updated_at
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    profile: {
      fullName: row.full_name,
      bio: row.bio,
      country: row.country,
      avatarUrl: row.avatar_url,
      updatedAt: row.updated_at,
    },
  };
};

/**
 * GET /users/search — Search users by name/username, include friendship status.
 * Excludes blocked users. Single query, no N+1.
 */
const searchUsers = async (searcherId, q) => {
  const result = await db.query(
    `SELECT
       u.id,
       p.full_name AS name,
       p.avatar_url AS "avatarUrl",
       p.country,
       u.username,
       fc.id        AS "connectionId",
       fc.status    AS "fcStatus",
       fc.requester_id AS "fcRequesterId"
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN friend_connections fc ON
       (fc.requester_id = $1 AND fc.addressee_id = u.id)
       OR (fc.requester_id = u.id AND fc.addressee_id = $1)
     WHERE u.id != $1
       AND (p.full_name ILIKE $2 OR u.username ILIKE $2)
       -- Exclude users who have blocked the searcher
       AND NOT EXISTS (
         SELECT 1 FROM friend_connections bl
         WHERE bl.requester_id = u.id
           AND bl.addressee_id = $1
           AND bl.status = 'blocked'
       )
       -- Exclude users the searcher has blocked
       AND NOT EXISTS (
         SELECT 1 FROM friend_connections bl
         WHERE bl.requester_id = $1
           AND bl.addressee_id = u.id
           AND bl.status = 'blocked'
       )
     ORDER BY p.full_name ASC
     LIMIT 30`,
    [searcherId, `%${q}%`],
  );

  return result.rows.map((row) => {
    let friendshipStatus = 'none';
    if (row.fcStatus === 'accepted') {
      friendshipStatus = 'accepted';
    } else if (row.fcStatus === 'pending') {
      friendshipStatus = row.fcRequesterId === searcherId ? 'pending_sent' : 'pending_received';
    } else if (row.fcStatus === 'declined') {
      friendshipStatus = 'none';
    }

    return {
      id: row.id,
      name: row.name,
      username: row.username,
      avatarUrl: row.avatarUrl,
      country: row.country,
      friendshipStatus,
      connectionId: row.connectionId || null,
    };
  });
};

/**
 * GET /users/:id/profile — Enhanced public profile with friendship status + stats.
 */
const getUserProfile = async (viewerId, targetId) => {
  // Check if target has blocked the viewer
  const blockCheck = await db.query(
    `SELECT 1 FROM friend_connections
     WHERE requester_id = $1 AND addressee_id = $2 AND status = 'blocked'`,
    [targetId, viewerId],
  );
  if (blockCheck.rows.length > 0) {
    const err = new Error('Profile not available');
    err.statusCode = 403;
    err.error = 'BLOCKED';
    throw err;
  }

  const result = await db.query(
    `SELECT
       u.id,
       u.username,
       p.full_name AS name,
       p.avatar_url AS "avatarUrl",
       p.bio,
       p.country,
       fc.id             AS "connectionId",
       fc.status         AS "fcStatus",
       fc.requester_id   AS "fcRequesterId",
       (SELECT COUNT(*)::int FROM trip_members WHERE user_id = $2) AS "tripCount",
       (SELECT COUNT(*)::int FROM friend_connections
        WHERE (requester_id = $2 OR addressee_id = $2) AND status = 'accepted') AS "friendCount"
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN friend_connections fc ON
       (fc.requester_id = $1 AND fc.addressee_id = u.id)
       OR (fc.requester_id = u.id AND fc.addressee_id = $1)
     WHERE u.id = $2`,
    [viewerId, targetId],
  );

  if (result.rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.error = 'USER_NOT_FOUND';
    throw err;
  }

  const row = result.rows[0];

  let friendshipStatus = 'none';
  if (row.fcStatus === 'accepted') {
    friendshipStatus = 'accepted';
  } else if (row.fcStatus === 'pending') {
    friendshipStatus = row.fcRequesterId === viewerId ? 'pending_sent' : 'pending_received';
  }

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    country: row.country,
    friendshipStatus,
    connectionId: row.connectionId || null,
    stats: {
      tripCount:   row.tripCount,
      eventCount:  0, // M3 events not integrated here yet
      friendCount: row.friendCount,
    },
  };
};

/**
 * GET /users/:id/gallery — Past trips and events (end_date < NOW()).
 * Visible to any authenticated user.
 */
const getUserGallery = async (targetId) => {
  const tripsResult = await db.query(
    `SELECT
       t.id,
       t.name,
       t.cover_photo_url AS "coverPhotoUrl",
       t.location_name   AS location,
       t.end_date        AS "endDate",
       (SELECT COUNT(*)::int FROM trip_members WHERE trip_id = t.id) AS "memberCount"
     FROM trips t
     JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
     WHERE t.end_date < NOW()
     ORDER BY t.end_date DESC
     LIMIT 20`,
    [targetId],
  );

  return {
    trips: tripsResult.rows,
    events: [], // M3 events to be populated when events module is complete
  };
};

module.exports = {
  saveProfile,
  uploadPhoto,
  getPublicProfile,
  updateProfile,
  searchUsers,
  getUserProfile,
  getUserGallery,
};
