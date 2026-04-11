const crypto = require('crypto');
const { query: db, getClient } = require('../../config/database');
const { sendEmail, wrapEmail } = require('../../utils/mailer');
const { sendFCMNotification, notifyUsers } = require('../../utils/fcm.util');
const { batchDeleteFromS3 } = require('../../utils/s3.util');
const { createInviteSmartLink } = require('../../utils/branch.util');
const config = require('../../config');
const logger = require('../../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateStr = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

const formatEvent = (e) => ({
  id: e.id,
  name: e.name,
  eventDate: toDateStr(e.event_date),
  eventType: e.event_type || null,
  description: e.description || null,
  location: {
    name: e.location_name || null,
    lat: e.location_lat ? parseFloat(e.location_lat) : null,
    lng: e.location_lng ? parseFloat(e.location_lng) : null,
  },
  archivedAt: e.archived_at || null,
  createdBy: e.created_by,
  createdAt: e.created_at,
  updatedAt: e.updated_at,
});

// ─── Create Event ─────────────────────────────────────────────────────────────

const createEvent = async (userId, body) => {
  const {
    name, eventDate, eventType, description, location = {}, reminders,
    friendIds = [], emails = [],
  } = body;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const eventResult = await client.query(
      `INSERT INTO events (name, event_date, event_type, description, location_name, location_lat, location_lng, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, eventDate, eventType || null, description || null, location.name || null, location.lat || null, location.lng || null, userId],
    );
    const event = eventResult.rows[0];

    // Add creator as admin
    await client.query(
      'INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, $3)',
      [event.id, userId, 'admin'],
    );

    // Schedule reminders (09:00 IST = 03:30 UTC) — event_start and 1_day_before only
    if (reminders) {
      const start = new Date(eventDate);
      start.setUTCHours(3, 30, 0, 0);

      const remindersToCreate = [
        { type: 'event_start',   date: new Date(start) },
        { type: '1_day_before',  date: new Date(start.getTime() - 86400000) },
      ];
      for (const r of remindersToCreate) {
        if (r.date > new Date()) {
          await client.query(
            'INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES ($1, $2, $3)',
            [event.id, r.type, r.date.toISOString()],
          );
        }
      }
    }

    await client.query('COMMIT');

    // ── Post-commit side effects ──
    const inviterResult = await db(
      'SELECT p.full_name FROM profiles p WHERE p.user_id = $1',
      [userId],
    );
    const inviterName = inviterResult.rows[0]?.full_name || 'A fellow organiser';

    // Add friendIds directly to event_members + FCM
    const addedUsers = [];
    for (const friendId of friendIds) {
      try {
        const { rowCount } = await db(
          `INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, 'member')
           ON CONFLICT (event_id, user_id) DO NOTHING`,
          [event.id, friendId],
        );
        if (rowCount > 0) addedUsers.push(friendId);
      } catch (err) {
        logger.error('Failed to add friend to event on creation', { friendId, error: err.message });
      }
    }

    if (addedUsers.length > 0) {
      const usersResult = await db(
        'SELECT id, fcm_token FROM users WHERE id = ANY($1::uuid[])',
        [addedUsers],
      );
      notifyUsers(usersResult.rows, {
        title: `${name} — ${inviterName} added you!`,
          body: 'Open GatherGo to see the event',
        }, { type: 'EVENT_MEMBER_ADDED', eventId: event.id, screen: 'events' });
    }

    // Send Branch-linked email invites
    for (const email of emails) {
      (async () => {
        try {
          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 3600000);
          let branchUrl = null;
          try {
            branchUrl = await createInviteSmartLink({ token, inviterName, context: name, type: 'event' });
          } catch (e) {
            branchUrl = `${config.appDeepLinkBaseUrl || 'https://gathergo.app'}/invite/event/${token}`;
            logger.warn('Branch link failed, using plain URL', { error: e.message });
          }
          await db(
            `INSERT INTO event_invites (event_id, invited_by, email, token, expires_at, branch_url)
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (token) DO NOTHING`,
            [event.id, userId, email, token, expiresAt.toISOString(), branchUrl],
          );
          await sendEmail({
            to: email,
            subject: `${inviterName} invited you to "${name}" on GatherGo`,
            html: buildInviteEmail({ inviterName, eventName: name, deepLink: branchUrl, expiresAt }),
            text: `${inviterName} invited you to join "${name}". Accept: ${branchUrl}`,
          });
        } catch (err) {
          logger.error('Failed to process email invite on event creation', { email, error: err.message });
        }
      })();
    }

    const countResult = await db('SELECT COUNT(*) FROM event_members WHERE event_id = $1', [event.id]);

    return {
      ...formatEvent(event),
      memberCount: parseInt(countResult.rows[0].count, 10),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('createEvent failed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

// ─── Get Events (list) ────────────────────────────────────────────────────────

const getEvents = async (userId, { status, page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;
  const safLimit = Math.min(limit, 100);

  let dateFilter = '';
  let archivedFilter = 'AND e.archived_at IS NULL';
  let orderBy = 'ORDER BY e.event_date ASC';

  if (status === 'upcoming') {
    dateFilter = 'AND e.event_date > CURRENT_DATE';
    orderBy = 'ORDER BY e.event_date ASC';
  } else if (status === 'past') {
    dateFilter = 'AND e.event_date < CURRENT_DATE';
    orderBy = 'ORDER BY e.event_date DESC';
  } else if (status === 'ongoing') {
    dateFilter = 'AND e.event_date = CURRENT_DATE';
    orderBy = 'ORDER BY e.event_date ASC';
  } else if (status === 'archived') {
    archivedFilter = 'AND e.archived_at IS NOT NULL';
    orderBy = 'ORDER BY e.archived_at DESC';
  }

  const result = await db(
    `SELECT
       e.*,
       COUNT(em2.user_id)::int AS member_count,
       COUNT(*) OVER()::int    AS total_count,
       COALESCE(
         (
           SELECT json_agg(avatar_url)
           FROM (
             SELECT p.avatar_url
             FROM event_members emx
             JOIN profiles p ON p.user_id = emx.user_id
             WHERE emx.event_id = e.id AND p.avatar_url IS NOT NULL
             LIMIT 5
           ) a
         ),
         '[]'::json
       ) AS member_avatars
     FROM events e
     JOIN event_members em ON em.event_id = e.id AND em.user_id = $1
     LEFT JOIN event_members em2 ON em2.event_id = e.id
     WHERE 1=1 ${archivedFilter} ${dateFilter}
     GROUP BY e.id
     ${orderBy}
     LIMIT $2 OFFSET $3`,
    [userId, safLimit, offset],
  );

  const total = result.rows[0]?.total_count || 0;
  const events = result.rows.map((e) => ({
    ...formatEvent(e),
    memberCount: e.member_count,
    memberAvatars: e.member_avatars || [],
  }));

  return { events, total, page, limit: safLimit };
};

// ─── Get Event Detail ─────────────────────────────────────────────────────────

const getEventById = async (eventId) => {
  const eventResult = await db(
    `SELECT
       e.*,
       (SELECT COUNT(*) FROM event_members WHERE event_id = e.id)::int AS member_count,
       (SELECT COUNT(*) FROM photos
        WHERE parent_type = 'event' AND parent_id = e.id)::int AS photo_video_count,
       (SELECT COUNT(*) FROM docs
        WHERE parent_type = 'event' AND parent_id = e.id)::int AS doc_count,
       (SELECT COALESCE(SUM(amount), 0) FROM expenses
        WHERE parent_type = 'event' AND parent_id = e.id) AS total_expense_amount
     FROM events e
     WHERE e.id = $1`,
    [eventId],
  );
  if (eventResult.rowCount === 0) return null;
  const e = eventResult.rows[0];

  const membersResult = await db(
    `SELECT em.user_id, p.full_name AS name, p.avatar_url, em.role, em.joined_at
     FROM event_members em
     LEFT JOIN profiles p ON p.user_id = em.user_id
     WHERE em.event_id = $1
     ORDER BY em.joined_at ASC`,
    [eventId],
  );

  return {
    event: formatEvent(e),
    members: membersResult.rows.map((m) => ({
      userId: m.user_id,
      name: m.name,
      avatarUrl: m.avatar_url,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    stats: {
      memberCount: e.member_count,
      photoVideoCount: e.photo_video_count,
      docCount: e.doc_count,
      totalExpenseAmount: parseFloat(e.total_expense_amount),
    },
  };
};

// ─── Update Event ─────────────────────────────────────────────────────────────

const updateEvent = async (eventId, updates) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.name !== undefined)             { fields.push(`name = $${idx++}`);          values.push(updates.name); }
  if (updates.eventDate !== undefined)        { fields.push(`event_date = $${idx++}`);    values.push(updates.eventDate); }
  if (updates.eventType !== undefined)        { fields.push(`event_type = $${idx++}`);    values.push(updates.eventType); }
  if (updates.description !== undefined)      { fields.push(`description = $${idx++}`);   values.push(updates.description); }
  if (updates.location?.name !== undefined)   { fields.push(`location_name = $${idx++}`); values.push(updates.location.name); }
  if (updates.location?.lat !== undefined)    { fields.push(`location_lat = $${idx++}`);  values.push(updates.location.lat); }
  if (updates.location?.lng !== undefined)    { fields.push(`location_lng = $${idx++}`);  values.push(updates.location.lng); }

  if (fields.length === 0) {
    const existing = await db('SELECT * FROM events WHERE id = $1', [eventId]);
    return formatEvent(existing.rows[0]);
  }

  values.push(eventId);
  const result = await db(
    `UPDATE events SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values,
  );

  const event = result.rows[0];

  // Reschedule reminders if eventDate changed
  if (updates.eventDate) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM event_reminders WHERE event_id = $1 AND sent_at IS NULL', [eventId]);
      const start = new Date(updates.eventDate);
      start.setUTCHours(3, 30, 0, 0);
      const remindersToCreate = [
        { type: 'event_start',  date: new Date(start) },
        { type: '1_day_before', date: new Date(start.getTime() - 86400000) },
      ];
      for (const r of remindersToCreate) {
        if (r.date > new Date()) {
          await client.query(
            'INSERT INTO event_reminders (event_id, reminder_type, scheduled_at) VALUES ($1, $2, $3)',
            [event.id, r.type, r.date.toISOString()],
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

  return formatEvent(event);
};

// ─── Delete Event ─────────────────────────────────────────────────────────────

const deleteEvent = async (eventId) => {
  // 1. Get S3 keys for docs and photos
  const [docsResult, photosResult] = await Promise.all([
    db("SELECT s3_key FROM docs WHERE parent_type = 'event' AND parent_id = $1", [eventId]),
    db("SELECT s3_key FROM photos WHERE parent_type = 'event' AND parent_id = $1", [eventId]),
  ]);

  const s3Keys = [
    ...docsResult.rows.map((r) => r.s3_key),
    ...photosResult.rows.map((r) => r.s3_key),
  ];

  // 2. Batch delete from S3
  if (s3Keys.length > 0) await batchDeleteFromS3(s3Keys);

  // 3. Delete shared table rows explicitly (no FK to events)
  await db("DELETE FROM docs     WHERE parent_type = 'event' AND parent_id = $1", [eventId]);
  await db("DELETE FROM photos   WHERE parent_type = 'event' AND parent_id = $1", [eventId]);
  await db("DELETE FROM expenses WHERE parent_type = 'event' AND parent_id = $1", [eventId]);
  await db("DELETE FROM polls    WHERE parent_type = 'event' AND parent_id = $1", [eventId]);
  await db("DELETE FROM notes    WHERE parent_type = 'event' AND parent_id = $1", [eventId]);

  // 4. Delete event (cascades event_members, event_invites, event_reminders)
  await db('DELETE FROM events WHERE id = $1', [eventId]);
};

// ─── Invite Members — friend vs non-friend flow ───────────────────────────────

const inviteToEvent = async (eventId, invitedBy, { friendIds = [], emails = [] }) => {
  const inviterResult = await db(
    'SELECT p.full_name FROM profiles p WHERE p.user_id = $1',
    [invitedBy],
  );
  const inviterName = inviterResult.rows[0]?.full_name || 'A fellow organiser';

  const eventResult = await db('SELECT name FROM events WHERE id = $1', [eventId]);
  if (eventResult.rowCount === 0) {
    const e = new Error('Event not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  const eventName = eventResult.rows[0].name;

  const added = [];
  const invited = [];
  const skipped = [];

  // ── Path A: friendIds — direct add ──────────────────────────
  for (const friendId of friendIds) {
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

    const insertResult = await db(
      `INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [eventId, friendId],
    );

    if (insertResult.rowCount === 0) {
      skipped.push({ userId: friendId, reason: 'already_member' });
      continue;
    }

    const profile = await db('SELECT full_name AS name FROM profiles WHERE user_id = $1', [friendId]);
    const fcmResult = await db('SELECT fcm_token FROM users WHERE id = $1', [friendId]);
    const fcmToken = fcmResult.rows[0]?.fcm_token;

    if (fcmToken) {
      sendFCMNotification(
        fcmToken,
        {
          title: `${eventName} — ${inviterName} added you!`,
          body: 'Open GatherGo to see the event',
        },
        { type: 'EVENT_MEMBER_ADDED', eventId, screen: 'events' },
      ).catch((err) => logger.error('FCM push failed', { err: err.message }));
    }

    added.push({ userId: friendId, name: profile.rows[0]?.name || null, method: 'direct' });
  }

  // ── Path B: emails ───────────────────────────────────────────
  for (const email of emails) {
    try {
      // Check if a GatherGo user exists with this email
      const existingUser = await db('SELECT id FROM users WHERE email = $1', [email]);
      const user = existingUser.rows[0] || null;

      if (user) {
        const memberCheck = await db(
          'SELECT 1 FROM event_members WHERE event_id = $1 AND user_id = $2',
          [eventId, user.id],
        );
        if (memberCheck.rowCount > 0) {
          skipped.push({ userId: user.id, reason: 'already_member' });
          continue;
        }

        const friendCheck = await db(
          `SELECT id FROM friend_connections
           WHERE status = 'accepted'
             AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
          [invitedBy, user.id],
        );

        if (friendCheck.rowCount > 0) {
          await db(
            `INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, 'member')
             ON CONFLICT (event_id, user_id) DO NOTHING`,
            [eventId, user.id],
          );
          const profile = await db('SELECT full_name AS name FROM profiles WHERE user_id = $1', [user.id]);
          const fcmResult = await db('SELECT fcm_token FROM users WHERE id = $1', [user.id]);
          const fcmToken = fcmResult.rows[0]?.fcm_token;
          if (fcmToken) {
            sendFCMNotification(
              fcmToken,
              { title: `${eventName} — ${inviterName} added you!`, body: 'Open GatherGo to see the event' },
              { type: 'EVENT_MEMBER_ADDED', eventId, screen: 'events' },
            ).catch((err) => logger.error('FCM push failed', { err: err.message }));
          }
          added.push({ userId: user.id, name: profile.rows[0]?.name || null, method: 'direct' });
          continue;
        }
        // Not a friend — fall through to Branch invite
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600000);
      let branchUrl = null;

      try {
        branchUrl = await createInviteSmartLink({ token, inviterName, context: eventName, type: 'event' });
      } catch (e) {
        branchUrl = `${config.appDeepLinkBaseUrl || 'https://gathergo.app'}/invite/event/${token}`;
        logger.warn('Branch link failed, using plain URL', { error: e.message });
      }

      await db(
        `INSERT INTO event_invites (event_id, invited_by, email, token, expires_at, branch_url)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (token) DO NOTHING`,
        [eventId, invitedBy, email, token, expiresAt.toISOString(), branchUrl],
      );

      sendEmail({
        to: email,
        subject: `${inviterName} invited you to "${eventName}" on GatherGo`,
        html: buildInviteEmail({ inviterName, eventName, deepLink: branchUrl, expiresAt }),
        text: `${inviterName} invited you to join "${eventName}". Accept: ${branchUrl}`,
      }).catch((err) => logger.error('SES invite email failed', { email, error: err.message }));

      invited.push({ email, branchUrl, expiresAt: expiresAt.toISOString() });
    } catch (err) {
      logger.error('Failed to process event invite', { email, error: err.message });
    }
  }

  return { added, invited, skipped };
};

// ─── Token-based invite ───────────────────────────────────────────────────────

const getEventInviteByToken = async (token) => {
  const result = await db(
    `SELECT
       ei.*,
       e.name AS event_name,
       p.full_name AS inviter_name
     FROM event_invites ei
     JOIN events e ON e.id = ei.event_id
     JOIN profiles p ON p.user_id = ei.invited_by
     WHERE ei.token = $1`,
    [token],
  );
  return result.rows[0] || null;
};

const acceptEventInvite = async (token, userId) => {
  const invite = await getEventInviteByToken(token);
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
      `INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [invite.event_id, userId],
    );
    await client.query(
      'UPDATE event_invites SET accepted_at = NOW(), user_id = $1 WHERE token = $2',
      [userId, token],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }

  return { eventId: invite.event_id, eventName: invite.event_name, role: 'member' };
};

// ─── Members ──────────────────────────────────────────────────────────────────

const getEventMembers = async (eventId) => {
  const result = await db(
    `SELECT em.user_id, em.role, em.joined_at,
            p.full_name AS name, p.avatar_url,
            u.email
     FROM event_members em
     LEFT JOIN profiles p ON p.user_id = em.user_id
     LEFT JOIN users u ON u.id = em.user_id
     WHERE em.event_id = $1
     ORDER BY em.joined_at ASC`,
    [eventId],
  );

  const members = result.rows.map((m) => ({
    userId: m.user_id,
    fullName: m.name,
    email: m.email,
    avatarUrl: m.avatar_url,
    role: m.role,
    joinedAt: m.joined_at,
  }));

  const adminCount = members.filter((m) => m.role === 'admin').length;
  return { members, total: members.length, adminCount };
};

const removeEventMember = async (eventId, targetUserId) => {
  const memberResult = await db(
    'SELECT * FROM event_members WHERE event_id = $1 AND user_id = $2',
    [eventId, targetUserId],
  );
  if (memberResult.rowCount === 0) {
    const e = new Error('Member not found in this event'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  const adminCountResult = await db(
    `SELECT COUNT(*) FROM event_members WHERE event_id = $1 AND role = 'admin'`,
    [eventId],
  );
  const adminCount = parseInt(adminCountResult.rows[0].count, 10);

  if (memberResult.rows[0].role === 'admin' && adminCount <= 1) {
    const e = new Error('Cannot remove the last admin from an event');
    e.statusCode = 422; e.error = 'LAST_ADMIN'; throw e;
  }

  await db('DELETE FROM event_members WHERE event_id = $1 AND user_id = $2', [eventId, targetUserId]);

  await db(
    `DELETE FROM event_invites
     WHERE event_id = $1 AND (user_id = $2 OR email = (
       SELECT email FROM users WHERE id = $2
     )) AND accepted_at IS NULL`,
    [eventId, targetUserId],
  );
};

// ─── Description ─────────────────────────────────────────────────────────────

const setEventDescription = async (eventId, description) => {
  const result = await db(
    `UPDATE events SET description = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [description ?? null, eventId],
  );
  if (result.rowCount === 0) {
    const e = new Error('Event not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }
  return formatEvent(result.rows[0]);
};

// ─── Archive ──────────────────────────────────────────────────────────────────

const archiveEvent = async (eventId) => {
  const result = await db(
    `UPDATE events SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND archived_at IS NULL RETURNING *`,
    [eventId],
  );
  if (result.rowCount === 0) {
    const existing = await db('SELECT archived_at FROM events WHERE id = $1', [eventId]);
    if (existing.rowCount === 0) {
      const e = new Error('Event not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
    }
    const e = new Error('Event is already archived'); e.statusCode = 409; e.error = 'CONFLICT'; throw e;
  }
  return formatEvent(result.rows[0]);
};

const unarchiveEvent = async (eventId) => {
  const result = await db(
    `UPDATE events SET archived_at = NULL, updated_at = NOW() WHERE id = $1 AND archived_at IS NOT NULL RETURNING *`,
    [eventId],
  );
  if (result.rowCount === 0) {
    const existing = await db('SELECT archived_at FROM events WHERE id = $1', [eventId]);
    if (existing.rowCount === 0) {
      const e = new Error('Event not found'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
    }
    const e = new Error('Event is not archived'); e.statusCode = 409; e.error = 'CONFLICT'; throw e;
  }
  return formatEvent(result.rows[0]);
};

// ─── Email template ───────────────────────────────────────────────────────────

const buildInviteEmail = ({ inviterName, eventName, deepLink, expiresAt }) =>
  wrapEmail(`
    <h2 style="margin:0 0 10px 0; font-size:22px; font-weight:700; color:#111827;">
      You&rsquo;re invited!
    </h2>
    <p style="margin:0 0 28px 0; font-size:15px; color:#374151; line-height:1.65;">
      <strong>${inviterName}</strong> has invited you to join
      <strong>&ldquo;${eventName}&rdquo;</strong> on Gatherrgo.
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

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  setEventDescription,
  archiveEvent,
  unarchiveEvent,
  inviteToEvent,
  getEventInviteByToken,
  acceptEventInvite,
  getEventMembers,
  removeEventMember,
};
