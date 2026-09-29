const crypto = require('crypto');
const { query: db, getClient } = require('../../config/database');
const config = require('../../config');
const { createAndSendNotification, notifySafely } = require('../../utils/fcm.util');
const { generateInviteShareText } = require('../../utils/shareText.util');
const { sendEmail, wrapEmail, sendConnectionRequestEmail, sendRequestAcceptedEmail } = require('../../utils/mailer');
const { getPresignedDownloadUrl } = require('../../utils/s3.util');
const logger = require('../../utils/logger');
const { phoneKey } = require('../../utils/phone.util');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns raw friendship row (both directions) or null.
 * Always checks both (a→b) and (b→a) — never assume direction.
 */
const getRawConnection = async (userA, userB) => {
  const result = await db(
    `SELECT id, requester_id, addressee_id, status
     FROM friend_connections
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)
     LIMIT 1`,
    [userA, userB],
  );
  return result.rows[0] || null;
};

/**
 * Fetch a single user's FCM token for push notifications.
 */
const getUserFcmToken = async (userId) => {
  const result = await db(
    'SELECT fcm_token FROM users WHERE id = $1',
    [userId],
  );
  return result.rows[0]?.fcm_token || null;
};
const normalizeAvatarUrl = (rawAvatarUrl) => {
  if (!rawAvatarUrl || rawAvatarUrl.includes('https://undefined')) return null;
  // Rewrite legacy direct S3 URLs (including expired presigned URLs) to CloudFront.
  const cf = config.s3?.cloudfrontDomain;
  if (cf && rawAvatarUrl.includes('.amazonaws.com/')) {
    try {
      const key = new URL(rawAvatarUrl).pathname.replace(/^\//, '');
      if (key) return `https://${cf}/${key}`;
    } catch { /* fall through */ }
  }
  return rawAvatarUrl;
};
// ─── Send Friend Request ───────────────────────────────────────────────────────

const sendFriendRequest = async (requesterId, addresseeId) => {
  if (requesterId === addresseeId) {
    const err = new Error('Cannot send a friend request to yourself');
    err.statusCode = 400;
    err.error = 'SELF_REQUEST';
    throw err;
  }

  // Verify addressee exists
  const userCheck = await db('SELECT id FROM users WHERE id = $1', [addresseeId]);
  if (userCheck.rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.error = 'USER_NOT_FOUND';
    throw err;
  }

  const existing = await getRawConnection(requesterId, addresseeId);

  if (existing) {
    if (existing.status === 'accepted') {
      const err = new Error('Already friends');
      err.statusCode = 409;
      err.error = 'ALREADY_FRIENDS';
      throw err;
    }
    if (existing.status === 'blocked') {
      const err = new Error('Action not allowed');
      err.statusCode = 403;
      err.error = 'BLOCKED';
      throw err;
    }
    if (existing.status === 'pending') {
      const err = new Error('A friend request already exists between these users');
      err.statusCode = 409;
      err.error = 'REQUEST_ALREADY_EXISTS';
      throw err;
    }
  }

  // Insert new pending request
  const result = await db(
    `INSERT INTO friend_connections (requester_id, addressee_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING id`,
    [requesterId, addresseeId],
  );
  const connectionId = result.rows[0].id;

  // Get requester's name for push notification
  const requesterResult = await db(
    'SELECT full_name FROM profiles WHERE user_id = $1',
    [requesterId],
  );
  const requesterName = requesterResult.rows[0]?.full_name || 'Someone';

  notifySafely(() => createAndSendNotification(
    addresseeId,
    {
      title: `${requesterName} sent you a friend request`,
      body: 'Open Requests to approve or decline',
    },
    'FRIEND_REQUEST',
    { connectionId, fromUserId: requesterId, screen: 'requests' },
  ), 'FRIEND_REQUEST');

  // Immediate email to addressee — fire-and-forget
  db('SELECT u.email, p.full_name FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1', [addresseeId])
    .then((r) => {
      const row = r.rows[0];
      if (row?.email) {
        sendConnectionRequestEmail(row.email, row.full_name, requesterName)
          .catch((err) => logger.error('sendConnectionRequestEmail failed', { err: err.message }));
      }
    })
    .catch(() => {});

  return { connectionId, status: 'pending' };
};

// ─── Respond to Friend Request (accept / decline) ─────────────────────────────

const respondFriendRequest = async (currentUserId, connectionId, action) => {
  const result = await db(
    'SELECT id, requester_id, addressee_id, status FROM friend_connections WHERE id = $1',
    [connectionId],
  );

  if (result.rows.length === 0) {
    const err = new Error('Friend request not found');
    err.statusCode = 404;
    err.error = 'NOT_FOUND';
    throw err;
  }

  const conn = result.rows[0];

  // Only the addressee can respond
  if (conn.addressee_id !== currentUserId) {
    const err = new Error('Only the recipient can respond to a friend request');
    err.statusCode = 403;
    err.error = 'FORBIDDEN';
    throw err;
  }

  if (conn.status !== 'pending') {
    const err = new Error('This request has already been responded to');
    err.statusCode = 409;
    err.error = 'ALREADY_RESPONDED';
    throw err;
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined';

  await db(
    'UPDATE friend_connections SET status = $1, updated_at = NOW() WHERE id = $2',
    [newStatus, connectionId],
  );

  if (action === 'accept') {
    // Get accepter's name + profile for the push
    const accepterResult = await db(
      `SELECT p.full_name, p.avatar_url
       FROM profiles p WHERE p.user_id = $1`,
      [currentUserId],
    );
    const accepter = accepterResult.rows[0] || {};
    const accepterName = accepter.full_name || 'Someone';

    createAndSendNotification(
      conn.requester_id,
      {
        title: `${accepterName} accepted your friend request!`,
        body: "You're now connected on GatherGo",
      },
      'FRIEND_ACCEPTED',
      { connectionId, userId: currentUserId, screen: 'friends' },
    ).catch((err) => logger.error('Notification failed', { err: err.message }));

    // Immediate email to the original requester — fire-and-forget
    db('SELECT u.email, p.full_name FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1', [conn.requester_id])
      .then((r) => {
        const row = r.rows[0];
        if (row?.email) {
          sendRequestAcceptedEmail(row.email, row.full_name, accepterName)
            .catch((err) => logger.error('sendRequestAcceptedEmail failed', { err: err.message }));
        }
      })
      .catch(() => {});

    return {
      connectionId,
      status: 'accepted',
      friend: {
        userId: currentUserId,
        name: accepter.full_name || null,
        avatarUrl: accepter.avatar_url || null,
      },
    };
  }

  // Declined — no push (privacy)
  return { connectionId, status: 'declined' };
};

// ─── Get Friend Requests (incoming + outgoing) ────────────────────────────────

const getFriendRequests = async (userId) => {
  const result = await db(
    `SELECT
       fc.id          AS "connectionId",
       fc.requester_id,
       fc.addressee_id,
       fc.created_at  AS "sentAt",
       p.full_name    AS name,
       p.avatar_url   AS "avatarUrl",
       pr.country
     FROM friend_connections fc
     JOIN users u ON u.id = CASE
       WHEN fc.requester_id = $1 THEN fc.addressee_id
       ELSE fc.requester_id
     END
     LEFT JOIN profiles p  ON p.user_id = u.id
     LEFT JOIN profiles pr ON pr.user_id = u.id
     WHERE (fc.requester_id = $1 OR fc.addressee_id = $1)
       AND fc.status = 'pending'
     ORDER BY fc.created_at DESC`,
    [userId],
  );

  const incoming = [];
  const outgoing = [];

  for (const row of result.rows) {
    const entry = {
      connectionId: row.connectionId,
      user: {
        id: row.requester_id === userId ? row.addressee_id : row.requester_id,
        name: row.name,
        avatarUrl: row.avatarUrl,
        country: row.country,
      },
      sentAt: row.sentAt,
    };

    if (row.addressee_id === userId) {
      incoming.push(entry);
    } else {
      outgoing.push(entry);
    }
  }

  return { incoming, outgoing };
};

// ─── Get Friends List ──────────────────────────────────────────────────────────

const getFriends = async (userId, search) => {
  const params = [userId];
  let searchClause = '';

  if (search) {
    params.push(`%${search}%`);
    searchClause = `AND (p.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
  }

  const result = await db(
    `SELECT
       fc.id                                             AS "connectionId",
       fc.updated_at                                     AS "connectedAt",
       u.id                                              AS "userId",
       u.username                                        AS tag,
       p.full_name                                       AS name,
       p.avatar_url                                      AS "avatarUrl",
       p.country,
       p.bio,
       (
         SELECT COUNT(*)::int
         FROM trip_members tm1
         JOIN trip_members tm2 ON tm1.trip_id = tm2.trip_id
         WHERE tm1.user_id = $1 AND tm2.user_id = u.id
       )                                                 AS "mutualTripCount",
       0                                                 AS "mutualEventCount"
     FROM friend_connections fc
     JOIN users u ON u.id = CASE
       WHEN fc.requester_id = $1 THEN fc.addressee_id
       ELSE fc.requester_id
     END
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE (fc.requester_id = $1 OR fc.addressee_id = $1)
       AND fc.status = 'accepted'
       ${searchClause}
     ORDER BY p.full_name ASC`,
    params,
  );

  const friends = await Promise.all(result.rows.map(async (row) => ({
    connectionId: row.connectionId,
    user: {
      id: row.userId,
      name: row.name,
      avatarUrl: normalizeAvatarUrl(row.avatarUrl),
      country: row.country,
      bio: row.bio,
      tag: row.tag,
    },
    mutualTripCount: row.mutualTripCount,
    mutualEventCount: row.mutualEventCount,
    connectedAt: row.connectedAt,
  })));

  return { friends, total: friends.length };
};

// ─── Remove Friend ────────────────────────────────────────────────────────────

const removeFriend = async (currentUserId, targetUserId) => {
  const result = await db(
    `DELETE FROM friend_connections
     WHERE ((requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1))
       AND status = 'accepted'
     RETURNING id`,
    [currentUserId, targetUserId],
  );

  if (result.rows.length === 0) {
    const err = new Error('Friendship not found');
    err.statusCode = 404;
    err.error = 'NOT_FOUND';
    throw err;
  }

  return { success: true };
};

// ─── Create Friend Invite (Branch smart link) ─────────────────────────────────

const createFriendInvite = async (inviterId, { channels, emails = [], phones = [] }) => {
  // Get inviter's name
  const inviterResult = await db(
    'SELECT full_name FROM profiles WHERE user_id = $1',
    [inviterId],
  );
  const inviterName = inviterResult.rows[0]?.full_name || 'A GatherGo user';

  // Anyone we were given who already has an account gets a real friend request —
  // it lands in their Requests tab. Only the rest need an invite link.
  const requested = [];
  const pendingEmails = [];
  const pendingPhones = [];

  for (const email of emails) {
    const r = await db('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const target = r.rows[0];
    if (!target || target.id === inviterId) {
      pendingEmails.push(email);
      continue;
    }
    try {
      const res = await sendFriendRequest(inviterId, target.id);
      requested.push({ userId: target.id, connectionId: res.connectionId, email });
    } catch (err) {
      // Already friends / already requested — nothing left to do for this person.
      logger.info('Friend invite skipped for existing user', { email, reason: err.error });
      requested.push({ userId: target.id, connectionId: null, email, skipped: err.error });
    }
  }

  for (const phone of phones) {
    const r = await db('SELECT id FROM users WHERE phone_key = $1', [phoneKey(phone)]);
    const target = r.rows[0];
    if (!target || target.id === inviterId) {
      pendingPhones.push(phone);
      continue;
    }
    try {
      const res = await sendFriendRequest(inviterId, target.id);
      requested.push({ userId: target.id, connectionId: res.connectionId, phone });
    } catch (err) {
      logger.info('Friend invite skipped for existing user', { phone, reason: err.error });
      requested.push({ userId: target.id, connectionId: null, phone, skipped: err.error });
    }
  }

  // Everyone named already has an account — no link needed.
  const isAnonymousShare = emails.length === 0 && phones.length === 0;
  if (!isAnonymousShare && pendingEmails.length === 0 && pendingPhones.length === 0) {
    return { token: null, branchUrl: null, shareText: null, expiresAt: null, requested };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600000); // 7 days

  const branchUrl = `${config.appDeepLinkBaseUrl}/invite/friend/${token}`;

  const shareText = generateInviteShareText({ inviterName, branchUrl, type: 'friend' });

  // Persist invite. Storing who it was addressed to is what lets signup matching
  // turn it into a friend request when they install and sign up.
  await db(
    `INSERT INTO friend_invites (invited_by, token, branch_url, expires_at, platform, email, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      inviterId,
      token,
      branchUrl,
      expiresAt.toISOString(),
      channels[0] || 'share',
      pendingEmails[0] || null,
      pendingPhones[0] || null,
    ],
  );

  // Fire-and-forget email invites (SES) if email channel requested
  if (channels.includes('email') && pendingEmails.length > 0) {
    for (const email of pendingEmails) {
      sendEmail({
        to: email,
        subject: `${inviterName} invited you to GatherGo`,
        html: wrapEmail(`
          <h2 style="margin:0 0 10px 0; font-size:22px; font-weight:700; color:#111827;">
            You&rsquo;re invited to Gatherrgo!
          </h2>
          <p style="margin:0 0 28px 0; font-size:15px; color:#374151; line-height:1.65;">
            <strong>${inviterName}</strong> wants to connect with you on Gatherrgo —
            the app for planning trips and gatherings with the people who matter most.
          </p>

          <!-- Bulletproof full-width-on-mobile CTA -->
          <table role="presentation" cellpadding="0" cellspacing="0" class="cta-table"
                 style="margin:0 auto 28px auto; width:100%; max-width:280px;">
            <tr>
              <td class="cta-td" style="border-radius:8px; background-color:#0D9488;">
                <a href="${branchUrl}" class="cta-link"
                   style="display:block; padding:14px 32px; color:#ffffff;
                          text-decoration:none; font-size:16px; font-weight:700;
                          border-radius:8px; text-align:center;
                          font-family:'Segoe UI',Arial,sans-serif;">
                  Join Gatherrgo
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:0; font-size:13px; color:#6B7280; text-align:center;">
            Or copy this link:
            <a href="${branchUrl}" style="color:#0D9488; word-break:break-all;">${branchUrl}</a>
          </p>
        `),
        text: shareText,
      }).catch((err) =>
        logger.error('Invite email send failed', { err: err.message, email }),
      );

    }
  }

  return {
    token,
    branchUrl,
    shareText,
    expiresAt: expiresAt.toISOString(),
    requested,
  };
};

module.exports = {
  sendFriendRequest,
  respondFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend,
  createFriendInvite,
};
