const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Get personalised home dashboard data for the authenticated user.
 * Uses a single efficient set of queries (no N+1).
 * M4: adds pendingFriendRequests count via subquery.
 */
const getHomeDashboard = async (userId) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // ── Upcoming trips (startDate > today), with member avatars ──
  const upcomingTripsResult = await query(`
    SELECT
      t.id,
      t.name,
      t.location_name       AS location,
      t.start_date          AS "startDate",
      t.end_date            AS "endDate",
      t.cover_photo_url     AS "coverPhotoUrl",
      (t.start_date::date - CURRENT_DATE) AS "daysToGo",
      COALESCE(
        (
          SELECT json_agg(avatar)
          FROM (
            SELECT json_build_object(
              'id', tm2.user_id::text,
              'uri', COALESCE(
                CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url NOT LIKE 'https://undefined/%' AND p.avatar_url NOT LIKE '%/undefined%' THEN p.avatar_url ELSE NULL END,
                'https://i.pravatar.cc/150?u=' || tm2.user_id::text
              )
            ) AS avatar
            FROM trip_members tm2
            JOIN profiles p ON p.user_id = tm2.user_id
            WHERE tm2.trip_id = t.id
            LIMIT 5
          ) avatars
        ),
        '[]'::json
      ) AS "memberAvatars"
    FROM trips t
    JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
    WHERE t.start_date > $2::date
    ORDER BY t.start_date ASC
    LIMIT 10
  `, [userId, today]);

  // ── Ongoing trip (startDate <= today <= endDate), prioritise trips ──
  const ongoingResult = await query(`
    SELECT
      t.id,
      t.name,
      t.location_name AS location,
      t.end_date      AS "endDate",
      'trip'          AS type
    FROM trips t
    JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
    WHERE t.start_date <= $2::date AND t.end_date >= $2::date
    ORDER BY t.start_date ASC
    LIMIT 1
  `, [userId, today]);

  // ── User info + pending friend requests count (single query) ──
  const userResult = await query(`
    SELECT
      u.id,
      p.full_name AS name,
      p.avatar_url AS "avatarUrl",
      (
        SELECT COUNT(*)::int
        FROM friend_connections
        WHERE addressee_id = $1 AND status = 'pending'
      ) AS "pendingFriendRequests"
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = $1
  `, [userId]);

  const userRow = userResult.rows[0] || { id: userId, name: null, avatarUrl: null, pendingFriendRequests: 0 };

  const user = {
    id: userRow.id,
    name: userRow.name,
    avatarUrl: userRow.avatarUrl,
  };

  const upcomingTrips = upcomingTripsResult.rows.map((t) => ({
    ...t,
    daysToGo: Math.max(0, parseInt(t.daysToGo, 10)),
    memberAvatars: t.memberAvatars || [],
  }));

  const ongoing = ongoingResult.rows[0] || null;

  return {
    user,
    upcomingTrips,
    upcomingEvents: [], // M3 will populate this
    ongoing,
    pendingFriendRequests: userRow.pendingFriendRequests || 0,
  };
};

module.exports = { getHomeDashboard };
