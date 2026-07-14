const crypto = require('crypto');
const { query: db, getClient } = require('../../config/database');
const { sendEmail, wrapEmail, sendTripCancelledEmail } = require('../../utils/mailer');
const { createAndSendNotifications, createAndSendNotification, notifySafely } = require('../../utils/fcm.util');
const { batchDeleteFromS3, getPresignedDownloadUrl } = require('../../utils/s3.util');
const { createInviteSmartLink } = require('../../utils/branch.util');
const { generateInviteShareText } = require('../../utils/shareText.util');
const config = require('../../config');
const logger = require('../../utils/logger');
const {
  normalizeLocationInput,
  locationKeywordsFromList,
  primaryFromLocations,
  insertLocations,
  replaceLocations,
  loadTripLocations,
  loadTripLocationsBatch,
  attachLocationsToTrip,
} = require('../../utils/locations.util');
const { resolveBannerUrl } = require('../../utils/banner.util');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcDaysToGo = (startDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((start - today) / 86400000));
};

const toDateStr = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// Returns true only for URLs that live in our own S3 bucket / CloudFront distribution
const isOwnS3Url = (url) => {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    if (config.s3.cloudfrontDomain && hostname === config.s3.cloudfrontDomain) return true;
    if (config.s3.bucket && hostname.startsWith(config.s3.bucket)) return true;
    return false;
  } catch {
    return false;
  }
};

// Generate a presigned URL for a banner that is stored in our S3 bucket.
// External URLs (Unsplash, etc.) pass through unchanged.
const resolvePresignedBannerUrl = async (rawUrl) => {
  if (!rawUrl || !isOwnS3Url(rawUrl)) return rawUrl || null;
  try {
    const key = new URL(rawUrl).pathname.replace(/^\//, '');
    if (!key) return rawUrl;
    return await getPresignedDownloadUrl(key);
  } catch {
    return rawUrl;
  }
};

const formatTrip = (t, locations = null) => {
  const attached = attachLocationsToTrip(t, locations);
  return {
    id: t.id,
    name: t.name,
    startDate: toDateStr(t.start_date),
    endDate: toDateStr(t.end_date),
    location: attached.location,
    locations: attached.locations,
    coverPhotoUrl: t.cover_photo_url,
    bannerImageUrl: t.banner_image_url || null,
    bannerCropFraction: t.banner_crop_fraction || null,
    archivedAt: t.archived_at || null,
    createdBy: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
};

// Async wrapper — resolves presigned banner URL then merges into formatted trip
const enrichTrip = async (t, locations = null) => {
  const bannerImageUrl = await resolvePresignedBannerUrl(t.banner_image_url);
  return { ...formatTrip(t, locations), bannerImageUrl };
};

const enrichTripWithLocations = async (t) => {
  const locations = await loadTripLocations(db, t.id);
  return enrichTrip(t, locations);
};

// ─── Create Trip ──────────────────────────────────────────────────────────────

const createTrip = async (userId, body) => {
  const {
    name, startDate, endDate, reminders,
    friendIds = [], emails = [], bannerImageUrl = null, bannerCropFraction = null,
  } = body;

  const normalizedLocations = normalizeLocationInput(body);
  if (normalizedLocations.length === 0) {
    const err = new Error('At least one location is required');
    err.statusCode = 422;
    err.error = 'VALIDATION_ERROR';
    throw err;
  }

  const primary = primaryFromLocations(normalizedLocations);
  const locationKeywords = locationKeywordsFromList(normalizedLocations);

  // Fallback chain: user upload → keyword match → generic travel photo
  const resolvedBanner = bannerImageUrl
    || await resolveBannerUrl([locationKeywords, name].filter(Boolean).join(' '));

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Insert trip
    const tripResult = await client.query(
      `INSERT INTO trips (name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url, banner_crop_fraction)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, startDate, endDate, primary.name, primary.lat, primary.lng, userId, resolvedBanner, bannerCropFraction ? JSON.stringify(bannerCropFraction) : null],
    );
    const trip = tripResult.rows[0];

    await insertLocations(client, 'trip_locations', 'trip_id', trip.id, normalizedLocations);

    // Add creator as admin
    await client.query(
      'INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3)',
      [trip.id, userId, 'admin'],
    );

    // Schedule reminders at configurable UTC time (default 03:30 UTC = 09:00 IST)
    if (reminders) {
      const HOUR = parseInt(process.env.REMINDER_HOUR_UTC ?? '3');
      const MIN  = parseInt(process.env.REMINDER_MIN_UTC  ?? '30');
      const start = new Date(startDate);
      start.setUTCHours(HOUR, MIN, 0, 0);

      const remindersToCreate = [
        { type: 'trip_start',    date: new Date(start) },
        { type: '1_day_before',  date: new Date(start.getTime() - 86400000) },
        { type: '3_days_before', date: new Date(start.getTime() - 3 * 86400000) },
        { type: '1_week_before', date: new Date(start.getTime() - 7 * 86400000) },
      ];
      for (const r of remindersToCreate) {
        if (r.date > new Date()) {
          await client.query(
            `INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (trip_id, reminder_type) WHERE sent_at IS NULL
             DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at`,
            [trip.id, r.type, r.date.toISOString()],
          );
        }
      }
    }

    await client.query('COMMIT');

    // ── Post-commit side effects (fire-and-forget) ──
    const inviterResult = await db(
      'SELECT p.full_name FROM profiles p WHERE p.user_id = $1',
      [userId],
    );
    const inviterName = inviterResult.rows[0]?.full_name || 'A fellow traveller';

    // Add friendIds directly to trip_members + FCM
    const addedUsers = [];
    for (const friendId of friendIds) {
      try {
        const { rowCount } = await db(
          `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'member')
           ON CONFLICT (trip_id, user_id) DO NOTHING`,
          [trip.id, friendId],
        );
        if (rowCount > 0) addedUsers.push(friendId);
      } catch (err) {
        logger.error('Failed to add friend to trip on creation', { friendId, error: err.message });
      }
    }

    if (addedUsers.length > 0) {
      const usersResult = await db(
        'SELECT id, fcm_token FROM users WHERE id = ANY($1::uuid[])',
        [addedUsers],
      );
      createAndSendNotifications(
        usersResult.rows,
        { title: `${name} — ${inviterName} added you!`, body: 'Open GatherGo to see the trip' },
        'TRIP_MEMBER_ADDED',
        { tripId: trip.id, screen: 'trips' },
      );
    }

    // Send Branch-linked email invites
    for (const email of emails) {
      (async () => {
        try {
          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 3600000);
          let branchUrl = null;
          try {
            branchUrl = await createInviteSmartLink({ token, inviterName, context: name, type: 'trip' });
          } catch (e) {
            branchUrl = `${config.appDeepLinkBaseUrl || 'https://gatherrgo.com'}/invite/trip/${token}`;
            logger.warn('Branch link failed, using plain URL', { error: e.message });
          }
          await db(
            `INSERT INTO trip_invites (trip_id, invited_by, email, token, expires_at, branch_url)
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (token) DO NOTHING`,
            [trip.id, userId, email, token, expiresAt.toISOString(), branchUrl],
          );
          await sendEmail({
            to: email,
            subject: `${inviterName} invited you to "${name}" on GatherGo`,
            html: buildInviteEmail({ inviterName, tripName: name, deepLink: branchUrl, expiresAt }),
            text: `${inviterName} invited you to join "${name}". Accept: ${branchUrl}`,
          });
        } catch (err) {
          logger.error('Failed to process email invite on trip creation', { email, error: err.message });
        }
      })();
    }

    const countResult = await db('SELECT COUNT(*) FROM trip_members WHERE trip_id = $1', [trip.id]);

    return {
      ...await enrichTrip(trip, normalizedLocations),
      memberCount: parseInt(countResult.rows[0].count, 10),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('createTrip failed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

// ─── Get Trips (list) ────────────────────────────────────────────────────────

const getTrips = async (userId, { status, page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;
  const safLimit = Math.min(limit, 100);

  let dateFilter = '';
  let archiveFilter = 'AND t.archived_at IS NULL'; // exclude archived from all normal lists
  let orderBy = 'ORDER BY t.start_date ASC';

  if (status === 'upcoming') {
    dateFilter = 'AND t.start_date > CURRENT_DATE';
    orderBy = 'ORDER BY t.start_date ASC';
  } else if (status === 'past') {
    dateFilter = 'AND t.end_date < CURRENT_DATE';
    orderBy = 'ORDER BY t.end_date DESC';
  } else if (status === 'ongoing') {
    dateFilter = 'AND t.start_date <= CURRENT_DATE AND t.end_date >= CURRENT_DATE';
    orderBy = 'ORDER BY t.start_date ASC';
  } else if (status === 'archived') {
    archiveFilter = 'AND t.archived_at IS NOT NULL';
    orderBy = 'ORDER BY t.archived_at DESC';
  }

  const result = await db(
    `SELECT
       t.*,
       COUNT(tm2.user_id)::int AS member_count,
       COUNT(*) OVER()::int    AS total_count,
       COALESCE(
         (
           SELECT json_agg(avatar)
           FROM (
             SELECT json_build_object(
               'id', tmx.user_id::text,
               'uri', COALESCE(
                 CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url NOT LIKE 'https://undefined/%' AND p.avatar_url NOT LIKE '%/undefined%' THEN p.avatar_url ELSE NULL END,
                 'https://i.pravatar.cc/150?u=' || tmx.user_id::text
               )
             ) AS avatar
             FROM trip_members tmx
             JOIN profiles p ON p.user_id = tmx.user_id
             WHERE tmx.trip_id = t.id
             ORDER BY tmx.joined_at ASC
             LIMIT 5
           ) a
         ),
         '[]'::json
       ) AS member_avatars
     FROM trips t
     JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
     LEFT JOIN trip_members tm2 ON tm2.trip_id = t.id
     WHERE 1=1 ${archiveFilter} ${dateFilter}
     GROUP BY t.id
     ${orderBy}
     LIMIT $2 OFFSET $3`,
    [userId, safLimit, offset],
  );

  const total = result.rows[0]?.total_count || 0;
  const tripIds = result.rows.map((t) => t.id);
  const locationsMap = await loadTripLocationsBatch(db, tripIds);

  const trips = await Promise.all(result.rows.map(async (t) => ({
    ...await enrichTrip(t, locationsMap.get(t.id) || []),
    memberCount: t.member_count,
    memberAvatars: t.member_avatars || [],
  })));

  return { trips, total, page, limit: safLimit };
};

// ─── Get Trip Detail ──────────────────────────────────────────────────────────
// Single SQL query with subqueries — no N+1

const getTripById = async (tripId, currentUserId) => {
  const tripResult = await db(
    `SELECT
       t.*,
       (SELECT COUNT(*) FROM trip_members WHERE trip_id = t.id)::int AS member_count,
       (SELECT COUNT(*) FROM photos WHERE parent_type = 'trip' AND parent_id = t.id)::int AS photo_video_count,
       (SELECT COUNT(*) FROM docs WHERE parent_type = 'trip' AND parent_id = t.id)::int AS doc_count,
       (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE parent_type = 'trip' AND parent_id = t.id) AS total_expense_amount,
       (SELECT COUNT(*) FROM expenses WHERE parent_type = 'trip' AND parent_id = t.id)::int AS expense_count,
       (SELECT COUNT(*) FROM polls WHERE parent_type = 'trip' AND parent_id = t.id)::int AS poll_count,
       (SELECT COUNT(*) FROM notes WHERE parent_type = 'trip' AND parent_id = t.id)::int AS note_count,
       (SELECT COUNT(*) FROM trip_activities WHERE trip_id = t.id AND is_completed = false)::int AS upcoming_activity_count,
       (SELECT COUNT(*) FROM trip_activities WHERE trip_id = t.id AND is_completed = true)::int AS completed_activity_count,
       -- Unread counts: items added by others after this user's last view of each section
       -- If no view record exists COALESCE falls back to NOW() so first-visit badge = 0
       (SELECT COUNT(*) FROM docs
        WHERE parent_type = 'trip' AND parent_id = t.id
          AND uploaded_by != $2
          AND created_at > COALESCE(
            (SELECT viewed_at FROM section_views WHERE user_id = $2 AND parent_type = 'trip' AND parent_id = t.id AND section = 'docs'),
            NOW()))::int AS unread_docs,
       (SELECT COUNT(*) FROM photos
        WHERE parent_type = 'trip' AND parent_id = t.id
          AND uploaded_by != $2
          AND created_at > COALESCE(
            (SELECT viewed_at FROM section_views WHERE user_id = $2 AND parent_type = 'trip' AND parent_id = t.id AND section = 'photos'),
            NOW()))::int AS unread_photos,
       (SELECT COUNT(*) FROM expenses
        WHERE parent_type = 'trip' AND parent_id = t.id
          AND created_by != $2
          AND created_at > COALESCE(
            (SELECT viewed_at FROM section_views WHERE user_id = $2 AND parent_type = 'trip' AND parent_id = t.id AND section = 'expenses'),
            NOW()))::int AS unread_expenses,
       (SELECT COUNT(*) FROM polls
        WHERE parent_type = 'trip' AND parent_id = t.id
          AND created_by != $2
          AND created_at > COALESCE(
            (SELECT viewed_at FROM section_views WHERE user_id = $2 AND parent_type = 'trip' AND parent_id = t.id AND section = 'polls'),
            NOW()))::int AS unread_polls,
       (SELECT COUNT(*) FROM notes
        WHERE parent_type = 'trip' AND parent_id = t.id
          AND created_by != $2
          AND created_at > COALESCE(
            (SELECT viewed_at FROM section_views WHERE user_id = $2 AND parent_type = 'trip' AND parent_id = t.id AND section = 'notes'),
            NOW()))::int AS unread_notes,
       (SELECT COUNT(*) FROM trip_members
        WHERE trip_id = t.id
          AND user_id != $2
          AND joined_at > COALESCE(
            (SELECT viewed_at FROM section_views WHERE user_id = $2 AND parent_type = 'trip' AND parent_id = t.id AND section = 'members'),
            NOW()))::int AS unread_members
     FROM trips t
     WHERE t.id = $1`,
    [tripId, currentUserId],
  );
  if (tripResult.rowCount === 0) return null;
  const t = tripResult.rows[0];

  const membersResult = await db(
    `SELECT tm.user_id, p.full_name AS name, p.avatar_url, tm.role, tm.joined_at
     FROM trip_members tm
     LEFT JOIN profiles p ON p.user_id = tm.user_id
     WHERE tm.trip_id = $1
     ORDER BY tm.joined_at ASC`,
    [tripId],
  );

  const locations = await loadTripLocations(db, tripId);

  return {
    trip: {
      ...await enrichTrip(t, locations),
      daysToGo: calcDaysToGo(t.start_date),
    },
    members: membersResult.rows.map((m) => ({
      userId: m.user_id,
      name: m.name,
      avatarUrl: m.avatar_url,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    stats: {
      memberCount: t.member_count,
      photoVideoCount: t.photo_video_count,
      docCount: t.doc_count,
      totalExpenseAmount: parseFloat(t.total_expense_amount),
      expenseCount: t.expense_count,
      pollCount: t.poll_count,
      noteCount: t.note_count,
      upcomingActivityCount: t.upcoming_activity_count,
      completedActivityCount: t.completed_activity_count,
    },
    unreadCounts: {
      docs: t.unread_docs,
      photos: t.unread_photos,
      expenses: t.unread_expenses,
      polls: t.unread_polls,
      notes: t.unread_notes,
      members: t.unread_members,
    },
  };
};

// ─── Update Trip ──────────────────────────────────────────────────────────────

const updateTrip = async (tripId, updates) => {
  // Validate date ordering. Edits can be partial (only startDate or only endDate
  // sent), so resolve the effective start/end against the stored trip before
  // comparing — otherwise a new startDate after the existing endDate slips through.
  if (updates.startDate !== undefined || updates.endDate !== undefined) {
    const existing = await db('SELECT start_date, end_date FROM trips WHERE id = $1', [tripId]);
    if (existing.rows.length === 0) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      err.error = 'NOT_FOUND';
      throw err;
    }
    const effectiveStart = new Date(updates.startDate ?? existing.rows[0].start_date);
    const effectiveEnd = new Date(updates.endDate ?? existing.rows[0].end_date);
    if (effectiveEnd < effectiveStart) {
      const err = new Error('endDate must be on or after startDate');
      err.statusCode = 422;
      err.error = 'VALIDATION_ERROR';
      throw err;
    }
  }

  const hasLocationsArray = Array.isArray(updates.locations);
  const hasLegacyLocation = updates.location && typeof updates.location === 'object';
  const normalizedLocations = (hasLocationsArray || hasLegacyLocation)
    ? normalizeLocationInput(updates)
    : null;

  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
  if (updates.startDate !== undefined) { fields.push(`start_date = $${idx++}`); values.push(updates.startDate); }
  if (updates.endDate !== undefined) { fields.push(`end_date = $${idx++}`); values.push(updates.endDate); }

  if (normalizedLocations) {
    if (normalizedLocations.length === 0) {
      const err = new Error('At least one location is required');
      err.statusCode = 422;
      err.error = 'VALIDATION_ERROR';
      throw err;
    }
    const primary = primaryFromLocations(normalizedLocations);
    fields.push(`location_name = $${idx++}`); values.push(primary.name);
    fields.push(`location_lat = $${idx++}`); values.push(primary.lat);
    fields.push(`location_lng = $${idx++}`); values.push(primary.lng);
  } else {
    if (updates.location?.name !== undefined) { fields.push(`location_name = $${idx++}`); values.push(updates.location.name); }
    if (updates.location?.lat !== undefined) { fields.push(`location_lat = $${idx++}`); values.push(updates.location.lat); }
    if (updates.location?.lng !== undefined) { fields.push(`location_lng = $${idx++}`); values.push(updates.location.lng); }
  }

  if (updates.bannerImageUrl !== undefined) { fields.push(`banner_image_url = $${idx++}`); values.push(updates.bannerImageUrl); }
  if (updates.bannerCropFraction !== undefined) { fields.push(`banner_crop_fraction = $${idx++}`); values.push(updates.bannerCropFraction ? JSON.stringify(updates.bannerCropFraction) : null); }

  if (fields.length === 0 && !normalizedLocations) {
    const existing = await db('SELECT * FROM trips WHERE id = $1', [tripId]);
    return enrichTripWithLocations(existing.rows[0]);
  }

  if (!normalizedLocations) {
    values.push(tripId);
    const result = await db(
      `UPDATE trips SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values,
    );
    const trip = result.rows[0];

    if (updates.startDate) {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        const HOUR = parseInt(process.env.REMINDER_HOUR_UTC ?? '3');
        const MIN  = parseInt(process.env.REMINDER_MIN_UTC  ?? '30');
        const start = new Date(updates.startDate);
        start.setUTCHours(HOUR, MIN, 0, 0);
        const remindersToCreate = [
          { type: 'trip_start',    date: new Date(start) },
          { type: '1_day_before',  date: new Date(start.getTime() - 86400000) },
          { type: '3_days_before', date: new Date(start.getTime() - 3 * 86400000) },
          { type: '1_week_before', date: new Date(start.getTime() - 7 * 86400000) },
        ];
        for (const r of remindersToCreate) {
          if (r.date > new Date()) {
            await client.query(
              `INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (trip_id, reminder_type) WHERE sent_at IS NULL
               DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at`,
              [trip.id, r.type, r.date.toISOString()],
            );
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    return enrichTripWithLocations(trip);
  }

  const client = await getClient();
  let trip;
  try {
    await client.query('BEGIN');

    if (fields.length > 0) {
      values.push(tripId);
      const result = await client.query(
        `UPDATE trips SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        values,
      );
      trip = result.rows[0];
    } else {
      const existing = await client.query('SELECT * FROM trips WHERE id = $1', [tripId]);
      trip = existing.rows[0];
    }

    if (normalizedLocations) {
      await replaceLocations(client, 'trip_locations', 'trip_id', tripId, normalizedLocations);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  if (updates.startDate) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const HOUR = parseInt(process.env.REMINDER_HOUR_UTC ?? '3');
      const MIN  = parseInt(process.env.REMINDER_MIN_UTC  ?? '30');
      const start = new Date(updates.startDate);
      start.setUTCHours(HOUR, MIN, 0, 0);
      const remindersToCreate = [
        { type: 'trip_start',    date: new Date(start) },
        { type: '1_day_before',  date: new Date(start.getTime() - 86400000) },
        { type: '3_days_before', date: new Date(start.getTime() - 3 * 86400000) },
        { type: '1_week_before', date: new Date(start.getTime() - 7 * 86400000) },
      ];
      for (const r of remindersToCreate) {
        if (r.date > new Date()) {
          await client.query(
            `INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (trip_id, reminder_type) WHERE sent_at IS NULL
             DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at`,
            [trip.id, r.type, r.date.toISOString()],
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const locations = await loadTripLocations(db, tripId);
  return enrichTrip(trip, locations);
};

// ─── Delete Trip ──────────────────────────────────────────────────────────────

const deleteTrip = async (tripId, actorId) => {
  const [docsResult, photosResult, membersResult, tripResult] = await Promise.all([
    db("SELECT s3_key FROM docs WHERE parent_type = 'trip' AND parent_id = $1", [tripId]),
    db("SELECT s3_key FROM photos WHERE parent_type = 'trip' AND parent_id = $1", [tripId]),
    db(
      `SELECT u.id, u.fcm_token, u.email, p.full_name
       FROM trip_members tm
       JOIN users u ON u.id = tm.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE tm.trip_id = $1${actorId ? ' AND tm.user_id != $2' : ''}`,
      actorId ? [tripId, actorId] : [tripId],
    ),
    db('SELECT name FROM trips WHERE id = $1', [tripId]),
  ]);

  const tripName = tripResult.rows[0]?.name || 'Your trip';
  const s3Keys = [
    ...docsResult.rows.map((r) => r.s3_key),
    ...photosResult.rows.map((r) => r.s3_key),
  ];

  if (s3Keys.length > 0) await batchDeleteFromS3(s3Keys);
  await db('DELETE FROM trips WHERE id = $1', [tripId]);

  if (membersResult.rows.length > 0) {
    createAndSendNotifications(
      membersResult.rows,
      { title: 'Trip Cancelled', body: `"${tripName}" has been cancelled by the organiser.` },
      'TRIP_CANCELLED',
      { tripId, tripName },
    ).catch(() => {});

    // Immediate email to each member — fire-and-forget
    for (const member of membersResult.rows) {
      if (member.email) {
        sendTripCancelledEmail(member.email, member.full_name, tripName)
          .catch((err) => logger.error('sendTripCancelledEmail failed', { userId: member.id, error: err.message }));
      }
    }
  }
};

// ─── Invite Members ───────────────────────────────────────────────────────────
//
// Nobody is ever added to a trip without their consent. An invite creates a
// *pending request* that the invitee approves or declines in their Requests tab.
//
// friendIds / email / phone that matches an account → pending request + push
// email / phone with no account                     → invite link (they sign up,
//                                                     signup matching turns it into
//                                                     a request — see
//                                                     invites.service.linkPendingInvitesToUser)

const inviteToTrip = async (tripId, invitedBy, { friendIds = [], emails = [], phones = [], shareOnly = false }) => {
  const inviterResult = await db(
    'SELECT p.full_name FROM profiles p WHERE p.user_id = $1',
    [invitedBy],
  );
  const inviterName = inviterResult.rows[0]?.full_name || 'A fellow traveller';

  const tripResult = await db('SELECT name FROM trips WHERE id = $1', [tripId]);
  if (tripResult.rowCount === 0) {
    const e = new Error('Trip not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const tripName = tripResult.rows[0].name;

  if (shareOnly) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600000);
    let branchUrl = null;
    try {
      branchUrl = await createInviteSmartLink({ token, inviterName, context: tripName, type: 'trip' });
    } catch (e) {
      branchUrl = `${config.appDeepLinkBaseUrl || 'https://gatherrgo.com'}/invite/trip/${token}`;
      logger.warn('Branch link failed, using plain URL', { error: e.message });
    }
    await db(
      `INSERT INTO trip_invites (trip_id, invited_by, email, phone, token, expires_at, branch_url)
       VALUES ($1, $2, NULL, NULL, $3, $4, $5) ON CONFLICT (token) DO NOTHING`,
      [tripId, invitedBy, token, expiresAt.toISOString(), branchUrl],
    );
    const shareText = generateInviteShareText({ inviterName, branchUrl, type: 'trip', context: tripName });
    return { added: [], invited: [{ branchUrl, expiresAt: expiresAt.toISOString() }], skipped: [], shareText };
  }

  const added = [];      // nobody is auto-added any more — kept so the response shape is stable
  const requested = [];  // existing users who now have a pending request
  const invited = [];    // no account yet — sent an install link
  const skipped = [];

  // ── Path A: friendIds — pending request ─────────────────────
  for (const friendId of friendIds) {
    // Verify friendship (bidirectional)
    const friendCheck = await db(
      `SELECT id FROM friend_connections
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [invitedBy, friendId],
    );
    if (friendCheck.rowCount === 0) {
      const e = new Error(`User ${friendId} is not in your friends list`);
      e.statusCode = 400; e.error = 'NOT_A_FRIEND'; e.userId = friendId; throw e;
    }

    await createTripRequest({ tripId, tripName, invitedBy, inviterName, userId: friendId, requested, skipped });
  }

  // ── Path B: emails ───────────────────────────────────────────
  for (const email of emails) {
    await processEmailOrPhoneInvite({ email, phone: null, tripId, tripName, invitedBy, inviterName, invited, requested, skipped });
  }

  // ── Path C: phones ───────────────────────────────────────────
  for (const phone of phones) {
    await processEmailOrPhoneInvite({ email: null, phone, tripId, tripName, invitedBy, inviterName, invited, requested, skipped });
  }

  return { added, requested, invited, skipped };
};

/**
 * Create a pending trip request for a user who already has an account.
 * They see it in their Requests tab and must approve it to become a member.
 */
const createTripRequest = async ({ tripId, tripName, invitedBy, inviterName, userId, requested, skipped }) => {
  if (userId === invitedBy) {
    skipped.push({ userId, reason: 'self' });
    return;
  }

  const memberCheck = await db(
    'SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2',
    [tripId, userId],
  );
  if (memberCheck.rowCount > 0) {
    skipped.push({ userId, reason: 'already_member' });
    return;
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600000);

  // The partial unique index on (trip_id, user_id) WHERE status = 'pending' makes
  // re-inviting someone who already has an open request a no-op.
  const insertResult = await db(
    `INSERT INTO trip_invites (trip_id, invited_by, user_id, token, expires_at, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [tripId, invitedBy, userId, token, expiresAt.toISOString()],
  );

  if (insertResult.rowCount === 0) {
    skipped.push({ userId, reason: 'already_invited' });
    return;
  }

  const inviteId = insertResult.rows[0].id;
  const profile = await db('SELECT full_name AS name FROM profiles WHERE user_id = $1', [userId]);

  notifySafely(() => createAndSendNotification(
    userId,
    {
      title: `${inviterName} invited you to "${tripName}"`,
      body: 'Open Requests to approve or decline',
    },
    'TRIP_REQUEST',
    { tripId, inviteId, screen: 'requests' },
  ), 'TRIP_REQUEST');

  requested.push({ userId, inviteId, name: profile.rows[0]?.name || null, method: 'request' });
};

// Helper for email/phone invite path
const processEmailOrPhoneInvite = async ({
  email, phone, tripId, tripName, invitedBy, inviterName, invited, requested, skipped,
}) => {
  const identifier = email || phone;
  try {
    // Check if a GatherGo user exists with this email or phone
    let existingUser = null;
    if (email) {
      const r = await db('SELECT id FROM users WHERE email = $1', [email]);
      existingUser = r.rows[0] || null;
    } else if (phone) {
      const r = await db('SELECT id FROM users WHERE phone = $1', [phone]);
      existingUser = r.rows[0] || null;
    }

    // They already have an account — send a request, not a link. Friendship is not
    // required: approving the request is the consent step.
    if (existingUser) {
      await createTripRequest({
        tripId, tripName, invitedBy, inviterName, userId: existingUser.id, requested, skipped,
      });
      return;
    }

    // No account — create invite token + link + email. They sign up with this same
    // email/phone and signup matching turns this row into a request.
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600000);
    let branchUrl = null;

    try {
      branchUrl = await createInviteSmartLink({ token, inviterName, context: tripName, type: 'trip' });
    } catch (e) {
      branchUrl = `${config.appDeepLinkBaseUrl || 'https://gatherrgo.com'}/invite/trip/${token}`;
      logger.warn('Branch link failed, using plain URL', { error: e.message });
    }

    await db(
      `INSERT INTO trip_invites (trip_id, invited_by, email, phone, token, expires_at, branch_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (token) DO NOTHING`,
      [tripId, invitedBy, email, phone, token, expiresAt.toISOString(), branchUrl],
    );

    // Send email if we have one (fire-and-forget)
    if (email) {
      sendEmail({
        to: email,
        subject: `${inviterName} invited you to "${tripName}" on GatherGo`,
        html: buildInviteEmail({ inviterName, tripName, deepLink: branchUrl, expiresAt }),
        text: `${inviterName} invited you to join "${tripName}". Accept: ${branchUrl}`,
      }).catch((err) => logger.error('SES invite email failed', { email, error: err.message }));
    }

    invited.push({ [email ? 'email' : 'phone']: identifier, branchUrl, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    logger.error('Failed to process invite', { identifier, error: err.message });
  }
};

// ─── Token-based invite (legacy deep link) ────────────────────────────────────

const getInviteByToken = async (token) => {
  const result = await db(
    `SELECT
       ti.*,
       t.name AS trip_name,
       p.full_name AS inviter_name
     FROM trip_invites ti
     JOIN trips t ON t.id = ti.trip_id
     JOIN profiles p ON p.user_id = ti.invited_by
     WHERE ti.token = $1`,
    [token],
  );
  return result.rows[0] || null;
};

const acceptInvite = async (token, userId) => {
  const invite = await getInviteByToken(token);
  if (!invite) {
    const err = new Error('Invite token not found'); err.statusCode = 404; err.error = 'NOT_FOUND'; throw err;
  }
  if (new Date(invite.expires_at) < new Date()) {
    const err = new Error('Invite token has expired'); err.statusCode = 410; err.error = 'TOKEN_EXPIRED'; throw err;
  }
  if (invite.accepted_at) {
    const err = new Error('Invite already accepted'); err.statusCode = 409; err.error = 'CONFLICT'; throw err;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [invite.trip_id, userId],
    );
    await client.query(
      'UPDATE trip_invites SET accepted_at = NOW(), user_id = $1 WHERE token = $2',
      [userId, token],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }

  return { tripId: invite.trip_id, tripName: invite.trip_name, role: 'member' };
};

// ─── Archive / Unarchive Trip ─────────────────────────────────────────────────

const archiveTrip = async (tripId) => {
  const result = await db(
    'UPDATE trips SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
    [tripId],
  );
  if (result.rowCount === 0) {
    const err = new Error('Trip not found'); err.statusCode = 404; err.error = 'NOT_FOUND'; throw err;
  }
  return enrichTripWithLocations(result.rows[0]);
};

const unarchiveTrip = async (tripId) => {
  const result = await db(
    'UPDATE trips SET archived_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
    [tripId],
  );
  if (result.rowCount === 0) {
    const err = new Error('Trip not found'); err.statusCode = 404; err.error = 'NOT_FOUND'; throw err;
  }
  return enrichTripWithLocations(result.rows[0]);
};

// ─── Confirm Trip (TRIP_MILESTONE) ───────────────────────────────────────────

const confirmTrip = async (tripId) => {
  const [tripResult, membersResult] = await Promise.all([
    db('SELECT name FROM trips WHERE id = $1', [tripId]),
    db(
      `SELECT u.id, u.fcm_token FROM trip_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.trip_id = $1`,
      [tripId],
    ),
  ]);

  if (tripResult.rowCount === 0) {
    const err = new Error('Trip not found'); err.statusCode = 404; err.error = 'NOT_FOUND'; throw err;
  }

  const tripName = tripResult.rows[0].name;

  if (membersResult.rows.length > 0) {
    createAndSendNotifications(
      membersResult.rows,
      { title: 'Trip Confirmed 🎉', body: `"${tripName}" has been confirmed. You're going!` },
      'TRIP_MILESTONE',
      { tripId, tripName },
    ).catch(() => {});
  }

  return { tripId, tripName, notified: membersResult.rows.length };
};

// ─── Email template ───────────────────────────────────────────────────────────

const buildInviteEmail = ({ inviterName, tripName, deepLink, expiresAt }) =>
  wrapEmail(`
    <h2 style="margin:0 0 10px 0; font-size:22px; font-weight:700; color:#111827;">
      You&rsquo;re invited!
    </h2>
    <p style="margin:0 0 28px 0; font-size:15px; color:#374151; line-height:1.65;">
      <strong>${inviterName}</strong> has invited you to join
      <strong>&ldquo;${tripName}&rdquo;</strong> on Gatherrgo.
    </p>

    <!-- Bulletproof full-width-on-mobile CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" class="cta-table"
           style="margin:0 auto 28px auto; width:100%; max-width:280px;">
      <tr>
        <td class="cta-td" style="border-radius:8px; background-color:#0D9488;">
          <a href="${deepLink}" class="cta-link"
             style="display:block; padding:14px 32px; color:#ffffff;
                    text-decoration:none; font-size:16px; font-weight:700;
                    border-radius:8px; text-align:center;
                    font-family:'Segoe UI',Arial,sans-serif;">
            Accept Invite
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0; font-size:13px; color:#6B7280; text-align:center;">
      This invite expires on <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.
    </p>
  `);

const VALID_SECTIONS = ['docs', 'members', 'photos', 'expenses', 'polls', 'notes'];

const markSectionViewed = async (tripId, userId, section) => {
  if (!VALID_SECTIONS.includes(section)) throw new Error('Invalid section');
  await db(
    `INSERT INTO section_views (user_id, parent_type, parent_id, section, viewed_at)
     VALUES ($1, 'trip', $2, $3, NOW())
     ON CONFLICT (user_id, parent_type, parent_id, section)
     DO UPDATE SET viewed_at = NOW()`,
    [userId, tripId, section],
  );
};

module.exports = {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  archiveTrip,
  unarchiveTrip,
  confirmTrip,
  inviteToTrip,
  getInviteByToken,
  acceptInvite,
  markSectionViewed,
};
