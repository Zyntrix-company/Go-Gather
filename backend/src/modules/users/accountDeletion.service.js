const { query: db, getClient } = require('../../config/database');
const { batchDeleteFromS3 } = require('../../utils/s3.util');
const { DELETED_EMAIL_DOMAIN } = require('../../utils/email.util');
const logger = require('../../utils/logger');
const tripsService = require('../trips/trips.service');
const eventsService = require('../events/events.service');
const apple = require('../auth/apple');

// Shown wherever the user still appears in shared trips/events (expenses, photos, notes).
const DELETED_USER_NAME = 'Deleted user';

/**
 * Groups the user administers must not be left ownerless: hand them to the
 * longest-standing remaining member, or delete the group if nobody else is in it.
 */
const handOverGroups = async (userId, { table, memberTable, fkCol, deleteGroup }) => {
  const { rows: groups } = await db(
    `SELECT g.id, g.created_by
       FROM ${table} g
      WHERE g.created_by = $1
         OR EXISTS (SELECT 1 FROM ${memberTable} m
                     WHERE m.${fkCol} = g.id AND m.user_id = $1 AND m.role = 'admin')`,
    [userId],
  );

  for (const group of groups) {
    const { rows: others } = await db(
      `SELECT m.user_id, m.role
         FROM ${memberTable} m
         JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
        WHERE m.${fkCol} = $1 AND m.user_id <> $2
        ORDER BY m.joined_at ASC`,
      [group.id, userId],
    );

    if (others.length === 0) {
      await deleteGroup(group.id);
      continue;
    }

    let heir = others.find((m) => m.role === 'admin');
    if (!heir) {
      heir = others[0];
      await db(
        `UPDATE ${memberTable} SET role = 'admin' WHERE ${fkCol} = $1 AND user_id = $2`,
        [group.id, heir.user_id],
      );
    }
    if (group.created_by === userId) {
      await db(`UPDATE ${table} SET created_by = $1 WHERE id = $2`, [heir.user_id, group.id]);
    }
  }
};

const avatarKeyFromUrl = (url) => {
  if (!url) return null;
  try {
    const key = new URL(url).pathname.replace(/^\//, '');
    return key.startsWith('avatars/') ? key : null;
  } catch {
    return null;
  }
};

/**
 * Permanently delete a user's account (App Store Guideline 5.1.1(v)).
 *
 * Personal data is removed outright. The users row itself is anonymized rather
 * than dropped, because shared trip/event content (expenses, settlements, photos,
 * notes) references it without ON DELETE CASCADE and must stay intact for the
 * other members — it now shows as "Deleted user".
 */
const deleteUserAccount = async (userId) => {
  const { rows } = await db(
    `SELECT u.id, u.deleted_at, u.is_platform_admin, u.apple_refresh_token, p.avatar_url
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  const user = rows[0];
  if (!user || user.deleted_at) {
    const err = new Error('Account not found');
    err.statusCode = 404;
    err.error = 'UserNotFound';
    throw err;
  }
  if (user.is_platform_admin) {
    const err = new Error('Platform admin accounts cannot be deleted from the app.');
    err.statusCode = 400;
    err.error = 'PlatformAdmin';
    throw err;
  }

  await handOverGroups(userId, {
    table: 'trips',
    memberTable: 'trip_members',
    fkCol: 'trip_id',
    deleteGroup: (id) => tripsService.deleteTrip(id, userId),
  });
  await handOverGroups(userId, {
    table: 'events',
    memberTable: 'event_members',
    fkCol: 'event_id',
    deleteGroup: (id) => eventsService.deleteEvent(id),
  });

  const { rows: albums } = await db('SELECT id FROM user_gallery_albums WHERE user_id = $1', [userId]);
  const albumIds = albums.map((a) => a.id);

  const [personalDocs, albumPhotos, extraPhotos] = await Promise.all([
    db("SELECT s3_key FROM docs WHERE parent_type = 'user' AND parent_id = $1", [userId]),
    db("SELECT s3_key FROM photos WHERE parent_type = 'gallery_album' AND parent_id = ANY($1::uuid[])", [albumIds]),
    db('SELECT s3_key FROM user_gallery_extra_photos WHERE user_id = $1', [userId]),
  ]);
  const s3Keys = [
    ...personalDocs.rows.map((r) => r.s3_key),
    ...albumPhotos.rows.map((r) => r.s3_key),
    ...extraPhotos.rows.map((r) => r.s3_key),
    avatarKeyFromUrl(user.avatar_url),
  ].filter(Boolean);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Personal content
    await client.query("DELETE FROM docs WHERE parent_type = 'user' AND parent_id = $1", [userId]);
    for (const table of ['photos', 'gallery_item_likes', 'gallery_item_comments']) {
      await client.query(
        `DELETE FROM ${table} WHERE parent_type = 'gallery_album' AND parent_id = ANY($1::uuid[])`,
        [albumIds],
      );
    }

    // Everything keyed to the user that has no value to anyone else
    for (const table of [
      'user_gallery_albums',
      'user_gallery_extra_photos',
      'user_gallery_hidden_photos',
      'user_gallery_item_meta',
      'gallery_item_likes',
      'refresh_tokens',
      'otps',
      'email_oauth_tokens',
      'notifications',
      'activity_reminders',
      'notification_batch_queue',
      'trip_notification_mutes',
      'section_views',
      'note_favorites',
      'ai_conversations',
      'feedback',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    }
    await client.query(
      'DELETE FROM friend_connections WHERE requester_id = $1 OR addressee_id = $1',
      [userId],
    );
    await client.query('DELETE FROM friend_invites WHERE invited_by = $1', [userId]);
    await client.query("DELETE FROM trip_invites WHERE user_id = $1 AND status = 'pending'", [userId]);
    await client.query("DELETE FROM event_invites WHERE user_id = $1 AND status = 'pending'", [userId]);

    const placeholderEmail = `deleted-${userId}@${DELETED_EMAIL_DOMAIN}`;
    await client.query(
      `UPDATE users SET
         email = $1, email_normalized = $1, phone = NULL, username = NULL,
         password_hash = NULL, google_id = NULL, facebook_id = NULL,
         apple_id = NULL, apple_refresh_token = NULL,
         fcm_token = NULL, sns_endpoint_arn = NULL, is_verified = false,
         deleted_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [placeholderEmail, userId],
    );
    await client.query(
      `UPDATE profiles SET full_name = $1, avatar_url = NULL, dob = NULL,
         gender = NULL, country = NULL, bio = NULL
       WHERE user_id = $2`,
      [DELETED_USER_NAME, userId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Files go after the commit: a failed S3 call must not resurrect the account.
  try {
    await batchDeleteFromS3(s3Keys);
  } catch (err) {
    logger.error('Account deletion: S3 cleanup failed', { userId, count: s3Keys.length, error: err.message });
  }

  // Apple requires revoking the Sign in with Apple grant when the account goes.
  if (user.apple_refresh_token) {
    try {
      const { decrypt } = require('../../utils/encrypt.util');
      await apple.revokeRefreshToken(decrypt(user.apple_refresh_token));
    } catch (err) {
      logger.error('Account deletion: Apple token revocation failed', { userId, error: err.message });
    }
  }

  logger.info('User account deleted', { userId });
};

module.exports = { deleteUserAccount, DELETED_USER_NAME };
