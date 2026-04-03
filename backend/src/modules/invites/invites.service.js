const { query: db, getClient } = require('../../config/database');
const { sendFCMNotification } = require('../../utils/fcm.util');
const logger = require('../../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInstallLinks = () => {
  const isLive = process.env.APP_IS_LIVE === 'true';
  return {
    android: isLive ? process.env.ANDROID_STORE_URL : process.env.ANDROID_APK_URL,
    ios:     isLive ? process.env.IOS_STORE_URL     : process.env.IOS_TESTFLIGHT_URL,
  };
};

/**
 * Search friend_invites, trip_invites for a given token.
 * Returns { row, type } or null.
 */
const findInviteByToken = async (token) => {
  // Friend invite
  const friendResult = await db(
    `SELECT fi.id, fi.invited_by, fi.expires_at, fi.claimed_at, fi.claimed_by,
            p.full_name AS inviter_name, p.avatar_url AS inviter_avatar
     FROM friend_invites fi
     LEFT JOIN profiles p ON p.user_id = fi.invited_by
     WHERE fi.token = $1`,
    [token],
  );
  if (friendResult.rows.length > 0) {
    return { row: friendResult.rows[0], type: 'friend' };
  }

  // Trip invite
  const tripResult = await db(
    `SELECT ti.id, ti.invited_by, ti.expires_at, ti.accepted_at AS claimed_at,
            ti.user_id AS claimed_by, ti.trip_id,
            t.name AS context_name,
            p.full_name AS inviter_name, p.avatar_url AS inviter_avatar
     FROM trip_invites ti
     LEFT JOIN trips t ON t.id = ti.trip_id
     LEFT JOIN profiles p ON p.user_id = ti.invited_by
     WHERE ti.token = $1`,
    [token],
  );
  if (tripResult.rows.length > 0) {
    return { row: tripResult.rows[0], type: 'trip' };
  }

  // Event invite
  const eventResult = await db(
    `SELECT ei.id, ei.invited_by, ei.expires_at, ei.accepted_at AS claimed_at,
            ei.user_id AS claimed_by, ei.event_id,
            e.name AS context_name,
            p.full_name AS inviter_name, p.avatar_url AS inviter_avatar
     FROM event_invites ei
     LEFT JOIN events e ON e.id = ei.event_id
     LEFT JOIN profiles p ON p.user_id = ei.invited_by
     WHERE ei.token = $1`,
    [token],
  );
  if (eventResult.rows.length > 0) {
    return { row: eventResult.rows[0], type: 'event' };
  }

  return null;
};

// ─── Validate Invite (public — no JWT) ────────────────────────────────────────

const validateInvite = async (token) => {
  const found = await findInviteByToken(token);

  if (!found) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  const { row, type } = found;

  if (row.claimed_at) {
    return { valid: false, reason: 'ALREADY_CLAIMED' };
  }

  if (new Date(row.expires_at) < new Date()) {
    return { valid: false, reason: 'EXPIRED' };
  }

  return {
    valid: true,
    type,
    token,
    expiresAt: row.expires_at,
    invitedBy: {
      name:      row.inviter_name   || null,
      avatarUrl: row.inviter_avatar || null,
    },
    context: {
      tripName:  type === 'trip'  ? (row.context_name || null) : null,
      eventName: type === 'event' ? (row.context_name || null) : null,
    },
    installLinks: getInstallLinks(),
  };
};

// ─── Claim Invite (authenticated) ─────────────────────────────────────────────

const claimInvite = async (token, claimantId) => {
  // First pass: identify type without locking
  const found = await findInviteByToken(token);

  if (!found) {
    const err = new Error('Invite not found');
    err.statusCode = 404;
    err.error = 'NOT_FOUND';
    throw err;
  }

  const { type } = found;

  if (type === 'friend') {
    return claimFriendInvite(token, claimantId, found.row);
  }

  if (type === 'trip') {
    return claimTripInvite(token, claimantId, found.row);
  }

  if (type === 'event') {
    return claimEventInvite(token, claimantId, found.row);
  }

  const err = new Error('Unknown invite type');
  err.statusCode = 400;
  err.error = 'INVALID_TYPE';
  throw err;
};

// ── Claim Friend Invite ───────────────────────────────────────────────────────

const claimFriendInvite = async (token, claimantId, _preloaded) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the invite row to prevent race conditions
    const lockResult = await client.query(
      `SELECT id, invited_by, claimed_at, claimed_by
       FROM friend_invites
       WHERE token = $1 AND expires_at > NOW() AND claimed_at IS NULL
       FOR UPDATE`,
      [token],
    );

    if (lockResult.rows.length === 0) {
      // Check if already claimed by this user (idempotent)
      const idempotentCheck = await client.query(
        'SELECT id, claimed_by FROM friend_invites WHERE token = $1',
        [token],
      );
      await client.query('ROLLBACK');

      if (idempotentCheck.rows[0]?.claimed_by === claimantId) {
        // Already claimed by this user — return success (idempotent)
        const conn = await db(
          `SELECT id FROM friend_connections
           WHERE (requester_id = $1 AND addressee_id = $2)
              OR (requester_id = $2 AND addressee_id = $1)`,
          [claimantId, idempotentCheck.rows[0].claimed_by],
        );
        return {
          type: 'friend',
          status: 'pending',
          connectionId: conn.rows[0]?.id || null,
        };
      }

      const err = new Error('Invite is invalid, expired, or already claimed');
      err.statusCode = 404;
      err.error = 'INVALID_INVITE';
      throw err;
    }

    const invite = lockResult.rows[0];
    const inviterId = invite.invited_by;

    // Prevent self-friend
    if (inviterId === claimantId) {
      await client.query('ROLLBACK');
      const err = new Error('Cannot claim your own invite');
      err.statusCode = 400;
      err.error = 'SELF_CLAIM';
      throw err;
    }

    // Check if already connected
    const existingConn = await client.query(
      `SELECT id, status FROM friend_connections
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [inviterId, claimantId],
    );

    let connectionId;

    if (existingConn.rows.length > 0 && existingConn.rows[0].status === 'accepted') {
      // Already friends — mark invite claimed and return
      await client.query(
        'UPDATE friend_invites SET claimed_at = NOW(), claimed_by = $1 WHERE token = $2',
        [claimantId, token],
      );
      await client.query('COMMIT');
      return { type: 'friend', status: 'accepted', connectionId: existingConn.rows[0].id };
    }

    if (existingConn.rows.length > 0) {
      connectionId = existingConn.rows[0].id;
    } else {
      // Create pending friend request
      const connResult = await client.query(
        `INSERT INTO friend_connections (requester_id, addressee_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [claimantId, inviterId],
      );
      connectionId = connResult.rows[0].id;
    }

    // Mark invite claimed
    await client.query(
      'UPDATE friend_invites SET claimed_at = NOW(), claimed_by = $1 WHERE token = $2',
      [claimantId, token],
    );

    // Record referral
    await client.query(
      `INSERT INTO referrals (referrer_id, referred_user_id, invite_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (referred_user_id) DO NOTHING`,
      [inviterId, claimantId, token],
    );

    await client.query('COMMIT');

    // FCM push to inviter (fire-and-forget)
    const [fcmResult, claimantProfile] = await Promise.all([
      db('SELECT fcm_token FROM users WHERE id = $1', [inviterId]),
      db('SELECT full_name FROM profiles WHERE user_id = $1', [claimantId]),
    ]);
    const fcmToken    = fcmResult.rows[0]?.fcm_token;
    const claimantName = claimantProfile.rows[0]?.full_name || 'Someone';

    if (fcmToken) {
      sendFCMNotification(
        fcmToken,
        {
          title: `${claimantName} wants to be your friend on GatherGo`,
          body: 'Tap to accept or decline',
        },
        {
          type:         'FRIEND_REQUEST',
          connectionId,
          fromUserId:   claimantId,
          screen:       'friends',
        },
      ).catch((err) => logger.error('FCM push failed', { err: err.message }));
    }

    return { type: 'friend', status: 'pending', connectionId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ── Claim Trip Invite ─────────────────────────────────────────────────────────

const claimTripInvite = async (token, claimantId, preloaded) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the invite row
    const lockResult = await client.query(
      `SELECT id, trip_id, invited_by, accepted_at, user_id
       FROM trip_invites
       WHERE token = $1 AND expires_at > NOW() AND accepted_at IS NULL
       FOR UPDATE`,
      [token],
    );

    if (lockResult.rows.length === 0) {
      // Idempotent check
      const idempotentCheck = await client.query(
        'SELECT trip_id, user_id FROM trip_invites WHERE token = $1',
        [token],
      );
      await client.query('ROLLBACK');

      if (idempotentCheck.rows[0]?.user_id === claimantId) {
        return { type: 'trip', tripId: idempotentCheck.rows[0].trip_id };
      }

      const err = new Error('Invite is invalid, expired, or already claimed');
      err.statusCode = 404;
      err.error = 'INVALID_INVITE';
      throw err;
    }

    const invite = lockResult.rows[0];

    // Add user to trip_members (ignore if already a member)
    await client.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (trip_id, user_id) DO NOTHING`,
      [invite.trip_id, claimantId],
    );

    // Mark invite accepted
    await client.query(
      `UPDATE trip_invites
       SET accepted_at = NOW(), user_id = $1
       WHERE token = $2`,
      [claimantId, token],
    );

    await client.query('COMMIT');

    // FCM push to trip admin (fire-and-forget)
    const [adminResult, claimantProfile] = await Promise.all([
      db(
        `SELECT u.fcm_token
         FROM trip_members tm JOIN users u ON u.id = tm.user_id
         WHERE tm.trip_id = $1 AND tm.role = 'admin'
         LIMIT 1`,
        [invite.trip_id],
      ),
      db('SELECT full_name FROM profiles WHERE user_id = $1', [claimantId]),
    ]);
    const adminFcm     = adminResult.rows[0]?.fcm_token;
    const claimantName = claimantProfile.rows[0]?.full_name || 'Someone';

    if (adminFcm) {
      sendFCMNotification(
        adminFcm,
        {
          title: `${claimantName} accepted your trip invite`,
          body: 'Tap to see trip members',
        },
        {
          type:          'TRIP_INVITE_ACCEPTED',
          tripId:        invite.trip_id,
          newMemberId:   claimantId,
          screen:        'trip',
        },
      ).catch((err) => logger.error('FCM push failed', { err: err.message }));
    }

    return { type: 'trip', tripId: invite.trip_id, tripName: preloaded.context_name || null };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ── Claim Event Invite ────────────────────────────────────────────────────────

const claimEventInvite = async (token, claimantId, preloaded) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the invite row
    const lockResult = await client.query(
      `SELECT id, event_id, invited_by, accepted_at, user_id
       FROM event_invites
       WHERE token = $1 AND expires_at > NOW() AND accepted_at IS NULL
       FOR UPDATE`,
      [token],
    );

    if (lockResult.rows.length === 0) {
      // Idempotent check
      const idempotentCheck = await client.query(
        'SELECT event_id, user_id FROM event_invites WHERE token = $1',
        [token],
      );
      await client.query('ROLLBACK');

      if (idempotentCheck.rows[0]?.user_id === claimantId) {
        return { type: 'event', eventId: idempotentCheck.rows[0].event_id };
      }

      const err = new Error('Invite is invalid, expired, or already claimed');
      err.statusCode = 404;
      err.error = 'INVALID_INVITE';
      throw err;
    }

    const invite = lockResult.rows[0];

    // Add user to event_members (ignore if already a member)
    await client.query(
      `INSERT INTO event_members (event_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [invite.event_id, claimantId],
    );

    // Mark invite accepted
    await client.query(
      `UPDATE event_invites SET accepted_at = NOW(), user_id = $1 WHERE token = $2`,
      [claimantId, token],
    );

    await client.query('COMMIT');

    // FCM push to event admin (fire-and-forget)
    const [adminResult, claimantProfile] = await Promise.all([
      db(
        `SELECT u.fcm_token
         FROM event_members em JOIN users u ON u.id = em.user_id
         WHERE em.event_id = $1 AND em.role = 'admin'
         LIMIT 1`,
        [invite.event_id],
      ),
      db('SELECT full_name FROM profiles WHERE user_id = $1', [claimantId]),
    ]);
    const adminFcm     = adminResult.rows[0]?.fcm_token;
    const claimantName = claimantProfile.rows[0]?.full_name || 'Someone';

    if (adminFcm) {
      sendFCMNotification(
        adminFcm,
        {
          title: `${claimantName} accepted your event invite`,
          body: 'Tap to see event members',
        },
        {
          type:        'EVENT_INVITE_ACCEPTED',
          eventId:     invite.event_id,
          newMemberId: claimantId,
          screen:      'events',
        },
      ).catch((err) => logger.error('FCM push failed', { err: err.message }));
    }

    return { type: 'event', eventId: invite.event_id, eventName: preloaded.context_name || null };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  validateInvite,
  claimInvite,
};
