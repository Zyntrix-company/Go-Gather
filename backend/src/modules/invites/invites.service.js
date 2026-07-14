const { query: db, getClient } = require('../../config/database');
const { createAndSendNotification, createAndSendNotifications, notifySafely } = require('../../utils/fcm.util');
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
    return acceptTripInvite({ token }, claimantId);
  }

  if (type === 'event') {
    return acceptEventInvite({ token }, claimantId);
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

    // Persist + push to inviter (fire-and-forget)
    const claimantProfile = await db('SELECT full_name FROM profiles WHERE user_id = $1', [claimantId]);
    const claimantName = claimantProfile.rows[0]?.full_name || 'Someone';

    notifySafely(() => createAndSendNotification(
      inviterId,
      {
        title: `${claimantName} wants to be your friend on GatherGo`,
        body: 'Tap to accept or decline',
      },
      'FRIEND_REQUEST',
      { connectionId, fromUserId: claimantId, screen: 'requests' },
    ), 'FRIEND_REQUEST');

    return { type: 'friend', status: 'pending', connectionId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ── Accept Trip Invite (by token from a link, or by id from the Requests tab) ──

const acceptTripInvite = async ({ token = null, inviteId = null }, userId) => {
  const client = await getClient();
  let invite;
  try {
    await client.query('BEGIN');

    const lockResult = await client.query(
      `SELECT id, trip_id, invited_by, user_id
       FROM trip_invites
       WHERE ($1::text IS NULL OR token = $1)
         AND ($2::uuid IS NULL OR id = $2)
         AND expires_at > NOW()
         AND status = 'pending'
       FOR UPDATE`,
      [token, inviteId],
    );

    if (lockResult.rows.length === 0) {
      // Idempotent: if this user already accepted it, treat as success.
      const existing = await client.query(
        `SELECT trip_id, user_id, status FROM trip_invites
         WHERE ($1::text IS NULL OR token = $1) AND ($2::uuid IS NULL OR id = $2)`,
        [token, inviteId],
      );
      await client.query('ROLLBACK');

      const row = existing.rows[0];
      if (row?.user_id === userId && row.status === 'accepted') {
        return { type: 'trip', tripId: row.trip_id };
      }

      const err = new Error('Invite is invalid, expired, or already responded to');
      err.statusCode = 404;
      err.error = 'INVALID_INVITE';
      throw err;
    }

    invite = lockResult.rows[0];

    // A request addressed to someone else can never be accepted by this user.
    if (invite.user_id && invite.user_id !== userId) {
      await client.query('ROLLBACK');
      const err = new Error('This invite belongs to another user');
      err.statusCode = 403;
      err.error = 'FORBIDDEN';
      throw err;
    }

    await client.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (trip_id, user_id) DO NOTHING`,
      [invite.trip_id, userId],
    );

    await client.query(
      `UPDATE trip_invites
       SET status = 'accepted', accepted_at = NOW(), user_id = $1
       WHERE id = $2`,
      [userId, invite.id],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  // Everything below is post-commit and must not be able to fail the acceptance.
  let tripName = 'Your trip';
  try {
    const [tripResult, adminResult, joinerProfile] = await Promise.all([
      db('SELECT name FROM trips WHERE id = $1', [invite.trip_id]),
      db(`SELECT user_id FROM trip_members WHERE trip_id = $1 AND role = 'admin' LIMIT 1`, [invite.trip_id]),
      db('SELECT full_name FROM profiles WHERE user_id = $1', [userId]),
    ]);
    tripName = tripResult.rows[0]?.name || tripName;
    const adminId    = adminResult.rows[0]?.user_id;
    const joinerName = joinerProfile.rows[0]?.full_name || 'Someone';

    if (adminId) {
      notifySafely(() => createAndSendNotification(
        adminId,
        { title: `${joinerName} accepted your trip invite`, body: 'Tap to see trip members' },
        'TRIP_INVITE_ACCEPTED',
        { tripId: invite.trip_id, newMemberId: userId, screen: 'trip' },
      ), 'TRIP_INVITE_ACCEPTED');
    }

    const otherMembers = await db(
      `SELECT u.id, u.fcm_token FROM trip_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.trip_id = $1 AND tm.user_id != $2 AND tm.user_id != $3`,
      [invite.trip_id, userId, adminId || userId],
    );
    if (otherMembers.rows.length > 0) {
      notifySafely(() => createAndSendNotifications(
        otherMembers.rows,
        { title: 'New Member Joined', body: `${joinerName} joined "${tripName}".` },
        'NEW_MEMBER_JOINED',
        { tripId: invite.trip_id },
      ), 'NEW_MEMBER_JOINED');
    }
  } catch (err) {
    logger.error('Post-accept notifications failed', { tripId: invite.trip_id, err: err.message });
  }

  return { type: 'trip', tripId: invite.trip_id, tripName };
};

// ── Accept Event Invite ───────────────────────────────────────────────────────

const acceptEventInvite = async ({ token = null, inviteId = null }, userId) => {
  const client = await getClient();
  let invite;
  try {
    await client.query('BEGIN');

    const lockResult = await client.query(
      `SELECT id, event_id, invited_by, user_id
       FROM event_invites
       WHERE ($1::text IS NULL OR token = $1)
         AND ($2::uuid IS NULL OR id = $2)
         AND expires_at > NOW()
         AND status = 'pending'
       FOR UPDATE`,
      [token, inviteId],
    );

    if (lockResult.rows.length === 0) {
      const existing = await client.query(
        `SELECT event_id, user_id, status FROM event_invites
         WHERE ($1::text IS NULL OR token = $1) AND ($2::uuid IS NULL OR id = $2)`,
        [token, inviteId],
      );
      await client.query('ROLLBACK');

      const row = existing.rows[0];
      if (row?.user_id === userId && row.status === 'accepted') {
        return { type: 'event', eventId: row.event_id };
      }

      const err = new Error('Invite is invalid, expired, or already responded to');
      err.statusCode = 404;
      err.error = 'INVALID_INVITE';
      throw err;
    }

    invite = lockResult.rows[0];

    if (invite.user_id && invite.user_id !== userId) {
      await client.query('ROLLBACK');
      const err = new Error('This invite belongs to another user');
      err.statusCode = 403;
      err.error = 'FORBIDDEN';
      throw err;
    }

    await client.query(
      `INSERT INTO event_members (event_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [invite.event_id, userId],
    );

    await client.query(
      `UPDATE event_invites
       SET status = 'accepted', accepted_at = NOW(), user_id = $1
       WHERE id = $2`,
      [userId, invite.id],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  let eventName = 'Your event';
  try {
    const [eventResult, adminResult, joinerProfile] = await Promise.all([
      db('SELECT name FROM events WHERE id = $1', [invite.event_id]),
      db(`SELECT user_id FROM event_members WHERE event_id = $1 AND role = 'admin' LIMIT 1`, [invite.event_id]),
      db('SELECT full_name FROM profiles WHERE user_id = $1', [userId]),
    ]);
    eventName = eventResult.rows[0]?.name || eventName;
    const adminId    = adminResult.rows[0]?.user_id;
    const joinerName = joinerProfile.rows[0]?.full_name || 'Someone';

    if (adminId) {
      notifySafely(() => createAndSendNotification(
        adminId,
        { title: `${joinerName} accepted your event invite`, body: 'Tap to see event members' },
        'EVENT_INVITE_ACCEPTED',
        { eventId: invite.event_id, newMemberId: userId, screen: 'events' },
      ), 'EVENT_INVITE_ACCEPTED');
    }

    const otherMembers = await db(
      `SELECT u.id, u.fcm_token FROM event_members em
       JOIN users u ON u.id = em.user_id
       WHERE em.event_id = $1 AND em.user_id != $2 AND em.user_id != $3`,
      [invite.event_id, userId, adminId || userId],
    );
    if (otherMembers.rows.length > 0) {
      notifySafely(() => createAndSendNotifications(
        otherMembers.rows,
        { title: 'New Member Joined', body: `${joinerName} joined "${eventName}".` },
        'NEW_MEMBER_JOINED',
        { eventId: invite.event_id },
      ), 'NEW_MEMBER_JOINED');
    }
  } catch (err) {
    logger.error('Post-accept notifications failed', { eventId: invite.event_id, err: err.message });
  }

  return { type: 'event', eventId: invite.event_id, eventName };
};

// ── Decline ───────────────────────────────────────────────────────────────────

const declineInvite = async (table, inviteId, userId) => {
  const result = await db(
    `UPDATE ${table}
     SET status = 'declined', declined_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING id`,
    [inviteId, userId],
  );

  if (result.rows.length === 0) {
    const err = new Error('Request not found, already responded to, or not yours');
    err.statusCode = 404;
    err.error = 'INVALID_INVITE';
    throw err;
  }

  // The inviter is deliberately not notified of a decline (privacy — mirrors friend requests).
  return { id: inviteId, status: 'declined' };
};

const declineTripInvite  = (inviteId, userId) => declineInvite('trip_invites', inviteId, userId);
const declineEventInvite = (inviteId, userId) => declineInvite('event_invites', inviteId, userId);

// ─── Signup matching ──────────────────────────────────────────────────────────
//
// Someone with no account gets an email/SMS invite, installs the app, and signs up
// with that same email/phone. This attaches every invite that was waiting for them
// so it shows up in their Requests tab immediately.

const linkPendingInvitesToUser = async (userId, { email = null, phone = null } = {}) => {
  if (!email && !phone) return { trips: 0, events: 0, friends: 0 };

  const summary = { trips: 0, events: 0, friends: 0 };

  // ── Trips ──
  try {
    const trips = await db(
      `WITH matched AS (
         SELECT DISTINCT ON (ti.trip_id) ti.id
         FROM trip_invites ti
         WHERE ti.user_id IS NULL
           AND ti.status = 'pending'
           AND ti.expires_at > NOW()
           AND ti.invited_by <> $1
           AND ((                $2::text IS NOT NULL AND LOWER(ti.email) = LOWER($2))
             OR (                $3::text IS NOT NULL AND ti.phone = $3))
           AND NOT EXISTS (SELECT 1 FROM trip_members tm
                            WHERE tm.trip_id = ti.trip_id AND tm.user_id = $1)
           AND NOT EXISTS (SELECT 1 FROM trip_invites x
                            WHERE x.trip_id = ti.trip_id AND x.user_id = $1 AND x.status = 'pending')
         ORDER BY ti.trip_id, ti.created_at DESC
       )
       UPDATE trip_invites ti
       SET user_id = $1
       FROM matched m, trips t, profiles p
       WHERE ti.id = m.id AND t.id = ti.trip_id AND p.user_id = ti.invited_by
       RETURNING ti.id, ti.trip_id, t.name AS trip_name, p.full_name AS inviter_name`,
      [userId, email, phone],
    );
    summary.trips = trips.rows.length;

    for (const row of trips.rows) {
      notifySafely(() => createAndSendNotification(
        userId,
        {
          title: `${row.inviter_name || 'Someone'} invited you to "${row.trip_name}"`,
          body: 'Open Requests to approve or decline',
        },
        'TRIP_REQUEST',
        { tripId: row.trip_id, inviteId: row.id, screen: 'requests' },
      ), 'TRIP_REQUEST');
    }
  } catch (err) {
    logger.error('Failed to link pending trip invites', { userId, err: err.message });
  }

  // ── Events ──
  try {
    const events = await db(
      `WITH matched AS (
         SELECT DISTINCT ON (ei.event_id) ei.id
         FROM event_invites ei
         WHERE ei.user_id IS NULL
           AND ei.status = 'pending'
           AND ei.expires_at > NOW()
           AND ei.invited_by <> $1
           AND ((                $2::text IS NOT NULL AND LOWER(ei.email) = LOWER($2))
             OR (                $3::text IS NOT NULL AND ei.phone = $3))
           AND NOT EXISTS (SELECT 1 FROM event_members em
                            WHERE em.event_id = ei.event_id AND em.user_id = $1)
           AND NOT EXISTS (SELECT 1 FROM event_invites x
                            WHERE x.event_id = ei.event_id AND x.user_id = $1 AND x.status = 'pending')
         ORDER BY ei.event_id, ei.created_at DESC
       )
       UPDATE event_invites ei
       SET user_id = $1
       FROM matched m, events e, profiles p
       WHERE ei.id = m.id AND e.id = ei.event_id AND p.user_id = ei.invited_by
       RETURNING ei.id, ei.event_id, e.name AS event_name, p.full_name AS inviter_name`,
      [userId, email, phone],
    );
    summary.events = events.rows.length;

    for (const row of events.rows) {
      notifySafely(() => createAndSendNotification(
        userId,
        {
          title: `${row.inviter_name || 'Someone'} invited you to "${row.event_name}"`,
          body: 'Open Requests to approve or decline',
        },
        'EVENT_REQUEST',
        { eventId: row.event_id, inviteId: row.id, screen: 'requests' },
      ), 'EVENT_REQUEST');
    }
  } catch (err) {
    logger.error('Failed to link pending event invites', { userId, err: err.message });
  }

  // ── Friends ──
  // A friend invite addressed to this email/phone becomes a pending friend request
  // from the inviter, so it lands in the same Requests tab.
  try {
    const friendInvites = await db(
      `SELECT DISTINCT ON (fi.invited_by) fi.id, fi.token, fi.invited_by,
              p.full_name AS inviter_name
       FROM friend_invites fi
       LEFT JOIN profiles p ON p.user_id = fi.invited_by
       WHERE fi.claimed_at IS NULL
         AND fi.expires_at > NOW()
         AND fi.invited_by <> $1
         AND ((       $2::text IS NOT NULL AND LOWER(fi.email) = LOWER($2))
           OR (       $3::text IS NOT NULL AND fi.phone = $3))
       ORDER BY fi.invited_by, fi.created_at DESC`,
      [userId, email, phone],
    );

    for (const invite of friendInvites.rows) {
      const conn = await db(
        `INSERT INTO friend_connections (requester_id, addressee_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (requester_id, addressee_id) DO NOTHING
         RETURNING id`,
        [invite.invited_by, userId],
      );

      await db(
        'UPDATE friend_invites SET claimed_at = NOW(), claimed_by = $1 WHERE id = $2',
        [userId, invite.id],
      );

      await db(
        `INSERT INTO referrals (referrer_id, referred_user_id, invite_token)
         VALUES ($1, $2, $3)
         ON CONFLICT (referred_user_id) DO NOTHING`,
        [invite.invited_by, userId, invite.token],
      ).catch(() => {});

      if (conn.rows.length === 0) continue; // already connected in some form
      summary.friends += 1;

      notifySafely(() => createAndSendNotification(
        userId,
        {
          title: `${invite.inviter_name || 'Someone'} wants to be your friend`,
          body: 'Open Requests to approve or decline',
        },
        'FRIEND_REQUEST',
        { connectionId: conn.rows[0].id, fromUserId: invite.invited_by, screen: 'requests' },
      ), 'FRIEND_REQUEST');
    }
  } catch (err) {
    logger.error('Failed to link pending friend invites', { userId, err: err.message });
  }

  if (summary.trips || summary.events || summary.friends) {
    logger.info('Linked pending invites to new user', { userId, ...summary });
  }

  return summary;
};

module.exports = {
  validateInvite,
  claimInvite,
  acceptTripInvite,
  acceptEventInvite,
  declineTripInvite,
  declineEventInvite,
  linkPendingInvitesToUser,
};
