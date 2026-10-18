const { query: db } = require('../../config/database');
const invitesService = require('../invites/invites.service');
const friendsService = require('../friends/friends.service');
const { normalizeAvatarUrl } = require('../../utils/avatarUrl.util');
const { presignOwnBanner } = require('../../utils/banner.util');

// ─── Incoming requests (friend + trip + event) ────────────────────────────────
//
// One call backs the Requests tab. Every item carries the id needed to act on it:
// friend → connectionId, trip/event → the invite id.

const getIncomingRequests = async (userId) => {
  const [friends, trips, events] = await Promise.all([
    db(
      `SELECT fc.id, fc.created_at, fc.requester_id,
              p.full_name AS inviter_name, p.avatar_url AS inviter_avatar
       FROM friend_connections fc
       LEFT JOIN profiles p ON p.user_id = fc.requester_id
       WHERE fc.addressee_id = $1 AND fc.status = 'pending'
       ORDER BY fc.created_at DESC`,
      [userId],
    ),
    db(
      `SELECT ti.id, ti.created_at, ti.expires_at, ti.trip_id, ti.invited_by,
              t.name AS context_name, t.location_name, t.start_date, t.end_date,
              p.full_name AS inviter_name, p.avatar_url AS inviter_avatar
       FROM trip_invites ti
       JOIN trips t ON t.id = ti.trip_id
       LEFT JOIN profiles p ON p.user_id = ti.invited_by
       WHERE ti.user_id = $1
         AND ti.status = 'pending'
         AND ti.expires_at > NOW()
         AND NOT EXISTS (
           SELECT 1 FROM trip_members tm WHERE tm.trip_id = ti.trip_id AND tm.user_id = $1
         )
       ORDER BY ti.created_at DESC`,
      [userId],
    ),
    db(
      `SELECT ei.id, ei.created_at, ei.expires_at, ei.event_id, ei.invited_by,
              e.name AS context_name, e.location_name, e.event_date,
              p.full_name AS inviter_name, p.avatar_url AS inviter_avatar
       FROM event_invites ei
       JOIN events e ON e.id = ei.event_id
       LEFT JOIN profiles p ON p.user_id = ei.invited_by
       WHERE ei.user_id = $1
         AND ei.status = 'pending'
         AND ei.expires_at > NOW()
         AND NOT EXISTS (
           SELECT 1 FROM event_members em WHERE em.event_id = ei.event_id AND em.user_id = $1
         )
       ORDER BY ei.created_at DESC`,
      [userId],
    ),
  ]);

  const fromUser = (row, id) => ({
    id,
    name: row.inviter_name || null,
    avatarUrl: normalizeAvatarUrl(row.inviter_avatar),
  });

  const items = [
    ...friends.rows.map((r) => ({
      id: r.id,
      type: 'friend',
      from: fromUser(r, r.requester_id),
      context: null,
      createdAt: r.created_at,
      expiresAt: null,
    })),
    ...trips.rows.map((r) => ({
      id: r.id,
      type: 'trip',
      from: fromUser(r, r.invited_by),
      context: {
        tripId: r.trip_id,
        name: r.context_name,
        locationName: r.location_name,
        startDate: r.start_date,
        endDate: r.end_date,
      },
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })),
    ...events.rows.map((r) => ({
      id: r.id,
      type: 'event',
      from: fromUser(r, r.invited_by),
      context: {
        eventId: r.event_id,
        name: r.context_name,
        locationName: r.location_name,
        // Events are single-day (migration 014 collapsed start/end into event_date),
        // but the requests payload keeps the trip-shaped range so one card renders both.
        startDate: r.event_date,
        endDate: r.event_date,
      },
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { requests: items, total: items.length };
};

// ─── Respond ──────────────────────────────────────────────────────────────────

const respondToRequest = async (userId, type, id, action) => {
  const approve = action === 'approve';

  if (type === 'friend') {
    const result = await friendsService.respondFriendRequest(
      userId,
      id,
      approve ? 'accept' : 'decline',
    );
    return { type: 'friend', id, status: result.status, friend: result.friend || null };
  }

  if (type === 'trip') {
    if (!approve) {
      await invitesService.declineTripInvite(id, userId);
      return { type: 'trip', id, status: 'declined' };
    }
    const result = await invitesService.acceptTripInvite({ inviteId: id }, userId);
    return { type: 'trip', id, status: 'accepted', tripId: result.tripId, name: result.tripName };
  }

  if (type === 'event') {
    if (!approve) {
      await invitesService.declineEventInvite(id, userId);
      return { type: 'event', id, status: 'declined' };
    }
    const result = await invitesService.acceptEventInvite({ inviteId: id }, userId);
    return { type: 'event', id, status: 'accepted', eventId: result.eventId, name: result.eventName };
  }

  const err = new Error('Unknown request type');
  err.statusCode = 400;
  err.error = 'INVALID_TYPE';
  throw err;
};

// ─── Preview (invite popup) ───────────────────────────────────────────────────
//
// Details for the popup shown over the Requests tab: what the trip/event is, who
// invited you and who is already in. Only the request's own invitee may read it, and
// only while it is still pending — you are not a member yet.

const PREVIEW_MEMBER_CAP = 12;

// Table and column names come from this constant, never from the request.
const PREVIEW = {
  trip: {
    invites: 'trip_invites', col: 'trip_id', parents: 'trips', members: 'trip_members',
    dates: 'p.start_date AS start_date, p.end_date AS end_date',
    banner: 'COALESCE(p.banner_image_url, p.cover_photo_url)',
  },
  event: {
    invites: 'event_invites', col: 'event_id', parents: 'events', members: 'event_members',
    // Events are single-day (migration 014).
    dates: 'p.event_date AS start_date, p.event_date AS end_date',
    banner: 'p.banner_image_url',
  },
};

const getRequestPreview = async (userId, type, id) => {
  const cfg = PREVIEW[type];
  if (!cfg) {
    const err = new Error('Unknown request type');
    err.statusCode = 400;
    err.error = 'INVALID_TYPE';
    throw err;
  }

  const header = await db(
    `SELECT i.${cfg.col} AS parent_id, i.invited_by,
            p.name, ${cfg.dates}, p.location_name, ${cfg.banner} AS banner_url,
            pr.full_name AS inviter_name, pr.avatar_url AS inviter_avatar
     FROM ${cfg.invites} i
     JOIN ${cfg.parents} p ON p.id = i.${cfg.col}
     LEFT JOIN profiles pr ON pr.user_id = i.invited_by
     WHERE i.id = $1 AND i.user_id = $2 AND i.status = 'pending' AND i.expires_at > NOW()`,
    [id, userId],
  );
  const row = header.rows[0];
  if (!row) {
    const err = new Error('Request not found, already responded to, or not yours');
    err.statusCode = 404;
    err.error = 'NOT_FOUND';
    throw err;
  }

  const [members, count] = await Promise.all([
    db(
      `SELECT m.user_id AS id, pr.full_name AS name, pr.avatar_url
       FROM ${cfg.members} m
       LEFT JOIN profiles pr ON pr.user_id = m.user_id
       WHERE m.${cfg.col} = $1
       ORDER BY m.joined_at ASC
       LIMIT ${PREVIEW_MEMBER_CAP}`,
      [row.parent_id],
    ),
    db(`SELECT COUNT(*)::int AS n FROM ${cfg.members} WHERE ${cfg.col} = $1`, [row.parent_id]),
  ]);

  return {
    type,
    id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    locationName: row.location_name || null,
    bannerImageUrl: await presignOwnBanner(row.banner_url),
    inviter: {
      id: row.invited_by,
      name: row.inviter_name || null,
      avatarUrl: normalizeAvatarUrl(row.inviter_avatar),
    },
    members: members.rows.map((m) => ({
      id: m.id,
      name: m.name || null,
      avatarUrl: normalizeAvatarUrl(m.avatar_url),
    })),
    memberCount: count.rows[0]?.n ?? members.rows.length,
  };
};

module.exports = { getIncomingRequests, getRequestPreview, respondToRequest };
