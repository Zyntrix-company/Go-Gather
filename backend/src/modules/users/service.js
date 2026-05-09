const db = require('../../config/database');
const config = require('../../config');
const logger = require('../../utils/logger');
const { sendWelcomeEmail } = require('../../utils/mailer');
const { createAndSendNotification } = require('../../utils/fcm.util');
const legalService = require('../legal/legal.service');

/**
 * Derive a URL-safe slug from a full name and find a DB-unique variant.
 * Pattern must satisfy /^[a-z0-9_]{3,20}$/.
 * @param {string} fullName
 * @param {object} dbClient  — pg client or pool (must support .query())
 */
const generateUniqueUsername = async (fullName, dbClient) => {
  // Use only the first name + _gg suffix (e.g. "Alice Smith" → "alice_gg")
  const firstName = fullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const raw = firstName.length >= 2 ? firstName : (firstName + 'user');
  const base = raw.slice(0, 12); // leave room for _gg + numeric suffix within 20 chars

  let candidate = `${base}_gg`;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await dbClient.query(
      'SELECT id FROM users WHERE username = $1',
      [candidate],
    );
    if (rows.length === 0) break;
    candidate = `${base}_gg${suffix}`;
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

    // Fire welcome email — non-blocking
    sendWelcomeEmail(row.email, row.full_name).catch((err) => {
      logger.error('Failed to send welcome email', { userId, error: err.message });
    });

    const firstName = row.full_name?.split(' ')[0] || 'there';
    createAndSendNotification(
      userId,
      {
        title: 'Welcome to GatherGo! 🎉',
        body: `Hey ${firstName}, your account is all set. Start planning your first trip!`,
      },
      'WELCOME',
      {},
    ).catch((err) => logger.error('Failed to send welcome notification', { userId, error: err.message }));


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
 * PUT /users/photo — Upload profile photo.
 * Accepts a file with buffer (memory storage) OR an already-uploaded multer-s3 file.
 * Stores a CloudFront / S3 URL in the DB and returns a short-lived presigned URL
 * for immediate display in the client (bypasses any CloudFront distribution restrictions).
 */
const uploadPhoto = async (userId, file) => {
  if (!file) {
    const err = new Error('No file provided');
    err.statusCode = 400;
    err.error = 'NoFile';
    throw err;
  }

  const { v4: uuidv4 } = require('uuid');
  const path = require('path');
  const { uploadToS3, getPresignedDownloadUrl } = require('../../utils/s3.util');

  let cdnUrl;
  let s3Key;

  if (file.buffer) {
    // Memory-storage path: upload buffer to S3 directly (same as gallery photos)
    const ext = path.extname(file.originalname || 'photo.jpg').toLowerCase() || '.jpg';
    s3Key = `avatars/${uuidv4()}${ext}`;
    cdnUrl = await uploadToS3(file.buffer, s3Key, file.mimetype);
  } else {
    // multer-s3 path: file was streamed to S3; key is already available
    s3Key = file.key;
    cdnUrl = config.s3.cloudfrontDomain
      ? `https://${config.s3.cloudfrontDomain}/${file.key}`
      : `https://${config.s3.bucket}.s3.${config.aws.region}.amazonaws.com/${file.key}`;
  }

  await db.query(
    `UPDATE profiles SET avatar_url = $1, updated_at = NOW()
     WHERE user_id = $2`,
    [cdnUrl, userId],
  );

  logger.info('Profile photo uploaded', { userId, cdnUrl, s3Key });

  // Generate a presigned URL so the client can display the photo immediately
  // without any CloudFront cache/access restrictions.
  let presignedUrl = null;
  try {
    presignedUrl = await getPresignedDownloadUrl(s3Key, 3600);
  } catch {
    // Non-fatal — client will fall back to the CDN URL
  }

  return {
    avatarUrl: presignedUrl || cdnUrl,  // presigned preferred; CDN as fallback
    cdnUrl,                              // permanent URL stored in DB
  };
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
  const { fullName, username, bio, country, gender, dob } = updates;

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
  if (gender !== undefined) {
    setClauses.push(`gender = $${paramIdx++}`);
    params.push(gender);
  }
  if (dob !== undefined) {
    setClauses.push(`dob = $${paramIdx++}`);
    params.push(dob);
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
            p.full_name, p.dob, p.gender, p.bio, p.country, p.avatar_url, p.updated_at
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
      dob: row.dob,
      gender: row.gender,
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

  // Presign avatar URL — same logic as normalizeAvatarUrl in friends.service.js
  logger.info('[getUserProfile] raw avatarUrl from DB', { targetId, rawAvatar: row.avatarUrl });
  let avatarUrl = null;
  const rawAvatar = row.avatarUrl;
  if (rawAvatar && !rawAvatar.includes('https://undefined')) {
    try {
      const { getPresignedDownloadUrl } = require('../../utils/s3.util');
      const cfDomain = config.s3.cloudfrontDomain;
      let s3Key = null;
      if (cfDomain && rawAvatar.startsWith(`https://${cfDomain}/`)) {
        s3Key = rawAvatar.slice(`https://${cfDomain}/`.length).split('?')[0];
      } else {
        const parsed = new URL(rawAvatar);
        s3Key = parsed.pathname.replace(/^\//, '').split('?')[0];
      }
      if (s3Key && s3Key.startsWith('avatars/')) {
        avatarUrl = await getPresignedDownloadUrl(s3Key, 3600);
      } else {
        avatarUrl = rawAvatar;
      }
    } catch {
      avatarUrl = rawAvatar;
    }
  }

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatarUrl,
    bio: row.bio,
    country: row.country,
    friendshipStatus,
    connectionId: row.connectionId || null,
    stats: {
      tripCount:   row.tripCount,
      eventCount:  0,
      friendCount: row.friendCount,
    },
  };
};

/**
 * GET /users/:id/gallery — All non-archived trips and events the user is a member of.
 * Banner images are presigned so they're viewable on the client.
 */
const getUserGallery = async (targetId) => {
  const { getPresignedDownloadUrl } = require('../../utils/s3.util');
  const cloudfrontDomain = config.s3?.cloudfrontDomain;

  // Resolve a raw URL for banner display.
  // - External URLs (Unsplash, etc.) pass through unchanged.
  // - CloudFront CDN URLs are already publicly accessible — return as-is.
  //   (Generating a presigned S3 URL from a CDN URL fails when OAC is active.)
  // - Direct S3 URLs need a presigned URL for private-bucket access.
  const presignBanner = async (rawUrl) => {
    if (!rawUrl) return null;
    try {
      const hostname = new URL(rawUrl).hostname;
      // If CloudFront is configured and this URL is from our CDN, return it directly.
      if (cloudfrontDomain && hostname === cloudfrontDomain) return rawUrl;
      // For direct S3 URLs, generate a presigned download URL.
      if (hostname.endsWith('.amazonaws.com')) {
        const key = new URL(rawUrl).pathname.replace(/^\//, '');
        return key ? await getPresignedDownloadUrl(key) : rawUrl;
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  };

  const [tripsResult, eventsResult] = await Promise.all([
    db.query(
      `SELECT
         t.id,
         t.name,
         COALESCE(t.banner_image_url, t.cover_photo_url) AS "bannerImageUrl",
         t.location_name   AS location,
         t.end_date        AS "endDate",
         (SELECT COUNT(*)::int FROM trip_members WHERE trip_id = t.id)                        AS "memberCount",
         (SELECT COUNT(*)::int FROM photos       WHERE parent_type = 'trip' AND parent_id = t.id) AS "photoCount",
         m.subtitle        AS "gallerySubtitle"
       FROM trips t
       JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
       LEFT JOIN user_gallery_item_meta m
         ON m.user_id = $1 AND m.parent_type = 'trip' AND m.parent_id = t.id
       WHERE t.archived_at IS NULL
       ORDER BY t.end_date DESC
       LIMIT 50`,
      [targetId],
    ),
    db.query(
      `SELECT
         e.id,
         e.name,
         e.banner_image_url                        AS "bannerImageUrl",
         e.location_name                           AS location,
         e.event_date                              AS "endDate",
         (SELECT COUNT(*)::int FROM event_members  WHERE event_id = e.id)                         AS "memberCount",
         (SELECT COUNT(*)::int FROM photos         WHERE parent_type = 'event' AND parent_id = e.id) AS "photoCount",
         m.subtitle        AS "gallerySubtitle"
       FROM events e
       JOIN event_members em ON em.event_id = e.id AND em.user_id = $1
       LEFT JOIN user_gallery_item_meta m
         ON m.user_id = $1 AND m.parent_type = 'event' AND m.parent_id = e.id
       WHERE e.archived_at IS NULL
       ORDER BY e.event_date DESC
       LIMIT 50`,
      [targetId],
    ),
  ]);

  // Presign all banner URLs in parallel
  const [trips, events] = await Promise.all([
    Promise.all(tripsResult.rows.map(async (row) => ({
      ...row,
      bannerImageUrl: await presignBanner(row.bannerImageUrl),
    }))),
    Promise.all(eventsResult.rows.map(async (row) => ({
      ...row,
      bannerImageUrl: await presignBanner(row.bannerImageUrl),
    }))),
  ]);

  return { trips, events };
};

/**
 * GET /users/:id/photos — All photos uploaded by a user, grouped by trip/event + activity.
 * Returns structure: { trips: [{id, name, activities: [{id, title, photos:[]}], photos:[]}, ...], events: [{id, name, photos:[]}, ...] }
 */
const getUserPhotos = async (targetId) => {
  const { getPresignedDownloadUrl } = require('../../utils/s3.util');

  // Fetch all photos uploaded by this user, with parent + activity info
  const photosResult = await db.query(
    `SELECT
       ph.id,
       ph.parent_type,
       ph.parent_id,
       ph.activity_id,
       ph.file_url,
       ph.s3_key,
       ph.mime_type,
       ph.caption,
       ph.created_at,
       ta.title AS activity_title,
       CASE ph.parent_type
         WHEN 'trip'  THEN t.name
         WHEN 'event' THEN e.name
       END AS parent_name,
       CASE ph.parent_type
         WHEN 'trip'  THEN t.cover_photo_url
         WHEN 'event' THEN e.cover_photo_url
       END AS parent_cover
     FROM photos ph
     LEFT JOIN trip_activities ta ON ta.id = ph.activity_id
     LEFT JOIN trips  t ON t.id = ph.parent_id AND ph.parent_type = 'trip'
     LEFT JOIN events e ON e.id = ph.parent_id AND ph.parent_type = 'event'
     WHERE ph.uploaded_by = $1
     ORDER BY ph.created_at DESC
     LIMIT 500`,
    [targetId],
  );

  // Generate presigned URLs and group by parent
  const tripMap  = new Map();
  const eventMap = new Map();

  for (const row of photosResult.rows) {
    // Mirror the same CloudFront guard used in shared photos.service.js:
    // when CloudFront is configured the stored file_url IS the CDN URL — skip presigning
    // (presigned S3 URLs fail when the bucket uses OAC, which blocks direct S3 access).
    const cloudfrontDomain = config.s3?.cloudfrontDomain;
    const presignedUrl = cloudfrontDomain ? null : await getPresignedDownloadUrl(row.s3_key);
    const photo = {
      id:            row.id,
      fileUrl:       row.file_url,
      url:           presignedUrl || row.file_url,
      mimeType:      row.mime_type,
      caption:       row.caption,
      activityId:    row.activity_id || null,
      activityTitle: row.activity_title || null,
      createdAt:     row.created_at,
    };

    if (row.parent_type === 'trip') {
      if (!tripMap.has(row.parent_id)) {
        tripMap.set(row.parent_id, {
          id:         row.parent_id,
          name:       row.parent_name,
          coverPhoto: row.parent_cover,
          activities: new Map(),
          photos:     [],
        });
      }
      const trip = tripMap.get(row.parent_id);
      if (photo.activityId) {
        if (!trip.activities.has(photo.activityId)) {
          trip.activities.set(photo.activityId, { id: photo.activityId, title: photo.activityTitle, photos: [] });
        }
        trip.activities.get(photo.activityId).photos.push(photo);
      } else {
        trip.photos.push(photo);
      }
    } else if (row.parent_type === 'event') {
      if (!eventMap.has(row.parent_id)) {
        eventMap.set(row.parent_id, {
          id:         row.parent_id,
          name:       row.parent_name,
          coverPhoto: row.parent_cover,
          photos:     [],
        });
      }
      eventMap.get(row.parent_id).photos.push(photo);
    }
  }

  // Serialize Maps to arrays
  const trips = Array.from(tripMap.values()).map((t) => ({
    ...t,
    activities: Array.from(t.activities.values()),
  }));

  return {
    trips,
    events: Array.from(eventMap.values()),
  };
};

/**
 * GET /users/notification-settings
 */
const getNotificationSettings = async (userId) => {
  const result = await db.query(
    'SELECT notification_settings, timezone FROM users WHERE id = $1',
    [userId],
  );
  const row = result.rows[0];
  return { settings: row?.notification_settings || {}, timezone: row?.timezone || 'Asia/Kolkata' };
};

/**
 * PATCH /users/notification-settings
 */
const updateNotificationSettings = async (userId, patch) => {
  const { email_digest, lock_screen_reminders, quiet_hours_enabled, quiet_start, quiet_end, timezone } = patch;

  if (email_digest !== undefined && !['daily', 'weekly', 'never'].includes(email_digest)) {
    const err = new Error('email_digest must be daily, weekly, or never');
    err.statusCode = 400; err.error = 'VALIDATION_ERROR'; throw err;
  }

  const settingsPatch = {};
  if (email_digest !== undefined)         settingsPatch.email_digest = email_digest;
  if (lock_screen_reminders !== undefined) settingsPatch.lock_screen_reminders = lock_screen_reminders;
  if (quiet_hours_enabled !== undefined)   settingsPatch.quiet_hours_enabled = quiet_hours_enabled;
  if (quiet_start !== undefined)           settingsPatch.quiet_start = quiet_start;
  if (quiet_end !== undefined)             settingsPatch.quiet_end = quiet_end;

  await db.query(
    `UPDATE users
     SET notification_settings = notification_settings || $1::jsonb,
         timezone = COALESCE($2, timezone),
         updated_at = NOW()
     WHERE id = $3`,
    [JSON.stringify(settingsPatch), timezone || null, userId],
  );

  return getNotificationSettings(userId);
};

/**
 * GET /users/legal-status — compare user ack versions to current published.
 */
const getLegalStatus = async (userId) => {
  const [privacyCur, termsCur, userRow] = await Promise.all([
    legalService.getCurrentPublished('privacy'),
    legalService.getCurrentPublished('terms'),
    db.query(
      'SELECT privacy_policy_ack_version, terms_ack_version FROM users WHERE id = $1',
      [userId],
    ),
  ]);
  const u = userRow.rows[0];
  const ackP = u?.privacy_policy_ack_version ?? null;
  const ackT = u?.terms_ack_version ?? null;
  const curPv = privacyCur?.version ?? null;
  const curTv = termsCur?.version ?? null;

  return {
    privacy: {
      currentVersion: curPv,
      acknowledgedVersion: ackP,
      needsAck: Boolean(curPv && ackP !== curPv),
      effectiveAt: privacyCur?.effectiveAt ?? null,
    },
    terms: {
      currentVersion: curTv,
      acknowledgedVersion: ackT,
      needsAck: Boolean(curTv && ackT !== curTv),
      effectiveAt: termsCur?.effectiveAt ?? null,
    },
  };
};

/**
 * POST /users/legal-ack — set ack to current published when client sends matching version(s).
 */
const acknowledgeLegal = async (userId, { privacyVersion, termsVersion }) => {
  const hasP = privacyVersion !== undefined && privacyVersion !== null && String(privacyVersion).trim() !== '';
  const hasT = termsVersion !== undefined && termsVersion !== null && String(termsVersion).trim() !== '';
  if (!hasP && !hasT) {
    const err = new Error('Provide privacyVersion and/or termsVersion matching the current published versions');
    err.statusCode = 400;
    err.error = 'LegalAckEmpty';
    throw err;
  }

  const privacyCur = await legalService.getCurrentPublished('privacy');
  const termsCur = await legalService.getCurrentPublished('terms');

  if (hasP) {
    const v = String(privacyVersion).trim();
    if (!privacyCur || v !== privacyCur.version) {
      const err = new Error('privacyVersion does not match the current published Privacy Policy');
      err.statusCode = 400;
      err.error = 'LegalAckMismatch';
      throw err;
    }
  }
  if (hasT) {
    const v = String(termsVersion).trim();
    if (!termsCur || v !== termsCur.version) {
      const err = new Error('termsVersion does not match the current published Terms');
      err.statusCode = 400;
      err.error = 'LegalAckMismatch';
      throw err;
    }
  }

  const sets = [];
  const vals = [];
  if (hasP) {
    vals.push(privacyCur.version);
    sets.push(`privacy_policy_ack_version = $${vals.length}`);
    sets.push('privacy_policy_ack_at = NOW()');
  }
  if (hasT) {
    vals.push(termsCur.version);
    sets.push(`terms_ack_version = $${vals.length}`);
    sets.push('terms_ack_at = NOW()');
  }
  vals.push(userId);
  const idPlaceholder = vals.length;
  await db.query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idPlaceholder}`,
    vals,
  );

  return getLegalStatus(userId);
};

/**
 * PATCH /users/me/gallery-items/:parentType/:parentId/subtitle
 * Upsert a per-user gallery subtitle for a trip or event the caller is a member of.
 * Pass subtitle = null / empty string to clear it.
 */
const upsertGallerySubtitle = async (userId, parentType, parentId, subtitle) => {
  // Verify membership — same rule as appearing in getUserGallery
  const memberCheck = parentType === 'trip'
    ? await db.query('SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2', [parentId, userId])
    : await db.query('SELECT 1 FROM event_members WHERE event_id = $1 AND user_id = $2', [parentId, userId]);

  if (memberCheck.rowCount === 0) {
    const e = new Error('Not a member of this trip/event');
    e.statusCode = 403;
    e.error = 'FORBIDDEN';
    throw e;
  }

  const cleanSubtitle = subtitle && subtitle.trim() ? subtitle.trim() : null;

  await db.query(
    `INSERT INTO user_gallery_item_meta (user_id, parent_type, parent_id, subtitle, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, parent_type, parent_id)
     DO UPDATE SET subtitle = EXCLUDED.subtitle, updated_at = NOW()`,
    [userId, parentType, parentId, cleanSubtitle],
  );

  return { subtitle: cleanSubtitle };
};

module.exports = {
  saveProfile,
  uploadPhoto,
  getPublicProfile,
  updateProfile,
  searchUsers,
  getUserProfile,
  getUserGallery,
  getUserPhotos,
  getNotificationSettings,
  updateNotificationSettings,
  getLegalStatus,
  acknowledgeLegal,
  upsertGallerySubtitle,
};
