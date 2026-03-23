const crypto = require('crypto');
const { query: db, getClient } = require('../../config/database');
const { sendEmail } = require('../../utils/mailer');
const { notifyUsers, sendFCMNotification } = require('../../utils/fcm.util');
const { batchDeleteFromS3 } = require('../../utils/s3.util');
const { createInviteSmartLink } = require('../../utils/branch.util');
const config = require('../../config');
const logger = require('../../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcDaysToGo = (startDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((start - today) / 86400000));
};

const toDateStr = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

const formatTrip = (t) => ({
  id: t.id,
  name: t.name,
  startDate: toDateStr(t.start_date),
  endDate: toDateStr(t.end_date),
  location: {
    name: t.location_name,
    lat: t.location_lat ? parseFloat(t.location_lat) : null,
    lng: t.location_lng ? parseFloat(t.location_lng) : null,
  },
  coverPhotoUrl: t.cover_photo_url,
  bannerImageUrl: t.banner_image_url || null,
  archivedAt: t.archived_at || null,
  createdBy: t.created_by,
  createdAt: t.created_at,
  updatedAt: t.updated_at,
});

// ─── Create Trip ──────────────────────────────────────────────────────────────

const createTrip = async (userId, body) => {
  const {
    name, startDate, endDate, location = {}, reminders,
    friendIds = [], emails = [], bannerImageUrl = null,
  } = body;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Insert trip
    const tripResult = await client.query(
      `INSERT INTO trips (name, start_date, end_date, location_name, location_lat, location_lng, created_by, banner_image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, startDate, endDate, location.name || null, location.lat || null, location.lng || null, userId, bannerImageUrl],
    );
    const trip = tripResult.rows[0];

    // Add creator as admin
    await client.query(
      'INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3)',
      [trip.id, userId, 'admin'],
    );

    // Schedule reminders (09:00 IST = 03:30 UTC)
    if (reminders) {
      const start = new Date(startDate);
      start.setUTCHours(3, 30, 0, 0); // 09:00 IST

      const remindersToCreate = [
        { type: 'trip_start', date: new Date(start) },
        { type: '1_day_before', date: new Date(start.getTime() - 86400000) },
        { type: '1_week_before', date: new Date(start.getTime() - 7 * 86400000) },
      ];
      for (const r of remindersToCreate) {
        if (r.date > new Date()) {
          await client.query(
            'INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at) VALUES ($1, $2, $3)',
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
      notifyUsers(usersResult.rows, {
        title: `${name} — ${inviterName} added you!`,
        body: 'Open GatherGo to see the trip',
      }, { type: 'TRIP_MEMBER_ADDED', tripId: trip.id, screen: 'trips' });
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
            branchUrl = `${config.appDeepLinkBaseUrl || 'https://gathergo.app'}/invite/trip/${token}`;
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
      ...formatTrip(trip),
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
           SELECT json_agg(avatar_url)
           FROM (
             SELECT p.avatar_url
             FROM trip_members tmx
             JOIN profiles p ON p.user_id = tmx.user_id
             WHERE tmx.trip_id = t.id AND p.avatar_url IS NOT NULL
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
  const trips = result.rows.map((t) => ({
    ...formatTrip(t),
    memberCount: t.member_count,
    memberAvatars: t.member_avatars || [],
  }));

  return { trips, total, page, limit: safLimit };
};

// ─── Get Trip Detail ──────────────────────────────────────────────────────────
// Single SQL query with subqueries — no N+1

const getTripById = async (tripId) => {
  const tripResult = await db(
    `SELECT
       t.*,
       (SELECT COUNT(*) FROM trip_members WHERE trip_id = t.id)::int AS member_count,
       (SELECT COUNT(*) FROM photos WHERE parent_type = 'trip' AND parent_id = t.id)::int AS photo_video_count,
       (SELECT COUNT(*) FROM docs WHERE parent_type = 'trip' AND parent_id = t.id)::int AS doc_count,
       (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE parent_type = 'trip' AND parent_id = t.id) AS total_expense_amount,
       (SELECT COUNT(*) FROM trip_activities WHERE trip_id = t.id AND is_completed = false)::int AS upcoming_activity_count,
       (SELECT COUNT(*) FROM trip_activities WHERE trip_id = t.id AND is_completed = true)::int AS completed_activity_count
     FROM trips t
     WHERE t.id = $1`,
    [tripId],
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

  return {
    trip: {
      ...formatTrip(t),
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
      upcomingActivityCount: t.upcoming_activity_count,
      completedActivityCount: t.completed_activity_count,
    },
  };
};

// ─── Update Trip ──────────────────────────────────────────────────────────────

const updateTrip = async (tripId, updates) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
  if (updates.startDate !== undefined) { fields.push(`start_date = $${idx++}`); values.push(updates.startDate); }
  if (updates.endDate !== undefined) { fields.push(`end_date = $${idx++}`); values.push(updates.endDate); }
  if (updates.location?.name !== undefined) { fields.push(`location_name = $${idx++}`); values.push(updates.location.name); }
  if (updates.location?.lat !== undefined) { fields.push(`location_lat = $${idx++}`); values.push(updates.location.lat); }
  if (updates.location?.lng !== undefined) { fields.push(`location_lng = $${idx++}`); values.push(updates.location.lng); }
  if (updates.bannerImageUrl !== undefined) { fields.push(`banner_image_url = $${idx++}`); values.push(updates.bannerImageUrl); }

  if (fields.length === 0) {
    const existing = await db('SELECT * FROM trips WHERE id = $1', [tripId]);
    return formatTrip(existing.rows[0]);
  }

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
      await client.query('DELETE FROM trip_reminders WHERE trip_id = $1 AND sent_at IS NULL', [tripId]);
      const start = new Date(updates.startDate);
      start.setUTCHours(3, 30, 0, 0);
      const remindersToCreate = [
        { type: 'trip_start', date: new Date(start) },
        { type: '1_day_before', date: new Date(start.getTime() - 86400000) },
        { type: '1_week_before', date: new Date(start.getTime() - 7 * 86400000) },
      ];
      for (const r of remindersToCreate) {
        if (r.date > new Date()) {
          await client.query(
            'INSERT INTO trip_reminders (trip_id, reminder_type, scheduled_at) VALUES ($1, $2, $3)',
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

  return formatTrip(trip);
};

// ─── Delete Trip ──────────────────────────────────────────────────────────────

const deleteTrip = async (tripId) => {
  const docsResult = await db("SELECT s3_key FROM docs WHERE parent_type = 'trip' AND parent_id = $1", [tripId]);
  // photos table now includes activity photos (activity_id set) — single query covers all
  const photosResult = await db("SELECT s3_key FROM photos WHERE parent_type = 'trip' AND parent_id = $1", [tripId]);

  const s3Keys = [
    ...docsResult.rows.map((r) => r.s3_key),
    ...photosResult.rows.map((r) => r.s3_key),
  ];

  if (s3Keys.length > 0) await batchDeleteFromS3(s3Keys);
  await db('DELETE FROM trips WHERE id = $1', [tripId]);
};

// ─── Invite Members — friend vs non-friend flow ───────────────────────────────
//
// friendIds → verified friendship → direct DB insert + FCM
// emails / phones → check existing user → if friend: same as friendIds
//                                       → else: Branch link + SES email

const inviteToTrip = async (tripId, invitedBy, { friendIds = [], emails = [], phones = [] }) => {
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

  const added = [];
  const invited = [];
  const skipped = [];

  // ── Path A: friendIds — direct add ──────────────────────────
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

    // Add to trip_members (skip if already a member)
    const insertResult = await db(
      `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (trip_id, user_id) DO NOTHING`,
      [tripId, friendId],
    );

    if (insertResult.rowCount === 0) {
      skipped.push({ userId: friendId, reason: 'already_member' });
      continue;
    }

    // Fetch profile for response
    const profile = await db(
      'SELECT full_name AS name FROM profiles WHERE user_id = $1',
      [friendId],
    );

    // FCM push (fire-and-forget)
    const fcmResult = await db('SELECT fcm_token FROM users WHERE id = $1', [friendId]);
    const fcmToken = fcmResult.rows[0]?.fcm_token;
    if (fcmToken) {
      sendFCMNotification(
        fcmToken,
        {
          title: `${tripName} — ${inviterName} added you!`,
          body: 'Open GatherGo to see the trip',
        },
        { type: 'TRIP_MEMBER_ADDED', tripId, screen: 'trips' },
      ).catch((err) => logger.error('FCM push failed', { err: err.message }));
    }

    added.push({ userId: friendId, name: profile.rows[0]?.name || null, method: 'direct' });
  }

  // ── Path B: emails ───────────────────────────────────────────
  for (const email of emails) {
    await processEmailOrPhoneInvite({ email, phone: null, tripId, tripName, invitedBy, inviterName, invited, added, skipped });
  }

  // ── Path C: phones ───────────────────────────────────────────
  for (const phone of phones) {
    await processEmailOrPhoneInvite({ email: null, phone, tripId, tripName, invitedBy, inviterName, invited, added, skipped });
  }

  return { added, invited, skipped };
};

// Helper for email/phone invite path
const processEmailOrPhoneInvite = async ({
  email, phone, tripId, tripName, invitedBy, inviterName, invited, added, skipped,
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

    if (existingUser) {
      // Check if they're already a trip member
      const memberCheck = await db(
        'SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2',
        [tripId, existingUser.id],
      );
      if (memberCheck.rowCount > 0) {
        skipped.push({ userId: existingUser.id, reason: 'already_member' });
        return;
      }

      // Check friendship
      const friendCheck = await db(
        `SELECT id FROM friend_connections
         WHERE status = 'accepted'
           AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
        [invitedBy, existingUser.id],
      );

      if (friendCheck.rowCount > 0) {
        // Is a friend — add directly
        await db(
          `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'member')
           ON CONFLICT (trip_id, user_id) DO NOTHING`,
          [tripId, existingUser.id],
        );
        const profile = await db('SELECT full_name AS name FROM profiles WHERE user_id = $1', [existingUser.id]);
        const fcmResult = await db('SELECT fcm_token FROM users WHERE id = $1', [existingUser.id]);
        const fcmToken = fcmResult.rows[0]?.fcm_token;
        if (fcmToken) {
          sendFCMNotification(
            fcmToken,
            { title: `${tripName} — ${inviterName} added you!`, body: 'Open GatherGo to see the trip' },
            { type: 'TRIP_MEMBER_ADDED', tripId, screen: 'trips' },
          ).catch((err) => logger.error('FCM push failed', { err: err.message }));
        }
        added.push({ userId: existingUser.id, name: profile.rows[0]?.name || null, method: 'direct' });
        return;
      }
      // Not a friend — fall through to Branch invite
    }

    // Create invite token + Branch link + SES
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600000);
    let branchUrl = null;

    try {
      branchUrl = await createInviteSmartLink({ token, inviterName, context: tripName, type: 'trip' });
    } catch (e) {
      branchUrl = `${config.appDeepLinkBaseUrl || 'https://gathergo.app'}/invite/trip/${token}`;
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
  return formatTrip(result.rows[0]);
};

const unarchiveTrip = async (tripId) => {
  const result = await db(
    'UPDATE trips SET archived_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
    [tripId],
  );
  if (result.rowCount === 0) {
    const err = new Error('Trip not found'); err.statusCode = 404; err.error = 'NOT_FOUND'; throw err;
  }
  return formatTrip(result.rows[0]);
};

// ─── Email template ───────────────────────────────────────────────────────────

const buildInviteEmail = ({ inviterName, tripName, deepLink, expiresAt }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #4F46E5;">GatherGo</h1>
  </div>
  <h2 style="color: #2D3748;">You're invited!</h2>
  <p style="color: #4A5568; font-size: 16px;">
    <strong>${inviterName}</strong> has invited you to join <strong>"${tripName}"</strong> on GatherGo.
  </p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${deepLink}"
       style="background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none;
              border-radius: 8px; font-size: 16px; font-weight: bold;">
      Accept Invite
    </a>
  </div>
  <p style="color: #718096; font-size: 14px; text-align: center;">
    This invite expires on <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.
  </p>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 30px 0;">
  <p style="color: #A0AEC0; font-size: 12px; text-align: center;">
    &copy; ${new Date().getFullYear()} GatherGo. All rights reserved.
  </p>
</body>
</html>
`;

module.exports = {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  archiveTrip,
  unarchiveTrip,
  inviteToTrip,
  getInviteByToken,
  acceptInvite,
};
