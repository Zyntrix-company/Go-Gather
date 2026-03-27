const { query: db } = require('../../../../config/database');
const logger = require('../../../../utils/logger');

const getMembers = async (tripId) => {
  const result = await db(
    `SELECT tm.user_id, tm.role, tm.joined_at,
            p.full_name AS name, p.avatar_url,
            u.email
     FROM trip_members tm
     LEFT JOIN profiles p ON p.user_id = tm.user_id
     LEFT JOIN users u ON u.id = tm.user_id
     WHERE tm.trip_id = $1
     ORDER BY tm.joined_at ASC`,
    [tripId],
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

const removeMember = async (tripId, targetUserId, requesterId) => {
  const memberResult = await db(
    'SELECT * FROM trip_members WHERE trip_id = $1 AND user_id = $2',
    [tripId, targetUserId],
  );
  if (memberResult.rowCount === 0) {
    const e = new Error('Member not found in this trip'); e.statusCode = 404; e.error = 'NOT_FOUND'; throw e;
  }

  const adminCountResult = await db(
    `SELECT COUNT(*) FROM trip_members WHERE trip_id = $1 AND role = 'admin'`,
    [tripId],
  );
  const adminCount = parseInt(adminCountResult.rows[0].count, 10);

  if (memberResult.rows[0].role === 'admin' && adminCount <= 1) {
    const e = new Error('Cannot remove the last admin from a trip');
    e.statusCode = 422; e.error = 'LAST_ADMIN'; throw e;
  }

  await db('DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2', [tripId, targetUserId]);

  await db(
    `DELETE FROM trip_invites
     WHERE trip_id = $1 AND (user_id = $2 OR email = (
       SELECT email FROM users WHERE id = $2
     )) AND accepted_at IS NULL`,
    [tripId, targetUserId],
  );
};

module.exports = { getMembers, removeMember };
